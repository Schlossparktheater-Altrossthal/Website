import fs from 'node:fs/promises';
import os from 'node:os';
import { setTimeout as wait } from 'node:timers/promises';
import { createRequire } from 'node:module';

import { Client } from 'pg';

const require = createRequire(import.meta.url);
const analyticsStaticData = require('../../src/data/server-analytics-static.json');

const fallbackAnalyticsModule = {
  applyPagePerformanceMetrics(baseEntries = []) {
    if (!Array.isArray(baseEntries)) {
      return [];
    }
    return baseEntries.map((entry) => ({ ...entry }));
  },
  mergeDeviceBreakdown(baseEntries = []) {
    if (!Array.isArray(baseEntries)) {
      return [];
    }
    return baseEntries.map((entry) => ({ ...entry }));
  },
};

function cloneStaticAnalyticsData() {
  return JSON.parse(JSON.stringify(analyticsStaticData));
}

const ANALYTICS_NOTIFICATION_CHANNEL = 'server_analytics_update';
const POSTGRES_RECONNECT_DELAY_MS = 2_500;

function formatPgIdentifier(identifier) {
  const name = typeof identifier === 'string' ? identifier.trim() : '';
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
    return null;
  }
  return `"${name.replace(/"/g, '""')}"`;
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

function calculateChangePercent(previousUsageMap, id, currentValue) {
  const previous = previousUsageMap.get(id);
  previousUsageMap.set(id, currentValue);

  if (previous === undefined || previous <= 0) {
    return 0;
  }

  const change = (currentValue - previous) / previous;
  if (!Number.isFinite(change)) {
    return 0;
  }

  return clamp(change, -5, 5);
}

function finalizeResourceMeasurement(previousUsageMap, measurement) {
  const sanitizedUsage = clamp(measurement.usagePercent, 0, 100);
  const roundedUsage = Math.round(sanitizedUsage * 10) / 10;
  const changePercent =
    Math.round(calculateChangePercent(previousUsageMap, measurement.id, roundedUsage) * 100) / 100;

  return {
    ...measurement,
    usagePercent: roundedUsage,
    changePercent,
  };
}

