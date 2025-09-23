import { describe, expect, it } from "vitest";

import {
  formatRelativeBetween,
  formatRelativeFromNow,
  formatRelativeWithAbsolute,
} from "@/lib/datetime";

describe("datetime utilities", () => {
  describe("formatRelativeFromNow", () => {
    it("formats short past differences in seconds", () => {
      const now = new Date("2024-06-01T12:00:00Z");
      const past = new Date("2024-06-01T11:59:45Z");

      expect(formatRelativeFromNow(past, { now })).toBe("vor 15 Sekunden");
    });

    it("formats future values using larger units", () => {
      const now = new Date("2024-06-01T12:00:00Z");
      const future = new Date("2024-06-01T14:30:00Z");

      expect(formatRelativeFromNow(future, { now })).toBe("in 3 Stunden");
    });

    it("accepts numeric timestamps as the reference", () => {
      const reference = Date.UTC(2024, 5, 1, 12, 0, 0);
      const past = new Date(reference - 2 * 60 * 60 * 1000);

      expect(formatRelativeFromNow(past, { now: reference })).toBe("vor 2 Stunden");
    });
  });

  describe("formatRelativeBetween", () => {
    it("honours custom formatters", () => {
      const reference = new Date("2024-01-01T00:00:00Z");
      const target = new Date("2024-01-02T00:00:00Z");
      const englishFormatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

      expect(
        formatRelativeBetween(target, reference, { formatter: englishFormatter }),
      ).toBe("tomorrow");
    });
  });

  describe("formatRelativeWithAbsolute", () => {
    it("combines relative and absolute representations", () => {
      const now = new Date("2024-01-10T12:00:00Z");
      const past = new Date("2024-01-08T10:30:00Z");
      const absoluteFormatter = new Intl.DateTimeFormat("de-DE", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "UTC",
      });

      const result = formatRelativeWithAbsolute(past, {
        now,
        absoluteFormatter,
        separator: " / ",
      });

      expect(result.relative).toBe("vorgestern");
      expect(result.absolute).toBe("08.01.2024, 10:30");
      expect(result.combined).toBe("vorgestern / 08.01.2024, 10:30");
    });
  });
});
