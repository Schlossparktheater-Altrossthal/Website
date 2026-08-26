import type {
  AnalyticsRealtimeEvent,
  AnalyticsSession,
  AnalyticsTrafficAttribution,
  PrismaClient,
} from "@prisma/client";

import { aggregateHttpMetrics } from "@/lib/analytics/aggregate-http";
import {
  aggregateSessionMetrics,
  type AnalyticsSessionLike,
  type RealtimeEventLike,
  type TrafficAttributionLike,
} from "@/lib/analytics/aggregate-session-metrics";
import { aggregatePageMetrics } from "@/lib/analytics/aggregate-page-metrics";
import {
  DEFAULT_SERVER_ANALYTICS_SETTINGS,
  loadServerAnalyticsSettings,
  type ServerAnalyticsSettings,
} from "@/lib/server-analytics-settings";
import { prisma } from "@/lib/prisma";

const DEFAULT_HTTP_WINDOW_MINUTES = DEFAULT_SERVER_ANALYTICS_SETTINGS.httpWindowMinutes;
const DEFAULT_HTTP_BUCKET_MINUTES = DEFAULT_SERVER_ANALYTICS_SETTINGS.httpBucketMinutes;
const DEFAULT_SESSION_WINDOW_DAYS = DEFAULT_SERVER_ANALYTICS_SETTINGS.sessionWindowDays;
const DEFAULT_SESSION_RETENTION_DAYS = DEFAULT_SERVER_ANALYTICS_SETTINGS.sessionRetentionDays;
const DEFAULT_REALTIME_WINDOW_HOURS = DEFAULT_SERVER_ANALYTICS_SETTINGS.realtimeWindowHours;
const DEFAULT_PAGE_WINDOW_DAYS = DEFAULT_SERVER_ANALYTICS_SETTINGS.pageWindowDays;
const DEFAULT_PAGE_RETENTION_DAYS = DEFAULT_SERVER_ANALYTICS_SETTINGS.pageRetentionDays;

type AggregationResult<T> = { status: "skipped"; reason: string } | { status: "success"; data: T };

type HttpAggregationOptions = {
  prisma?: PrismaClient;
  now?: Date;
  windowMinutes?: number;
  bucketMinutes?: number;
  settings?: ServerAnalyticsSettings;
};

type SessionAggregationOptions = {
  prisma?: PrismaClient;
  now?: Date;
  windowDays?: number;
  retentionDays?: number;
  realtimeWindowHours?: number;
  settings?: ServerAnalyticsSettings;
};

type PageAggregationOptions = {
  prisma?: PrismaClient;
  now?: Date;
  windowDays?: number;
  retentionDays?: number;
  settings?: ServerAnalyticsSettings;
};

type ServerAnalyticsAggregationOptions = {
  http?: HttpAggregationOptions;
  sessions?: SessionAggregationOptions;
  pages?: PageAggregationOptions;
};

function needsHttpSettings(options?: HttpAggregationOptions): boolean {
  if (!options) {
    return false;
  }
  const settings = options.settings;
  if (options.windowMinutes === undefined && settings?.httpWindowMinutes === undefined) {
    return true;
  }
  if (options.bucketMinutes === undefined && settings?.httpBucketMinutes === undefined) {
    return true;
  }
  return false;
}

function needsSessionSettings(options?: SessionAggregationOptions): boolean {
  if (!options) {
    return false;
  }
  const settings = options.settings;
  if (options.windowDays === undefined && settings?.sessionWindowDays === undefined) {
    return true;
  }
  if (options.retentionDays === undefined && settings?.sessionRetentionDays === undefined) {
    return true;
  }
  if (options.realtimeWindowHours === undefined && settings?.realtimeWindowHours === undefined) {
    return true;
  }
  return false;
}

function needsPageSettings(options?: PageAggregationOptions): boolean {
  if (!options) {
    return false;
  }
  const settings = options.settings;
  if (options.windowDays === undefined && settings?.pageWindowDays === undefined) {
    return true;
  }
  if (options.retentionDays === undefined && settings?.pageRetentionDays === undefined) {
    return true;
  }
  return false;
}

export type ServerAnalyticsAggregationSummary = {
  http: AggregationResult<{
    windowStart: Date;
    windowEnd: Date;
    requestCount: number;
  }>;
  sessions: AggregationResult<{
    sessionCount: number;
    trafficAttributionCount: number;
    realtimeEventCount: number;
  }>;
  pages: AggregationResult<{
    pageViewCount: number;
  }>;
};

function getPrisma(client?: PrismaClient): PrismaClient {
  return client ?? prisma;
}

