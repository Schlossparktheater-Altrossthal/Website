import http from 'node:http';
import process from 'node:process';
import { spawn } from 'node:child_process';
import httpProxy from 'http-proxy';

function parsePort(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

async function main() {
  const proxyPort = parsePort(process.env.PORT ?? process.env.PROXY_PORT ?? 3000, 3000);
  const proxyHost =
    process.env.PROXY_HOST?.trim() ||
    process.env.APP_PROXY_HOST?.trim() ||
    process.env.HOST?.trim() ||
    '0.0.0.0';
  const appHost = process.env.APP_HOST?.trim() || process.env.APP_BIND_HOST?.trim() || '127.0.0.1';
  const appPort = parsePort(process.env.APP_SERVER_PORT ?? process.env.APP_PORT ?? proxyPort + 1, proxyPort + 1);

  if (!Number.isFinite(proxyPort) || proxyPort <= 0) {
    throw new Error(`Invalid proxy port: ${process.env.PORT}`);
  }
  if (!Number.isFinite(appPort) || appPort <= 0) {
    throw new Error(`Invalid application port: ${process.env.APP_SERVER_PORT ?? process.env.APP_PORT}`);
  }

  const targetUrl = `http://${appHost}:${appPort}`;
  const childEnv = {
    ...process.env,
    PORT: String(appPort),
    APP_PORT: String(appPort),
    APP_HOST: appHost,
    APP_BIND_HOST: appHost,
  };
  if (!childEnv.REALTIME_INTERNAL_ORIGIN) {
    childEnv.REALTIME_INTERNAL_ORIGIN = targetUrl;
  }

  console.log(`[Proxy] Launching combined application server on ${targetUrl}`);
  const child = spawn(process.execPath, ['scripts/start-combined-server.mjs'], {
    env: childEnv,
    stdio: 'inherit',
  });

  let shuttingDown = false;
  let plannedExitCode = 0;
  let serverClosed = false;
  let childExited = false;

  const proxy = httpProxy.createProxyServer({
    target: targetUrl,
    ws: true,
    xfwd: true,
  });

  proxy.on('error', (error, req, res) => {
    if (shuttingDown) return;
    console.error('[Proxy] Error while proxying request', error);

    if (res) {
      const canWriteHead = typeof res.writeHead === 'function';
      const canEnd = typeof res.end === 'function';
      const canDestroy = typeof res.destroy === 'function';

      if (canWriteHead && !res.headersSent) {
        res.writeHead(502, { 'Content-Type': 'text/plain' });
      }
      if (canEnd && !res.writableEnded) {
        res.end('Bad Gateway');
        return;
      }
      if (!canEnd && canDestroy) {
        res.destroy();
        return;
      }
    }

    if (req && typeof req.destroy === 'function') {
      req.destroy();
    }
  });

  const server = http.createServer((req, res) => {
    proxy.web(req, res, { target: targetUrl });
  });

  server.on('upgrade', (req, socket, head) => {
    proxy.ws(req, socket, head, { target: targetUrl });
  });

  server.on('error', (error) => {
    if (shuttingDown) return;
    console.error('[Proxy] HTTP server error', error);
  });

  const markServerClosed = () => {
    serverClosed = true;
    maybeExit();
  };

  server.listen(proxyPort, proxyHost, () => {
    const displayHost = ['0.0.0.0', '::', '::0'].includes(proxyHost) ? '0.0.0.0' : proxyHost;
    console.log(`[Proxy] Listening on http://${displayHost}:${proxyPort} and proxying to ${targetUrl}`);
  });

  function maybeExit() {
    if (serverClosed && childExited) {
      process.exit(plannedExitCode);
    }
  }

  function initiateShutdown(signal, exitCode = 0) {
    if (shuttingDown) return;
    shuttingDown = true;
    plannedExitCode = exitCode;
    console.log(`[Proxy] Received ${signal}, shutting down`);
    proxy.close();
    server.close(markServerClosed);
    if (!child.killed) {
      child.kill(signal);
    }
  }

  process.on('SIGTERM', () => initiateShutdown('SIGTERM', 0));
  process.on('SIGINT', () => initiateShutdown('SIGINT', 0));

  child.on('exit', (code, signal) => {
    childExited = true;
    if (!shuttingDown) {
      plannedExitCode = code ?? (signal ? 1 : 0);
      if (signal) {
        console.error(`[Proxy] Combined server exited unexpectedly due to signal ${signal}`);
      } else {
        console.error(`[Proxy] Combined server exited unexpectedly with code ${plannedExitCode}`);
      }
      shuttingDown = true;
      proxy.close();
      server.close(markServerClosed);
    } else {
      plannedExitCode = code ?? plannedExitCode;
    }
    maybeExit();
  });
}

main().catch((error) => {
  console.error('[Proxy] Fatal error starting reverse proxy', error);
  process.exit(1);
});
