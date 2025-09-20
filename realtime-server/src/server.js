import { createServer } from 'http';
import { Server } from 'socket.io';
import { URL } from 'url';
import { createHmac, timingSafeEqual } from 'node:crypto';

const PORT = Number(process.env.PORT || 4001);
const SOCKET_PATH = process.env.SOCKET_PATH || '/socket.io';
const EVENT_PATH = process.env.EVENT_PATH || '/events';
const AUTH_TOKEN = process.env.REALTIME_AUTH_TOKEN || process.env.REALTIME_SERVER_TOKEN || '';
const HANDSHAKE_SECRET = (process.env.REALTIME_HANDSHAKE_SECRET || AUTH_TOKEN || '').trim();

if (!AUTH_TOKEN) {
  console.warn('[Realtime] REALTIME_AUTH_TOKEN is not configured. Admin event requests without a token will be rejected.');
}

if (!HANDSHAKE_SECRET) {
  console.warn('[Realtime] REALTIME_HANDSHAKE_SECRET/REALTIME_AUTH_TOKEN is not configured. Socket handshakes will be rejected.');
}

const rawOrigins = process.env.CORS_ORIGIN || '*';
const allowAllOrigins = rawOrigins === '*';
const allowedOrigins = allowAllOrigins
  ? true
  : rawOrigins.split(',').map((origin) => origin.trim()).filter(Boolean);

const onlineUsers = new Map();

function toISO(date) {
  return new Date(date).toISOString();
}

function createJsonResponse(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
}

function parseHandshakeToken(token) {
  if (typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [issuedAtRaw, expiresAtRaw, signature] = parts;
  const issuedAt = Number(issuedAtRaw);
  const expiresAt = Number(expiresAtRaw);
  if (!Number.isFinite(issuedAt) || !Number.isFinite(expiresAt)) return null;
  if (!signature || typeof signature !== 'string') return null;
  return { issuedAt, expiresAt, signature };
}

function verifyHandshake(userId, token) {
  if (!HANDSHAKE_SECRET) {
    return { ok: false, reason: 'Handshake secret not configured' };
  }
  if (typeof userId !== 'string' || !userId.trim()) {
    return { ok: false, reason: 'Missing userId' };
  }
  if (typeof token !== 'string' || !token.trim()) {
    return { ok: false, reason: 'Missing token' };
  }

  const parsed = parseHandshakeToken(token);
  if (!parsed) {
    return { ok: false, reason: 'Invalid token format' };
  }

  if (parsed.expiresAt < Date.now()) {
    return { ok: false, reason: 'Token expired' };
  }

  const base = `${userId}:${parsed.issuedAt}:${parsed.expiresAt}`;
  const expectedSignature = createHmac('sha256', HANDSHAKE_SECRET).update(base).digest('hex');

  try {
    const providedBuffer = Buffer.from(parsed.signature, 'hex');
    const expectedBuffer = Buffer.from(expectedSignature, 'hex');
    if (providedBuffer.length !== expectedBuffer.length) {
      return { ok: false, reason: 'Invalid token signature' };
    }
    if (!timingSafeEqual(providedBuffer, expectedBuffer)) {
      return { ok: false, reason: 'Invalid token signature' };
    }
  } catch {
    return { ok: false, reason: 'Invalid token signature' };
  }

  return { ok: true, issuedAt: parsed.issuedAt, expiresAt: parsed.expiresAt };
}

function isValidRoomIdentifier(room, prefixLength) {
  if (typeof room !== 'string') return false;
  if (room.length > 200) return false;
  if (prefixLength >= room.length) return false;
  const identifier = room.slice(prefixLength);
  return /^[A-Za-z0-9_-]+$/.test(identifier);
}

function isAllowedRoom(room, socket) {
  if (typeof room !== 'string' || !room) return false;
  if (room === 'global') return true;
  if (room.startsWith('user_')) {
    const expectedRoom = `user_${socket.data.userId}`;
    return expectedRoom === room;
  }
  if (room.startsWith('rehearsal_')) {
    return isValidRoomIdentifier(room, 'rehearsal_'.length);
  }
  if (room.startsWith('show_')) {
    return isValidRoomIdentifier(room, 'show_'.length);
  }
  return false;
}

const httpServer = createServer((req, res) => {
  if (!req.url) {
    createJsonResponse(res, 404, { error: 'Not Found' });
    return;
  }

  const url = new URL(req.url, 'http://localhost');

  if (req.method === 'POST' && url.pathname === EVENT_PATH) {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        req.connection.destroy();
      }
    });

    req.on('end', () => {
      try {
        const payload = body ? JSON.parse(body) : {};
        const token = payload?.token;
        const eventType = payload?.eventType;
        const data = payload?.payload;

        if (!AUTH_TOKEN || token !== AUTH_TOKEN) {
          console.warn('[Realtime] Rejected admin event request due to missing or invalid auth token.');
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
        console.error('[Realtime] Failed to handle admin event', error);
        createJsonResponse(res, 400, { error: 'Invalid payload' });
      }
    });

    return;
  }

  createJsonResponse(res, 200, { status: 'ok' });
});

