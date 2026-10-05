import type { FoodMatchStatus } from "@prisma/client";

import { checkFood, type ConflictVerdict, type FoodProfile } from "@/lib/food/conflicts";
import { INGREDIENT_UNITS, type IngredientUnit } from "@/lib/food/recipes/ingredient-line";
import type { TaxonIndex } from "@/lib/food/taxonomy/taxon-index";

/**
 * Auswertung eines Rezepts aus seinen Zutaten (docs/Plan/rezepte-plan.md): Allergene,
 * Ernährungsformen, Nährwerte je Portion. Nichts davon wird von Hand gepflegt.
 */

export type RecipeIngredientInput = {
  name: string;
  amount: number | null;
  unit: string | null;
  optional?: boolean;
  /** Taxa direkt an der Zeile (ohne Lebensmittel zugeordnet). */
  taxonCodes: string[];
  status: FoodMatchStatus;
  foodItem: {
    nutrients: unknown;
    taxonCodes: string[];
    tracesCodes: string[];
    matchStatus: FoodMatchStatus;
    pieceWeightG: number | null;
    densityGPerMl: number | null;
  } | null;
};

export type RecipeComputed = {
  version: 1;
  status: FoodMatchStatus;
  /** Taxa je Zutat – Eingabe für `checkFood` (components). */
  components: string[][];
  traces: string[];
  /** Enthaltene Allergene (Art ALLERGEN), LMIV zuerst. */
  allergens: string[];
  diets: Record<"vegan" | "vegetarian" | "pescetarian" | "halal" | "kosher", ConflictVerdict>;
  /** Nährwerte je Portion (BLS-Codes), nur aus Zutaten mit bekanntem Gewicht. */
  perServing: Record<string, number>;
  /** Anteil der Zutaten (nach Anzahl), deren Gewicht und Nährwerte bekannt sind (0…1). */
  nutritionCoverage: number;
  unclearIngredients: string[];
};

/** Nährstoffe, die je Portion ausgewiesen werden. */
export const SERVING_NUTRIENTS = [
  "ENERCC",
  "ENERCJ",
  "PROT625",
  "FAT",
  "FASAT",
  "CHO",
  "SUGAR",
  "FIBT",
  "NACL",
  "LACS",
  "FRUS",
  "ALC",
] as const;

/** Übliches Stückgewicht (g) je Taxon, wenn das Lebensmittel selbst keins kennt. */
const PIECE_WEIGHTS: Readonly<Record<string, number>> = {
  "en:eggs": 60,
  "en:egg": 60,
  "en:onion": 80,
  "en:garlic": 5,
  "en:tomato": 100,
  "en:potato": 100,
  "en:carrot": 80,
  "en:lemon": 100,
  "en:apple": 150,
  "en:banana": 120,
  "en:bell-pepper": 150,
  "en:zucchini": 250,
};

const STATUS_RANK: Record<FoodMatchStatus, number> = {
  MANUAL: 0,
  MATCHED: 0,
  PARTIAL: 1,
  UNCLEAR: 2,
};

export function nutrientsOf(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object") return {};
  const result: Record<string, number> = {};
  for (const [key, number] of Object.entries(value)) {
    if (typeof number === "number" && Number.isFinite(number)) result[key] = number;
  }
  return result;
}

/** Gewicht einer Zutat in Gramm, falls bestimmbar. */
export function ingredientGrams(
  ingredient: Pick<RecipeIngredientInput, "amount" | "unit" | "foodItem" | "taxonCodes">,
  codes: string[],
): number | null {
  if (ingredient.amount === null) return null;
  const unit = ingredient.unit as IngredientUnit | null;
  const definition = unit ? INGREDIENT_UNITS[unit] : undefined;
  if (definition && "grams" in definition) return ingredient.amount * definition.grams;
  if (definition && "millilitres" in definition) {
    return ingredient.amount * definition.millilitres * (ingredient.foodItem?.densityGPerMl ?? 1);
  }
  if (!unit || unit === "stueck" || unit === "zehe") {
    const piece =
      ingredient.foodItem?.pieceWeightG ??
      codes.map((code) => PIECE_WEIGHTS[code]).find((weight) => weight !== undefined);
    return piece ? ingredient.amount * piece : null;
  }
  return null;
}

export function computeRecipe(
  index: TaxonIndex,
  recipe: { servings: number; ingredients: RecipeIngredientInput[] },
): RecipeComputed {
  const components: string[][] = [];
  const traces = new Set<string>();
  const totals: Record<string, number> = {};
  const unclear: string[] = [];
  let worst: FoodMatchStatus = "MATCHED";
  let withNutrition = 0;

  for (const ingredient of recipe.ingredients) {
    const codes = [
      ...new Set([...(ingredient.foodItem?.taxonCodes ?? []), ...ingredient.taxonCodes]),
    ];
    components.push(codes);
    ingredient.foodItem?.tracesCodes.forEach((code) => traces.add(code));

    // Die Zuordnung der Zeile (Service) entscheidet über die Sicherheit der Inhaltsstoffe; der
    // Stand des Lebensmittels zählt nur, wenn die Zeile selbst nichts Sicheres weiß.
    const lineSure = ingredient.status === "MATCHED" || ingredient.status === "MANUAL";
    const status: FoodMatchStatus =
      lineSure || !ingredient.foodItem ? ingredient.status : ingredient.foodItem.matchStatus;
    const effective: FoodMatchStatus = codes.length === 0 ? "UNCLEAR" : status;
    if (STATUS_RANK[effective] > STATUS_RANK[worst]) worst = effective;
    if (effective === "UNCLEAR") unclear.push(ingredient.name);

    const grams = ingredientGrams(ingredient, codes);
    const nutrients = nutrientsOf(ingredient.foodItem?.nutrients);
    if (grams !== null && Object.keys(nutrients).length > 0) {
      withNutrition += 1;
      for (const code of SERVING_NUTRIENTS) {
        if (nutrients[code] !== undefined)
          totals[code] = (totals[code] ?? 0) + (nutrients[code] * grams) / 100;
      }
    }
  }

  const status: FoodMatchStatus =
    worst === "UNCLEAR" && unclear.length < recipe.ingredients.length ? "PARTIAL" : worst;
  const profile: FoodProfile = { codes: [], components, traces: [...traces], status };
  const contained = new Set(components.flatMap((codes) => [...index.closureOf(codes)]));
  const allergens = [...contained]
    .filter((code) => index.get(code)?.kind === "ALLERGEN")
    .sort((a, b) => Number(index.get(b)?.lmiv) - Number(index.get(a)?.lmiv) || a.localeCompare(b));

  const diet = (style: "vegan" | "vegetarian" | "pescetarian" | "halal" | "kosher") =>
    checkFood(index, { restrictions: [], style }, profile).verdict;

  const servings = Math.max(1, recipe.servings);
  const perServing: Record<string, number> = {};
  for (const [code, total] of Object.entries(totals)) {
    perServing[code] = Math.round((total / servings) * 10) / 10;
  }

  return {
    version: 1,
    status,
    components,
    traces: [...traces].sort(),
    allergens,
    diets: {
      vegan: diet("vegan"),
      vegetarian: diet("vegetarian"),
      pescetarian: diet("pescetarian"),
      halal: diet("halal"),
      kosher: diet("kosher"),
    },
    perServing,
    nutritionCoverage:
      recipe.ingredients.length === 0
        ? 0
        : Math.round((withNutrition / recipe.ingredients.length) * 100) / 100,
    unclearIngredients: unclear,
  };
}
