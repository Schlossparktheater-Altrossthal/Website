import type { FoodItem } from "@prisma/client";

import { nutrientsOf } from "@/lib/food/recipes/compute";
import { describeTaxon, suggestTaxa, type TaxonSuggestion } from "@/lib/food/taxon-suggestions";
import { loadTaxonIndex } from "@/lib/food/taxonomy/store";
import type { TaxonIndex } from "@/lib/food/taxonomy/taxon-index";
import { prisma } from "@/lib/prisma";

/**
 * Auswahl für die Zuordnung einer Rezeptzutat: passende Lebensmittel (mit Nährwerten) und
 * Taxa (nur Inhaltsstoffe). Jede Option zeigt, welche Allergene sie mitbringt – so sieht man
 * vor dem Klick, was die Wahl für die Auswertung bedeutet.
 */

export type FoodOption = {
  id: string;
  name: string;
  /** Kennzeichnungspflichtige Allergene (LMIV), die das Lebensmittel mitbringt. */
  allergens: string[];
  kcal: number | null;
};

export type TaxonOption = TaxonSuggestion & { allergens: string[] };

export type IngredientOptions = {
  current: {
    foodName: string | null;
    taxa: string[];
    allergens: string[];
    status: "MATCHED" | "PARTIAL" | "UNCLEAR" | "MANUAL";
  };
  foods: FoodOption[];
  taxa: TaxonOption[];
};

export function lmivAllergens(index: TaxonIndex, codes: string[]): string[] {
  return [...index.closureOf(codes)]
    .map((code) => index.get(code))
    .filter((entry) => entry?.kind === "ALLERGEN" && entry.lmiv)
    .map((entry) => entry?.nameDe ?? entry?.code ?? "")
    .sort((a, b) => a.localeCompare(b, "de"));
}

function toFoodOption(index: TaxonIndex, item: FoodItem): FoodOption {
  const kcal = nutrientsOf(item.nutrients).ENERCC;
  return {
    id: item.id,
    name: item.nameDe,
    allergens: lmivAllergens(index, item.taxonCodes),
    kcal: kcal === undefined ? null : Math.round(kcal),
  };
}

/** Wortteile eines Namens für die Suche: ganze Wörter und das Grundwort („Kürbispüree“ → Püree). */
/** Alltagsnamen, die der BLS anders führt. */
const SEARCH_SYNONYMS: Readonly<Record<string, readonly string[]>> = {
  "pflanzliche milch": ["Haferdrink", "Sojadrink", "Mandeldrink", "Reisdrink"],
  pflanzenmilch: ["Haferdrink", "Sojadrink", "Mandeldrink", "Reisdrink"],
  "vegane milch": ["Haferdrink", "Sojadrink", "Mandeldrink"],
  hafermilch: ["Haferdrink"],
  sojamilch: ["Sojadrink"],
  mandelmilch: ["Mandeldrink"],
};

function searchTerms(index: TaxonIndex, name: string): string[] {
  const synonyms = SEARCH_SYNONYMS[name.trim().toLocaleLowerCase("de-DE")];
  if (synonyms) return [...synonyms];
  const words = name.split(/[\s,/-]+/).filter((word) => word.length >= 3);
  const fromTaxa = index.matchText(name).flatMap((match) => {
    const entry = index.get(match.code);
    return entry?.nameDe ? [entry.nameDe] : [];
  });
  return [...new Set([name, ...words, ...fromTaxa])];
}

function rank(name: string, terms: string[]): number {
  const lower = name.toLocaleLowerCase("de-DE");
  const first = lower.split(/[\s,]+/)[0] ?? "";
  let best = 9;
  terms.forEach((term, position) => {
    const t = term.toLocaleLowerCase("de-DE");
    // Grundwort am Ende („Schlagsahne“ ist Sahne) vor Bestimmungswort („Sahnelikör“ nicht).
    const score =
      lower === t
        ? 0
        : first === t
          ? 1
          : first.endsWith(t)
            ? 2
            : first.startsWith(t)
              ? 3.5
              : lower.includes(t)
                ? 4
                : 9;
    best = Math.min(best, score + (position === 0 ? 0 : 1));
  });
  return best + (/\broh\b/.test(lower) ? 0 : 0.5) + lower.length / 200;
}

function descendants(index: TaxonIndex, codes: string[]): string[] {
  return codes.flatMap((code) => index.descendants(code, 40));
}

/** Lebensmittel zu einem Suchtext; findet auch zusammengesetzte Wörter über ihre Teile. */
export async function searchFoodOptions(query: string, limit = 12): Promise<FoodOption[]> {
  const term = query.trim();
  if (term.length < 2) return [];
  const index = await loadTaxonIndex();
  const terms = searchTerms(index, term);
  const codes = index.matchText(term).map((match) => match.code);
  const items = await prisma.foodItem.findMany({
    where: {
      OR: [
        ...terms.map((text) => ({ nameDe: { contains: text, mode: "insensitive" as const } })),
        ...(codes.length > 0
          ? [{ taxonCodes: { hasSome: [...codes, ...descendants(index, codes)] } }]
          : []),
      ],
    },
    take: 200,
  });
  // Lebensmittel der erkannten Kategorie zählen wie ein guter Namenstreffer („pflanzliche
  // Milch“ → Haferdrink statt Kuhmilch).
  const exact = index.matchExact(term)?.code;
  const score = (item: FoodItem) => {
    const base = rank(item.nameDe, terms);
    if (!exact) return base;
    const related = item.taxonCodes.some(
      (code) => code === exact || index.closure(code).has(exact),
    );
    return related ? base - 0.5 : base + 1;
  };
  return items
    .sort((a, b) => score(a) - score(b))
    .slice(0, limit)
    .map((item) => toFoodOption(index, item));
}

export async function getIngredientOptions(ingredientId: string): Promise<IngredientOptions> {
  const index = await loadTaxonIndex();
  const line = await prisma.recipeIngredient.findUniqueOrThrow({
    where: { id: ingredientId },
    include: { foodItem: true },
  });
  const codes = [...new Set([...(line.foodItem?.taxonCodes ?? []), ...line.taxonCodes])];
  const taxonCodes =
    line.taxonCodes.length > 0
      ? line.taxonCodes
      : index.matchText(line.name).map((match) => match.code);
  const taxa = [
    ...new Map(
      [
        ...taxonCodes.flatMap((code) => describeTaxon(index, code) ?? []),
        ...suggestTaxa(index, line.name, 4),
      ].map((taxon) => [taxon.code, taxon]),
    ).values(),
  ]
    .slice(0, 5)
    .map((taxon) => ({ ...taxon, allergens: lmivAllergens(index, [taxon.code]) }));
  const foods = (await searchFoodOptions(line.name, 8)).filter(
    (food) => food.id !== line.foodItemId,
  );
  return {
    current: {
      foodName: line.foodItem?.nameDe ?? null,
      taxa: line.taxonCodes.map((code) => index.get(code)?.nameDe ?? code),
      allergens: lmivAllergens(index, codes),
      status: line.status,
    },
    foods: foods.slice(0, 6),
    taxa,
  };
}
