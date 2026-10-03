import { describe, expect, it } from "vitest";

import { summarizeUsage, type UsagePageViewRow } from "../usage-summary";

const NOW = new Date("2026-10-03T12:00:00Z");
const MIN = 60_000;
const DAY = 24 * 60 * MIN;

function view(overrides: Partial<UsagePageViewRow> & { minutesAgo: number }): UsagePageViewRow {
  const { minutesAgo, ...rest } = overrides;
  return {
    path: "/mitglieder",
    createdAt: new Date(NOW.getTime() - minutesAgo * MIN),
    timeOnPageMs: 60_000,
    deviceHint: "mobile",
    userId: "u1",
    sessionKey: "s1",
    ...rest,
  };
}

describe("summarizeUsage", () => {
  const names = new Map([
    ["u1", "Anna Beispiel"],
    ["u2", "Ben Muster"],
  ]);

  it("trennt Besuche nach 30 Minuten Pause und zählt aktive Personen", () => {
    const summary = summarizeUsage(
      [
        view({ minutesAgo: 120 }),
        view({ minutesAgo: 118, path: "/mitglieder/sperrliste" }),
        // > 30 min Pause -> neuer Besuch
        view({ minutesAgo: 30, path: "/mitglieder/sperrliste" }),
        view({ minutesAgo: 10, userId: "u2", sessionKey: "s2", deviceHint: "desktop" }),
        // außerhalb des Mitgliederbereichs -> ignoriert
        view({ minutesAgo: 5, path: "/login", userId: null }),
      ],
      7,
      NOW,
      names,
    );

    expect(summary.kpis.activeMembers.current).toBe(2);
    expect(summary.kpis.visits.current).toBe(3);
    expect(summary.kpis.pageViews.current).toBe(4);
    expect(summary.kpis.mobileShare.current).toBe(0.75);
    expect(summary.pages[0]).toMatchObject({ route: "/mitglieder", views: 2, persons: 2 });
    expect(summary.members.map((member) => member.name)).toEqual(["Ben Muster", "Anna Beispiel"]);
    expect(summary.members[1]).toMatchObject({ visits: 2, pageViews: 3, device: "Handy" });
    expect(summary.daily).toHaveLength(7);
    expect(summary.daily.at(-1)).toMatchObject({ activeMembers: 2, pageViews: 4 });
  });

  it("vergleicht mit dem Vorzeitraum", () => {
    const summary = summarizeUsage(
      [view({ minutesAgo: 60 }), view({ minutesAgo: (8 * DAY) / MIN, userId: "u2" })],
      7,
      NOW,
      names,
    );
    expect(summary.kpis.activeMembers).toEqual({ current: 1, previous: 1 });
    expect(summary.kpis.pageViews).toEqual({ current: 1, previous: 1 });
  });
});

describe("routeLabel", () => {
  it("nutzt Menünamen statt Pfaden", async () => {
    const { routeLabel } = await import("../route-labels");
    expect(routeLabel("/mitglieder/sperrliste")).toBe("Sperrliste");
    expect(routeLabel("/mitglieder/mitgliederverwaltung/[id]")).toMatch(/› Detail$/);
  });
});
