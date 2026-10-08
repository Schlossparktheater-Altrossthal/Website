import { describe, expect, it } from "vitest";

import { computeWeekLoad, describeLoad, weekBounds } from "@/lib/calendar/week-load";

const events = [
  {
    id: "fri",
    dayKey: "2026-10-09",
    start: "2026-10-09T16:30:00Z",
    end: "2026-10-09T19:30:00Z",
    userIds: ["ida", "max"],
  },
  {
    id: "sun",
    dayKey: "2026-10-11",
    start: "2026-10-11T08:00:00Z",
    end: "2026-10-11T10:00:00Z",
    userIds: ["ida"],
  },
  {
    id: "next-week",
    dayKey: "2026-10-12",
    start: "2026-10-12T16:00:00Z",
    end: "2026-10-12T18:00:00Z",
    userIds: ["ida"],
  },
  {
    id: "self",
    dayKey: "2026-10-10",
    start: "2026-10-10T08:00:00Z",
    end: "2026-10-10T10:00:00Z",
    userIds: ["ida"],
  },
];

describe("week load", () => {
  it("finds monday to sunday", () => {
    expect(weekBounds("2026-10-10")).toEqual({ from: "2026-10-05", to: "2026-10-11" });
    expect(weekBounds("2026-10-05")).toEqual({ from: "2026-10-05", to: "2026-10-11" });
  });

  it("counts events of the week without the current one", () => {
    const load = computeWeekLoad(events, "2026-10-10", "self");
    expect(load.ida).toEqual({ count: 2, minutes: 300, dayKeys: ["2026-10-09", "2026-10-11"] });
    expect(load.max?.count).toBe(1);
  });

  it("describes load with neighbouring days", () => {
    const load = computeWeekLoad(events, "2026-10-10", "self");
    expect(describeLoad(load.ida, "2026-10-10")).toEqual({
      text: "diese Woche schon 2× · 5 h · auch Fr + So",
      heavy: true,
      neighbors: ["2026-10-09", "2026-10-11"],
    });
    expect(describeLoad(undefined, "2026-10-10")).toBeNull();
  });
});
