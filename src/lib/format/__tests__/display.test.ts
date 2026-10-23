import { describe, expect, it } from "vitest";

import {
  formatDate,
  formatDateKey,
  formatDateTime,
  formatTime,
  toValidDate,
} from "@/lib/format/date";

describe("Datumsanzeige", () => {
  // 22:30 UTC ist in Berlin (Sommerzeit) bereits der nächste Tag.
  const lateUtc = new Date("2026-07-14T22:30:00Z");

  it("formatiert in Europe/Berlin", () => {
    expect(formatDate(lateUtc)).toBe("15.07.2026");
    expect(formatTime(lateUtc)).toBe("00:30");
    expect(formatDateTime(lateUtc)).toBe("15.07.2026, 00:30");
    expect(formatDate(lateUtc, "long")).toBe("15. Juli 2026");
  });

  it("akzeptiert Strings und Zahlen", () => {
    expect(formatDate("2026-10-23T08:00:00Z")).toBe("23.10.2026");
    expect(formatDate(lateUtc.getTime())).toBe("15.07.2026");
  });

  it("liefert null für leere oder ungültige Werte", () => {
    expect(formatDate(null)).toBeNull();
    expect(formatDate(undefined)).toBeNull();
    expect(formatDate("")).toBeNull();
    expect(formatDateTime("kein Datum")).toBeNull();
    expect(toValidDate("kaputt")).toBeNull();
  });

  it("formatiert reine Kalendertage ohne Verrutschen", () => {
    expect(formatDateKey("2026-03-29")).toBe("29.03.2026");
    expect(
      formatDateKey("2026-10-23", { weekday: "short", day: "2-digit", month: "2-digit" }),
    ).toBe("Fr., 23.10.");
    expect(formatDateKey("")).toBeNull();
    expect(formatDateKey("23.10.2026")).toBeNull();
  });
});
