import { describe, expect, it } from "vitest";

import {
  getEasterSunday,
  getSaxonyPublicHolidayName,
  getSaxonyPublicHolidays,
} from "@/lib/saxony-public-holidays";

describe("getSaxonyPublicHolidays", () => {
  it("computes Easter Sunday", () => {
    expect(getEasterSunday(2024).toISOString().slice(0, 10)).toBe("2024-03-31");
    expect(getEasterSunday(2026).toISOString().slice(0, 10)).toBe("2026-04-05");
    expect(getEasterSunday(2027).toISOString().slice(0, 10)).toBe("2027-03-28");
  });

  it("matches the known Saxony holidays of 2023 to 2026", () => {
    const dates = (year: number) =>
      getSaxonyPublicHolidays(year).map((entry) => `${entry.startDate} ${entry.title}`);
    expect(dates(2023)).toEqual([
      "2023-01-01 Neujahrstag",
      "2023-04-07 Karfreitag",
      "2023-04-10 Ostermontag",
      "2023-05-01 Tag der Arbeit",
      "2023-05-18 Christi Himmelfahrt",
      "2023-05-29 Pfingstmontag",
      "2023-06-08 Fronleichnam",
      "2023-10-03 Tag der Deutschen Einheit",
      "2023-10-31 Reformationstag",
      "2023-11-22 Buß- und Bettag",
      "2023-12-25 1. Weihnachtstag",
      "2023-12-26 2. Weihnachtstag",
    ]);
    expect(dates(2024)).toContain("2024-11-20 Buß- und Bettag");
    expect(dates(2025)).toContain("2025-11-19 Buß- und Bettag");
    expect(dates(2026)).toContain("2026-11-18 Buß- und Bettag");
    expect(dates(2026)).toContain("2026-06-04 Fronleichnam");
  });

  it("keeps the ids of the former static list", () => {
    const ids = getSaxonyPublicHolidays(2023).map((entry) => entry.id);
    expect(ids).toContain("public-holiday:2023-11-22-buss-und-bettag");
    expect(ids).toContain("public-holiday:2023-12-25-1-weihnachtstag");
  });

  it("names a holiday by its date", () => {
    expect(getSaxonyPublicHolidayName("2026-10-03")).toBe("Tag der Deutschen Einheit");
    expect(getSaxonyPublicHolidayName("2026-10-04")).toBeNull();
  });
});
