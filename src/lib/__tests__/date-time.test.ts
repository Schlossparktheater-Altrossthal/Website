import { describe, expect, it } from "vitest";

import { parseDateTimeInTimeZone } from "@/lib/date-time";

describe("parseDateTimeInTimeZone", () => {
  it("converts Berlin summer time to UTC", () => {
    expect(parseDateTimeInTimeZone("2026-07-10", "19:00").toISOString()).toBe(
      "2026-07-10T17:00:00.000Z",
    );
  });

  it("converts Berlin winter time to UTC", () => {
    expect(parseDateTimeInTimeZone("2026-12-10", "19:00").toISOString()).toBe(
      "2026-12-10T18:00:00.000Z",
    );
  });

  it("handles the day of the clock change", () => {
    expect(parseDateTimeInTimeZone("2026-10-25", "12:00").toISOString()).toBe(
      "2026-10-25T11:00:00.000Z",
    );
  });
});
