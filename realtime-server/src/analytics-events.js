import { PrismaClient } from '@prisma/client';

const globalPrismaKey = Symbol.for('__realtime_prisma');

function getGlobalPrisma() {
  const globalObject = globalThis;
  if (!globalObject[globalPrismaKey]) {
    globalObject[globalPrismaKey] = new PrismaClient();
  }
  return globalObject[globalPrismaKey];
}

export function createRealtimeAnalyticsRecorder({ logger } = {}) {
  const enabled = Boolean(process.env.DATABASE_URL);
  const logError = typeof logger?.error === 'function' ? (...args) => logger.error(...args) : (...args) => console.error(...args);
  let prisma = null;

  async function ensureClient() {
    if (!enabled) {
      return null;
    }
    if (prisma) {
      return prisma;
    }
    try {
      prisma = getGlobalPrisma();
    } catch (error) {
      logError('[Realtime] Failed to initialize Prisma for analytics events', error);
      prisma = null;
    }
    return prisma;
  }

  return {
    async record(eventType, occurredAt = new Date()) {
      const client = await ensureClient();
      if (!client) {
        return;
      }
      try {
        await client.analyticsRealtimeEvent.create({
          data: {
            eventType,
            occurredAt,
          },
        });
      } catch (error) {
        logError('[Realtime] Failed to persist realtime analytics event', error);
      }
    },
    async flush() {
      if (prisma && typeof prisma.$disconnect === 'function') {
        try {
          await prisma.$disconnect();
        } catch (error) {
          logError('[Realtime] Failed to disconnect Prisma for analytics recorder', error);
        }
        prisma = null;
      }
    },
  };
}
