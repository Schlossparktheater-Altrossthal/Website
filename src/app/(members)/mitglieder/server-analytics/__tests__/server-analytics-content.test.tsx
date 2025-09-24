// @vitest-environment jsdom

import "@testing-library/jest-dom";
import { EventEmitter } from "node:events";
import React, { act } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { ServerAnalytics } from "@/lib/server-analytics";

import { ServerAnalyticsContent } from "../server-analytics-content";

const { updateStatusMock } = vi.hoisted(() => ({
  updateStatusMock: vi.fn(),
}));

vi.mock("../actions", () => ({
  updateServerLogStatusAction: updateStatusMock,
}));

type MockSocket = {
  on: (event: string, handler: (...args: unknown[]) => void) => void;
  off: (event: string, handler: (...args: unknown[]) => void) => void;
  emit: (event: string, payload?: unknown) => void;
  connected: boolean;
};

const realtimeState: {
  socket: MockSocket | null;
  isConnected: boolean;
  connectionStatus: "connected" | "connecting" | "disconnected" | "error";
} = {
  socket: null,
  isConnected: false,
  connectionStatus: "disconnected",
};

vi.mock("@/hooks/useRealtime", () => ({
  useRealtime: () => realtimeState,
}));

let originalRequestAnimationFrame: typeof globalThis.requestAnimationFrame | undefined;
let originalCancelAnimationFrame: typeof globalThis.cancelAnimationFrame | undefined;

beforeAll(() => {
  originalRequestAnimationFrame = globalThis.requestAnimationFrame;
  originalCancelAnimationFrame = globalThis.cancelAnimationFrame;

  const rafTimers = new Map<number, NodeJS.Timeout>();
  let rafHandleCounter = 1;

  globalThis.requestAnimationFrame = ((callback: FrameRequestCallback) => {
    const handle = rafHandleCounter++;
    const timeout = setTimeout(() => {
      rafTimers.delete(handle);
      callback(performance.now());
    }, 16);
    rafTimers.set(handle, timeout);
    return handle as unknown as number;
  }) as typeof globalThis.requestAnimationFrame;

  globalThis.cancelAnimationFrame = ((handle: number) => {
    const timeout = rafTimers.get(handle);
    if (timeout) {
      clearTimeout(timeout);
      rafTimers.delete(handle);
    }
  }) as typeof globalThis.cancelAnimationFrame;
});

afterAll(() => {
  if (originalRequestAnimationFrame) {
    globalThis.requestAnimationFrame = originalRequestAnimationFrame;
  } else {
    Reflect.deleteProperty(globalThis as Record<string, unknown>, "requestAnimationFrame");
  }

  if (originalCancelAnimationFrame) {
    globalThis.cancelAnimationFrame = originalCancelAnimationFrame;
  } else {
    Reflect.deleteProperty(globalThis as Record<string, unknown>, "cancelAnimationFrame");
  }
});

function createAnalytics(): ServerAnalytics {
  const now = new Date().toISOString();
  return {
    generatedAt: now,
    summary: {
      uptimePercentage: 99.9,
      requestsLast24h: 1_200,
      averageResponseTimeMs: 180,
      p95ResponseTimeMs: 420,
      errorRate: 0.02,
      peakConcurrentUsers: 42,
      cacheHitRate: 0.7,
      realtimeEventsLast24h: 120,
      slaTargetPercentage: 99.95,
      slaViolationMinutes: 3.8,
    },
    resourceUsage: [
      { id: "cpu", label: "CPU", usagePercent: 56, changePercent: -0.02, capacity: "4 Kerne" },
    ],
    requestBreakdown: {
      frontend: { requests: 600, avgResponseTimeMs: 160, cacheHitRate: 0.5, avgPayloadKb: 120 },
      members: { requests: 420, avgResponseTimeMs: 210, realtimeEvents: 80, avgSessionDurationSeconds: 360 },
      api: { requests: 180, avgResponseTimeMs: 240, backgroundJobs: 15, errorRate: 0.04 },
    },
    peakHours: [],
    publicPages: [],
    memberPages: [],
    trafficSources: [],
    deviceBreakdown: [],
    sessionInsights: [],
    optimizationInsights: [],
    serverLogs: [
      {
        id: "log-1",
        severity: "error",
        service: "Next.js API",
        message: "Timeout",
        description: "Request dauerte länger als 5 Sekunden",
        occurrences: 3,
        firstSeen: now,
        lastSeen: now,
        status: "open",
        recommendedAction: "Poolgröße prüfen",
        affectedUsers: 4,
        tags: ["API", "Prisma"],
      },
    ],
    metadata: {
      source: "live",
      attempts: 1,
      lastUpdatedAt: now,
      fallbackReasons: [],
    },
  };
}

