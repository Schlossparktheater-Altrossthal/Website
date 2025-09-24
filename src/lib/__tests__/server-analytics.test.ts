import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const analyticsScenario = vi.hoisted(() => ({
  useDatabase: true,
  httpSummary: () => ({
    windowStart: new Date("2024-01-01T00:00:00.000Z"),
    windowEnd: new Date("2024-01-01T01:00:00.000Z"),
    totalRequests: 2400,
    successfulRequests: 2350,
    clientErrorRequests: 30,
    serverErrorRequests: 20,
    averageDurationMs: 180,
    p95DurationMs: 420,
    averagePayloadBytes: 8192,
    uptimePercentage: 99.96,
    frontendRequests: 1200,
    frontendAvgResponseMs: 150,
    frontendAvgPayloadBytes: 4096,
    membersRequests: 800,
    membersAvgResponseMs: 190,
    apiRequests: 400,
    apiAvgResponseMs: 210,
    apiErrorRate: 0.03,
  }),
  peakHours: () => [
    {
      bucketStart: new Date("2024-01-01T10:00:00.000Z"),
      bucketEnd: new Date("2024-01-01T11:00:00.000Z"),
      requests: 320,
      share: 0.12,
    },
  ],
  deviceOverrides: () => [
    { device: "Desktop", sessions: 180, avgPageLoadMs: 540, share: 0.6 },
    { device: "Mobile", sessions: 120, avgPageLoadMs: 680, share: 0.4 },
  ],
  pageMetrics: () => [
    { path: "/", avgPageLoadMs: 980, lcpMs: 1300, scope: "public", weight: 200 },
    {
      path: "/mitglieder/dashboard",
      avgPageLoadMs: 760,
      lcpMs: 980,
      scope: "members",
      weight: 120,
    },
  ],
  sessionInsights: () => [
    {
      segment: "Neu",
      avgSessionDurationSeconds: 420,
      pagesPerSession: 4.2,
      retentionRate: 0.58,
      share: 0.4,
      conversionRate: 0.18,
    },
  ],
  trafficSources: () => [
    {
      channel: "Direkt",
      sessions: 420,
      avgSessionDurationSeconds: 380,
      conversionRate: 0.12,
      changePercent: 0.05,
    },
  ],
  realtimeSummary: () => ({
    windowStart: new Date("2024-01-01T00:00:00.000Z"),
    windowEnd: new Date("2024-01-02T00:00:00.000Z"),
    totalEvents: 640,
    eventCounts: { connect: 120, update: 520 },
  }),
  logs: () => [
    {
      id: "log-1",
      severity: "warning" as const,
      service: "Prisma",
      message: "Pool exhausted",
      description: "Connections at limit",
      occurrences: 3,
      firstSeen: new Date("2024-01-01T00:00:00.000Z"),
      lastSeen: new Date("2024-01-01T01:30:00.000Z"),
      status: "open" as const,
      recommendedAction: "Scale pool",
      affectedUsers: 4,
      tags: ["DB", "Pool"],
    },
  ],
}));

const cacheState = vi.hoisted(() => ({
  store: new Map<string, unknown>(),
  failNext: false,
}));

vi.mock("next/cache", async () => {
  const actual = await vi.importActual<typeof import("next/cache")>("next/cache");
  return {
    ...actual,
    unstable_cache: <T extends (...args: never[]) => unknown>(fn: T, key: unknown) => {
      const cacheKey = JSON.stringify(key);
      return async (...args: Parameters<T>) => {
        if (cacheState.failNext) {
          cacheState.failNext = false;
          throw new Error("cache unavailable");
        }
        if (cacheState.store.has(cacheKey)) {
          return cacheState.store.get(cacheKey);
        }
        const result = await fn(...args);
        cacheState.store.set(cacheKey, result);
        return result;
      };
    },
  };
});

vi.mock("node:timers/promises", async () => {
  const actual = await vi.importActual<typeof import("node:timers/promises")>("node:timers/promises");
  return {
    ...actual,
    setTimeout: () => Promise.resolve(),
  };
});

vi.mock("node:os", async () => {
  const actual = await vi.importActual<typeof import("node:os")>("node:os");
  return {
    ...actual,
    cpus: () => [
      { times: { user: 10, nice: 0, sys: 5, idle: 20, irq: 0 } },
      { times: { user: 8, nice: 0, sys: 4, idle: 18, irq: 0 } },
    ],
    loadavg: () => [0.5, 0.4, 0.3],
    totalmem: () => 16 * 1024 * 1024 * 1024,
    freemem: () => 6 * 1024 * 1024 * 1024,
  };
});

