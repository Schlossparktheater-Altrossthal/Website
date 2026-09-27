import { describe, expect, it } from "vitest";

import { candidateDays, rankDays, rateDay, weekdayOf } from "@/lib/calendar/date-finder";

const participants = [
  { userId: "max", level: "REQUIRED" as const },
  { userId: "ben", level: "REQUIRED" as const },
  { userId: "lena", level: "OPTIONAL" as const },
];

describe("candidateDays", () => {
  it("keeps only the selected weekdays", () => {
    // 2026-10-05 ist ein Montag.
    const days = candidateDays({ from: "2026-10-05", to: "2026-10-18", weekdays: [2, 4] });
    expect(days).toEqual(["2026-10-06", "2026-10-08", "2026-10-13", "2026-10-15"]);
    expect(days.map(weekdayOf)).toEqual([2, 4, 2, 4]);
  });

  it("uses every day without weekday filter and respects the limit", () => {
    expect(candidateDays({ from: "2026-10-05", to: "2026-10-31", weekdays: [], limit: 3 })).toEqual(
      ["2026-10-05", "2026-10-06", "2026-10-07"],
    );
  });
});

describe("rateDay", () => {
  it("rates a day without restrictions as good", () => {
    const day = rateDay(participants, { dateKey: "2026-10-06", blocks: {}, busy: {} });
    expect(day.rating).toBe("good");
    expect(day.score).toBe(0);
    expect(day.required.free).toBe(2);
  });

  it("marks a day as bad when a required person is blocked or busy", () => {
    const blocked = rateDay(participants, {
      dateKey: "2026-10-06",
      blocks: { max: "blocked" },
      busy: {},
    });
    expect(blocked.rating).toBe("bad");
    expect(blocked.missingRequired).toEqual(["max"]);

    const busy = rateDay(participants, {
      dateKey: "2026-10-06",
      blocks: {},
      busy: { ben: "Probe" },
    });
    expect(busy.required.busy).toBe(1);
    expect(busy.missingRequired).toEqual(["ben"]);
  });

  it("treats limited required people as ok", () => {
    const day = rateDay(participants, {
      dateKey: "2026-10-06",
      blocks: { ben: "limited", lena: "blocked" },
      busy: {},
    });
    expect(day.rating).toBe("ok");
    expect(day.limitedRequired).toEqual(["ben"]);
    expect(day.optional.blocked).toBe(1);
  });
});

describe("rankDays", () => {
  it("weights required people higher than optional ones", () => {
    const ranked = rankDays(participants, [
      { dateKey: "2026-10-06", blocks: { max: "blocked" }, busy: {} },
      { dateKey: "2026-10-07", blocks: { lena: "blocked" }, busy: {} },
      { dateKey: "2026-10-08", blocks: {}, busy: {} },
      { dateKey: "2026-10-09", blocks: {}, busy: {} },
    ]);
    expect(ranked.map((day) => day.dateKey)).toEqual([
      "2026-10-08",
      "2026-10-09",
      "2026-10-07",
      "2026-10-06",
    ]);
  });
});