function isDatabaseEnabled(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

function resolvePositiveInteger(
  value: unknown,
  fallback: number,
  { min }: { min?: number } = {},
): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  const normalized = Math.round(parsed);
  if (typeof min === "number" && normalized < min) {
    return fallback;
  }
  if (normalized <= 0) {
    return fallback;
  }
  return normalized;
}

function transformSessions(rows: AnalyticsSession[]): AnalyticsSessionLike[] {
  return rows.map((session) => ({
    ...session,
    startedAt: session.startedAt instanceof Date ? session.startedAt : new Date(session.startedAt),
    lastSeenAt:
      session.lastSeenAt instanceof Date ? session.lastSeenAt : new Date(session.lastSeenAt),
    pagePaths: Array.isArray(session.pagePaths) ? [...session.pagePaths] : [],
  }));
}

function transformRealtimeEvents(rows: AnalyticsRealtimeEvent[]): RealtimeEventLike[] {
  return rows.map((event) => ({
    ...event,
    occurredAt: event.occurredAt instanceof Date ? event.occurredAt : new Date(event.occurredAt),
  }));
}

function toTrafficAttributionLike(rows: AnalyticsTrafficAttribution[]): TrafficAttributionLike[] {
  return rows.map((row) => ({
    sessionId: row.sessionId,
    analyticsSessionId: row.analyticsSessionId,
    path: row.path,
    referrer: row.referrer,
    referrerDomain: row.referrerDomain,
    utmSource: row.utmSource,
    utmMedium: row.utmMedium,
    utmCampaign: row.utmCampaign,
    utmTerm: row.utmTerm,
    utmContent: row.utmContent,
  }));
}

type AnalyticsAggregationContext = {
  client: PrismaClient;
  now: Date;
  settings: ServerAnalyticsSettings | null;
};

async function runAggregation<T>(
  options: { prisma?: PrismaClient; now?: Date; settings?: ServerAnalyticsSettings },
  shouldLoadSettings: boolean,
  settingsLabel: string,
  execute: (context: AnalyticsAggregationContext) => Promise<T>,
): Promise<AggregationResult<T>> {
  if (!isDatabaseEnabled()) {
    return { status: "skipped", reason: "database_disabled" };
  }

  const client = getPrisma(options.prisma);
  const now = options.now ?? new Date();
  let settings = options.settings ?? null;

  if (!settings && shouldLoadSettings) {
    try {
      settings = await loadServerAnalyticsSettings(client);
    } catch (error) {
      console.error(
        `[analytics] Failed to load server analytics settings for ${settingsLabel} aggregation`,
        error,
      );
    }
  }

  const data = await execute({ client, now, settings });

  return { status: "success", data };
}

export async function runHttpAnalyticsAggregation(options: HttpAggregationOptions = {}): Promise<
  AggregationResult<{
    windowStart: Date;
    windowEnd: Date;
    requestCount: number;
  }>
