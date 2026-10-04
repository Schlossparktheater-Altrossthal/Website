import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { applyCustomOverrides, CUSTOM_ALIASES } from "@/lib/food/taxonomy/custom";
import {
  buildOffTaxonRecords,
  parseOffSynonyms,
  type OffJsonTaxonomy,
} from "@/lib/food/taxonomy/off-parse";
import { invalidateTaxonIndex, saveTaxonRecords } from "@/lib/food/taxonomy/store";
import { normalizeFoodText } from "@/lib/food/normalize";
import { prisma } from "@/lib/prisma";

/** Veröffentlichte OFF-Taxonomien (JSON) und Quelltexte mit Synonymen. */
export const OFF_TAXONOMY_SOURCES = {
  "ingredients.json": "https://static.openfoodfacts.org/data/taxonomies/ingredients.json",
  "allergens.json": "https://static.openfoodfacts.org/data/taxonomies/allergens.json",
  "ingredients.txt":
    "https://raw.githubusercontent.com/openfoodfacts/openfoodfacts-server/main/taxonomies/food/ingredients.txt",
  "allergens.txt":
    "https://raw.githubusercontent.com/openfoodfacts/openfoodfacts-server/main/taxonomies/allergens.txt",
} as const;

type SourceName = keyof typeof OFF_TAXONOMY_SOURCES;

async function loadSource(name: SourceName, directory?: string): Promise<string> {
  if (directory) return readFile(join(directory, name), "utf8");
  const response = await fetch(OFF_TAXONOMY_SOURCES[name], { signal: AbortSignal.timeout(60_000) });
  if (!response.ok) throw new Error(`${name}: HTTP ${response.status}`);
  return response.text();
}

/**
 * Importiert die OFF-Taxonomie samt eigener Ergänzungen und legt die festen Aliase an.
 * `directory`: lokal abgelegte Dateien statt Download (gleiche Dateinamen).
 */
export async function importOffTaxonomy(options: { directory?: string } = {}): Promise<{
  taxa: number;
  aliases: number;
  version: string;
}> {
  const [ingredients, allergens, ingredientsTxt, allergensTxt] = await Promise.all([
    loadSource("ingredients.json", options.directory),
    loadSource("allergens.json", options.directory),
    loadSource("ingredients.txt", options.directory),
    loadSource("allergens.txt", options.directory).catch(() => ""),
  ]);
  const synonyms = parseOffSynonyms(ingredientsTxt);
  for (const [code, value] of parseOffSynonyms(allergensTxt)) synonyms.set(code, value);

  const records = applyCustomOverrides(
    buildOffTaxonRecords({
      ingredients: JSON.parse(ingredients) as OffJsonTaxonomy,
      allergens: JSON.parse(allergens) as OffJsonTaxonomy,
      synonyms,
    }),
  );
  const version = new Date().toISOString().slice(0, 10);
  const taxa = await saveTaxonRecords(records, version);

  let aliases = 0;
  for (const [text, taxonCode] of Object.entries(CUSTOM_ALIASES)) {
    const key = normalizeFoodText(text);
    const existing = await prisma.foodTaxonAlias.findUnique({ where: { text: key } });
    if (existing && existing.source !== "AUTO") continue; // von Menschen bestätigt → bleibt
    await prisma.foodTaxonAlias.upsert({
      where: { text: key },
      create: { text: key, taxonCode, source: "AUTO" },
      update: { taxonCode },
    });
    aliases += 1;
  }
  invalidateTaxonIndex();

  await prisma.foodDataImport.create({
    data: { source: "off-taxonomy", version, itemCount: taxa, note: `${aliases} Aliase` },
  });
  return { taxa, aliases, version };
}
