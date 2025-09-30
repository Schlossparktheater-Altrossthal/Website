import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AnalyticsHttpSummary, AnalyticsRealtimeSummary, AnalyticsSessionSummary } from "@prisma/client";

import { collectServerAnalytics } from "@/lib/server-analytics";

const { prismaMock, loadSettingsMock } = vi.hoisted(() => ({
  prismaMock: {
    analyticsHttpSummary: { findFirst: vi.fn() },
    analyticsHttpPeakHour: { findMany: vi.fn() },
    analyticsSessionSummary: { findFirst: vi.fn() },
    analyticsSessionInsight: { findMany: vi.fn() },
    analyticsTrafficSource: { findMany: vi.fn() },
    analyticsRealtimeSummary: { findFirst: vi.fn() },
  },
  loadSettingsMock: vi.fn(),
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

vi.mock("@/lib/server-analytics-settings", async () => {
  const actual = await vi.importActual<typeof import("@/lib/server-analytics-settings")>(
    "@/lib/server-analytics-settings",
  );
  return {
    ...actual,
    loadServerAnalyticsSettings: loadSettingsMock,
  };
});

describe("collectServerAnalytics", () => {
  beforeEach(() => {
    prismaMock.analyticsHttpSummary.findFirst.mockReset();
    prismaMock.analyticsHttpPeakHour.findMany.mockReset();
    prismaMock.analyticsSessionSummary.findFirst.mockReset();
    prismaMock.analyticsSessionInsight.findMany.mockReset();
    prismaMock.analyticsTrafficSource.findMany.mockReset();
    prismaMock.analyticsRealtimeSummary.findFirst.mockReset();
    loadSettingsMock.mockReset();
    loadSettingsMock.mockResolvedValue({
      httpWindowMinutes: 1440,
      httpBucketMinutes: 60,
      sessionWindowDays: 30,
      sessionRetentionDays: 180,
      realtimeWindowHours: 24,
      pageWindowDays: 14,
      pageRetentionDays: 60,
    });
    process.env.DATABASE_URL = "postgres://test";
  });

  it("overrides static metrics with aggregated database values", async () => {
    loadSettingsMock.mockResolvedValue({
      httpWindowMinutes: 900,
      httpBucketMinutes: 45,
      sessionWindowDays: 21,
      sessionRetentionDays: 120,
      realtimeWindowHours: 18,
      pageWindowDays: 10,
      pageRetentionDays: 50,
    });
    const httpSummary = {
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
      botRequests: 30,
      botAvgResponseMs: 180,
      botBlockedRequests: 4,
      guestRequests: 90,
      guestAvgResponseMs: 95,
    } as AnalyticsHttpSummary & {
      botRequests: number;
      botAvgResponseMs: number;
      botBlockedRequests: number;
      guestRequests: number;
      guestAvgResponseMs: number;
    };

    const sessionSummary: Partial<AnalyticsSessionSummary> = {
      windowStart: new Date("2024-01-01T10:00:00.000Z"),
      windowEnd: new Date("2024-01-01T11:00:00.000Z"),
      peakConcurrentUsers: 5,
      membersRealtimeEvents: 12,
      membersAvgSessionDurationSeconds: 450,
      guestAvgSessionDurationSeconds: 260,
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
    const loggedOutSegment = analytics.visitorDistribution.find((segment) => segment.id === "logged-out");
    expect(loggedOutSegment?.requests).toBe(90);
    expect(loggedOutSegment?.avgSessionDurationSeconds).toBe(260);
    const botSegment = analytics.visitorDistribution.find((segment) => segment.id === "bot");
    expect(botSegment?.requests).toBe(30);
    expect(botSegment?.avgResponseTimeMs).toBe(180);
    expect(botSegment?.blockedRequests).toBe(4);
    expect(analytics.isDemoData).toBe(false);
    expect(analytics.settings).toEqual({
      httpWindowMinutes: 900,
      httpBucketMinutes: 45,
      sessionWindowDays: 21,
      sessionRetentionDays: 120,
      realtimeWindowHours: 18,
      pageWindowDays: 10,
      pageRetentionDays: 50,
    });
  });

  it("keeps the demo flag when no database connection is available", async () => {
    delete process.env.DATABASE_URL;

    const analytics = await collectServerAnalytics();

    expect(prismaMock.analyticsHttpSummary.findFirst).not.toHaveBeenCalled();
    expect(prismaMock.analyticsSessionSummary.findFirst).not.toHaveBeenCalled();
    expect(prismaMock.analyticsRealtimeSummary.findFirst).not.toHaveBeenCalled();
    expect(analytics.isDemoData).toBe(true);
    expect(loadSettingsMock).not.toHaveBeenCalled();
  });
});