> {
  return runAggregation(
    options,
    options.windowMinutes === undefined || options.bucketMinutes === undefined,
    "HTTP",
    async ({ client, now, settings }) => {
      const windowMinutes =
        options.windowMinutes ??
        settings?.httpWindowMinutes ??
        resolvePositiveInteger(
          process.env.ANALYTICS_HTTP_WINDOW_MINUTES,
          DEFAULT_HTTP_WINDOW_MINUTES,
          { min: 5 },
        );
      const bucketMinutes =
        options.bucketMinutes ??
        settings?.httpBucketMinutes ??
        resolvePositiveInteger(
          process.env.ANALYTICS_HTTP_BUCKET_MINUTES,
          DEFAULT_HTTP_BUCKET_MINUTES,
          { min: 1 },
        );
      const windowStart = new Date(now.getTime() - Math.max(windowMinutes, 5) * 60_000);

      const [requests, heartbeats] = await Promise.all([
        client.analyticsHttpRequest.findMany({
          where: {
            timestamp: {
              gte: windowStart,
              lte: now,
            },
          },
          orderBy: { timestamp: "asc" },
        }),
        client.analyticsUptimeHeartbeat.findMany({
          where: {
            observedAt: {
              gte: windowStart,
              lte: now,
            },
          },
        }),
      ]);

      const { summary, peakHours } = aggregateHttpMetrics({
        requests,
        heartbeats,
        windowStart,
        windowEnd: now,
        bucketMinutes,
      });

      await client.$transaction(async (tx) => {
        await tx.analyticsHttpSummary.deleteMany({});
        await tx.analyticsHttpPeakHour.deleteMany({});

        await tx.analyticsHttpSummary.create({
          data: {
            windowStart: summary.windowStart,
            windowEnd: summary.windowEnd,
            totalRequests: summary.totalRequests,
            successfulRequests: summary.successfulRequests,
            clientErrorRequests: summary.clientErrorRequests,
            serverErrorRequests: summary.serverErrorRequests,
            averageDurationMs: summary.averageDurationMs,
            p95DurationMs: summary.p95DurationMs,
            averagePayloadBytes: summary.averagePayloadBytes,
            uptimePercentage: summary.uptimePercentage,
            frontendRequests: summary.frontendRequests,
            frontendAvgResponseMs: summary.frontendAvgResponseMs,
            frontendAvgPayloadBytes: summary.frontendAvgPayloadBytes,
            cacheHitRate: summary.cacheHitRate,
            frontendCacheHitRate: summary.frontendCacheHitRate,
            membersRequests: summary.membersRequests,
            membersAvgResponseMs: summary.membersAvgResponseMs,
            guestRequests: summary.guestRequests,
            guestAvgResponseMs: summary.guestAvgResponseMs,
            apiRequests: summary.apiRequests,
            apiAvgResponseMs: summary.apiAvgResponseMs,
            apiErrorRate: summary.apiErrorRate,
            apiBackgroundJobs: summary.apiBackgroundJobs,
            botRequests: summary.botRequests,
            botAvgResponseMs: summary.botAvgResponseMs,
            botBlockedRequests: summary.botBlockedRequests,
          },
        });

        if (peakHours.length > 0) {
          await tx.analyticsHttpPeakHour.createMany({
            data: peakHours.map((entry) => ({
              bucketStart: entry.bucketStart,
              bucketEnd: entry.bucketEnd,
              requests: entry.requests,
              share: entry.share,
            })),
          });
        }
      });

      return {
        windowStart,
        windowEnd: now,
        requestCount: requests.length,
      };
    },
  );
}

export async function runSessionAnalyticsAggregation(
  options: SessionAggregationOptions = {},
): Promise<
  AggregationResult<{
    sessionCount: number;
    trafficAttributionCount: number;
    realtimeEventCount: number;
  }>
