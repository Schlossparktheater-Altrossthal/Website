import { describe, expect, it } from "vitest";

import { summarizeEventAudience, summarizeEventScenes } from "@/lib/calendar/event-summary";

const departments = new Map([
  ["d1", "Kostüm"],
  ["d2", "Bühne"],
]);

describe("summarizeEventAudience", () => {
  it("nennt ohne Regeln und Einladungen alle", () => {
    expect(
      summarizeEventAudience({ rules: [], blockDepartmentIds: [], invitedCount: 0 }, departments),
    ).toBe("Alle");
  });

  it("fasst Ensemble, Gewerke aus Regeln und Spuren und Personen zusammen", () => {
    expect(
      summarizeEventAudience(
        {
          rules: [
            { type: "ALL_CAST", targetId: null },
            { type: "DEPARTMENT", targetId: "d1" },
            { type: "USER", targetId: "u1" },
          ],
          blockDepartmentIds: ["d2", "d1", null],
          invitedCount: 9,
        },
        departments,
      ),
    ).toBe("Ensemble · Kostüm · Bühne · 1 Person");
  });

  it("markiert Teile des Ensembles", () => {
    expect(
      summarizeEventAudience(
        { rules: [{ type: "SCENE", targetId: "s1" }], blockDepartmentIds: [], invitedCount: 4 },
        departments,
      ),
    ).toBe("Ensemble (Teil)");
  });
});

describe("summarizeEventScenes", () => {
  it("sortiert nach Spielreihenfolge und entfernt Doppelte", () => {
    expect(
      summarizeEventScenes([
        { identifier: "1.4", sequence: 4 },
        { identifier: "1.2", sequence: 2 },
        { identifier: "1.4", sequence: 4 },
      ]),
    ).toBe("1.2, 1.4");
  });

  it("kürzt lange Listen zur Spanne", () => {
    const scenes = Array.from({ length: 12 }, (_, i) => ({
      identifier: `1.${i + 1}`,
      sequence: i,
    }));
    expect(summarizeEventScenes(scenes)).toBe("1.1–1.12 (12)");
  });
});