async function collectSystemResourceUsage({ previousResourceUsage, logError, diskPath }) {
  const resources = [];

  const cpuCount = Math.max(os.cpus().length, 1);
  const loadAverages = os.loadavg();
  const loadOneMinuteRaw = loadAverages.length > 0 ? loadAverages[0] : 0;
  const loadOneMinute = Number.isFinite(loadOneMinuteRaw) ? loadOneMinuteRaw : 0;

  const targetDiskPath = diskPath || process.cwd();

  const [cpuUsagePercent, diskUsage] = await Promise.all([
    measureCpuUsagePercent().catch((error) => {
      logError('[server-analytics] CPU usage probe failed', error);
      return null;
    }),
    getDiskUsageSnapshot(targetDiskPath).catch((error) => {
      logError(`[server-analytics] Disk usage probe failed for ${targetDiskPath}`, error);
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

  return resources.map((resource) => finalizeResourceMeasurement(previousResourceUsage, resource));
}

function isModuleNotFoundError(error) {
  if (!error) {
    return false;
  }
  return error.code === 'ERR_MODULE_NOT_FOUND' || error.code === 'MODULE_NOT_FOUND';
}

export function createAnalyticsManager({
  logger = console,
  intervalMs = 2000,
  maxAgeMs,
  importAnalyticsModule = () => import('../../src/lib/server-analytics-data.js'),
  loadStaticData = () => cloneStaticAnalyticsData(),
  collectResourceUsage,
  getDatabaseUrl = () => process.env.DATABASE_URL,
  now = () => Date.now(),
  toISO = (value) => new Date(value).toISOString(),
  diskPath = process.cwd(),
  subscribeToExternalUpdates: providedSubscribe,
} = {}) {
  const state = {
    latestAnalytics: null,
    refreshPromise: null,
    modulePromise: null,
    moduleMissingLogged: false,
    moduleErrorLogged: false,
    previousResourceUsage: new Map(),
    intervalId: null,
    externalSubscription: null,
  };

  const logError =
    typeof logger?.error === 'function' ? (...args) => logger.error(...args) : (...args) => console.error(...args);
  const logWarn =
    typeof logger?.warn === 'function' ? (...args) => logger.warn(...args) : (...args) => console.warn(...args);

  const resolvedInterval = Math.max(Number(intervalMs) || 0, 2000);
  const resolvedMaxAge = Math.max(Number(maxAgeMs) || resolvedInterval * 1.5, resolvedInterval);

  const resourceUsageCollector =
    typeof collectResourceUsage === 'function'
      ? collectResourceUsage
      : ({ previousResourceUsage }) =>
          collectSystemResourceUsage({ previousResourceUsage, logError, diskPath });

  const externalUpdateSubscriber =
    typeof providedSubscribe === 'function'
      ? providedSubscribe
      : createPostgresNotificationSubscriber({ getDatabaseUrl, logError, logWarn });

  function logMissingAnalyticsModule(message, error) {
    if (state.moduleMissingLogged) {
      return;
    }
    state.moduleMissingLogged = true;
    if (error) {
      logWarn(message, error);
      return;
    }
    logWarn(message);
  }

  function logAnalyticsModuleError(error) {
    if (state.moduleErrorLogged) {
      return;
    }
    state.moduleErrorLogged = true;
    logError('[Realtime] Failed to load optional server analytics module', error);
  }

  async function resolveAnalyticsModule() {
    if (!state.modulePromise) {
      state.modulePromise = importAnalyticsModule()
        .then((module) => {
          if (
            !module ||
            typeof module.applyPagePerformanceMetrics !== 'function' ||
            typeof module.mergeDeviceBreakdown !== 'function'
          ) {
            logMissingAnalyticsModule(
              '[Realtime] server-analytics-data module is missing expected exports. Falling back to static analytics.',
            );
            return null;
          }
          return module;
        })
        .catch((error) => {
          if (isModuleNotFoundError(error)) {
            logMissingAnalyticsModule(
              '[Realtime] server-analytics-data module not found. Falling back to static analytics.',
              error,
            );
            return null;
          }
          logAnalyticsModuleError(error);
          return null;
        });
    }

    return state.modulePromise;
  }

  function createFallbackSnapshot(reason) {
    const base = loadStaticData();
    const generatedAt = toISO(now());
    const fallbackReasons = reason ? [reason] : undefined;
    return {
      generatedAt,
      ...base,
      metadata: {
        source: 'fallback',
        attempts: 1,
        lastUpdatedAt: generatedAt,
        fallbackReasons,
      },
    };
  }

  async function collectAnalyticsSnapshot() {
    const base = loadStaticData();
    const fallbackReasons = [];
    const databaseUrl = getDatabaseUrl();
    if (!databaseUrl) {
      fallbackReasons.push('DATABASE_URL ist nicht gesetzt – verwende statische Kennzahlen');
    }

    let resourceUsage = base.resourceUsage;
    try {
      resourceUsage = await resourceUsageCollector({
        previousResourceUsage: state.previousResourceUsage,
        logError,
        diskPath,
      });
    } catch (error) {
      logError('[Realtime] Verwende statische Ressourcenwerte für Server-Analytics', error);
      fallbackReasons.push('Systemressourcen konnten nicht gemessen werden');
    }

    let deviceBreakdown = base.deviceBreakdown ?? [];
    let publicPages = base.publicPages ?? [];
    let memberPages = base.memberPages ?? [];
    let databaseUsed = false;

    const analyticsModule = await resolveAnalyticsModule();
    const mergeDeviceBreakdownFn =
      typeof analyticsModule?.mergeDeviceBreakdown === 'function'
        ? analyticsModule.mergeDeviceBreakdown
        : fallbackAnalyticsModule.mergeDeviceBreakdown;
    const applyPagePerformanceMetricsFn =
      typeof analyticsModule?.applyPagePerformanceMetrics === 'function'
        ? analyticsModule.applyPagePerformanceMetrics
        : fallbackAnalyticsModule.applyPagePerformanceMetrics;
    const loadDeviceBreakdownFromDatabaseFn =
      typeof analyticsModule?.loadDeviceBreakdownFromDatabase === 'function'
        ? analyticsModule.loadDeviceBreakdownFromDatabase
        : null;
    const loadPagePerformanceMetricsFn =
      typeof analyticsModule?.loadPagePerformanceMetrics === 'function'
        ? analyticsModule.loadPagePerformanceMetrics
        : null;

    if (databaseUrl && loadDeviceBreakdownFromDatabaseFn && loadPagePerformanceMetricsFn) {
      const [deviceOverrides, pageMetrics] = await Promise.all([
        loadDeviceBreakdownFromDatabaseFn().catch((error) => {
          logError('[Realtime] Failed to load device analytics', error);
          fallbackReasons.push('Gerätekennzahlen aus der Datenbank nicht verfügbar');
          return null;
        }),
        loadPagePerformanceMetricsFn().catch((error) => {
          logError('[Realtime] Failed to load page performance metrics', error);
          fallbackReasons.push('Seitenmetriken konnten nicht geladen werden');
          return [];
        }),
      ]);

      if (Array.isArray(deviceOverrides)) {
        deviceBreakdown = mergeDeviceBreakdownFn(deviceBreakdown, deviceOverrides ?? undefined);
        databaseUsed = databaseUsed || deviceOverrides.length > 0;
      } else {
        deviceBreakdown = mergeDeviceBreakdownFn(deviceBreakdown);
      }

      if (Array.isArray(pageMetrics) && pageMetrics.length > 0) {
        publicPages = applyPagePerformanceMetricsFn(publicPages, pageMetrics, 'public');
        memberPages = applyPagePerformanceMetricsFn(memberPages, pageMetrics, 'members');
        databaseUsed = true;
      } else {
        publicPages = publicPages.map((entry) => ({ ...entry }));
        memberPages = memberPages.map((entry) => ({ ...entry }));
        fallbackReasons.push('Keine Seitenmetriken in der Datenbank gespeichert');
      }
    } else {
      if (databaseUrl) {
        fallbackReasons.push('Optionales Analytics-Modul nicht verfügbar – verwende statische Kennzahlen');
      }
      deviceBreakdown = mergeDeviceBreakdownFn(deviceBreakdown);
      publicPages = applyPagePerformanceMetricsFn(publicPages, [], 'public');
      memberPages = applyPagePerformanceMetricsFn(memberPages, [], 'members');
    }

    const generatedAt = toISO(now());
    const uniqueFallbackReasons = Array.from(new Set(fallbackReasons.filter(Boolean)));

    return {
      generatedAt,
      ...base,
      resourceUsage,
      deviceBreakdown,
      publicPages,
      memberPages,
      metadata: {
        source: databaseUrl && databaseUsed ? 'live' : 'fallback',
        attempts: 1,
        lastUpdatedAt: generatedAt,
        fallbackReasons: uniqueFallbackReasons.length > 0 ? uniqueFallbackReasons : undefined,
      },
    };
  }
  function analyticsIsFresh() {
    if (!state.latestAnalytics) {
      return false;
    }
    const timestamp = Date.parse(state.latestAnalytics.generatedAt);
    if (!Number.isFinite(timestamp)) {
      return false;
    }
    const currentTime = Number(now());
    if (!Number.isFinite(currentTime)) {
      return false;
    }
    return currentTime - timestamp < resolvedMaxAge;
  }

  async function refreshAnalytics() {
    if (state.refreshPromise) {
      return state.refreshPromise;
    }

    state.refreshPromise = collectAnalyticsSnapshot()
      .then((snapshot) => {
        state.latestAnalytics = snapshot;
        return snapshot;
      })
      .catch((error) => {
        logError('[Realtime] Failed to refresh analytics snapshot', error);
        if (state.latestAnalytics) {
          return state.latestAnalytics;
        }
        const fallback = createFallbackSnapshot(
          error instanceof Error ? error.message : 'Failed to refresh analytics snapshot',
        );
        state.latestAnalytics = fallback;
        return fallback;
      })
      .finally(() => {
        state.refreshPromise = null;
      });

    return state.refreshPromise;
  }

  async function getAnalyticsSnapshot() {
    if (analyticsIsFresh()) {
      return state.latestAnalytics;
    }
    return refreshAnalytics();
  }

  function emitAnalytics(target, analytics) {
    if (!analytics || typeof target?.emit !== 'function') {
      return;
    }
    target.emit('server_analytics_update', {
      type: 'server_analytics_update',
      timestamp: analytics.generatedAt ?? toISO(now()),
      analytics,
    });
  }

  async function broadcastOnce(io) {
    try {
      const analytics = await refreshAnalytics();
      emitAnalytics(io, analytics);
    } catch (error) {
      logError('[Realtime] Failed to broadcast analytics update', error);
    }
  }

  function start(io) {
    if (!io) {
      throw new Error('Socket server instance is required to schedule analytics updates');
    }
    stop();
    state.intervalId = setInterval(() => {
      broadcastOnce(io);
    }, resolvedInterval);
    if (typeof state.intervalId?.unref === 'function') {
      state.intervalId.unref();
    }
    refreshAnalytics().catch((error) => {
      logError('[Realtime] Initial analytics snapshot failed', error);
    });
    if (typeof externalUpdateSubscriber === 'function') {
      state.externalSubscription = externalUpdateSubscriber(() => {
        Promise.resolve(broadcastOnce(io)).catch((error) => {
          logError('[Realtime] Failed to broadcast analytics update after notification', error);
        });
      });
    }
  }

  function stop() {
    if (state.intervalId) {
      clearInterval(state.intervalId);
      state.intervalId = null;
    }
    if (state.externalSubscription && typeof state.externalSubscription.close === 'function') {
      Promise.resolve(state.externalSubscription.close()).catch((error) => {
        logWarn('[Realtime] Failed to close analytics notification subscription', error);
      });
      state.externalSubscription = null;
    }
  }

  return {
    start,
    stop,
    refresh: refreshAnalytics,
    getSnapshot: getAnalyticsSnapshot,
    emit: emitAnalytics,
    isFresh: analyticsIsFresh,
    state,
  };
}

function createPostgresNotificationSubscriber({ getDatabaseUrl, logError, logWarn }) {
  return (handler) => {
    const connectionString = typeof getDatabaseUrl === 'function' ? getDatabaseUrl() : null;
    if (!connectionString) {
      logWarn('[Realtime] Analytics notifications disabled because no DATABASE_URL is configured.');
      return null;
    }

    const channelIdentifier = formatPgIdentifier(ANALYTICS_NOTIFICATION_CHANNEL);
    if (!channelIdentifier) {
      logWarn(
        `[Realtime] Analytics notifications disabled because channel "${ANALYTICS_NOTIFICATION_CHANNEL}" is invalid.`,
      );
      return null;
    }

    let client = null;
    let closed = false;
    let reconnectTimer = null;
    let connecting = false;
    let activeHandlers = null;

    const handleNotification = (message) => {
      if (!message || message.channel !== ANALYTICS_NOTIFICATION_CHANNEL) {
        return;
      }
      let payload;
      if (message.payload) {
        try {
          payload = JSON.parse(message.payload);
        } catch (error) {
          logWarn('[Realtime] Failed to parse analytics notification payload', error);
        }
      }
      try {
        const result = handler(payload);
        if (result && typeof result.catch === 'function') {
          result.catch((error) => logError('[Realtime] Analytics notification handler failed', error));
        }
      } catch (error) {
        logError('[Realtime] Analytics notification handler threw an error', error);
      }
    };

    const detachListeners = (target, handlers) => {
      if (!target) {
        return;
      }
      if (typeof target.off === 'function') {
        target.off('notification', handleNotification);
        if (handlers?.error) target.off('error', handlers.error);
        if (handlers?.end) target.off('end', handlers.end);
      } else {
        target.removeListener?.('notification', handleNotification);
        if (handlers?.error) target.removeListener?.('error', handlers.error);
        if (handlers?.end) target.removeListener?.('end', handlers.end);
      }
    };

    const destroyClient = async (target, handlers, { skipUnlisten = false } = {}) => {
      if (!target) {
        return;
      }
      detachListeners(target, handlers);
      if (!skipUnlisten) {
        try {
          await target.query(`UNLISTEN ${channelIdentifier}`);
        } catch (error) {
          logWarn('[Realtime] Failed to unlisten analytics channel', error);
        }
      }
      try {
        await target.end();
      } catch (error) {
        logWarn('[Realtime] Failed to close analytics notification client', error);
      }
    };

    const clearReconnectTimer = () => {
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
    };

    const scheduleReconnect = (delay = POSTGRES_RECONNECT_DELAY_MS) => {
      if (closed || reconnectTimer || connecting || client) {
        return;
      }
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        connect();
      }, delay);
      if (typeof reconnectTimer.unref === 'function') {
        reconnectTimer.unref();
      }
    };

    const connect = async () => {
      if (closed || connecting || client) {
        return;
      }
      connecting = true;

      const nextClient = new Client({ connectionString });
      const handlers = {
        error: (error) => {
          logError('[Realtime] Analytics notification client error', error);
          if (client === nextClient) {
            client = null;
            activeHandlers = null;
          }
          destroyClient(nextClient, handlers).catch((destroyError) => {
            logWarn('[Realtime] Failed to dispose analytics notification client', destroyError);
          });
          scheduleReconnect();
        },
        end: () => {
          if (client === nextClient) {
            client = null;
            activeHandlers = null;
          }
          detachListeners(nextClient, handlers);
          if (!closed) {
            logWarn('[Realtime] Analytics notification connection closed. Reconnecting…');
            scheduleReconnect();
          }
        },
      };

      nextClient.on('notification', handleNotification);
      nextClient.on('error', handlers.error);
      nextClient.on('end', handlers.end);

      try {
        await nextClient.connect();
        await nextClient.query(`LISTEN ${channelIdentifier}`);
        client = nextClient;
        activeHandlers = handlers;
        clearReconnectTimer();
      } catch (error) {
        detachListeners(nextClient, handlers);
        try {
          await nextClient.end();
        } catch (closeError) {
          logWarn('[Realtime] Failed to close analytics notification client', closeError);
        }
        logError('[Realtime] Failed to connect to analytics notification channel', error);
        scheduleReconnect();
      } finally {
        connecting = false;
      }
    };

    connect();

    return {
      async close() {
        closed = true;
        clearReconnectTimer();
        const target = client;
        const handlers = activeHandlers;
        client = null;
        activeHandlers = null;
        if (target) {
          await destroyClient(target, handlers).catch((error) => {
            logWarn('[Realtime] Failed to close analytics notification client', error);
          });
        }
      },
    };
  };
}
