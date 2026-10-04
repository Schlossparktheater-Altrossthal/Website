import type { ConflictVerdict } from "@/lib/food/conflicts";
import { INGREDIENT_UNITS, type IngredientUnit } from "@/lib/food/recipes/ingredient-line";

/** Anzeige-Helfer für Rezepte (rein, auch im Client nutzbar). */

const NUMBER = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1 });

/** Menge × Faktor, sinnvoll gerundet („1,5 EL“, „250 g“). */
export function formatAmount(amount: number | null, unit: string | null, factor = 1): string {
  if (amount === null) return "";
  const value = amount * factor;
  const rounded = value >= 10 ? Math.round(value) : Math.round(value * 10) / 10;
  const label =
    unit && unit in INGREDIENT_UNITS ? INGREDIENT_UNITS[unit as IngredientUnit].label : "";
  return [NUMBER.format(rounded), label].filter(Boolean).join(" ");
}

export function formatMinutes(minutes: number | null): string | null {
  if (!minutes) return null;
  if (minutes < 60) return `${minutes} Min.`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} Std. ${rest} Min.` : `${hours} Std.`;
}

export function formatRating(average: number | null, count: number): string | null {
  return average === null ? null : `★ ${NUMBER.format(average)} (${count})`;
}

export const DIET_LABELS = {
  vegan: "vegan",
  vegetarian: "vegetarisch",
  pescetarian: "pescetarisch",
  halal: "halal",
  kosher: "koscher",
} as const;

export type DietKey = keyof typeof DIET_LABELS;

/** Badge-Ton für ein Prüfergebnis. */
export function verdictTone(verdict: ConflictVerdict): "success" | "warning" | "destructive" {
  return verdict === "ok" ? "success" : verdict === "check" ? "warning" : "destructive";
}

export const VERDICT_LABELS: Record<ConflictVerdict, string> = {
  ok: "passt",
  check: "prüfen",
  conflict: "nicht geeignet",
};

/** Nährwerte je Portion in der üblichen Reihenfolge der Nährwerttabelle. */
export const NUTRIENT_ROWS: readonly {
  code: string;
  label: string;
  unit: string;
  indent?: boolean;
}[] = [
  { code: "ENERCC", label: "Energie", unit: "kcal" },
  { code: "FAT", label: "Fett", unit: "g" },
  { code: "FASAT", label: "davon gesättigte Fettsäuren", unit: "g", indent: true },
  { code: "CHO", label: "Kohlenhydrate", unit: "g" },
  { code: "SUGAR", label: "davon Zucker", unit: "g", indent: true },
  { code: "FIBT", label: "Ballaststoffe", unit: "g" },
  { code: "PROT625", label: "Eiweiß", unit: "g" },
  { code: "NACL", label: "Salz", unit: "g" },
  { code: "LACS", label: "Laktose", unit: "g" },
  { code: "FRUS", label: "Fruktose", unit: "g" },
  { code: "ALC", label: "Alkohol", unit: "g" },
];

export function formatNutrient(value: number): string {
  return NUMBER.format(value);
}
