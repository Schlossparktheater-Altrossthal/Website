import { describe, expect, it } from "vitest";

import { aggregateSessionMetrics } from "@/lib/analytics/aggregate-session-metrics";
import type {
  AnalyticsSessionLike,
  TrafficAttributionLike,
  RealtimeEventLike,
} from "@/lib/analytics/aggregate-session-metrics";

describe("aggregateSessionMetrics", () => {
  it("builds session insights, traffic sources and realtime summary", () => {
    const now = new Date("2024-01-02T12:00:00.000Z");

    const sessions: AnalyticsSessionLike[] = [
      {
        id: "s1",
        userId: "u1",
        isMember: true,
        membershipRole: "member",
        startedAt: new Date("2024-01-01T10:00:00.000Z"),
        endedAt: new Date("2024-01-01T11:00:00.000Z"),
        lastSeenAt: new Date("2024-01-01T11:00:00.000Z"),
        durationSeconds: null,
        pagePaths: ["/dashboard", "/reports"],
      },
      {
        id: "s2",
        userId: "u2",
        isMember: false,
        membershipRole: null,
        startedAt: new Date("2024-01-01T13:00:00.000Z"),
        endedAt: new Date("2024-01-01T13:30:00.000Z"),
        lastSeenAt: new Date("2024-01-01T13:30:00.000Z"),
        durationSeconds: null,
        pagePaths: ["/landing"],
      },
      {
        id: "s3",
        userId: "u1",
        isMember: true,
        membershipRole: "member",
        startedAt: new Date("2024-01-02T08:00:00.000Z"),
        endedAt: new Date("2024-01-02T08:45:00.000Z"),
        lastSeenAt: new Date("2024-01-02T08:45:00.000Z"),
        durationSeconds: null,
        pagePaths: ["/dashboard", "/planning", "/planning"],
      },
    ];

    const traffic: TrafficAttributionLike[] = [
      {
        sessionId: "pv1",
        analyticsSessionId: "s1",
        path: "/dashboard",
        referrer: "https://www.google.com/search?q=theater",
        referrerDomain: "www.google.com",
        utmSource: null,
        utmMedium: "cpc",
        utmCampaign: null,
        utmTerm: null,
        utmContent: null,
      },
      {
        sessionId: "pv2",
        analyticsSessionId: "s2",
        path: "/landing",
        referrer: null,
        referrerDomain: null,
        utmSource: "newsletter",
        utmMedium: "email",
        utmCampaign: "winter-sale",
        utmTerm: null,
        utmContent: null,
      },
      {
        sessionId: "pv3",
        analyticsSessionId: null,
        path: "/legacy",
        referrer: "https://partner.example.com/article",
        referrerDomain: "partner.example.com",
        utmSource: null,
        utmMedium: null,
        utmCampaign: null,
        utmTerm: null,
        utmContent: null,
      },
      {
        sessionId: "pv4",
        analyticsSessionId: "s3",
        path: "/planning",
        referrer: null,
        referrerDomain: null,
        utmSource: null,
        utmMedium: null,
        utmCampaign: null,
        utmTerm: null,
        utmContent: null,
      },
    ];

    const realtimeEvents: RealtimeEventLike[] = [
      { eventType: "ping", occurredAt: new Date("2024-01-02T11:00:00.000Z") },
      { eventType: "ping", occurredAt: new Date("2024-01-02T10:30:00.000Z") },
      { eventType: "socket_connected", occurredAt: new Date("2024-01-02T09:00:00.000Z") },
      { eventType: "join_room", occurredAt: new Date("2024-01-01T09:00:00.000Z") },
    ];

    const result = aggregateSessionMetrics({
      sessions,
      traffic,
      realtimeEvents,
      now,
    });

    expect(result.sessionInsights).toHaveLength(3);

    const members = result.sessionInsights.find((entry) => entry.segment === "Mitglieder");
    const guests = result.sessionInsights.find((entry) => entry.segment === "Gäste");
    const returning = result.sessionInsights.find((entry) => entry.segment === "Wiederkehrend");

    expect(members).toBeDefined();
    expect(members?.avgSessionDurationSeconds).toBe(3150);
    expect(members?.pagesPerSession).toBe(2);
    expect(members?.retentionRate).toBeCloseTo(1, 5);
    expect(members?.share).toBeCloseTo(2 / 3, 5);
    expect(members?.conversionRate).toBeCloseTo(1, 5);

    expect(guests).toBeDefined();
    expect(guests?.avgSessionDurationSeconds).toBe(1800);
    expect(guests?.pagesPerSession).toBe(1);
    expect(guests?.retentionRate).toBe(0);
    expect(guests?.share).toBeCloseTo(1 / 3, 5);
    expect(guests?.conversionRate).toBe(0);

    expect(returning).toBeDefined();
    expect(returning?.avgSessionDurationSeconds).toBe(3150);
    expect(returning?.pagesPerSession).toBe(2);
    expect(returning?.retentionRate).toBeCloseTo(1, 5);
    expect(returning?.conversionRate).toBeCloseTo(1, 5);

    expect(result.trafficSources).toHaveLength(4);
    expect(result.trafficSources[0].channel).toBe("Direct");
    expect(result.trafficSources[0].sessions).toBe(1);
    expect(result.trafficSources[0].avgSessionDurationSeconds).toBe(2700);
    expect(result.trafficSources[0].conversionRate).toBeCloseTo(1, 5);

    const paidSearch = result.trafficSources.find((entry) => entry.channel === "Paid Search");
    expect(paidSearch).toBeDefined();
    expect(paidSearch?.sessions).toBe(1);
    expect(paidSearch?.avgSessionDurationSeconds).toBe(3600);
    expect(paidSearch?.conversionRate).toBeCloseTo(1, 5);

    const email = result.trafficSources.find((entry) => entry.channel === "E-Mail");
    expect(email).toBeDefined();
    expect(email?.sessions).toBe(1);
    expect(email?.avgSessionDurationSeconds).toBe(1800);
    expect(email?.conversionRate).toBeCloseTo(0, 5);

    const referral = result.trafficSources.find((entry) => entry.channel === "Partner.Example.Com");
    expect(referral).toBeDefined();
    expect(referral?.sessions).toBe(1);
    expect(referral?.avgSessionDurationSeconds).toBe(0);

    expect(result.realtimeSummary.totalEvents).toBe(3);
    expect(result.realtimeSummary.eventCounts).toEqual({
      ping: 2,
      socket_connected: 1,
    });
    expect(result.realtimeSummary.windowEnd.toISOString()).toBe(now.toISOString());
    expect(result.realtimeSummary.windowStart.toISOString()).toBe(
      new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(),
    );
  });
});
