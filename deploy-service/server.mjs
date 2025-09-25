import { createServer } from 'node:http';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { spawn } from 'node:child_process';
import { URL } from 'node:url';

const secret = process.env.GITHUB_WEBHOOK_SECRET;
if (!secret) {
  throw new Error('GITHUB_WEBHOOK_SECRET must be defined');
}

const targetBranch = process.env.TARGET_BRANCH ?? 'main';
const webhookPath = process.env.WEBHOOK_PATH ?? '/webhook';
const listenPort = Number.parseInt(process.env.LISTEN_PORT ?? process.env.PORT ?? '3000', 10);
const healthPath = `${webhookPath.endsWith('/') ? webhookPath.slice(0, -1) : webhookPath}/health`;

let deploymentQueue = Promise.resolve();
let lastStatus = {
  ok: true,
  message: 'ready',
  finishedAt: null,
};

function headerToString(header) {
  if (!header) {
    return undefined;
  }
  return Array.isArray(header) ? header[0] : header;
}

function verifySignature(signatureHeader, payloadBuffer) {
  if (!signatureHeader) {
    return false;
  }
  const expected = createHmac('sha256', secret).update(payloadBuffer).digest('hex');
  const expectedHeader = Buffer.from(`sha256=${expected}`);
  const actualHeader = Buffer.from(signatureHeader);
  if (expectedHeader.length !== actualHeader.length) {
    return false;
  }
  return timingSafeEqual(expectedHeader, actualHeader);
}

function runDeployment(reason) {
  return new Promise((resolve, reject) => {
    console.log(`[webhook] Triggered deployment: ${reason}`);
    lastStatus = {
      ok: true,
      message: 'in_progress',
      finishedAt: null,
    };
    const child = spawn('/app/deploy.sh', {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env,
    });

    child.stdout.on('data', (chunk) => {
      process.stdout.write(chunk);
    });
    child.stderr.on('data', (chunk) => {
      process.stderr.write(chunk);
    });

    child.on('close', (code) => {
      if (code === 0) {
        console.log('[webhook] Deployment finished successfully');
        lastStatus = {
          ok: true,
          message: 'success',
          finishedAt: new Date().toISOString(),
        };
        resolve();
      } else {
        const error = new Error(`Deployment exited with status ${code}`);
        lastStatus = {
          ok: false,
          message: error.message,
          finishedAt: new Date().toISOString(),
        };
        reject(error);
      }
    });
  });
}

function enqueueDeployment(reason) {
  deploymentQueue = deploymentQueue
    .catch(() => undefined)
    .then(() => runDeployment(reason));
  return deploymentQueue;
}

function respondJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
  });
  res.end(payload);
}

const server = createServer((req, res) => {
  const { method } = req;
  const url = new URL(req.url ?? '/', 'http://localhost');

  if (method === 'GET' && (url.pathname === '/healthz' || url.pathname === healthPath)) {
    respondJson(res, 200, { status: 'ok', lastStatus });
    return;
  }

  if (method !== 'POST' || url.pathname !== webhookPath) {
    respondJson(res, 404, { error: 'not_found' });
    return;
  }

  const signatureHeader = headerToString(req.headers['x-hub-signature-256']);
  const eventType = req.headers['x-github-event'];

  const chunks = [];
  req.on('data', (chunk) => {
    chunks.push(chunk);
  });
  req.on('error', (error) => {
    console.error('[webhook] Failed to read request body', error);
    respondJson(res, 500, { error: 'read_error' });
  });
  req.on('end', () => {
    if (res.writableEnded) {
      return;
    }
    const buffer = Buffer.concat(chunks);

    if (!verifySignature(signatureHeader, buffer)) {
      respondJson(res, 401, { error: 'invalid_signature' });
      return;
    }

    if (eventType === 'ping') {
      respondJson(res, 200, { status: 'pong' });
      return;
    }

    if (eventType !== 'push') {
      respondJson(res, 202, { status: 'ignored', reason: `event ${eventType} unsupported` });
      return;
    }

    let payload;
    try {
      payload = JSON.parse(buffer.toString('utf8'));
    } catch (error) {
      console.warn('[webhook] Unable to parse webhook payload', error);
      respondJson(res, 400, { error: 'invalid_json' });
      return;
    }

    if (payload.ref !== `refs/heads/${targetBranch}`) {
      respondJson(res, 202, { status: 'ignored', reason: `branch ${payload.ref} does not match target ${targetBranch}` });
      return;
    }

    enqueueDeployment(`push to ${targetBranch}`).catch((error) => {
      console.error('[webhook] Deployment failed', error);
    });

    respondJson(res, 202, { status: 'queued' });
  });
});

server.listen(listenPort, () => {
  console.log(
    `[webhook] Listening on 0.0.0.0:${listenPort}, path ${webhookPath}, health ${healthPath}`,
  );
});
