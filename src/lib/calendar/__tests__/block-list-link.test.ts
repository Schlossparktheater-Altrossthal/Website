import { describe, expect, it } from "vitest";

import { blockDayKey, isWithinFreeze } from "@/lib/calendar/block-list-link";
import { parseDateTimeInTimeZone } from "@/lib/date-time";

/** Mittwoch, 30.09.2026, 10:00 Uhr Berliner Zeit. */
const NOW = parseDateTimeInTimeZone("2026-09-30", "10:00");

const at = (day: string, time = "19:00") => parseDateTimeInTimeZone(day, time);

describe("blockDayKey", () => {
  it("rechnet den Tag in Berliner Zeit", () => {
    expect(blockDayKey(at("2026-10-01", "00:30"))).toBe("2026-10-01");
    expect(blockDayKey(at("2026-09-30", "23:30"))).toBe("2026-09-30");
  });
});

describe("isWithinFreeze", () => {
  it("greift innerhalb der Sperrfrist", () => {
    expect(isWithinFreeze(at("2026-09-30"), 7, NOW)).toBe(true);
    expect(isWithinFreeze(at("2026-10-03"), 7, NOW)).toBe(true);
  });

  it("greift an der Grenze nicht mehr", () => {
    // Der 07.10. ist genau sieben Tage entfernt – die Sperrliste nimmt den Tag noch auf.
    expect(isWithinFreeze(at("2026-10-07"), 7, NOW)).toBe(false);
    expect(isWithinFreeze(at("2026-10-08"), 7, NOW)).toBe(false);
  });

  it("ist ohne Sperrfrist immer falsch", () => {
    expect(isWithinFreeze(at("2026-09-30"), 0, NOW)).toBe(false);
  });
});
