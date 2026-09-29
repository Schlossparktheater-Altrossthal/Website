import { describe, expect, it } from "vitest";

import { allergyInputSchema, aversionInputSchema, firstIssueMessage } from "../dietary-validation";

const minimalAllergy = { allergen: "Erdnüsse", level: "SEVERE" };

describe("allergyInputSchema", () => {
  it("füllt nicht angegebene Angaben mit Standardwerten", () => {
    const result = allergyInputSchema.safeParse(minimalAllergy);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toEqual({
      allergen: "Erdnüsse",
      kind: "ALLERGY",
      level: "SEVERE",
      tracesOk: null,
      diagnosed: false,
      symptoms: null,
      treatment: null,
      note: null,
    });
  });

  it("nimmt Art, Spuren und Bestätigung an", () => {
    const result = allergyInputSchema.safeParse({
      ...minimalAllergy,
      kind: "INTOLERANCE",
      tracesOk: false,
      diagnosed: true,
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.kind).toBe("INTOLERANCE");
    expect(result.data.tracesOk).toBe(false);
    expect(result.data.diagnosed).toBe(true);
  });

  it("unterscheidet unproblematische Spuren von einer fehlenden Angabe", () => {
    const yes = allergyInputSchema.parse({ ...minimalAllergy, tracesOk: true });
    const unset = allergyInputSchema.parse(minimalAllergy);
    expect(yes.tracesOk).toBe(true);
    expect(unset.tracesOk).toBeNull();
  });

  it("schneidet Leerzeichen ab und behandelt leere Texte als nicht angegeben", () => {
    const result = allergyInputSchema.parse({
      ...minimalAllergy,
      allergen: "  Erdnüsse  ",
      symptoms: "   ",
      note: "",
    });
    expect(result.allergen).toBe("Erdnüsse");
    expect(result.symptoms).toBeNull();
    expect(result.note).toBeNull();
  });

  it("weist ein zu kurzes Allergen ab", () => {
    expect(allergyInputSchema.safeParse({ ...minimalAllergy, allergen: "E" }).success).toBe(false);
  });

  it("weist einen unbekannten Schweregrad ab", () => {
    expect(allergyInputSchema.safeParse({ ...minimalAllergy, level: "EXTREME" }).success).toBe(
      false,
    );
  });

  it("weist eine unbekannte Art ab", () => {
    expect(allergyInputSchema.safeParse({ ...minimalAllergy, kind: "UNBEKANNT" }).success).toBe(
      false,
    );
  });

  it("weist zu lange Texte ab", () => {
    expect(allergyInputSchema.safeParse({ ...minimalAllergy, note: "x".repeat(501) }).success).toBe(
      false,
    );
  });
});

describe("aversionInputSchema", () => {
  it("nimmt eine Besonderheit mit optionaler Notiz an", () => {
    expect(aversionInputSchema.parse({ label: "  Keine Pilze ", note: "  " })).toEqual({
      label: "Keine Pilze",
      note: null,
    });
  });

  it("weist eine zu kurze Angabe ab", () => {
    expect(aversionInputSchema.safeParse({ label: "x" }).success).toBe(false);
  });

  it("weist eine zu lange Angabe ab", () => {
    expect(aversionInputSchema.safeParse({ label: "x".repeat(121) }).success).toBe(false);
  });
});

describe("firstIssueMessage", () => {
  it("nimmt die erste Meldung des Schemas", () => {
    const result = allergyInputSchema.safeParse({ allergen: "E", level: "MILD" });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(firstIssueMessage(result.error)).toContain("Allergen");
  });

  it("fällt auf einen Standardtext zurück, wenn es keine Meldung gibt", () => {
    expect(firstIssueMessage({ issues: [] })).toBe("Ungültige Eingaben.");
  });
});
