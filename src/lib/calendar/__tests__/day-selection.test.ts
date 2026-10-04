import { describe, expect, it } from "vitest";

import { applyDayRange, dayKeysBetween } from "../day-selection";

describe("dayKeysBetween", () => {
  it("liefert den Zeitraum über den Monatsrand, auch rückwärts", () => {
    expect(dayKeysBetween("2026-11-02", "2026-10-30")).toEqual([
      "2026-10-30",
      "2026-10-31",
      "2026-11-01",
      "2026-11-02",
    ]);
  });

  it("überlebt die Zeitumstellung", () => {
    expect(dayKeysBetween("2026-10-24", "2026-10-26")).toHaveLength(3);
  });
});

describe("applyDayRange", () => {
  it("fügt hinzu und überspringt nicht wählbare Tage", () => {
    const next = applyDayRange(
      new Set(["2026-10-01"]),
      "2026-10-03",
      "2026-10-05",
      "add",
      (key) => key !== "2026-10-04",
    );
    expect([...next].sort()).toEqual(["2026-10-01", "2026-10-03", "2026-10-05"]);
  });

  it("wählt ab, ohne die Ausgangsmenge zu verändern", () => {
    const base = new Set(["2026-10-01", "2026-10-02", "2026-10-03"]);
    const next = applyDayRange(base, "2026-10-02", "2026-10-03", "remove");
    expect([...next]).toEqual(["2026-10-01"]);
    expect(base.size).toBe(3);
  });
});
