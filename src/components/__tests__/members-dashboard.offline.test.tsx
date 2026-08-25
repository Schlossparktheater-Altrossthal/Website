// @vitest-environment jsdom

import "@testing-library/jest-dom";
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MembersDashboard } from "../members-dashboard";
import { DEV_DASHBOARD_OVERVIEW_FIXTURE } from "@/lib/dev-dashboard-fixture";

const { useNotificationRealtimeMock } = vi.hoisted(() => ({
  useNotificationRealtimeMock: vi.fn(),
}));

const { fetchMock } = vi.hoisted(() => ({
  fetchMock: vi.fn<typeof fetch>(),
}));

vi.mock("next-auth/react", () => ({
  useSession: () => ({
    data: { user: { id: "user-1", name: "Offline Tester", email: "offline@example.com" } },
  }),
}));

vi.mock("@/hooks/useRealtime", () => ({
  useRealtime: () => ({
    socket: null,
    connectionStatus: "offline" as const,
    isConnected: false,
    joinRoom: vi.fn(),
    leaveRoom: vi.fn(),
    reconnect: vi.fn(),
  }),
  useNotificationRealtime: useNotificationRealtimeMock,
}));

vi.mock("@/hooks/useOnlineStats", () => ({
  useOnlineStats: () => ({
    totalOnline: 0,
    onlineUsers: [],
    isLoading: false,
  }),
}));

vi.mock("@/components/members/permissions-context", () => ({
  useMembersPermissions: () => [],
}));

vi.mock("@/components/members/members-app-shell", () => ({
  MembersContentLayout: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="layout">{children}</div>
  ),
  MembersContentHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  MembersTopbar: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  MembersTopbarStatus: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  MembersTopbarTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const originalFetch = global.fetch;

describe("MembersDashboard offline fallback", () => {
  beforeEach(() => {
    (globalThis as typeof globalThis & { React?: typeof React }).React = React;
    vi.clearAllMocks();

    fetchMock.mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify(DEV_DASHBOARD_OVERVIEW_FIXTURE), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    fetchMock.mockReset();
  });

  it("renders a gentle offline banner without logging errors", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(<MembersDashboard />);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/dashboard/overview", { cache: "no-store" });
    });

    const banner = await screen.findByText("Offline-Demo-Modus");
    expect(banner).toBeInTheDocument();
    expect(
      screen.getByText(
        "Der Dashboard-Endpunkt liefert Beispielwerte, da keine Datenbank verbunden ist.",
      ),
    ).toBeInTheDocument();

    expect(consoleErrorSpy).not.toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });
});
