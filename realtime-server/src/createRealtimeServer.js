import fs from 'node:fs/promises';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { createServer } from 'http';
import os from 'node:os';
import { setTimeout as wait } from 'node:timers/promises';
import { Server } from 'socket.io';
import { URL } from 'url';

import analyticsStaticData from '../../src/data/server-analytics-static.json' assert { type: 'json' };

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

const previousResourceUsage = new Map();

function cloneStaticAnalyticsData() {
  return JSON.parse(JSON.stringify(analyticsStaticData));
}

function clamp(value, min, max) {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.min(Math.max(value, min), max);
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return '0 B';
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  const decimals = value >= 100 ? 0 : value >= 10 ? 1 : 2;
  return `${value.toFixed(decimals)} ${units[unitIndex]}`;
}

function readCpuTimes() {
  return os.cpus().reduce(
    (accumulator, cpu) => {
      const times = cpu.times;
      const total = times.user + times.nice + times.sys + times.idle + times.irq;
      return {
        idle: accumulator.idle + times.idle,
        total: accumulator.total + total,
      };
    },
    { idle: 0, total: 0 },
  );
}

async function measureCpuUsagePercent(intervalMs = 200) {
  const start = readCpuTimes();
  if (start.total === 0) {
    return 0;
  }

  await wait(intervalMs);

  const end = readCpuTimes();
  const totalDelta = end.total - start.total;
  if (totalDelta <= 0) {
    return 0;
  }

  const idleDelta = end.idle - start.idle;
  const usage = 1 - idleDelta / totalDelta;
  if (!Number.isFinite(usage) || usage < 0) {
    return 0;
  }

  return clamp(usage * 100, 0, 100);
}

function getMemoryUsageSnapshot() {
  const total = os.totalmem();
  const free = os.freemem();

  const totalBytes = clamp(total, 0, Number.MAX_SAFE_INTEGER);
  const freeBytes = clamp(Math.min(free, totalBytes), 0, totalBytes);
  const usedBytes = Math.max(totalBytes - freeBytes, 0);
  const usagePercent = totalBytes > 0 ? (usedBytes / totalBytes) * 100 : 0;

  return {
    usagePercent,
    totalBytes,
    freeBytes,
  };
}

async function getDiskUsageSnapshot(path) {
  const stats = await fs.statfs(path);

  const blockSize = clamp(stats.bsize ?? 0, 0, Number.MAX_SAFE_INTEGER);
  const totalBlocks = clamp(stats.blocks ?? 0, 0, Number.MAX_SAFE_INTEGER);
  const availableBlocksValue = typeof stats.bavail === 'number' && stats.bavail >= 0 ? stats.bavail : stats.bfree ?? 0;
  const availableBlocks = clamp(availableBlocksValue, 0, totalBlocks);

  const totalBytes = blockSize * totalBlocks;
  const freeBytes = blockSize * availableBlocks;
  const usedBytes = Math.max(totalBytes - freeBytes, 0);
  const usagePercent = totalBytes > 0 ? (usedBytes / totalBytes) * 100 : 0;

  return {
    usagePercent,
    totalBytes,
    freeBytes,
    path,
  };
}

function calculateChangePercent(id, currentValue) {
  const previous = previousResourceUsage.get(id);
  previousResourceUsage.set(id, currentValue);

  if (previous === undefined || previous <= 0) {
    return 0;
  }

  const change = (currentValue - previous) / previous;
  if (!Number.isFinite(change)) {
    return 0;
  }

  return clamp(change, -5, 5);
}

function finalizeResourceMeasurement(measurement) {
  const sanitizedUsage = clamp(measurement.usagePercent, 0, 100);
  const roundedUsage = Math.round(sanitizedUsage * 10) / 10;
  const changePercent = Math.round(calculateChangePercent(measurement.id, roundedUsage) * 100) / 100;

  return {
    ...measurement,
    usagePercent: roundedUsage,
    changePercent,
  };
}

