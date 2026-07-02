import { createServer } from 'http';
import next from 'next';
import process from 'node:process';
import { createRealtimeServer } from '../realtime-server/src/createRealtimeServer.js';

function normalizeBasePath(raw) {
  if (!raw) return '/realtime';
  const trimmed = raw.trim();
  if (!trimmed || trimmed === '/') return '';
  const prefixed = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return prefixed.replace(/\/$/, '');
}

function ensureLeadingSlash(path, fallback = '/socket.io') {
  const value = path && path.trim() ? path : fallback;
  return value.startsWith('/') ? value : `/${value}`;
}

function resolveHostname() {
  const candidates = [
    process.env.APP_HOST,
    process.env.APP_BIND_HOST,
    process.env.BIND_HOST,
    process.env.SERVER_HOST,
    process.env.HOST,
  ];

  for (const candidate of candidates) {
    if (candidate && candidate.trim()) {
      return candidate.trim();
    }
  }

  return '0.0.0.0';
}

async function main() {
  const dev = process.env.NODE_ENV !== 'production';
  const port = Number(process.env.PORT || process.env.APP_PORT || 3000);
  const hostname = resolveHostname();

  const basePath = normalizeBasePath(process.env.REALTIME_BASE_PATH);
  const socketPath = ensureLeadingSlash(
    process.env.NEXT_PUBLIC_REALTIME_PATH || (basePath ? `${basePath}/socket.io` : '/socket.io'),
  );
  const eventPath = ensureLeadingSlash(
    process.env.REALTIME_SERVER_EVENT_PATH || (basePath ? `${basePath}/events` : '/events'),
    basePath ? `${basePath}/events` : '/events',
  );

  process.env.NEXT_PUBLIC_REALTIME_PATH = socketPath;
  process.env.REALTIME_SERVER_EVENT_PATH = eventPath;

  const internalOrigin = (process.env.REALTIME_INTERNAL_ORIGIN || `http://127.0.0.1:${port}`).replace(/\/$/, '');
  if (!process.env.REALTIME_SERVER_URL) {
    process.env.REALTIME_SERVER_URL = `${internalOrigin}${basePath || ''}` || internalOrigin;
  }

  const publicOrigin = process.env.REALTIME_PUBLIC_ORIGIN;
  if (!process.env.NEXT_PUBLIC_REALTIME_URL) {
    process.env.NEXT_PUBLIC_REALTIME_URL = publicOrigin
      ? `${publicOrigin.replace(/\/$/, '')}${basePath || ''}`
      : basePath || '/realtime';
  }

  const app = next({ dev, hostname, port });
  const handle = app.getRequestHandler();

  await app.prepare();

  const server = createServer();

  createRealtimeServer({
    server,
    socketPath,
    eventPath,
    allowFallbackResponse: false,
    logger: console,
  });

  server.on('request', (req, res) => {
    handle(req, res).catch((error) => {
      console.error('[Combined] Failed to handle request', error);
      if (!res.headersSent) {
        res.statusCode = 500;
        res.end('Internal Server Error');
      } else if (!res.writableEnded) {
        res.end();
      }
    });
  });

  await new Promise((resolve, reject) => {
    const handleError = (error) => {
      server.off('listening', handleListening);
      reject(error);
    };
    const handleListening = () => {
      server.off('error', handleError);
      resolve();
    };

    server.once('error', handleError);
    server.listen(port, hostname, handleListening);
  });

  const displayHost = ['0.0.0.0', '::', '::0'].includes(hostname) ? 'localhost' : hostname;
  console.log(`Next.js app listening on http://${displayHost}:${port}`);
  console.log(
    `Realtime server mounted at ${process.env.REALTIME_SERVER_URL} (socket path: ${socketPath}, event path: ${eventPath})`,
  );
}

main().catch((error) => {
  console.error('[Combined] Fatal error starting server', error);
  process.exit(1);
});
