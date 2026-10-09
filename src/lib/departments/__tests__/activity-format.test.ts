import { describe, expect, it } from "vitest";

import { claimActive, describeActivity, orderSteps, splitSteps } from "../activity-format";

describe("claimActive", () => {
  const now = new Date("2026-10-09T20:00:00Z");

  it("gilt 12 Stunden", () => {
    expect(claimActive(new Date("2026-10-09T08:30:00Z"), now)).toBe(true);
    expect(claimActive(new Date("2026-10-09T07:59:00Z"), now)).toBe(false);
  });

  it("ohne Zeitpunkt ist niemand dran", () => {
    expect(claimActive(null, now)).toBe(false);
  });
});

describe("describeActivity", () => {
  it("beschreibt Checkliste und Notizen", () => {
    expect(describeActivity("checklist_done", { text: "grundiert" })).toBe(
      "hat „grundiert“ abgehakt",
    );
    expect(describeActivity("next_step", { text: "zweite Schicht" })).toBe(
      "Nächster Schritt: zweite Schicht",
    );
    expect(describeActivity("caution", { text: null })).toBe("Achtung-Hinweis entfernt");
    expect(describeActivity("column", { to: "In Arbeit" })).toBe(
      "hat sie nach „In Arbeit“ geschoben",
    );
    expect(describeActivity("claim", { on: false })).toBe("hat die Karte freigegeben");
  });
});

describe("splitSteps / orderSteps", () => {
  it("macht aus einer eingefügten Liste einzelne Schritte", () => {
    expect(splitSteps("- Tisch aufstellen\n2) Abkleben\n\n[ ] Beschriften\r\n• Fertig")).toEqual([
      "Tisch aufstellen",
      "Abkleben",
      "Beschriften",
      "Fertig",
    ]);
  });

  it("stellt offene Schritte vor erledigte, Reihenfolge bleibt", () => {
    const steps = [
      { id: "a", done: true },
      { id: "b", done: false },
      { id: "c", done: false },
    ];
    expect(orderSteps(steps).map((step) => step.id)).toEqual(["b", "c", "a"]);
  });
});
