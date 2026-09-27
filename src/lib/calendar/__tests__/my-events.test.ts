import { describe, expect, it } from "vitest";

import { resolveEventBucket } from "@/lib/calendar/my-events";
import { parseDateTimeInTimeZone } from "@/lib/date-time";

/** Mittwoch, 30.09.2026, 10:00 Uhr Berliner Zeit. */
const NOW = parseDateTimeInTimeZone("2026-09-30", "10:00");

const at = (day: string, time = "19:00") => parseDateTimeInTimeZone(day, time);

describe("resolveEventBucket", () => {
  it("fasst heute und morgen zusammen", () => {
    expect(resolveEventBucket(at("2026-09-30"), NOW)).toBe("today");
    expect(resolveEventBucket(at("2026-10-01"), NOW)).toBe("today");
  });

  it("zählt den Rest der Woche bis einschließlich Sonntag zum Abschnitt week", () => {
    expect(resolveEventBucket(at("2026-10-02"), NOW)).toBe("week");
    expect(resolveEventBucket(at("2026-10-04"), NOW)).toBe("week");
    expect(resolveEventBucket(at("2026-10-05"), NOW)).toBe("later");
  });

  it("erkennt Vergangenes", () => {
    expect(resolveEventBucket(at("2026-09-29"), NOW)).toBe("past");
    expect(resolveEventBucket(at("2026-09-30", "08:00"), NOW)).toBe("today");
  });

  it("entscheidet auf Tagesebene in Europe/Berlin", () => {
    // 00:30 Uhr Berliner Zeit gehört schon zum Folgetag, in UTC aber noch zum Vortag.
    expect(resolveEventBucket(parseDateTimeInTimeZone("2026-10-01", "00:30"), NOW)).toBe("today");
  });

  it("reicht am Sonntag bis zum kommenden Sonntag", () => {
    const sunday = parseDateTimeInTimeZone("2026-10-04", "10:00");
    expect(resolveEventBucket(at("2026-10-05"), sunday)).toBe("today");
    expect(resolveEventBucket(at("2026-10-11"), sunday)).toBe("week");
    expect(resolveEventBucket(at("2026-10-12"), sunday)).toBe("later");
  });
});
