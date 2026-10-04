import type { FoodMatchStatus } from "@prisma/client";
import { z } from "zod";

import type { TaxonIndex } from "@/lib/food/taxonomy/taxon-index";

/**
 * Adapter Open Food Facts → Lebensmittel (Fertigprodukte per Barcode). Daten unter ODbL; sie
 * werden nur intern als Cache (FoodItem, Quelle OFF) gehalten und nicht mit eigenen Daten
 * vermischt veröffentlicht. API: https://openfoodfacts.github.io/openfoodfacts-server/api/
 */

export const OFF_ATTRIBUTION = "Daten von Open Food Facts (openfoodfacts.org), Lizenz ODbL";

const OFF_PRODUCT_URL = "https://world.openfoodfacts.org/api/v2/product";
const OFF_FIELDS = [
  "code",
  "product_name",
  "product_name_de",
  "brands",
  "allergens_tags",
  "traces_tags",
  "ingredients_tags",
  "labels_tags",
  "nutriments",
].join(",");

/** OFF verlangt einen sprechenden User-Agent mit Kontakt. */
const USER_AGENT =
  "SommertheaterAltrossthal-Mitgliederbereich/1.0 (+https://www.sommertheater-altrossthal.de)";

const offProductSchema = z.object({
  code: z.string(),
  product_name: z.string().optional().nullable(),
  product_name_de: z.string().optional().nullable(),
  brands: z.string().optional().nullable(),
  allergens_tags: z.array(z.string()).optional().default([]),
  traces_tags: z.array(z.string()).optional().default([]),
  ingredients_tags: z.array(z.string()).optional().default([]),
  labels_tags: z.array(z.string()).optional().default([]),
  nutriments: z.record(z.string(), z.unknown()).optional().default({}),
});

export type OffProduct = z.infer<typeof offProductSchema>;

const offResponseSchema = z.object({
  status: z.number(),
  product: offProductSchema.optional(),
});

/** OFF-Nährwertfeld (je 100 g) → BLS-Nährstoffcode, mit Umrechnung in die BLS-Einheit. */
const NUTRIENT_MAP: readonly { off: string; bls: string; factor?: number }[] = [
  { off: "energy-kj_100g", bls: "ENERCJ" },
  { off: "energy-kcal_100g", bls: "ENERCC" },
  { off: "proteins_100g", bls: "PROT625" },
  { off: "fat_100g", bls: "FAT" },
  { off: "saturated-fat_100g", bls: "FASAT" },
  { off: "carbohydrates_100g", bls: "CHO" },
  { off: "sugars_100g", bls: "SUGAR" },
  { off: "fiber_100g", bls: "FIBT" },
  { off: "salt_100g", bls: "NACL" },
  { off: "sodium_100g", bls: "NA", factor: 1000 }, // g → mg
  { off: "lactose_100g", bls: "LACS" },
  { off: "fructose_100g", bls: "FRUS" },
  { off: "glucose_100g", bls: "GLUS" },
  { off: "alcohol_100g", bls: "ALC", factor: 0.789 }, // % vol → g/100 g (Näherung)
];

const LABEL_TAXA: Readonly<Record<string, string>> = {
  "en:no-gluten": "x:label-gluten-free",
  "en:gluten-free": "x:label-gluten-free",
  "en:no-lactose": "x:label-lactose-free",
  "en:lactose-free": "x:label-lactose-free",
};

export type OffMapping = {
  barcode: string;
  nameDe: string;
  nameEn: string | null;
  nutrients: Record<string, number>;
  taxonCodes: string[];
  tracesCodes: string[];
  matchStatus: FoodMatchStatus;
};

export function mapOffProduct(product: OffProduct, index: TaxonIndex): OffMapping {
  const nutrients: Record<string, number> = {};
  for (const { off, bls, factor } of NUTRIENT_MAP) {
    const value = product.nutriments[off];
    if (typeof value === "number" && Number.isFinite(value)) {
      nutrients[bls] = Math.round(value * (factor ?? 1) * 1000) / 1000;
    }
  }

  const labels = product.labels_tags.flatMap((label) =>
    LABEL_TAXA[label] ? [LABEL_TAXA[label]] : [],
  );
  const known = (codes: string[]) => codes.filter((code) => index.has(code));
  const taxonCodes = [
    ...new Set([...known(product.ingredients_tags), ...known(product.allergens_tags), ...labels]),
  ].sort();
  const tracesCodes = [...new Set(known(product.traces_tags))].sort();

  let matchStatus: FoodMatchStatus = "UNCLEAR";
  if (product.ingredients_tags.length > 0) matchStatus = "MATCHED";
  else if (product.allergens_tags.length > 0) matchStatus = "PARTIAL";

  const name = product.product_name_de || product.product_name || product.code;
  const brand = product.brands?.split(",")[0]?.trim();
  return {
    barcode: product.code,
    nameDe: brand && !name.includes(brand) ? `${name} (${brand})` : name,
    nameEn: product.product_name || null,
    nutrients,
    taxonCodes,
    tracesCodes,
    matchStatus,
  };
}

/** Produkt per Barcode abrufen; `null`, wenn OFF es nicht kennt. */
export async function fetchOffProduct(barcode: string): Promise<OffProduct | null> {
  if (!/^\d{6,14}$/.test(barcode)) throw new Error("Ungültiger Barcode.");
  const response = await fetch(`${OFF_PRODUCT_URL}/${barcode}.json?fields=${OFF_FIELDS}`, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    signal: AbortSignal.timeout(10_000),
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Open Food Facts antwortet mit ${response.status}.`);
  const parsed = offResponseSchema.parse(await response.json());
  return parsed.status === 1 && parsed.product ? parsed.product : null;
}
