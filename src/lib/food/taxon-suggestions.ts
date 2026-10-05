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
  /** Oberbegriffe von oben nach unten („Schalenfrüchte › Baumnüsse“), höchstens drei. */
  path: string[];
};

/** Oberbegriffe mit deutschem Namen, jeweils über den ersten Elternteil. */
function pathOf(index: TaxonIndex, code: string): string[] {
  const path: string[] = [];
  const seen = new Set([code]);
  let current = index.get(code);
  while (current && path.length < 3) {
    const parent = current.parentCodes
      .map((parentCode) => index.get(parentCode))
      .find((candidate) => candidate && !seen.has(candidate.code));
    if (!parent) break;
    seen.add(parent.code);
    if (parent.nameDe) path.unshift(parent.nameDe);
    current = parent;
  }
  return path;
}

/** Ein Taxon als Vorschlag beschreiben. */
export function describeTaxon(index: TaxonIndex, code: string): TaxonSuggestion | null {
  const entry = index.get(code);
  if (!entry) return null;
  const parent = entry.parentCodes
    .map((parentCode) => index.get(parentCode))
    .find((candidate) => candidate?.nameDe);
  return {
    code: entry.code,
    name: entry.nameDe ?? entry.nameEn ?? entry.code,
    parentName: parent?.nameDe ?? null,
    kind: entry.kind,
    lmiv: entry.lmiv,
    isGroup: entry.kind === "ALLERGEN" || index.descendants(entry.code, 1).length > 0,
    path: pathOf(index, entry.code),
  };
}

/** Vorschläge für das Allergie-Feld: nur Einträge mit deutschem Namen. */
export function suggestTaxa(index: TaxonIndex, query: string, limit = 8): TaxonSuggestion[] {
  return index
    .search(query, limit * 3)
    .filter((entry) => entry.nameDe)
    .slice(0, limit)
    .flatMap((entry) => {
      const described = describeTaxon(index, entry.code);
      return described ? [described] : [];
    });
}
