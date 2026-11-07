import { describe, expect, it } from "vitest";

import { availabilityDayKeys, parseAvailabilityRange } from "@/lib/regie/availability-range";

// Mittwoch, 4.11.2026
const today = new Date("2026-11-04T10:00:00Z");
const base = { today, preferredWeekdays: [6, 0], finalWeek: null, eventDayKeys: new Set<string>() };

describe("availabilityDayKeys", () => {
  it("ganze Wochen: heute bis Sonntag der letzten Woche", () => {
    const keys = availabilityDayKeys({ mode: "wochen", weeks: 2 }, base);
    expect(keys[0]).toBe("2026-11-04");
    expect(keys.at(-1)).toBe("2026-11-15");
  });

  it("Kerntage: nur Wochenenden und Endprobenwoche", () => {
    const keys = availabilityDayKeys(
      { mode: "kerntage", weeks: 2 },
      { ...base, finalWeek: { start: "2026-11-12", end: "2026-11-13" } },
    );
    expect(keys).toEqual([
      "2026-11-07",
      "2026-11-08",
      "2026-11-12",
      "2026-11-13",
      "2026-11-14",
      "2026-11-15",
    ]);
  });

  it("Termintage: nur Tage mit Termin", () => {
    const keys = availabilityDayKeys(
      { mode: "termine", weeks: 1 },
      { ...base, eventDayKeys: new Set(["2026-11-05", "2026-11-20"]) },
    );
    expect(keys).toEqual(["2026-11-05"]);
  });

  it("ungültige Parameter → Vorgabe", () => {
    expect(parseAvailabilityRange("x", "99")).toEqual({ mode: "kerntage", weeks: 2 });
  });
});
