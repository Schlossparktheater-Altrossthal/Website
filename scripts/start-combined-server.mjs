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

async function main() {
  const dev = process.env.NODE_ENV !== 'production';
  const port = Number(process.env.PORT || process.env.APP_PORT || 3000);
  const hostname = process.env.HOSTNAME || '0.0.0.0';

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

  await new Promise((resolve) => {
    server.listen(port, hostname, resolve);
  });

  const displayHost = hostname === '0.0.0.0' ? 'localhost' : hostname;
  console.log(`Next.js app listening on http://${displayHost}:${port}`);
  console.log(
    `Realtime server mounted at ${process.env.REALTIME_SERVER_URL} (socket path: ${socketPath}, event path: ${eventPath})`,
  );
}

main().catch((error) => {
  console.error('[Combined] Fatal error starting server', error);
  process.exit(1);
});
