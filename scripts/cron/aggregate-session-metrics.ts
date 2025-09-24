import { prisma } from "@/lib/prisma";
import {
  aggregateSessionMetrics,
  type AnalyticsSessionLike,
  type RealtimeEventLike,
  type TrafficAttributionLike,
} from "@/lib/analytics/aggregate-session-metrics";
import type {
  AnalyticsRealtimeEvent,
  AnalyticsSession,
  AnalyticsTrafficAttribution,
} from "@prisma/client";

const DEFAULT_SESSION_WINDOW_DAYS = 30;
const DEFAULT_RETENTION_DAYS = 180;

function resolvePositiveInteger(value: unknown, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.round(parsed);
}

function transformSessions(sessions: AnalyticsSession[]): AnalyticsSessionLike[] {
  return sessions.map((session) => ({
    ...session,
    startedAt: session.startedAt instanceof Date ? session.startedAt : new Date(session.startedAt),
    lastSeenAt: session.lastSeenAt instanceof Date ? session.lastSeenAt : new Date(session.lastSeenAt),
    pagePaths: Array.isArray(session.pagePaths) ? [...session.pagePaths] : [],
  }));
}

function transformRealtimeEvents(events: AnalyticsRealtimeEvent[]): RealtimeEventLike[] {
  return events.map((event) => ({
    ...event,
    occurredAt: event.occurredAt instanceof Date ? event.occurredAt : new Date(event.occurredAt),
  }));
}

async function notifyRealtime(job: string, payload: Record<string, unknown> = {}) {
  if (!process.env.DATABASE_URL) {
    return;
  }

  try {
    const channelPayload = JSON.stringify({
      job,
      scope: "analytics",
      timestamp: new Date().toISOString(),
      ...payload,
    });
    await prisma.$executeRaw`SELECT pg_notify('server_analytics_update', ${channelPayload})`;
  } catch (error) {
    console.error(`[analytics] Failed to notify realtime server after ${job} aggregation`, error);
  }
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.warn("[analytics] DATABASE_URL is not set. Skipping session metrics aggregation.");
    return;
  }

  const now = new Date();
  const windowDays = resolvePositiveInteger(
    process.env.ANALYTICS_SESSION_WINDOW_DAYS,
    DEFAULT_SESSION_WINDOW_DAYS,
  );
  const retentionDays = resolvePositiveInteger(
    process.env.ANALYTICS_SESSION_RETENTION_DAYS,
    DEFAULT_RETENTION_DAYS,
  );
  const windowStart = new Date(now.getTime() - windowDays * 24 * 60 * 60 * 1000);
  const realtimeWindowStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const [sessionsRaw, trafficRaw, realtimeEventsRaw] = await Promise.all([
    prisma.analyticsSession.findMany({
      where: {
        startedAt: {
          gte: windowStart,
          lte: now,
        },
      },
    }),
    prisma.analyticsTrafficAttribution.findMany({
      where: {
        createdAt: {
          gte: windowStart,
          lte: now,
        },
      },
    }),
    prisma.analyticsRealtimeEvent.findMany({
      where: {
        occurredAt: {
          gte: realtimeWindowStart,
          lte: now,
        },
      },
    }),
  ]);

  const sessions = transformSessions(sessionsRaw);
  const traffic = trafficRaw as AnalyticsTrafficAttribution[] as TrafficAttributionLike[];
  const realtimeEvents = transformRealtimeEvents(realtimeEventsRaw);

  const result = aggregateSessionMetrics({
    sessions,
    traffic,
    realtimeEvents,
    now,
  });

  await prisma.$transaction(async (tx) => {
    await tx.analyticsSessionInsight.deleteMany({});
    await tx.analyticsTrafficSource.deleteMany({});
    await tx.analyticsRealtimeSummary.deleteMany({});

    if (result.sessionInsights.length > 0) {
      await tx.analyticsSessionInsight.createMany({
        data: result.sessionInsights.map((insight) => ({
          segment: insight.segment,
          avgSessionDurationSeconds: insight.avgSessionDurationSeconds,
          pagesPerSession: insight.pagesPerSession,
          retentionRate: insight.retentionRate,
          share: insight.share,
          conversionRate: insight.conversionRate,
        })),
      });
    }

    if (result.trafficSources.length > 0) {
      await tx.analyticsTrafficSource.createMany({
        data: result.trafficSources.map((source) => ({
          channel: source.channel,
          sessions: source.sessions,
          avgSessionDurationSeconds: source.avgSessionDurationSeconds,
          conversionRate: source.conversionRate,
          changePercent: source.changePercent,
        })),
      });
    }

    await tx.analyticsRealtimeSummary.create({
      data: {
        windowStart: result.realtimeSummary.windowStart,
        windowEnd: result.realtimeSummary.windowEnd,
        totalEvents: result.realtimeSummary.totalEvents,
        eventCounts: result.realtimeSummary.eventCounts,
      },
    });

    if (retentionDays > 0) {
      const cutoff = new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000);
      await tx.analyticsSession.deleteMany({
        where: {
          startedAt: { lt: cutoff },
        },
      });
      await tx.analyticsTrafficAttribution.deleteMany({
        where: {
          createdAt: { lt: cutoff },
        },
      });
      await tx.analyticsRealtimeEvent.deleteMany({
        where: {
          occurredAt: { lt: cutoff },
        },
      });
    }
  });

  await notifyRealtime("session", { windowEnd: now.toISOString() });
}

void main()
  .catch((error) => {
    console.error("[analytics] Failed to aggregate session metrics", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (process.env.DATABASE_URL) {
      try {
        await prisma.$disconnect();
      } catch (error) {
        console.error("[analytics] Failed to disconnect Prisma after session aggregation", error);
      }
    }
  });
