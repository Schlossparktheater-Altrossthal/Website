import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { TaxonIndex } from "@/lib/food/taxonomy/taxon-index";
import type { TaxonRecord } from "@/lib/food/taxonomy/types";

const CACHE_TTL_MS = 10 * 60 * 1000;
const CHUNK_SIZE = 500;

let cached: { index: TaxonIndex; loadedAt: number } | null = null;

/** Taxonomie aus der DB, im Prozess zwischengespeichert (wenige Tausend Zeilen, selten geändert). */
export async function loadTaxonIndex(options: { fresh?: boolean } = {}): Promise<TaxonIndex> {
  if (!options.fresh && cached && Date.now() - cached.loadedAt < CACHE_TTL_MS) return cached.index;
  const [taxa, aliases] = await Promise.all([
    prisma.foodTaxon.findMany({
      select: {
        code: true,
        kind: true,
        nameDe: true,
        nameEn: true,
        synonymsDe: true,
        synonymsEn: true,
        parentCodes: true,
        allergenCodes: true,
        impliesCodes: true,
        vegan: true,
        vegetarian: true,
        lmiv: true,
      },
    }),
    prisma.foodTaxonAlias.findMany({ select: { text: true, taxonCode: true } }),
  ]);
  const index = new TaxonIndex(
    taxa.map((taxon) => ({
      ...taxon,
      vegan: triState(taxon.vegan),
      vegetarian: triState(taxon.vegetarian),
    })),
    aliases.map((alias) => [alias.text, alias.taxonCode]),
  );
  cached = { index, loadedAt: Date.now() };
  return index;
}

export function invalidateTaxonIndex(): void {
  cached = null;
}

function triState(value: string | null) {
  return value === "yes" || value === "no" || value === "maybe" ? value : null;
}

/**
 * Schreibt Taxon-Datensätze (Upsert). Codes, die es in der neuen Version nicht mehr gibt, bleiben
 * stehen – Personenangaben verweisen evtl. noch darauf.
 */
export async function saveTaxonRecords(
  records: TaxonRecord[],
  sourceVersion: string,
): Promise<number> {
  for (let start = 0; start < records.length; start += CHUNK_SIZE) {
    const chunk = records.slice(start, start + CHUNK_SIZE);
    await prisma.$transaction(
      chunk.map((record) => {
        const data: Prisma.FoodTaxonUncheckedCreateInput = { ...record, sourceVersion };
        return prisma.foodTaxon.upsert({
          where: { code: record.code },
          create: data,
          update: data,
        });
      }),
    );
  }
  invalidateTaxonIndex();
  return records.length;
}
