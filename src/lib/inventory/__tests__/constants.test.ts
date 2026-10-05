import { describe, expect, it } from "vitest";

import {
  addMonths,
  formatInventoryCode,
  inspectionState,
  isLocationCode,
  parseInventoryCode,
} from "@/lib/inventory/constants";

describe("formatInventoryCode", () => {
  it("schreibt Codes ohne führende Nullen", () => {
    expect(formatInventoryCode("T", 42, 3)).toBe("T-42-3");
    expect(formatInventoryCode("T", 42)).toBe("T-42");
    expect(formatInventoryCode("L", 7, null)).toBe("L-7");
  });
});

describe("parseInventoryCode", () => {
  it("liest Codes aus QR-URLs und Eingaben", () => {
    expect(parseInventoryCode("https://mitglieder.example.org/i/T-42-3")).toBe("T-42-3");
    expect(parseInventoryCode("https://x.de/i/K-7?utm=1")).toBe("K-7");
    expect(parseInventoryCode("t42")).toBe("T-42");
    expect(parseInventoryCode("t042-03")).toBe("T-42-3");
    expect(parseInventoryCode("T42.3")).toBe("T-42-3");
    expect(parseInventoryCode(" l-0003 ")).toBe("L-3");
    expect(parseInventoryCode("T-123456-12345")).toBe("T-123456-12345");
  });

  it("verwirft Unsinn", () => {
    expect(parseInventoryCode("")).toBeNull();
    expect(parseInventoryCode("hallo welt")).toBeNull();
    expect(parseInventoryCode("https://example.org/foo")).toBeNull();
    expect(parseInventoryCode("T-0")).toBeNull();
    expect(parseInventoryCode("T-4-0")).toBeNull();
  });

  it("erkennt Lagerort-Codes", () => {
    expect(isLocationCode(formatInventoryCode("L", 5))).toBe(true);
    expect(isLocationCode("T-5-1")).toBe(false);
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