> {
  return runAggregation(
    options,
    options.windowDays === undefined ||
      options.retentionDays === undefined ||
      options.realtimeWindowHours === undefined,
    "session",
    async ({ client, now, settings }) => {
      const windowDays =
        options.windowDays ??
        settings?.sessionWindowDays ??
        resolvePositiveInteger(
          process.env.ANALYTICS_SESSION_WINDOW_DAYS,
          DEFAULT_SESSION_WINDOW_DAYS,
        );
      const retentionDays =
        options.retentionDays ??
        settings?.sessionRetentionDays ??
        resolvePositiveInteger(
          process.env.ANALYTICS_SESSION_RETENTION_DAYS,
          DEFAULT_SESSION_RETENTION_DAYS,
        );
      const realtimeWindowHours =
        options.realtimeWindowHours ??
        settings?.realtimeWindowHours ??
        DEFAULT_REALTIME_WINDOW_HOURS;

      const windowStart = new Date(now.getTime() - windowDays * 24 * 60 * 60 * 1000);
      const realtimeWindowStart = new Date(now.getTime() - realtimeWindowHours * 60 * 60 * 1000);

      const [sessionsRaw, trafficRaw, realtimeEventsRaw] = await Promise.all([
        client.analyticsSession.findMany({
          where: {
            startedAt: {
              gte: windowStart,
              lte: now,
            },
          },
        }),
        client.analyticsTrafficAttribution.findMany({
          where: {
            createdAt: {
              gte: windowStart,
              lte: now,
            },
          },
        }),
        client.analyticsRealtimeEvent.findMany({
          where: {
            occurredAt: {
              gte: realtimeWindowStart,
              lte: now,
            },
          },
        }),
      ]);

      const sessions = transformSessions(sessionsRaw as AnalyticsSession[]);
      const traffic = toTrafficAttributionLike(trafficRaw as AnalyticsTrafficAttribution[]);
      const realtimeEvents = transformRealtimeEvents(realtimeEventsRaw as AnalyticsRealtimeEvent[]);

      const result = aggregateSessionMetrics({
        sessions,
        traffic,
        realtimeEvents,
        now,
      });

      await client.$transaction(async (tx) => {
        await tx.analyticsSessionInsight.deleteMany({});
        await tx.analyticsTrafficSource.deleteMany({});
        await tx.analyticsRealtimeSummary.deleteMany({});
        await tx.analyticsSessionSummary.deleteMany({});

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

        await tx.analyticsSessionSummary.create({
          data: {
            windowStart: result.sessionSummary.windowStart,
            windowEnd: result.sessionSummary.windowEnd,
            peakConcurrentUsers: result.sessionSummary.peakConcurrentUsers,
            membersRealtimeEvents: result.sessionSummary.membersRealtimeEvents,
            membersAvgSessionDurationSeconds:
              result.sessionSummary.membersAvgSessionDurationSeconds,
            guestAvgSessionDurationSeconds: result.sessionSummary.guestAvgSessionDurationSeconds,
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

      return {
        sessionCount: sessionsRaw.length,
        trafficAttributionCount: trafficRaw.length,
        realtimeEventCount: realtimeEventsRaw.length,
      };
    },
  );
}

export async function runPageAnalyticsAggregation(
  options: PageAggregationOptions = {},
): Promise<AggregationResult<{ pageViewCount: number }>> {
  return runAggregation(
    options,
    options.windowDays === undefined || options.retentionDays === undefined,
    "page",
    async ({ client, now, settings }) => {
      const windowDays =
        options.windowDays ??
        settings?.pageWindowDays ??
        resolvePositiveInteger(process.env.ANALYTICS_PAGE_WINDOW_DAYS, DEFAULT_PAGE_WINDOW_DAYS);
      const retentionDays =
        options.retentionDays ??
        settings?.pageRetentionDays ??
        resolvePositiveInteger(
          process.env.ANALYTICS_PAGE_RETENTION_DAYS,
          DEFAULT_PAGE_RETENTION_DAYS,
        );

      const windowStart = new Date(now.getTime() - windowDays * 24 * 60 * 60 * 1000);

      const pageViews = await client.analyticsPageView.findMany({
        where: {
          createdAt: {
            gte: windowStart,
            lte: now,
          },
        },
        select: {
          path: true,
          scope: true,
          deviceHint: true,
          loadTimeMs: true,
          lcpMs: true,
          timeOnPageMs: true,
          weight: true,
        },
      });

      const { pages, devices } = aggregatePageMetrics(pageViews);

      await client.$transaction(async (tx) => {
        await tx.analyticsPageMetric.deleteMany({});
        await tx.analyticsDeviceMetric.deleteMany({});

        if (pages.length > 0) {
          await tx.analyticsPageMetric.createMany({
            data: pages.map((page) => ({
              path: page.path,
              scope: page.scope,
              avgLoadMs: page.avgLoadMs,
              lcpMs: page.lcpMs,
              avgTimeOnPageSeconds: page.avgTimeOnPageSeconds,
              weight: page.weight,
            })),
          });
        }

        if (devices.length > 0) {
          await tx.analyticsDeviceMetric.createMany({
            data: devices.map((device) => ({
              device: device.device,
              sessions: device.sessions,
              avgLoadMs: device.avgLoadMs,
              share: device.share,
            })),
          });
        }

        if (retentionDays > 0) {
          const cutoff = new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000);
          await tx.analyticsPageView.deleteMany({
            where: {
              createdAt: { lt: cutoff },
            },
          });
          await tx.analyticsDeviceSnapshot.deleteMany({
            where: {
              createdAt: { lt: cutoff },
            },
          });
        }
      });

      return {
        pageViewCount: pageViews.length,
      };
    },
  );
}

export async function runServerAnalyticsAggregation(
  options: ServerAnalyticsAggregationOptions = {},
): Promise<ServerAnalyticsAggregationSummary> {
  let sharedSettings: ServerAnalyticsSettings | null = null;

  if (
    isDatabaseEnabled() &&
    (needsHttpSettings(options.http) ||
      needsSessionSettings(options.sessions) ||
      needsPageSettings(options.pages))
  ) {
    try {
      const prismaCandidate =
        options.http?.prisma ?? options.sessions?.prisma ?? options.pages?.prisma;
      sharedSettings = await loadServerAnalyticsSettings(getPrisma(prismaCandidate));
    } catch (error) {
      console.error("[analytics] Failed to load shared server analytics settings", error);
      sharedSettings = null;
    }
  }

  const [http, sessions, pages] = await Promise.all([
    runHttpAnalyticsAggregation({
      ...options.http,
      settings: options.http?.settings ?? sharedSettings ?? undefined,
    }),
    runSessionAnalyticsAggregation({
      ...options.sessions,
      settings: options.sessions?.settings ?? sharedSettings ?? undefined,
    }),
    runPageAnalyticsAggregation({
      ...options.pages,
      settings: options.pages?.settings ?? sharedSettings ?? undefined,
    }),
  ]);

  return {
    http,
    sessions,
    pages,
  };
}
