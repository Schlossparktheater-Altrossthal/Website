import { describe, expect, it } from "vitest";

import { buildScheduleMonths, isoWeek } from "@/lib/calendar/schedule-pdf";
import type { HolidayRange } from "@/types/holidays";

const holiday = (
  title: string,
  startDate: string,
  endDate: string,
  category: HolidayRange["category"] = "schoolHoliday",
): HolidayRange => ({ id: title, title, startDate, endDate, category });

const entry = (dayKey: string) => ({
  dayKey,
  lastDayKey: dayKey,
  event: { type: "event", dayKey },
});

describe("isoWeek", () => {
  it("rechnet ISO-Kalenderwochen", () => {
    expect(isoWeek("2026-10-16")).toBe(42);
    expect(isoWeek("2027-01-01")).toBe(53);
    expect(isoWeek("2027-01-04")).toBe(1);
  });
});

describe("buildScheduleMonths", () => {
  it("gruppiert nach Monat und Woche und setzt Ferien/Feiertage an ihren Tag", () => {
    const months = buildScheduleMonths(
      [entry("2026-10-16"), entry("2026-10-17"), entry("2026-11-02")],
      [
        holiday("Herbstferien", "2026-10-12", "2026-10-24"),
        holiday("Reformationstag", "2026-10-31", "2026-10-31", "publicHoliday"),
        holiday("Winterferien", "2027-02-08", "2027-02-21"),
      ],
    );
    expect(months.map((month) => month.label)).toEqual(["Oktober 2026", "November 2026"]);
    const october = months[0].weeks;
    expect(october[0].label).toBe("KW 42");
    // Laufende Ferien stehen am Anfang, vor den Terminen.
    expect(october[0].items[0]).toMatchObject({
      type: "notice",
      text: "Herbstferien 12.10.–24.10.",
    });
    expect(october[0].items).toHaveLength(3);
    expect(october[1].items).toEqual([
      { type: "notice", kind: "publicHoliday", text: "Reformationstag · Sa 31.10." },
    ]);
    expect(months[1].weeks[0].label).toBe("KW 45");
  });

  it("liefert ohne Termine nichts", () => {
    expect(buildScheduleMonths([], [holiday("Herbstferien", "2026-10-12", "2026-10-24")])).toEqual(
      [],
    );
  });
});
