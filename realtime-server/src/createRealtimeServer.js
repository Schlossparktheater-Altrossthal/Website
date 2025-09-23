import { createServer } from 'http';
import { Server } from 'socket.io';
import { URL } from 'url';
import { createAnalyticsManager } from './analytics.js';
import { verifyHandshake } from './handshake.js';
import { createEventHandlers } from './events.js';

function toISO(date) {
  return new Date(date).toISOString();
}

function createJsonResponse(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
}

function normalizePath(path, fallback = '/') {
  const raw = path ?? fallback;
  if (!raw) return '/';
  return raw.startsWith('/') ? raw.replace(/\/$/, '') || '/' : `/${raw}`.replace(/\/$/, '');
}

function resolveBoolean(value, fallback) {
  if (typeof value === 'boolean') return value;
  return fallback;
}

function resolveNumber(value, fallback) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function createRealtimeServer(options = {}) {
  const {
    server,
    port: explicitPort,
    socketPath: explicitSocketPath,
    eventPath: explicitEventPath,
    healthCheckPath: explicitHealthCheckPath,
    logger = console,
    authToken: explicitAuthToken,
    handshakeSecret: explicitHandshakeSecret,
    corsOrigin: explicitCorsOrigin,
    allowFallbackResponse,
    attachRequestListener = true,
    analyticsIntervalMs: explicitAnalyticsIntervalMs,
    analyticsMaxAgeMs: explicitAnalyticsMaxAgeMs,
  } = options;

  const logError =
    typeof logger?.error === 'function' ? (...args) => logger.error(...args) : (...args) => console.error(...args);
  const logWarn =
    typeof logger?.warn === 'function' ? (...args) => logger.warn(...args) : (...args) => console.warn(...args);
  const logInfo =
    typeof logger?.log === 'function' ? (...args) => logger.log(...args) : (...args) => console.log(...args);

  const port = Number.isFinite(explicitPort) ? Number(explicitPort) : Number(process.env.PORT || 4001);
  const socketPath = normalizePath(
    explicitSocketPath ?? process.env.SOCKET_PATH ?? process.env.NEXT_PUBLIC_REALTIME_PATH ?? '/socket.io',
    '/socket.io',
  );
  const eventPath = normalizePath(
    explicitEventPath ?? process.env.EVENT_PATH ?? process.env.REALTIME_SERVER_EVENT_PATH ?? '/events',
    '/events',
  );
  const healthCheckPath = explicitHealthCheckPath === null ? null : normalizePath(explicitHealthCheckPath ?? '/');

  const rawOrigins =
    typeof explicitCorsOrigin === 'string' && explicitCorsOrigin.trim()
      ? explicitCorsOrigin
      : process.env.CORS_ORIGIN || '*';
  const allowAllOrigins = rawOrigins === '*';
  const allowedOrigins = allowAllOrigins
    ? true
    : rawOrigins
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean);

  const resolvedAuthToken = (
    explicitAuthToken ?? process.env.REALTIME_AUTH_TOKEN ?? process.env.REALTIME_SERVER_TOKEN ?? ''
  ).trim();
  const resolvedHandshakeSecret = (
    explicitHandshakeSecret ?? process.env.REALTIME_HANDSHAKE_SECRET ?? resolvedAuthToken ?? ''
  ).trim();

  if (!resolvedAuthToken) {
    logWarn('[Realtime] REALTIME_AUTH_TOKEN is not configured. Admin event requests without a token will be rejected.');
  }

  if (!resolvedHandshakeSecret) {
    logWarn(
      '[Realtime] REALTIME_HANDSHAKE_SECRET/REALTIME_AUTH_TOKEN is not configured. Socket handshakes will be rejected.',
    );
  }

  const httpServer = server ?? createServer();
  const respondToUnknownPaths = resolveBoolean(allowFallbackResponse, !server);

  const io = new Server(httpServer, {
    path: socketPath,
    transports: ['websocket', 'polling'],
    cors: allowAllOrigins
      ? {
          origin: true,
          credentials: true,
        }
      : {
          origin: allowedOrigins,
          credentials: true,
        },
  });

  const defaultAnalyticsInterval = 2000;
  const analyticsIntervalMsRaw = resolveNumber(
    explicitAnalyticsIntervalMs,
    resolveNumber(process.env.REALTIME_ANALYTICS_INTERVAL_MS, defaultAnalyticsInterval),
  );
  const analyticsIntervalMs = Math.max(analyticsIntervalMsRaw, 2000);

  const analyticsMaxAgeMsRaw = resolveNumber(
    explicitAnalyticsMaxAgeMs,
    resolveNumber(process.env.REALTIME_ANALYTICS_MAX_AGE_MS, analyticsIntervalMs * 1.5),
  );
  const analyticsMaxAgeMs = Math.max(analyticsMaxAgeMsRaw, analyticsIntervalMs);

  const analyticsManager = createAnalyticsManager({
    logger,
    intervalMs: analyticsIntervalMs,
    maxAgeMs: analyticsMaxAgeMs,
    toISO,
  });

  const {
    broadcastOnlineStats,
    emitUserPresence,
    emitRehearsalUsersList,
    registerUser,
    unregisterUser,
    handleServerEvent,
    validateRoom,
  } = createEventHandlers({ io, logger, toISO });

  analyticsManager.start(io);

  function handleAdminEventRequest(req, res) {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        req.socket.destroy();
      }
    });

    req.on('end', () => {
      try {
        const payload = body ? JSON.parse(body) : {};
        const token = payload?.token;
        const eventType = payload?.eventType;
        const data = payload?.payload;

        if (!resolvedAuthToken || token !== resolvedAuthToken) {
          logWarn('[Realtime] Rejected admin event request due to missing or invalid auth token.');
          createJsonResponse(res, 401, { error: 'Unauthorized' });
          return;
        }

        const handled = handleServerEvent(eventType, data);
        if (!handled) {
          createJsonResponse(res, 400, { error: 'Unsupported event type' });
          return;
        }

        createJsonResponse(res, 200, { ok: true });
      } catch (error) {
        logError('[Realtime] Failed to handle admin event', error);
        createJsonResponse(res, 400, { error: 'Invalid payload' });
      }
    });

    return true;
  }

  const requestHandler = (req, res) => {
    if (!req.url) {
      if (!respondToUnknownPaths) {
        return false;
      }
      createJsonResponse(res, 404, { error: 'Not Found' });
      return true;
    }

    let url;
    try {
      url = new URL(req.url, 'http://localhost');
    } catch {
      if (!respondToUnknownPaths) {
        return false;
      }
      createJsonResponse(res, 400, { error: 'Invalid request URL' });
      return true;
    }

    if (req.method === 'POST' && url.pathname === eventPath) {
      return handleAdminEventRequest(req, res);
    }

    if (!respondToUnknownPaths) {
      return false;
    }

    if (!healthCheckPath || url.pathname === healthCheckPath) {
      createJsonResponse(res, 200, { status: 'ok' });
      return true;
    }

    createJsonResponse(res, 200, { status: 'ok' });
    return true;
  };

  let attachedRequestListener = false;

  if (attachRequestListener) {
    const listener = (req, res) => {
      if (requestHandler(req, res)) {
        return;
      }
    };
    if (typeof httpServer.prependListener === 'function') {
      httpServer.prependListener('request', listener);
    } else {
      httpServer.on('request', listener);
    }
    attachedRequestListener = true;
  }

  io.use((socket, next) => {
    const auth = socket.handshake.auth || {};
    const rawUserId = typeof auth.userId === 'string' ? auth.userId : null;
    const token = typeof auth.token === 'string' ? auth.token : null;
    const rawName = typeof auth.userName === 'string' ? auth.userName : null;

    const validation = verifyHandshake({ userId: rawUserId, token, secret: resolvedHandshakeSecret });
    if (!validation.ok) {
      logWarn(`[Realtime] Rejected socket ${socket.id} handshake: ${validation.reason}`);
      return next(new Error('Unauthorized'));
    }

    socket.data.userId = rawUserId;
    socket.data.userName = rawName && rawName.trim() ? rawName : 'Unbekannt';
    socket.data.rooms = new Set();

    return next();
  });

  io.on('connection', (socket) => {
    const userId = typeof socket.data.userId === 'string' ? socket.data.userId : null;
    if (!userId) {
      socket.emit('error', { message: 'Unauthorized: missing userId' });
      return socket.disconnect(true);
    }

    if (!socket.data.rooms) {
      socket.data.rooms = new Set();
    }

    registerUser(socket);

    analyticsManager
      .getSnapshot()
      .then((analytics) => {
        analyticsManager.emit(socket, analytics);
      })
      .catch((error) => {
        logError(`[Realtime] Failed to deliver analytics snapshot to socket ${socket.id}`, error);
      });

    socket.join('global');
    socket.data.rooms.add('global');

    socket.on('join_room', (room) => {
      if (!validateRoom(room, socket)) {
        return;
      }
      if (socket.data.rooms.has(room)) {
        return;
      }
      socket.join(room);
      socket.data.rooms.add(room);
      emitUserPresence(room, socket, 'join');

      if (room.startsWith('rehearsal_')) {
        const rehearsalId = room.substring('rehearsal_'.length);
        emitRehearsalUsersList(rehearsalId, socket);
      }
    });

    socket.on('leave_room', (room) => {
      if (typeof room !== 'string') return;
      if (!socket.data.rooms.has(room)) return;
      socket.data.rooms.delete(room);
      socket.leave(room);
      emitUserPresence(room, socket, 'leave');
    });

    socket.on('get_online_stats', () => {
      broadcastOnlineStats();
    });

    socket.on('get_rehearsal_users', (rehearsalId) => {
      if (typeof rehearsalId !== 'string') return;
      const roomName = `rehearsal_${rehearsalId}`;
      if (!socket.data.rooms.has(roomName)) {
        return;
      }
      emitRehearsalUsersList(rehearsalId, socket);
    });

    socket.on('get_server_analytics', () => {
      analyticsManager
        .getSnapshot()
        .then((analytics) => {
          analyticsManager.emit(socket, analytics);
        })
        .catch((error) => {
          logError(`[Realtime] Failed to refresh analytics for socket ${socket.id}`, error);
        });
    });

    socket.on('ping', () => {
      socket.emit('pong');
    });

    socket.on('disconnecting', () => {
      for (const room of socket.data.rooms) {
        emitUserPresence(room, socket, 'leave');
      }
    });

    socket.on('disconnect', () => {
      unregisterUser(socket);
    });
  });

  let closed = false;

  async function listen(listenPort = port, hostname = '0.0.0.0') {
    if (server) {
      throw new Error('listen() should not be called when using an existing HTTP server instance');
    }
    await new Promise((resolve) => {
      httpServer.listen(listenPort, hostname, resolve);
    });
    logInfo(`Realtime server listening on port ${listenPort}`);
  }

  async function close() {
    if (closed) return;
    closed = true;
    analyticsManager.stop();
    await new Promise((resolve, reject) => {
      io.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        httpServer.close((closeError) => {
          if (closeError) {
            reject(closeError);
          } else {
            resolve();
          }
        });
      });
    });
  }

  return {
    io,
    httpServer,
    listen,
    close,
    config: {
      port,
      socketPath,
      eventPath,
      healthCheckPath,
      corsOrigin: rawOrigins,
      allowAllOrigins,
      authToken: resolvedAuthToken,
      handshakeSecret: resolvedHandshakeSecret,
      respondToUnknownPaths,
      attachedRequestListener,
    },
  };
}

export async function startRealtimeServer(options = {}) {
  const instance = createRealtimeServer(options);
  await instance.listen(options.port);
  return instance;
}
