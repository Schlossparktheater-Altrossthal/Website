import { describe, expect, it } from "vitest";

import type { AnalyticsHttpSummary } from "@prisma/client";

import { deriveOptimizationInsights } from "@/lib/analytics/derive-optimization-insights";
import type { DeviceStat, OptimizationInsight, PagePerformanceEntry, SessionInsight } from "@/lib/server-analytics";

const baseFallback: OptimizationInsight[] = [
  {
    id: "fallback-1",
    area: "Frontend",
    title: "Fallback",
    description: "Fallback description",
    impact: "Mittel",
    metric: "-",
  },
];

const emptyPage: PagePerformanceEntry = {
  path: "/",
  title: "Home",
  views: 0,
  uniqueVisitors: 0,
  avgTimeOnPageSeconds: 0,
  loadTimeMs: 0,
  lcpMs: 0,
  bounceRate: 0,
  exitRate: 0,
  avgScrollDepth: 0,
  goalCompletionRate: 0,
};

describe("deriveOptimizationInsights", () => {
  it("returns fallback entries when requested", () => {
    const result = deriveOptimizationInsights({
      publicPages: [emptyPage],
      memberPages: [],
      deviceStats: [],
      sessionInsights: [],
      httpSummary: null,
      fallback: baseFallback,
      useFallbackOnly: true,
    });

    expect(result).toEqual(baseFallback);
    expect(result).not.toBe(baseFallback);
  });

  it("returns fallback when no rule matches", () => {
    const result = deriveOptimizationInsights({
      publicPages: [emptyPage],
      memberPages: [],
      deviceStats: [],
      sessionInsights: [],
      httpSummary: null,
      fallback: baseFallback,
    });

    expect(result).toEqual(baseFallback);
  });

  it("derives insights from analytics data", () => {
    const publicPages: PagePerformanceEntry[] = [
      {
        ...emptyPage,
        path: "/events/sommerfest",
        title: "Sommerfest",
        views: 4200,
        loadTimeMs: 2600,
        lcpMs: 2100,
      },
      {
        ...emptyPage,
        path: "/home",
        title: "Startseite",
        views: 8000,
        loadTimeMs: 1500,
        lcpMs: 2400,
      },
    ];

    const memberPages: PagePerformanceEntry[] = [
      {
        ...emptyPage,
        path: "/mitglieder/produktionen",
        title: "Produktionen",
        views: 1800,
        loadTimeMs: 2100,
        lcpMs: 1800,
      },
    ];

    const sessionInsights: SessionInsight[] = [
      {
        segment: "Neue Besucher",
        avgSessionDurationSeconds: 220,
        pagesPerSession: 2.8,
        retentionRate: 0.32,
        share: 0.25,
      },
    ];

    const deviceStats: DeviceStat[] = [
      { device: "Mobile", sessions: 5200, avgPageLoadMs: 1750, share: 0.42 },
    ];

    const httpSummary: AnalyticsHttpSummary = {
      id: "sum-1",
      windowStart: new Date("2024-10-01T00:00:00Z"),
      windowEnd: new Date("2024-10-02T00:00:00Z"),
      totalRequests: 10000,
      successfulRequests: 9000,
      clientErrorRequests: 500,
      serverErrorRequests: 500,
      averageDurationMs: 320,
      p95DurationMs: 580,
      averagePayloadBytes: 420000,
      uptimePercentage: 99.5,
      frontendRequests: 6000,
      frontendAvgResponseMs: 280,
      frontendAvgPayloadBytes: 520000,
      cacheHitRate: 0.48,
      frontendCacheHitRate: 0.55,
      membersRequests: 2200,
      membersAvgResponseMs: 1950,
      apiRequests: 1800,
      apiAvgResponseMs: 640,
      apiErrorRate: 0.07,
      apiBackgroundJobs: 45,
      generatedAt: new Date("2024-10-02T00:00:00Z"),
    };

    const result = deriveOptimizationInsights({
      publicPages,
      memberPages,
      deviceStats,
      sessionInsights,
      httpSummary,
      fallback: baseFallback,
    });

    const ids = result.map((entry) => entry.id);

    expect(ids).toContain("page-speed-events-sommerfest");
    expect(ids).toContain("lcp-home");
    expect(ids).toContain("member-speed-mitglieder-produktionen");
    expect(ids).toContain("segment-neue-besucher");
    expect(ids).toContain("device-mobile");
    expect(ids).toContain("api-error-rate");
    expect(ids).toContain("cache-hit-rate");
    expect(ids).toContain("member-api-latency");
  });
});
