import { describe, expect, it } from "vitest";

import {
  addMonths,
  formatInventoryCode,
  inspectionState,
  isLocationCode,
  parseInventoryCode,
} from "@/lib/inventory/constants";

describe("parseInventoryCode", () => {
  it("liest Codes aus QR-URLs und Eingaben", () => {
    expect(parseInventoryCode("https://mitglieder.example.org/i/T-0042")).toBe("T-0042");
    expect(parseInventoryCode("https://x.de/i/K-0007?utm=1")).toBe("K-0007");
    expect(parseInventoryCode("t42")).toBe("T-0042");
    expect(parseInventoryCode(" l-3 ")).toBe("L-0003");
    expect(parseInventoryCode("T-123456")).toBe("T-123456");
  });

  it("verwirft Unsinn", () => {
    expect(parseInventoryCode("")).toBeNull();
    expect(parseInventoryCode("hallo welt")).toBeNull();
    expect(parseInventoryCode("https://example.org/foo")).toBeNull();
  });

  it("erkennt Lagerort-Codes", () => {
    expect(isLocationCode(formatInventoryCode("L", 5))).toBe(true);
    expect(isLocationCode("T-0005")).toBe(false);
  });
});

describe("Prüffristen", () => {
  const now = new Date("2026-10-02T10:00:00Z");

  it("leitet die Ampel ab", () => {
    expect(inspectionState({ inspectionRequired: false, nextInspectionAt: null }, now)).toBe(
      "none",
    );
    expect(inspectionState({ inspectionRequired: true, nextInspectionAt: null }, now)).toBe(
      "overdue",
    );
    expect(
      inspectionState({ inspectionRequired: true, nextInspectionAt: "2026-10-20T00:00:00Z" }, now),
    ).toBe("soon");
    expect(
      inspectionState({ inspectionRequired: true, nextInspectionAt: "2027-06-01T00:00:00Z" }, now),
    ).toBe("ok");
    expect(
      inspectionState(
        {
          inspectionRequired: true,
          nextInspectionAt: "2027-06-01T00:00:00Z",
          lastInspectionFailed: true,
        },
        now,
      ),
    ).toBe("failed");
  });

  it("addiert Monate ohne Überlauf am Monatsende", () => {
    expect(addMonths(new Date("2026-01-31T00:00:00Z"), 1).toISOString()).toBe(
      "2026-02-28T00:00:00.000Z",
    );
    expect(addMonths(new Date("2026-03-15T00:00:00Z"), 12).toISOString()).toBe(
      "2027-03-15T00:00:00.000Z",
    );
  });
});
