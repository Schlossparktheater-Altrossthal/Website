import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PrismaClient } from "@prisma/client";

const aggregatorMocks = vi.hoisted(() => ({
  aggregateHttpMetrics: vi.fn(),
  aggregateSessionMetrics: vi.fn(),
  aggregatePageMetrics: vi.fn(),
}));

vi.mock("@/lib/analytics/aggregate-http", () => ({
  aggregateHttpMetrics: aggregatorMocks.aggregateHttpMetrics,
}));

vi.mock("@/lib/analytics/aggregate-session-metrics", () => ({
  aggregateSessionMetrics: aggregatorMocks.aggregateSessionMetrics,
}));

vi.mock("@/lib/analytics/aggregate-page-metrics", () => ({
  aggregatePageMetrics: aggregatorMocks.aggregatePageMetrics,
}));

import {
  runHttpAnalyticsAggregation,
  runServerAnalyticsAggregation,
  runSessionAnalyticsAggregation,
} from "@/lib/analytics/server-analytics-pipeline";

describe("server analytics pipeline", () => {
  beforeEach(() => {
    aggregatorMocks.aggregateHttpMetrics.mockReset();
    aggregatorMocks.aggregateSessionMetrics.mockReset();
    aggregatorMocks.aggregatePageMetrics.mockReset();
    process.env.DATABASE_URL = "postgres://test";
  });

  it("aggregates HTTP analytics and persists summaries", async () => {
    const now = new Date("2024-01-01T01:00:00.000Z");
    const requests = [
      {
        timestamp: new Date("2024-01-01T00:30:00.000Z"),
        area: "public",
        statusCode: 200,
        durationMs: 120,
        payloadBytes: 512,
        route: "/",
        method: "GET",
      },
    ];
    const heartbeats: unknown[] = [];

    const tx = {
      analyticsHttpSummary: {
        deleteMany: vi.fn().mockResolvedValue(undefined),
        create: vi.fn().mockResolvedValue(undefined),
      },
      analyticsHttpPeakHour: {
        deleteMany: vi.fn().mockResolvedValue(undefined),
        createMany: vi.fn().mockResolvedValue(undefined),
      },
    };

    const prismaMock = {
      analyticsHttpRequest: { findMany: vi.fn().mockResolvedValue(requests) },
      analyticsUptimeHeartbeat: { findMany: vi.fn().mockResolvedValue(heartbeats) },
      $transaction: vi.fn(async (callback: (tx: typeof tx) => Promise<void>) => {
        await callback(tx);
      }),
    } as unknown as PrismaClient;

    aggregatorMocks.aggregateHttpMetrics.mockReturnValue({
      summary: {
        windowStart: new Date("2024-01-01T00:00:00.000Z"),
        windowEnd: now,
        totalRequests: 1,
        successfulRequests: 1,
        clientErrorRequests: 0,
        serverErrorRequests: 0,
        averageDurationMs: 120,
        p95DurationMs: 120,
        averagePayloadBytes: 512,
        uptimePercentage: 99,
        frontendRequests: 1,
        frontendAvgResponseMs: 120,
        frontendAvgPayloadBytes: 512,
        cacheHitRate: 0.5,
        frontendCacheHitRate: 0.5,
        membersRequests: 0,
        membersAvgResponseMs: 0,
        guestRequests: 1,
        guestAvgResponseMs: 120,
        apiRequests: 0,
        apiAvgResponseMs: 0,
        apiErrorRate: 0,
        apiBackgroundJobs: 0,
        botRequests: 0,
        botAvgResponseMs: 0,
        botBlockedRequests: 0,
      },
      peakHours: [
        {
          bucketStart: new Date("2024-01-01T00:00:00.000Z"),
          bucketEnd: new Date("2024-01-01T01:00:00.000Z"),
          requests: 1,
          share: 1,
        },
      ],
    });

    const result = await runHttpAnalyticsAggregation({
      prisma: prismaMock,
      now,
      windowMinutes: 60,
      bucketMinutes: 60,
    });

    expect(aggregatorMocks.aggregateHttpMetrics).toHaveBeenCalledWith(
      expect.objectContaining({
        requests,
        windowEnd: now,
      }),
    );
    expect(tx.analyticsHttpSummary.deleteMany).toHaveBeenCalledOnce();
    expect(tx.analyticsHttpSummary.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ totalRequests: 1 }),
    });
    expect(result.status).toBe("success");
    if (result.status === "success") {
      expect(result.data.requestCount).toBe(1);
    }
  });

  it("aggregates session analytics and writes derived data", async () => {
    const now = new Date("2024-01-02T00:00:00.000Z");
    const sessions = [
      {
        id: "session-1",
        userId: "user-1",
        isMember: true,
        membershipRole: "cast",
        startedAt: new Date("2024-01-01T22:00:00.000Z"),
        endedAt: null,
        lastSeenAt: new Date("2024-01-01T23:00:00.000Z"),
        durationSeconds: null,
        pagePaths: ["/mitglieder"],
      },
    ];
    const traffic = [
      {
        sessionId: "session-1",
        analyticsSessionId: "session-1",
        path: "/mitglieder",
        referrer: null,
        referrerDomain: null,
        utmSource: null,
        utmMedium: null,
        utmCampaign: null,
        utmTerm: null,
        utmContent: null,
      },
    ];
    const realtimeEvents = [
      {
        id: "event-1",
        eventType: "ping",
        occurredAt: new Date("2024-01-01T23:30:00.000Z"),
      },
    ];

    const tx = {
      analyticsSessionInsight: {
        deleteMany: vi.fn().mockResolvedValue(undefined),
        createMany: vi.fn().mockResolvedValue(undefined),
      },
      analyticsTrafficSource: {
        deleteMany: vi.fn().mockResolvedValue(undefined),
        createMany: vi.fn().mockResolvedValue(undefined),
      },
      analyticsRealtimeSummary: {
        deleteMany: vi.fn().mockResolvedValue(undefined),
        create: vi.fn().mockResolvedValue(undefined),
      },
      analyticsSessionSummary: {
        deleteMany: vi.fn().mockResolvedValue(undefined),
        create: vi.fn().mockResolvedValue(undefined),
      },
      analyticsSession: { deleteMany: vi.fn().mockResolvedValue(undefined) },
      analyticsTrafficAttribution: { deleteMany: vi.fn().mockResolvedValue(undefined) },
      analyticsRealtimeEvent: { deleteMany: vi.fn().mockResolvedValue(undefined) },
    };

    const prismaMock = {
      analyticsSession: { findMany: vi.fn().mockResolvedValue(sessions) },
      analyticsTrafficAttribution: { findMany: vi.fn().mockResolvedValue(traffic) },
      analyticsRealtimeEvent: { findMany: vi.fn().mockResolvedValue(realtimeEvents) },
      $transaction: vi.fn(async (callback: (tx: typeof tx) => Promise<void>) => {
        await callback(tx);
      }),
    } as unknown as PrismaClient;

    aggregatorMocks.aggregateSessionMetrics.mockReturnValue({
      sessionInsights: [
        {
          segment: "Mitglieder",
          avgSessionDurationSeconds: 360,
          pagesPerSession: 3,
          retentionRate: 0.6,
          share: 0.4,
          conversionRate: 0.1,
        },
      ],
      trafficSources: [
        {
          channel: "Direct",
          sessions: 10,
          avgSessionDurationSeconds: 200,
          conversionRate: 0.1,
          changePercent: 0.05,
        },
      ],
      realtimeSummary: {
        windowStart: new Date("2024-01-01T22:00:00.000Z"),
        windowEnd: now,
        totalEvents: 1,
        eventCounts: { ping: 1 },
      },
      sessionSummary: {
        windowStart: new Date("2024-01-01T22:00:00.000Z"),
        windowEnd: now,
        peakConcurrentUsers: 2,
        membersRealtimeEvents: 1,
        membersAvgSessionDurationSeconds: 420,
        guestAvgSessionDurationSeconds: 180,
      },
    });

    const settings = {
      httpWindowMinutes: 1440,
      httpBucketMinutes: 60,
      sessionWindowDays: 30,
      sessionRetentionDays: 180,
      realtimeWindowHours: 24,
      pageWindowDays: 14,
      pageRetentionDays: 60,
    };

    const result = await runSessionAnalyticsAggregation({ prisma: prismaMock, now, settings });

    expect(aggregatorMocks.aggregateSessionMetrics).toHaveBeenCalled();
    expect(tx.analyticsSessionInsight.deleteMany).toHaveBeenCalledOnce();
    expect(tx.analyticsSessionInsight.createMany).toHaveBeenCalled();
    expect(tx.analyticsRealtimeSummary.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ totalEvents: 1 }),
    });
    expect(result.status).toBe("success");
    if (result.status === "success") {
      expect(result.data.sessionCount).toBe(1);
      expect(result.data.realtimeEventCount).toBe(1);
    }
  });

  it("skips aggregation gracefully when no database is configured", async () => {
    delete process.env.DATABASE_URL;

    const summary = await runServerAnalyticsAggregation();

    expect(summary.http.status).toBe("skipped");
    expect(summary.sessions.status).toBe("skipped");
    expect(summary.pages.status).toBe("skipped");
    expect(aggregatorMocks.aggregateHttpMetrics).not.toHaveBeenCalled();
    expect(aggregatorMocks.aggregateSessionMetrics).not.toHaveBeenCalled();
    expect(aggregatorMocks.aggregatePageMetrics).not.toHaveBeenCalled();
  });
});