vi.mock("node:fs/promises", async () => {
  const actual = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
  return {
    ...actual,
    statfs: vi.fn(async () => ({
      bsize: 4096,
      blocks: 500_000,
      bavail: 200_000,
      bfree: 200_000,
      frsize: 4096,
    })),
  };
});

vi.mock("@/lib/analytics/load-server-logs", () => ({
  loadLatestCriticalServerLogs: vi.fn(async () => {
    if (!analyticsScenario.useDatabase) {
      return [];
    }
    return analyticsScenario
      .logs()
      .map((log) => ({
        ...log,
        firstSeen: new Date(log.firstSeen),
        lastSeen: new Date(log.lastSeen),
        tags: Array.isArray(log.tags) ? [...log.tags] : [],
      }));
  }),
}));

vi.mock("@/lib/server-analytics-data", () => ({
  loadDeviceBreakdownFromDatabase: vi.fn(async () => {
    if (!analyticsScenario.useDatabase) {
      return null;
    }
    return analyticsScenario.deviceOverrides().map((device) => ({ ...device }));
  }),
  loadPagePerformanceMetrics: vi.fn(async () => {
    if (!analyticsScenario.useDatabase) {
      return [];
    }
    return analyticsScenario.pageMetrics().map((metric) => ({ ...metric }));
  }),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    analyticsHttpSummary: {
      findFirst: vi.fn(async () => (analyticsScenario.useDatabase ? { ...analyticsScenario.httpSummary() } : null)),
    },
    analyticsHttpPeakHour: {
      findMany: vi.fn(async () => (analyticsScenario.useDatabase ? analyticsScenario.peakHours().map((hour) => ({ ...hour })) : [])),
    },
    analyticsSessionInsight: {
      findMany: vi.fn(async () => (analyticsScenario.useDatabase ? analyticsScenario.sessionInsights().map((row) => ({ ...row })) : [])),
    },
    analyticsTrafficSource: {
      findMany: vi.fn(async () => (analyticsScenario.useDatabase ? analyticsScenario.trafficSources().map((row) => ({ ...row })) : [])),
    },
    analyticsRealtimeSummary: {
      findFirst: vi.fn(async () => (analyticsScenario.useDatabase ? { ...analyticsScenario.realtimeSummary() } : null)),
    },
  },
}));

describe("collectServerAnalytics", () => {
  const originalDatabaseUrl = process.env.DATABASE_URL;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    cacheState.store.clear();
    cacheState.failNext = false;
    analyticsScenario.useDatabase = true;
    process.env.DATABASE_URL = "postgres://example.test";
    vi.resetModules();
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    process.env.DATABASE_URL = originalDatabaseUrl;
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  it("returns live analytics when database data is available", async () => {
    const { collectServerAnalytics } = await import("@/lib/server-analytics");

    const snapshot = await collectServerAnalytics();

    expect(snapshot.metadata.source).toBe("live");
    expect(snapshot.metadata.attempts).toBe(1);
    expect(snapshot.summary.requestsLast24h).toBe(analyticsScenario.httpSummary().totalRequests);
    expect(snapshot.metadata.fallbackReasons).toBeUndefined();
  });

  it("serves cached analytics when the database falls back after a successful run", async () => {
    const { collectServerAnalytics } = await import("@/lib/server-analytics");

    const liveSnapshot = await collectServerAnalytics();
    expect(liveSnapshot.metadata.source).toBe("live");

    cacheState.store.clear();
    analyticsScenario.useDatabase = false;

    const cachedSnapshot = await collectServerAnalytics();

    expect(cachedSnapshot.metadata.source).toBe("cached");
    expect(cachedSnapshot.metadata.attempts).toBeGreaterThan(1);
    expect(cachedSnapshot.metadata.staleSince).toBeDefined();
    expect(cachedSnapshot.summary.requestsLast24h).toBe(liveSnapshot.summary.requestsLast24h);
    expect(cachedSnapshot.metadata.fallbackReasons).toEqual(
      expect.arrayContaining([
        "Datenbank lieferte keine Live-Kennzahlen – verwende letzten bekannten Stand",
      ]),
    );
  });

  it("falls back to static analytics when no cached snapshot is available", async () => {
    analyticsScenario.useDatabase = false;
    cacheState.store.clear();

    const { collectServerAnalytics } = await import("@/lib/server-analytics");

    const snapshot = await collectServerAnalytics();

    expect(snapshot.metadata.source).toBe("fallback");
    expect(snapshot.metadata.attempts).toBeGreaterThan(1);
    expect(snapshot.metadata.fallbackReasons?.length ?? 0).toBeGreaterThan(0);
  });
});