async function collectSystemResourceUsage(logError = console.error) {
  const resources = [];

  const cpuCount = Math.max(os.cpus().length, 1);
  const loadAverages = os.loadavg();
  const loadOneMinuteRaw = loadAverages.length > 0 ? loadAverages[0] : 0;
  const loadOneMinute = Number.isFinite(loadOneMinuteRaw) ? loadOneMinuteRaw : 0;

  const diskPath = process.cwd();

  const [cpuUsagePercent, diskUsage] = await Promise.all([
    measureCpuUsagePercent().catch((error) => {
      logError('[server-analytics] CPU usage probe failed', error);
      return null;
    }),
    getDiskUsageSnapshot(diskPath).catch((error) => {
      logError(`[server-analytics] Disk usage probe failed for ${diskPath}`, error);
      return null;
    }),
  ]);

  if (cpuUsagePercent !== null) {
    resources.push({
      id: 'app-cpu',
      label: 'App-Server CPU',
      usagePercent: cpuUsagePercent,
      capacity: `${cpuCount} Kern${cpuCount === 1 ? '' : 'e'} · Load 1m ${loadOneMinute.toFixed(2)}`,
    });
  }

  const memoryUsage = getMemoryUsageSnapshot();
  resources.push({
    id: 'app-ram',
    label: 'Arbeitsspeicher',
    usagePercent: memoryUsage.usagePercent,
    capacity: `${formatBytes(memoryUsage.totalBytes)} gesamt · ${formatBytes(memoryUsage.freeBytes)} frei`,
  });

  if (diskUsage !== null) {
    const normalizedPath = diskUsage.path === '' ? '/' : diskUsage.path;
    resources.push({
      id: 'app-disk',
      label: `Dateisystem (${normalizedPath})`,
      usagePercent: diskUsage.usagePercent,
      capacity: `${formatBytes(diskUsage.totalBytes)} gesamt · ${formatBytes(diskUsage.freeBytes)} frei`,
    });
  }

  if (resources.length === 0) {
    throw new Error('Keine Systemressourcen konnten ermittelt werden');
  }

  return resources.map(finalizeResourceMeasurement);
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
    logger.warn(
      '[Realtime] REALTIME_AUTH_TOKEN is not configured. Admin event requests without a token will be rejected.',
    );
  }

  if (!resolvedHandshakeSecret) {
    logger.warn(
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

  const logError = typeof logger.error === 'function' ? (...args) => logger.error(...args) : (...args) => console.error(...args);

  const defaultAnalyticsInterval = 15000;
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

  let latestAnalytics = null;
  let analyticsRefreshPromise = null;
  let analyticsIntervalId = null;

  async function collectAnalyticsSnapshot() {
    const base = cloneStaticAnalyticsData();
    let resourceUsage = base.resourceUsage;
    try {
      resourceUsage = await collectSystemResourceUsage(logError);
    } catch (error) {
      logError('[Realtime] Verwende statische Ressourcenwerte für Server-Analytics', error);
    }

    return {
      generatedAt: toISO(Date.now()),
      ...base,
      resourceUsage,
    };
  }

  function analyticsIsFresh() {
    if (!latestAnalytics) {
      return false;
    }
    const timestamp = Date.parse(latestAnalytics.generatedAt);
    if (!Number.isFinite(timestamp)) {
      return false;
    }
    return Date.now() - timestamp < analyticsMaxAgeMs;
  }

  async function refreshAnalytics() {
    if (analyticsRefreshPromise) {
      return analyticsRefreshPromise;
    }

    analyticsRefreshPromise = collectAnalyticsSnapshot()
      .then((snapshot) => {
        latestAnalytics = snapshot;
        return snapshot;
      })
      .catch((error) => {
        logError('[Realtime] Failed to refresh analytics snapshot', error);
        if (latestAnalytics) {
          return latestAnalytics;
        }
        const fallback = { generatedAt: toISO(Date.now()), ...cloneStaticAnalyticsData() };
        latestAnalytics = fallback;
        return fallback;
      })
      .finally(() => {
        analyticsRefreshPromise = null;
      });

    return analyticsRefreshPromise;
  }

  async function getAnalyticsSnapshot() {
    if (analyticsIsFresh()) {
      return latestAnalytics;
    }
    return refreshAnalytics();
  }

  function emitAnalytics(target, analytics) {
    if (!analytics || typeof target.emit !== 'function') {
      return;
    }
    target.emit('server_analytics_update', {
      type: 'server_analytics_update',
      timestamp: analytics.generatedAt ?? toISO(Date.now()),
      analytics,
    });
  }

  function scheduleAnalyticsBroadcast() {
    refreshAnalytics()
      .then((analytics) => {
        emitAnalytics(io, analytics);
      })
      .catch((error) => {
        logError('[Realtime] Failed to broadcast analytics update', error);
      });
  }

  analyticsIntervalId = setInterval(scheduleAnalyticsBroadcast, analyticsIntervalMs);
  if (typeof analyticsIntervalId.unref === 'function') {
    analyticsIntervalId.unref();
  }

  refreshAnalytics().catch((error) => {
    logError('[Realtime] Initial analytics snapshot failed', error);
  });

  const onlineUsers = new Map();

  function verifyHandshake(userId, token) {
    if (!resolvedHandshakeSecret) {
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
    const expectedSignature = createHmac('sha256', resolvedHandshakeSecret).update(base).digest('hex');

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
          logger.warn('[Realtime] Rejected admin event request due to missing or invalid auth token.');
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
        logger.error('[Realtime] Failed to handle admin event', error);
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

    const validation = verifyHandshake(rawUserId, token);
    if (!validation.ok) {
      logger.warn(`[Realtime] Rejected socket ${socket.id} handshake: ${validation.reason}`);
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

    getAnalyticsSnapshot()
      .then((analytics) => {
        emitAnalytics(socket, analytics);
      })
      .catch((error) => {
        logError(`[Realtime] Failed to deliver analytics snapshot to socket ${socket.id}`, error);
      });

    socket.join('global');
    socket.data.rooms.add('global');

    socket.on('join_room', (room) => {
      if (!isAllowedRoom(room, socket)) {
        logger.warn(`[Realtime] socket ${socket.id} attempted to join unauthorized room: ${room}`);
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
      getAnalyticsSnapshot()
        .then((analytics) => {
          emitAnalytics(socket, analytics);
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
    logger.log(`Realtime server listening on port ${listenPort}`);
  }

  async function close() {
    if (closed) return;
    closed = true;
    if (analyticsIntervalId) {
      clearInterval(analyticsIntervalId);
      analyticsIntervalId = null;
    }
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
