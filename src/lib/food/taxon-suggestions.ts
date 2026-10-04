import type { TaxonIndex } from "@/lib/food/taxonomy/taxon-index";

export type TaxonSuggestion = {
  code: string;
  name: string;
  /** Nächster Oberbegriff mit deutschem Namen („Haselnuss“ → „Baumnüsse“). */
  parentName: string | null;
  kind: "ALLERGEN" | "INGREDIENT" | "SENSITIVITY";
  /** Eines der 14 kennzeichnungspflichtigen Allergene. */
  lmiv: boolean;
  /** Oberbegriff mit Unterbegriffen – gilt für alle darunter. */
  isGroup: boolean;
};

/** Vorschläge für das Allergie-Feld: nur Einträge mit deutschem Namen. */
export function suggestTaxa(index: TaxonIndex, query: string, limit = 8): TaxonSuggestion[] {
  return index
    .search(query, limit * 3)
    .filter((entry) => entry.nameDe)
    .slice(0, limit)
    .map((entry) => {
      const parent = entry.parentCodes
        .map((code) => index.get(code))
        .find((candidate) => candidate?.nameDe);
      return {
        code: entry.code,
        name: entry.nameDe ?? entry.code,
        parentName: parent?.nameDe ?? null,
        kind: entry.kind,
        lmiv: entry.lmiv,
        isGroup: entry.kind === "ALLERGEN" || index.descendants(entry.code, 1).length > 0,
      };
    });
}
