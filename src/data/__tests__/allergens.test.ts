import { describe, expect, it } from "vitest";

import {
  ALLERGEN_CATALOG,
  ALLERGEN_KIND_LABELS,
  ALLERGEN_KIND_OPTIONS,
  findAllergenEntry,
  normalizeDietaryLabel,
  resolveAllergenKind,
  suggestAllergens,
} from "../allergens";

/** Die vierzehn kennzeichnungspflichtigen Allergene (LMIV Anhang II, in der Schweiz LGV). */
const KENNZEICHNUNGSPFLICHTIG = [
  "Gluten",
  "Krebstiere",
  "Eier",
  "Fisch",
  "Erdnüsse",
  "Soja",
  "Milcheiweiß",
  "Schalenfrüchte",
  "Sellerie",
  "Senf",
  "Sesam",
  "Sulfite",
  "Lupinen",
  "Weichtiere",
];

describe("ALLERGEN_CATALOG", () => {
  it("enthält die kennzeichnungspflichtigen Allergene", () => {
    for (const label of KENNZEICHNUNGSPFLICHTIG) {
      expect(ALLERGEN_CATALOG.some((entry) => entry.label === label)).toBe(true);
    }
  });

  it("hat für Labels und Aliase je einen eindeutigen Suchschlüssel", () => {
    const keys = ALLERGEN_CATALOG.flatMap((entry) =>
      [entry.label, ...entry.aliases].map(normalizeDietaryLabel),
    );
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("gibt jedem Eintrag eine der drei Arten", () => {
    for (const entry of ALLERGEN_CATALOG) {
      expect(Object.keys(ALLERGEN_KIND_LABELS)).toContain(entry.kind);
    }
  });
});

describe("ALLERGEN_KIND_OPTIONS", () => {
  it("bietet alle Arten mit Anzeigetext an", () => {
    expect(ALLERGEN_KIND_OPTIONS.map((option) => option.value)).toEqual([
      "ALLERGY",
      "INTOLERANCE",
      "OTHER",
    ]);
    for (const option of ALLERGEN_KIND_OPTIONS) {
      expect(option.label.length).toBeGreaterThan(0);
    }
  });
});

describe("normalizeDietaryLabel", () => {
  it("vereinheitlicht Schreibweise, Leerzeichen und Umlaute", () => {
    expect(normalizeDietaryLabel("  Erdnüsse  ")).toBe("erdnusse");
    expect(normalizeDietaryLabel("Milch   Eiweiß")).toBe("milch eiweiss");
  });
});

describe("findAllergenEntry", () => {
  it("findet Einträge über Label und Alias", () => {
    expect(findAllergenEntry("Milcheiweiß")?.value).toBe("milk-protein");
    expect(findAllergenEntry("  milchzucker ")?.value).toBe("lactose");
  });

  it("liefert für unbekannte Texte nichts", () => {
    expect(findAllergenEntry("Pilze")).toBeNull();
    expect(findAllergenEntry("   ")).toBeNull();
  });
});

describe("resolveAllergenKind", () => {
  it("erkennt Allergien", () => {
    expect(resolveAllergenKind("Erdnüsse")).toBe("ALLERGY");
    expect(resolveAllergenKind("Zöliakie")).toBe("ALLERGY");
  });

  it("erkennt Intoleranzen", () => {
    expect(resolveAllergenKind("Laktoseintoleranz")).toBe("INTOLERANCE");
    expect(resolveAllergenKind("Fruchtzucker")).toBe("INTOLERANCE");
  });

  it("liefert für Freitext nichts", () => {
    expect(resolveAllergenKind("Nüsse und Pilze")).toBeNull();
  });
});

describe("suggestAllergens", () => {
  it("schlägt bei einer bekannten Schreibweise den Katalogeintrag vor", () => {
    expect(suggestAllergens("erdnuss")[0]?.label).toBe("Erdnüsse");
  });

  it("findet auch über Aliase", () => {
    const labels = suggestAllergens("pollen").map((entry) => entry.label);
    expect(labels).toContain("Kreuzallergie");
  });

  it("liefert bei leerer Eingabe keine Vorschläge", () => {
    expect(suggestAllergens("   ")).toEqual([]);
  });

  it("begrenzt die Trefferzahl", () => {
    expect(suggestAllergens("e", 3)).toHaveLength(3);
  });

  it("stellt den eigenen Text nicht über exakte Treffer", () => {
    expect(suggestAllergens("Laktose")[0]?.label).toBe("Laktose");
  });
});
