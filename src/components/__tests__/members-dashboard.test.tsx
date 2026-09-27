// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
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

const { useMembersPermissionsMock } = vi.hoisted(() => ({
  useMembersPermissionsMock: vi.fn<() => readonly string[]>(),
}));

vi.mock("@/components/members/permissions-context", () => ({
  useMembersPermissions: useMembersPermissionsMock,
}));

vi.mock("@/components/members/members-app-shell", () => ({
  MembersContentLayout: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="layout">{children}</div>
  ),
  MembersContentHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  MembersPageActions: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  MembersTopbar: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  MembersTopbarStatus: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  MembersTopbarTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const originalFetch = global.fetch;

// Gilt für alle Testblöcke: Dashboard ohne Session/Rechte, Netzwerk vollständig gemockt.
beforeEach(() => {
  (globalThis as typeof globalThis & { React?: typeof React }).React = React;
  vi.clearAllMocks();
  useMembersPermissionsMock.mockReturnValue([]);

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

describe("MembersDashboard offline fallback", () => {
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

const TEST_DAY_IN_MS = 86_400_000;

function daysFromNow(days: number) {
  return new Date(Date.now() + days * TEST_DAY_IN_MS).toISOString();
}

function mockOverview(overrides: { finalRehearsalWeek: unknown; activeProduction: unknown }) {
  fetchMock.mockImplementation(() =>
    Promise.resolve(
      new Response(
        JSON.stringify({
          offline: false,
          stats: { productionMembers: 45, rehearsalsThisWeek: 3, unreadNotifications: 0 },
          upcomingEvents: [],
          recentActivities: [],
          profileCompletion: { complete: true, completed: 5, total: 5, openItems: [] },
          ...overrides,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    ),
  );
}

async function waitForOverview() {
  // Die Kennzahl „Proben diese Woche“ steht erst nach dem Laden auf einem Wert.
  await waitFor(() => {
    const tile = screen.getByText("Proben diese Woche").closest<HTMLElement>("a, div");
    expect(tile?.textContent).not.toContain("–");
  });
}

function queryFinalRehearsalTile() {
  const label = screen.queryByText("Tage bis Endproben");
  return label?.closest<HTMLElement>("a, div") ?? null;
}

describe("MembersDashboard final rehearsal tile", () => {
  it("keeps the tile with a placeholder when the active production has no date", async () => {
    mockOverview({
      finalRehearsalWeek: null,
      activeProduction: { id: "show-1", title: "Teststück", year: 2027 },
    });

    render(<MembersDashboard />);
    await waitForOverview();

    const tile = queryFinalRehearsalTile();
    expect(tile).not.toBeNull();
    expect(tile?.textContent).toContain("Tage bis Endproben");
    expect(tile?.textContent).toContain("–");
    expect(tile?.textContent).toContain("Noch kein Termin gesetzt");
    expect(screen.queryByRole("link", { name: /Tage bis Endproben/ })).toBeNull();
  });

  it("links the placeholder tile to the production timeline for managers", async () => {
    useMembersPermissionsMock.mockReturnValue(["PRIVATE.PRODUCTION.SHOW.MANAGE"]);
    mockOverview({
      finalRehearsalWeek: null,
      activeProduction: { id: "show-1", title: "Teststück", year: 2027 },
    });

    render(<MembersDashboard />);
    await waitForOverview();

    expect(screen.getByRole("link", { name: /Tage bis Endproben/ })).toHaveAttribute(
      "href",
      "/mitglieder/produktionen/show-1",
    );
  });

  it("hides the tile when no production is active", async () => {
    mockOverview({ finalRehearsalWeek: null, activeProduction: null });

    render(<MembersDashboard />);
    await waitForOverview();

    expect(queryFinalRehearsalTile()).toBeNull();
    expect(screen.getByText("Keine aktive Produktion")).toBeInTheDocument();
  });

  it("shows the member count of the active production", async () => {
    mockOverview({
      finalRehearsalWeek: null,
      activeProduction: { id: "show-1", title: "Teststück", year: 2027 },
    });

    render(<MembersDashboard />);
    await waitForOverview();

    const tile = screen.getByText("Mitglieder").closest<HTMLElement>("a, div");
    expect(tile?.textContent).toContain("45");
    expect(tile?.textContent).toContain("in dieser Produktion");
  });

  it("hides the tile once the final rehearsal week is over", async () => {
    mockOverview({
      finalRehearsalWeek: {
        showId: "show-1",
        title: "Teststück",
        year: 2026,
        startDate: daysFromNow(-30),
        endDate: daysFromNow(-24),
      },
      activeProduction: { id: "show-1", title: "Teststück", year: 2026 },
    });

    render(<MembersDashboard />);
    await waitForOverview();

    expect(queryFinalRehearsalTile()).toBeNull();
  });

  it("counts the days until the final rehearsal week starts", async () => {
    mockOverview({
      finalRehearsalWeek: {
        showId: "show-1",
        title: "Teststück",
        year: 2027,
        startDate: daysFromNow(5),
        endDate: daysFromNow(11),
      },
      activeProduction: { id: "show-1", title: "Teststück", year: 2027 },
    });

    render(<MembersDashboard />);
    await waitForOverview();

    const tile = queryFinalRehearsalTile();
    // Die Kachel nennt nur noch den Wert; das Startdatum stand früher als Hinweis darunter.
    expect(tile?.textContent).toMatch(/^Tage bis Endproben\s*5$/);
  });
});
