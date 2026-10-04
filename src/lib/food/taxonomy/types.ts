import type { FoodTaxonKind, FoodTaxonSource } from "@prisma/client";

/** Ein Knoten der Lebensmittel-Taxonomie – unabhängig von der Datenbank (für Import und Tests). */
export type TaxonRecord = {
  code: string;
  kind: FoodTaxonKind;
  source: FoodTaxonSource;
  nameDe: string | null;
  nameEn: string | null;
  synonymsDe: string[];
  synonymsEn: string[];
  parentCodes: string[];
  allergenCodes: string[];
  impliesCodes: string[];
  vegan: TriState | null;
  vegetarian: TriState | null;
  lmiv: boolean;
};

export type TriState = "yes" | "no" | "maybe";

export function toTriState(value: unknown): TriState | null {
  return value === "yes" || value === "no" || value === "maybe" ? value : null;
}