describe("ServerAnalyticsContent", () => {
  beforeEach(() => {
    (globalThis as typeof globalThis & { React?: typeof React }).React = React;
    vi.clearAllMocks();
    realtimeState.socket = null;
    realtimeState.isConnected = false;
    realtimeState.connectionStatus = "disconnected";
  });

  it("updates server log status via server action", async () => {
    const analytics = createAnalytics();
    const updatedLog = {
      ...analytics.serverLogs[0],
      status: "resolved" as const,
      lastSeen: new Date("2024-01-02T00:00:00.000Z").toISOString(),
    };
    updateStatusMock.mockResolvedValueOnce({ success: true, log: updatedLog });

    const user = userEvent.setup();
    render(<ServerAnalyticsContent initialAnalytics={analytics} />);

    const logsTab = await screen.findByRole("tab", { name: "Serverlogs" });
    await user.click(logsTab);

    const resolveButton = await screen.findByRole("button", { name: "Als gelöst markieren" });
    await user.click(resolveButton);

    await waitFor(() => {
      expect(updateStatusMock).toHaveBeenCalledWith({ logId: "log-1", status: "resolved" });
    });

    await waitFor(() => {
      expect(screen.getByText("Gelöst")).toBeInTheDocument();
    });

    expect(screen.queryByRole("button", { name: "Als gelöst markieren" })).not.toBeInTheDocument();
  });

  it("applies realtime updates from socket events", async () => {
    const analytics = createAnalytics();
    const emitter = new EventEmitter();
    const socket: MockSocket = {
      connected: true,
      on: (event, handler) => {
        emitter.on(event, handler);
      },
      off: (event, handler) => {
        emitter.off(event, handler);
      },
      emit: vi.fn(),
    };

    realtimeState.socket = socket;
    realtimeState.isConnected = true;
    realtimeState.connectionStatus = "connected";

    render(<ServerAnalyticsContent initialAnalytics={analytics} />);

    expect(await screen.findByText(/1\.200/)).toBeInTheDocument();

    const nextAnalytics: ServerAnalytics = {
      ...analytics,
      generatedAt: new Date(Date.now() + 1_000).toISOString(),
      summary: {
        ...analytics.summary,
        requestsLast24h: 3_200,
        uptimePercentage: 99.7,
        p95ResponseTimeMs: 540,
        slaViolationMinutes: 7.5,
      },
      metadata: {
        ...analytics.metadata,
        source: "cached",
        staleSince: new Date(Date.now() - 5_000).toISOString(),
        fallbackReasons: ["Datenbank nicht erreichbar"],
      },
    };

    await act(async () => {
      emitter.emit("server_analytics_update", {
        type: "server_analytics_update",
        timestamp: nextAnalytics.generatedAt,
        analytics: nextAnalytics,
      });
    });

    await waitFor(() => {
      expect(screen.getByText(/3\.200/)).toBeInTheDocument();
    });

    expect(socket.emit).toHaveBeenCalledWith("get_server_analytics");
    const cacheBadges = await screen.findAllByLabelText("Server-Analytics aus Cache");
    expect(cacheBadges.length).toBeGreaterThan(0);
  });
});