const io = new Server(httpServer, {
  path: SOCKET_PATH,
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

io.use((socket, next) => {
  const auth = socket.handshake.auth || {};
  const rawUserId = typeof auth.userId === 'string' ? auth.userId : null;
  const token = typeof auth.token === 'string' ? auth.token : null;
  const rawName = typeof auth.userName === 'string' ? auth.userName : null;

  const validation = verifyHandshake(rawUserId, token);
  if (!validation.ok) {
    console.warn(`[Realtime] Rejected socket ${socket.id} handshake: ${validation.reason}`);
    return next(new Error('Unauthorized'));
  }

  socket.data.userId = rawUserId;
  socket.data.userName = rawName && rawName.trim() ? rawName : 'Unbekannt';
  socket.data.rooms = new Set();

  return next();
});

function broadcastOnlineStats() {
  const snapshot = {
    totalOnline: onlineUsers.size,
    onlineUsers: Array.from(onlineUsers.entries()).map(([userId, info]) => ({
      id: userId,
      name: info.name,
      lastSeen: toISO(info.lastSeen),
    })),
  };

  io.emit('online_stats_update', {
    type: 'online_stats_update',
    timestamp: toISO(Date.now()),
    stats: snapshot,
  });
}

function emitUserPresence(room, socket, action) {
  const userId = socket.data.userId;
  if (!userId) return;
  const payload = {
    type: 'user_presence',
    timestamp: toISO(Date.now()),
    action,
    room,
    user: {
      id: userId,
      name: socket.data.userName,
    },
  };
  socket.to(room).emit('user_presence', payload);
}

function emitRehearsalUsersList(rehearsalId, socket) {
  const roomName = `rehearsal_${rehearsalId}`;
  const room = io.sockets.adapter.rooms.get(roomName);
  if (!room) {
    socket.emit('rehearsal_users_list', {
      type: 'rehearsal_users_list',
      timestamp: toISO(Date.now()),
      rehearsalId,
      users: [],
    });
    return;
  }

  const users = [];
  for (const socketId of room) {
    const member = io.sockets.sockets.get(socketId);
    if (member?.data?.userId) {
      users.push({
        id: member.data.userId,
        name: member.data.userName,
      });
    }
  }

  socket.emit('rehearsal_users_list', {
    type: 'rehearsal_users_list',
    timestamp: toISO(Date.now()),
    rehearsalId,
    users,
  });
}

function registerUser(socket) {
  const userId = socket.data.userId;
  const name = socket.data.userName;
  const existing = onlineUsers.get(userId);
  if (existing) {
    existing.sockets.add(socket.id);
    existing.lastSeen = Date.now();
  } else {
    onlineUsers.set(userId, {
      name,
      lastSeen: Date.now(),
      sockets: new Set([socket.id]),
    });
    io.emit('user_joined', {
      type: 'user_joined',
      timestamp: toISO(Date.now()),
      user: { id: userId, name },
    });
  }
  broadcastOnlineStats();
}

function unregisterUser(socket) {
  const userId = socket.data.userId;
  const existing = onlineUsers.get(userId);
  if (!existing) return;

  existing.sockets.delete(socket.id);
  if (existing.sockets.size === 0) {
    onlineUsers.delete(userId);
    io.emit('user_left', {
      type: 'user_left',
      timestamp: toISO(Date.now()),
      user: { id: userId, name: socket.data.userName },
    });
  } else {
    existing.lastSeen = Date.now();
  }
  broadcastOnlineStats();
}

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

  socket.join('global');
  socket.data.rooms.add('global');

  socket.on('join_room', (room) => {
    if (!isAllowedRoom(room, socket)) {
      console.warn(`[Realtime] socket ${socket.id} attempted to join unauthorized room: ${room}`);
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

function broadcastAttendanceUpdate(payload) {
  if (!payload || !payload.rehearsalId) return false;
  const event = {
    type: 'attendance_updated',
    rehearsalId: payload.rehearsalId,
    targetUserId: payload.targetUserId,
    status: payload.status ?? null,
    comment: payload.comment,
    actorUserId: payload.actorUserId,
    timestamp: toISO(Date.now()),
  };

  io.to(`rehearsal_${payload.rehearsalId}`).emit('attendance_updated', event);
  if (payload.targetUserId) {
    io.to(`user_${payload.targetUserId}`).emit('attendance_updated', event);
  }
  return true;
}

function broadcastRehearsalCreated(payload) {
  if (!payload || !payload.rehearsal) return false;
  const event = {
    type: 'rehearsal_created',
    rehearsal: payload.rehearsal,
    targetUserIds: Array.isArray(payload.targetUserIds) ? payload.targetUserIds : [],
    timestamp: toISO(Date.now()),
  };

  if (event.targetUserIds.length) {
    event.targetUserIds.forEach((userId) => {
      io.to(`user_${userId}`).emit('rehearsal_created', event);
    });
  } else {
    io.emit('rehearsal_created', event);
  }
  return true;
}

function broadcastRehearsalUpdated(payload) {
  if (!payload || !payload.rehearsalId) return false;
  const event = {
    type: 'rehearsal_updated',
    rehearsalId: payload.rehearsalId,
    changes: payload.changes || {},
    targetUserIds: Array.isArray(payload.targetUserIds) ? payload.targetUserIds : [],
    timestamp: toISO(Date.now()),
  };

  io.to(`rehearsal_${payload.rehearsalId}`).emit('rehearsal_updated', event);
  event.targetUserIds.forEach((userId) => {
    io.to(`user_${userId}`).emit('rehearsal_updated', event);
  });
  return true;
}

function sendNotification(payload) {
  if (!payload || !payload.targetUserId || !payload.notification) return false;
  const event = {
    type: 'notification_created',
    notification: payload.notification,
    targetUserId: payload.targetUserId,
    timestamp: toISO(Date.now()),
  };

  io.to(`user_${payload.targetUserId}`).emit('notification_created', event);
  return true;
}

function handleServerEvent(eventType, data) {
  switch (eventType) {
    case 'attendance_updated':
      return broadcastAttendanceUpdate(data);
    case 'rehearsal_created':
      return broadcastRehearsalCreated(data);
    case 'rehearsal_updated':
      return broadcastRehearsalUpdated(data);
    case 'notification_created':
      return sendNotification(data);
    default:
      return false;
  }
}

httpServer.listen(PORT, () => {
  console.log(`Realtime server listening on port ${PORT}`);
});
