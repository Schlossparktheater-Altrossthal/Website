// @vitest-environment jsdom

import "@testing-library/jest-dom";
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ServerAnalytics } from "@/lib/server-analytics";

import { ServerAnalyticsContent } from "../server-analytics-content";

const { updateStatusMock, updateSettingsMock } = vi.hoisted(() => ({
  updateStatusMock: vi.fn(),
  updateSettingsMock: vi.fn(),
}));

vi.mock("../actions", () => ({
  updateServerLogStatusAction: updateStatusMock,
  updateServerAnalyticsSettingsAction: updateSettingsMock,
}));

vi.mock("@/hooks/useRealtime", () => ({
  useRealtime: () => ({
    socket: null,
    isConnected: false,
    connectionStatus: "disconnected" as const,
  }),
}));

function createAnalytics(overrides: Partial<ServerAnalytics> = {}): ServerAnalytics {
  const now = overrides.generatedAt ?? new Date().toISOString();
  const analytics: ServerAnalytics = {
    generatedAt: now,
    isDemoData: false,
    settings: {
      httpWindowMinutes: 1440,
      httpBucketMinutes: 60,
      sessionWindowDays: 30,
      sessionRetentionDays: 180,
      realtimeWindowHours: 24,
      pageWindowDays: 14,
      pageRetentionDays: 60,
    },
    summary: {
      uptimePercentage: 99.9,
      requestsLast24h: 1_200,
      averageResponseTimeMs: 180,
      errorRate: 0.02,
      peakConcurrentUsers: 42,
      cacheHitRate: 0.7,
      realtimeEventsLast24h: 120,
    },
    resourceUsage: [
      { id: "cpu", label: "CPU", usagePercent: 56, changePercent: -0.02, capacity: "4 Kerne" },
    ],
    requestBreakdown: {
      frontend: { requests: 600, avgResponseTimeMs: 160, cacheHitRate: 0.5, avgPayloadKb: 120 },
      members: { requests: 420, avgResponseTimeMs: 210, realtimeEvents: 80, avgSessionDurationSeconds: 360 },
      api: { requests: 180, avgResponseTimeMs: 240, backgroundJobs: 15, errorRate: 0.04 },
    },
    visitorDistribution: [
      {
        id: "logged-out",
        label: "Nicht eingeloggt",
        requests: 600,
        share: 0.48,
        avgResponseTimeMs: 160,
        avgSessionDurationSeconds: 300,
      },
      {
        id: "logged-in",
        label: "Eingeloggt",
        requests: 420,
        share: 0.34,
        avgResponseTimeMs: 210,
        avgSessionDurationSeconds: 360,
        realtimeEvents: 80,
      },
      {
        id: "bot",
        label: "Bots & Crawler",
        requests: 220,
        share: 0.18,
        avgResponseTimeMs: 320,
        blockedRequests: 16,
      },
    ],
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
  };

  return {
    ...analytics,
    ...overrides,
  };
}

describe("ServerAnalyticsContent", () => {
  beforeEach(() => {
    (globalThis as typeof globalThis & { React?: typeof React }).React = React;
    vi.clearAllMocks();
    updateSettingsMock.mockReset();
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

  it("renders the demo badge when demo data is active", () => {
    const analytics = createAnalytics({ isDemoData: true });
    render(<ServerAnalyticsContent initialAnalytics={analytics} />);

    expect(screen.getAllByText("Demo").length).toBeGreaterThan(0);
  });

  it("hides the demo badge when real data is available", () => {
    const analytics = createAnalytics({ isDemoData: false });
    render(<ServerAnalyticsContent initialAnalytics={analytics} />);

    expect(screen.queryByText("Demo")).not.toBeInTheDocument();
  });

  it("displays the visitor distribution", () => {
    const analytics = createAnalytics();
    render(<ServerAnalyticsContent initialAnalytics={analytics} />);

    expect(screen.getByText("Nutzertypen & Traffic")).toBeInTheDocument();
    expect(screen.getByText("Nicht eingeloggt")).toBeInTheDocument();
    expect(screen.getByText("Bots & Crawler")).toBeInTheDocument();
  });

  it("updates analytics settings via server action", async () => {
    const analytics = createAnalytics();
    const user = userEvent.setup();
    const updatedSettings = {
      ...analytics.settings,
      httpWindowMinutes: 720,
    };
    const updatedAnalytics = createAnalytics({
      settings: updatedSettings,
      generatedAt: new Date("2024-02-01T12:00:00.000Z").toISOString(),
    });

    updateSettingsMock.mockResolvedValueOnce({
      success: true,
      settings: updatedSettings,
      analytics: updatedAnalytics,
    });

    render(<ServerAnalyticsContent initialAnalytics={analytics} canManageSettings />);

    const settingsTab = await screen.findByRole("tab", { name: "Einstellungen" });
    await user.click(settingsTab);

    const httpInput = await screen.findByLabelText("Auswertungszeitraum (Minuten)");
    await user.clear(httpInput);
    await user.type(httpInput, "720");

    const submitButton = await screen.findByRole("button", { name: "Einstellungen speichern" });
    await user.click(submitButton);

    await waitFor(() => {
      expect(updateSettingsMock).toHaveBeenCalledWith({
        httpWindowMinutes: 720,
        httpBucketMinutes: analytics.settings.httpBucketMinutes,
        sessionWindowDays: analytics.settings.sessionWindowDays,
        sessionRetentionDays: analytics.settings.sessionRetentionDays,
        realtimeWindowHours: analytics.settings.realtimeWindowHours,
        pageWindowDays: analytics.settings.pageWindowDays,
        pageRetentionDays: analytics.settings.pageRetentionDays,
      });
    });
  });
});
