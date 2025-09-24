import { describe, expect, it } from "vitest";

import type { AnalyticsRequestArea } from "@prisma/client";

import { aggregateHttpMetrics } from "@/lib/analytics/aggregate-http";

describe("aggregateHttpMetrics", () => {
  const baseWindowStart = new Date("2024-06-01T10:00:00.000Z");
  const baseWindowEnd = new Date("2024-06-02T10:00:00.000Z");

  function createRequest(
    overrides: Partial<{
      offsetMinutes: number;
      area: AnalyticsRequestArea;
      statusCode: number;
      durationMs: number;
      payloadBytes: number;
    }> = {},
  ) {
    const offset = overrides.offsetMinutes ?? 0;
    const timestamp = new Date(baseWindowStart.getTime() + offset * 60_000);
    return {
      timestamp,
      area: overrides.area ?? "public",
      statusCode: overrides.statusCode ?? 200,
      durationMs: overrides.durationMs ?? 180,
      payloadBytes: overrides.payloadBytes ?? 2_048,
    };
  }

  it("computes summary statistics and peak hours", () => {
    const requests = [
      createRequest({ offsetMinutes: 5, durationMs: 120, payloadBytes: 1_024 }),
      createRequest({ offsetMinutes: 15, durationMs: 180, payloadBytes: 2_048 }),
      createRequest({ offsetMinutes: 65, durationMs: 240, payloadBytes: 3_072, area: "members" }),
      createRequest({ offsetMinutes: 125, durationMs: 200, payloadBytes: 2_560, area: "members" }),
      createRequest({ offsetMinutes: 185, durationMs: 320, payloadBytes: 1_536, area: "api", statusCode: 502 }),
      createRequest({ offsetMinutes: 200, durationMs: 210, payloadBytes: 512, area: "api", statusCode: 204 }),
    ];

    const heartbeats = [
      { observedAt: new Date(baseWindowStart.getTime() + 10 * 60_000), isHealthy: true },
      { observedAt: new Date(baseWindowStart.getTime() + 70 * 60_000), isHealthy: false },
      { observedAt: new Date(baseWindowStart.getTime() + 130 * 60_000), isHealthy: true },
    ];

    const result = aggregateHttpMetrics({
      requests,
      heartbeats,
      windowStart: baseWindowStart,
      windowEnd: baseWindowEnd,
      bucketMinutes: 60,
    });

    expect(result.summary.totalRequests).toBe(6);
    expect(result.summary.successfulRequests).toBe(5);
    expect(result.summary.clientErrorRequests).toBe(0);
    expect(result.summary.serverErrorRequests).toBe(1);
    expect(result.summary.averageDurationMs).toBeCloseTo((120 + 180 + 240 + 200 + 320 + 210) / 6, 5);
    expect(result.summary.averagePayloadBytes).toBeCloseTo((1024 + 2048 + 3072 + 2560 + 1536 + 512) / 6, 5);
    expect(result.summary.p95DurationMs).toBeGreaterThanOrEqual(240);
    expect(result.summary.uptimePercentage).toBeCloseTo((2 / 3) * 100, 5);

    expect(result.summary.frontendRequests).toBe(2);
    expect(result.summary.membersRequests).toBe(2);
    expect(result.summary.apiRequests).toBe(2);
    expect(result.summary.frontendAvgResponseMs).toBeCloseTo(150, 5);
    expect(result.summary.membersAvgResponseMs).toBeCloseTo(220, 5);
    expect(result.summary.apiAvgResponseMs).toBeCloseTo(265, 5);
    expect(result.summary.apiErrorRate).toBeCloseTo(0.5, 5);

    expect(result.peakHours.length).toBeGreaterThan(0);
    const firstPeak = result.peakHours[0];
    expect(firstPeak.requests).toBeGreaterThan(0);
    expect(firstPeak.share).toBeGreaterThan(0);
    expect(firstPeak.share).toBeLessThanOrEqual(1);
  });

  it("handles empty inputs gracefully", () => {
    const result = aggregateHttpMetrics({
      requests: [],
      heartbeats: [],
      windowStart: baseWindowStart,
      windowEnd: baseWindowEnd,
    });

    expect(result.summary.totalRequests).toBe(0);
    expect(result.summary.averageDurationMs).toBe(0);
    expect(result.summary.p95DurationMs).toBeNull();
    expect(result.summary.uptimePercentage).toBeNull();
    expect(result.peakHours).toEqual([]);
  });
});
