import { describe, expect, it } from "vitest";

import {
  DEFAULT_STRICTNESS,
  DIETARY_STRICTNESS_OPTIONS,
  DIETARY_STYLE_OPTIONS,
  DIETARY_VARIANT_OPTIONS,
  dietaryPreferenceSchema,
  isStrictnessRelevant,
  parseDietaryStrictnessFromLabel,
  parseDietaryStyleFromLabel,
  parseDietaryVariantFromLabel,
  resolveDietaryStrictnessLabel,
  resolveDietaryStyleLabel,
  resolveDietaryVariantLabel,
  STRICTNESS_NOT_RELEVANT_LABEL,
  supportsDietaryVariant,
} from "../dietary-preferences";

describe("DIETARY_STYLE_OPTIONS", () => {
  it("führt jeden Stil genau einmal", () => {
    const values = DIETARY_STYLE_OPTIONS.map((option) => option.value);
    const labels = DIETARY_STYLE_OPTIONS.map((option) => option.label);
    expect(new Set(values).size).toBe(values.length);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it("enthält keinen Altwert none mehr", () => {
    const values: readonly string[] = DIETARY_STYLE_OPTIONS.map((option) => option.value);
    expect(values).not.toContain("none");
  });
});

describe("supportsDietaryVariant", () => {
  it("bietet eine Unterform nur bei vegetarisch an", () => {
    expect(supportsDietaryVariant("vegetarian")).toBe(true);
    for (const option of DIETARY_STYLE_OPTIONS) {
      if (option.value === "vegetarian") continue;
      expect(supportsDietaryVariant(option.value)).toBe(false);
    }
  });
});

describe("dietaryPreferenceSchema", () => {
  it("nimmt einen vollständigen vegetarischen Eintrag an", () => {
    const result = dietaryPreferenceSchema.safeParse({
      style: "vegetarian",
      variant: "lacto",
      strictness: "strict",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.variant).toBe("lacto");
      expect(result.data.customLabel).toBeNull();
    }
  });

  it("verlangt bei individueller Bezeichnung einen Text", () => {
    const result = dietaryPreferenceSchema.safeParse({
      style: "custom",
      customLabel: "   ",
      strictness: "flexible",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["customLabel"]);
    }
  });

  it("weist eine Unterform ab, die es für den Stil nicht gibt", () => {
    const result = dietaryPreferenceSchema.safeParse({
      style: "vegan",
      variant: "lacto",
      strictness: "strict",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["variant"]);
    }
  });

  it("kennt den Altwert none nicht mehr", () => {
    const result = dietaryPreferenceSchema.safeParse({ style: "none", strictness: "flexible" });
    expect(result.success).toBe(false);
  });
});

describe("parseDietaryStyleFromLabel", () => {
  it("liest den Altwert none als Allesesser", () => {
    expect(parseDietaryStyleFromLabel("none")).toEqual({ style: "omnivore", customLabel: null });
  });

  it("findet jeden Stil über sein Label wieder", () => {
    for (const option of DIETARY_STYLE_OPTIONS) {
      if (option.value === "custom") continue;
      expect(parseDietaryStyleFromLabel(option.label).style).toBe(option.value);
    }
  });

  it("nimmt unbekannte Texte als individuellen Stil", () => {
    expect(parseDietaryStyleFromLabel("Rohkost")).toEqual({
      style: "custom",
      customLabel: "Rohkost",
    });
  });

  it("behandelt eine leere Angabe als Allesesser", () => {
    expect(parseDietaryStyleFromLabel(null).style).toBe("omnivore");
    expect(parseDietaryStyleFromLabel("   ").style).toBe("omnivore");
  });
});

describe("parseDietaryVariantFromLabel", () => {
  it("liest jede Unterform über ihr Label", () => {
    for (const option of DIETARY_VARIANT_OPTIONS) {
      expect(parseDietaryVariantFromLabel(option.label)).toBe(option.value);
    }
  });

  it("liefert für eine fehlende oder unbekannte Angabe null", () => {
    expect(parseDietaryVariantFromLabel(null)).toBeNull();
    expect(parseDietaryVariantFromLabel("irgendwas")).toBeNull();
  });
});

describe("resolveDietaryStyleLabel", () => {
  it("fällt bei einem unbekannten Stil auf Allesesser zurück", () => {
    expect(resolveDietaryStyleLabel("custom", "  ").label).toBe("Allesesser");
  });

  it("nutzt bei individueller Bezeichnung den eigenen Text", () => {
    expect(resolveDietaryStyleLabel("custom", "  Rohkost  ")).toEqual({
      label: "Rohkost",
      custom: "Rohkost",
    });
  });
});

describe("resolveDietaryVariantLabel", () => {
  it("gibt die Unterform nur beim passenden Stil zurück", () => {
    expect(resolveDietaryVariantLabel("vegetarian", "lacto")).toBe("Nur Milch, kein Ei");
    expect(resolveDietaryVariantLabel("vegan", "lacto")).toBeNull();
    expect(resolveDietaryVariantLabel("vegetarian", null)).toBeNull();
  });
});

describe("Strengegrad", () => {
  it("ist nur außerhalb von Allesesser relevant", () => {
    expect(isStrictnessRelevant("omnivore")).toBe(false);
    expect(isStrictnessRelevant("vegetarian")).toBe(true);
  });

  it('schreibt bei Allesesser „Nicht relevant"', () => {
    expect(resolveDietaryStrictnessLabel("omnivore", "strict")).toBe(STRICTNESS_NOT_RELEVANT_LABEL);
  });

  it("liest jede Stufe über ihr Label wieder ein", () => {
    for (const option of DIETARY_STRICTNESS_OPTIONS) {
      expect(parseDietaryStrictnessFromLabel(option.label)).toBe(option.value);
    }
  });

  it('nutzt die Standardstufe, wenn nichts oder „Nicht relevant" gespeichert ist', () => {
    expect(parseDietaryStrictnessFromLabel(STRICTNESS_NOT_RELEVANT_LABEL)).toBe(DEFAULT_STRICTNESS);
    expect(parseDietaryStrictnessFromLabel("")).toBe(DEFAULT_STRICTNESS);
  });
});
