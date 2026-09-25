import { describe, expect, it } from "vitest";

import { buildDayInfos, buildHolidayMap, isInFinalWeek } from "@/lib/sperrliste/day-tiers";
import type { HolidayRange } from "@/types/holidays";

const holidays: HolidayRange[] = [
  {
    id: "herbst",
    title: "Herbstferien",
    startDate: "2026-10-12",
    endDate: "2026-10-16",
    category: "schoolHoliday",
  },
  {
    id: "einheit",
    title: "Tag der Deutschen Einheit",
    startDate: "2026-10-03",
    endDate: "2026-10-03",
    category: "publicHoliday",
  },
];

function tiersFor(
  start: string,
  end: string,
  extra: Partial<Parameters<typeof buildDayInfos>[1]> = {},
) {
  const infos = buildDayInfos(
    { start: new Date(`${start}T00:00:00`), end: new Date(`${end}T00:00:00`) },
    {
      preferredWeekdays: [5, 6, 0],
      exceptionWeekdays: [],
      holidays,
      today: new Date("2026-10-01T10:00:00"),
      ...extra,
    },
  );
  return Object.fromEntries(infos.map((info) => [info.key, info]));
}

describe("buildDayInfos", () => {
  it("marks Friday to Sunday as core days and other weekdays as off", () => {
    const days = tiersFor("2026-10-05", "2026-10-11");
    expect(days["2026-10-05"].tier).toBe("off");
    expect(days["2026-10-08"].tier).toBe("off");
    expect(days["2026-10-09"].tier).toBe("core");
    expect(days["2026-10-11"].tier).toBe("core");
  });

  it("treats weekdays in school holidays, public holidays and event days as possible", () => {
    const days = tiersFor("2026-10-12", "2026-10-22", {
      eventDayKeys: new Set(["2026-10-21"]),
    });
    expect(days["2026-10-13"].tier).toBe("possible");
    expect(days["2026-10-13"].isSchoolHoliday).toBe(true);
    expect(days["2026-10-20"].tier).toBe("off");
    expect(days["2026-10-21"].tier).toBe("possible");
    expect(tiersFor("2026-10-03", "2026-10-03")["2026-10-03"].isPublicHoliday).toBe(true);
  });

  it("promotes every day of the final rehearsal week to core", () => {
    const days = tiersFor("2026-11-01", "2026-11-10", {
      finalWeek: { start: "2026-11-02", end: "2026-11-06" },
    });
    expect(days["2026-11-02"].tier).toBe("core");
    expect(days["2026-11-04"].isFinalWeek).toBe(true);
    expect(days["2026-11-09"].tier).toBe("off");
  });

  it("uses exception weekdays as possible days", () => {
    const days = tiersFor("2026-10-06", "2026-10-06", { exceptionWeekdays: [2] });
    expect(days["2026-10-06"].tier).toBe("possible");
  });

  it("flags today, past days and the freeze window", () => {
    const days = tiersFor("2026-09-30", "2026-10-09", { freezeDays: 7 });
    expect(days["2026-09-30"].isPast).toBe(true);
    expect(days["2026-10-01"].isToday).toBe(true);
    expect(days["2026-10-07"].isFrozen).toBe(true);
    expect(days["2026-10-08"].isFrozen).toBe(false);
  });
});

describe("helpers", () => {
  it("expands holiday ranges per day", () => {
    const map = buildHolidayMap(holidays);
    expect(map.get("2026-10-14")?.[0]?.title).toBe("Herbstferien");
    expect(map.has("2026-10-17")).toBe(false);
  });

  it("assumes a seven day final week when no end is set", () => {
    const week = { start: "2026-11-02", end: null };
    expect(isInFinalWeek("2026-11-08", week)).toBe(true);
    expect(isInFinalWeek("2026-11-09", week)).toBe(false);
  });
});
