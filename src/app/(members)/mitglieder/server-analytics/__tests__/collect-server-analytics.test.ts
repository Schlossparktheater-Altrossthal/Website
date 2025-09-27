import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AnalyticsHttpSummary, AnalyticsRealtimeSummary, AnalyticsSessionSummary } from "@prisma/client";

import { collectServerAnalytics } from "@/lib/server-analytics";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    analyticsHttpSummary: { findFirst: vi.fn() },
    analyticsHttpPeakHour: { findMany: vi.fn() },
    analyticsSessionSummary: { findFirst: vi.fn() },
    analyticsSessionInsight: { findMany: vi.fn() },
    analyticsTrafficSource: { findMany: vi.fn() },
    analyticsRealtimeSummary: { findFirst: vi.fn() },
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

vi.mock("@/lib/analytics/load-server-logs", () => ({
  loadLatestCriticalServerLogs: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/lib/server-analytics-data", () => ({
  loadDeviceBreakdownFromDatabase: vi.fn().mockResolvedValue([]),
  loadPagePerformanceMetrics: vi.fn().mockResolvedValue([]),
}));

describe("collectServerAnalytics", () => {
  beforeEach(() => {
    prismaMock.analyticsHttpSummary.findFirst.mockReset();
    prismaMock.analyticsHttpPeakHour.findMany.mockReset();
    prismaMock.analyticsSessionSummary.findFirst.mockReset();
    prismaMock.analyticsSessionInsight.findMany.mockReset();
    prismaMock.analyticsTrafficSource.findMany.mockReset();
    prismaMock.analyticsRealtimeSummary.findFirst.mockReset();
    process.env.DATABASE_URL = "postgres://test";
  });

  it("overrides static metrics with aggregated database values", async () => {
    const httpSummary: Partial<AnalyticsHttpSummary> = {
      windowStart: new Date("2024-01-01T10:00:00.000Z"),
      windowEnd: new Date("2024-01-01T11:00:00.000Z"),
      totalRequests: 200,
      successfulRequests: 180,
      clientErrorRequests: 15,
      serverErrorRequests: 5,
      averageDurationMs: 120,
      frontendRequests: 80,
      frontendAvgResponseMs: 90,
      frontendAvgPayloadBytes: 40_960,
      cacheHitRate: 0.42,
      frontendCacheHitRate: 0.6,
      membersRequests: 70,
      membersAvgResponseMs: 140,
      apiRequests: 50,
      apiAvgResponseMs: 160,
      apiErrorRate: 0.08,
      apiBackgroundJobs: 21,
    };

    const sessionSummary: Partial<AnalyticsSessionSummary> = {
      windowStart: new Date("2024-01-01T10:00:00.000Z"),
      windowEnd: new Date("2024-01-01T11:00:00.000Z"),
      peakConcurrentUsers: 5,
      membersRealtimeEvents: 12,
      membersAvgSessionDurationSeconds: 450,
    };

    const realtimeSummary: Partial<AnalyticsRealtimeSummary> = {
      windowStart: new Date("2024-01-01T10:00:00.000Z"),
      windowEnd: new Date("2024-01-01T11:00:00.000Z"),
      totalEvents: 40,
      eventCounts: { ping: 20 },
    };

    prismaMock.analyticsHttpSummary.findFirst.mockResolvedValue(httpSummary as AnalyticsHttpSummary);
    prismaMock.analyticsHttpPeakHour.findMany.mockResolvedValue([]);
    prismaMock.analyticsSessionSummary.findFirst.mockResolvedValue(
      sessionSummary as AnalyticsSessionSummary,
    );
    prismaMock.analyticsSessionInsight.findMany.mockResolvedValue([]);
    prismaMock.analyticsTrafficSource.findMany.mockResolvedValue([]);
    prismaMock.analyticsRealtimeSummary.findFirst.mockResolvedValue(
      realtimeSummary as AnalyticsRealtimeSummary,
    );

    const analytics = await collectServerAnalytics();

    expect(analytics.summary.cacheHitRate).toBeCloseTo(0.42, 5);
    expect(analytics.summary.peakConcurrentUsers).toBe(5);
    expect(analytics.summary.realtimeEventsLast24h).toBe(40);
    expect(analytics.requestBreakdown.frontend.cacheHitRate).toBeCloseTo(0.6, 5);
    expect(analytics.requestBreakdown.members.realtimeEvents).toBe(12);
    expect(analytics.requestBreakdown.members.avgSessionDurationSeconds).toBe(450);
    expect(analytics.requestBreakdown.api.backgroundJobs).toBe(21);
    expect(analytics.isDemoData).toBe(false);
  });
});
