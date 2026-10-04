import type { FoodItem, Prisma } from "@prisma/client";

import { mapBlsFood } from "@/lib/food/bls/map";
import { BLS_VERSION, type BlsComponent, type BlsFood } from "@/lib/food/bls/parse";
import { fetchOffProduct, mapOffProduct } from "@/lib/food/off/product";
import { loadTaxonIndex } from "@/lib/food/taxonomy/store";
import { prisma } from "@/lib/prisma";

const CHUNK_SIZE = 250;
/** Nach dieser Zeit wird ein OFF-Produkt beim nächsten Abruf aktualisiert. */
const OFF_REFRESH_MS = 30 * 24 * 60 * 60 * 1000;

export async function saveBlsComponents(components: BlsComponent[]): Promise<void> {
  await prisma.$transaction(
    components.map((component) =>
      prisma.foodNutrient.upsert({
        where: { code: component.code },
        create: component,
        update: component,
      }),
    ),
  );
}

/**
 * Schreibt BLS-Lebensmittel samt Zuordnung (Upsert über Quelle + BLS-Code). Von Hand gesetzte
 * Zuordnungen (`MANUAL`) bleiben erhalten, nur die Nährwerte werden aktualisiert.
 */
export async function saveBlsFoods(
  foods: BlsFood[],
): Promise<Record<"MATCHED" | "PARTIAL" | "UNCLEAR", number>> {
  const index = await loadTaxonIndex({ fresh: true });
  const manual = new Set(
    (
      await prisma.foodItem.findMany({
        where: { source: "BLS", matchStatus: "MANUAL" },
        select: { sourceId: true },
      })
    ).map((item) => item.sourceId),
  );
  const stats = { MATCHED: 0, PARTIAL: 0, UNCLEAR: 0 };

  for (let start = 0; start < foods.length; start += CHUNK_SIZE) {
    const chunk = foods.slice(start, start + CHUNK_SIZE);
    await prisma.$transaction(
      chunk.map((food) => {
        const mapping = mapBlsFood(food, index);
        if (mapping.matchStatus !== "MANUAL") stats[mapping.matchStatus] += 1;
        const base = {
          nameDe: food.nameDe,
          nameEn: food.nameEn,
          groupCode: mapping.groupCode,
          nutrients: food.nutrients as Prisma.InputJsonObject,
          sourceVersion: BLS_VERSION,
        };
        const mapped = { taxonCodes: mapping.taxonCodes, matchStatus: mapping.matchStatus };
        return prisma.foodItem.upsert({
          where: { source_sourceId: { source: "BLS", sourceId: food.code } },
          create: { source: "BLS", sourceId: food.code, ...base, ...mapped },
          update: manual.has(food.code) ? base : { ...base, ...mapped },
        });
      }),
    );
  }
  return stats;
}

/**
 * Fertigprodukt per Barcode: aus dem Cache, sonst (oder wenn veraltet) von Open Food Facts.
 * `null`, wenn das Produkt unbekannt ist.
 */
export async function findOrFetchOffItem(barcode: string): Promise<FoodItem | null> {
  const cached = await prisma.foodItem.findUnique({
    where: { source_sourceId: { source: "OFF", sourceId: barcode } },
  });
  if (cached && Date.now() - cached.updatedAt.getTime() < OFF_REFRESH_MS) return cached;

  const product = await fetchOffProduct(barcode);
  if (!product) return cached;
  const index = await loadTaxonIndex();
  const mapping = mapOffProduct(product, index);
  const data = {
    nameDe: mapping.nameDe,
    nameEn: mapping.nameEn,
    nutrients: mapping.nutrients as Prisma.InputJsonObject,
    taxonCodes: mapping.taxonCodes,
    tracesCodes: mapping.tracesCodes,
    matchStatus: mapping.matchStatus,
    sourceVersion: new Date().toISOString().slice(0, 10),
  };
  return prisma.foodItem.upsert({
    where: { source_sourceId: { source: "OFF", sourceId: barcode } },
    create: { source: "OFF", sourceId: barcode, ...data },
    update: cached?.matchStatus === "MANUAL" ? { nutrients: data.nutrients } : data,
  });
}

/** Suche in den Lebensmitteln (Name, Präfix vor Teilwort). */
export async function searchFoodItems(query: string, limit = 20): Promise<FoodItem[]> {
  const term = query.trim();
  if (term.length < 2) return [];
  const items = await prisma.foodItem.findMany({
    where: { nameDe: { contains: term, mode: "insensitive" } },
    take: limit * 3,
  });
  const lower = term.toLocaleLowerCase("de-DE");
  return items
    .sort(
      (a, b) => rank(a.nameDe, lower) - rank(b.nameDe, lower) || a.nameDe.length - b.nameDe.length,
    )
    .slice(0, limit);
}

function rank(name: string, term: string): number {
  const lower = name.toLocaleLowerCase("de-DE");
  if (lower === term) return 0;
  if (lower.startsWith(term)) return 1;
  return 2;
}
