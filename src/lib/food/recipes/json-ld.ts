import { z } from "zod";

import { safeFetchText } from "@/lib/food/recipes/safe-fetch";

/**
 * Liest ein Rezept aus schema.org/Recipe (JSON-LD), wie es fast alle Rezeptseiten einbetten
 * (docs/Plan/rezepte-plan.md). Übernommen wird nur die Struktur; Bilder werden nicht kopiert,
 * die Quelle bleibt verlinkt.
 */

export type ImportedRecipe = {
  title: string;
  description: string | null;
  servings: number | null;
  ingredientLines: string[];
  steps: string[];
  prepMinutes: number | null;
  cookMinutes: number | null;
  tags: string[];
  sourceUrl: string;
  sourceName: string | null;
};

const textish = z.union([z.string(), z.number()]).transform(String);

function asArray<T>(value: T | T[] | undefined | null): T[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

/** ISO-8601-Dauer („PT1H30M“) in Minuten. */
export function isoDurationMinutes(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const match = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/i.exec(value.trim());
  if (!match) return null;
  const [, days, hours, minutes] = match;
  const total = Number(days ?? 0) * 1440 + Number(hours ?? 0) * 60 + Number(minutes ?? 0);
  return total > 0 ? total : null;
}

function decodeEntities(value: string): string {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function isRecipeType(value: unknown): boolean {
  return asArray(value as string | string[]).some((type) => type === "Recipe");
}

/** Sucht alle Recipe-Objekte, auch in `@graph` und Listen. */
function findRecipes(
  node: unknown,
  found: Record<string, unknown>[] = [],
): Record<string, unknown>[] {
  if (Array.isArray(node)) node.forEach((item) => findRecipes(item, found));
  else if (node && typeof node === "object") {
    const record = node as Record<string, unknown>;
    if (isRecipeType(record["@type"])) found.push(record);
    if (record["@graph"]) findRecipes(record["@graph"], found);
  }
  return found;
}

function instructionTexts(value: unknown): string[] {
  const result: string[] = [];
  for (const item of asArray(value as unknown[])) {
    if (typeof item === "string") {
      result.push(...item.split(/\n+/).map(decodeEntities).filter(Boolean));
    } else if (item && typeof item === "object") {
      const record = item as Record<string, unknown>;
      if (record.itemListElement) result.push(...instructionTexts(record.itemListElement));
      else if (typeof record.text === "string") result.push(decodeEntities(record.text));
      else if (typeof record.name === "string") result.push(decodeEntities(record.name));
    }
  }
  return result;
}

function servingsOf(value: unknown): number | null {
  for (const item of asArray(value as unknown[])) {
    const parsed = textish.safeParse(item);
    const number = parsed.success ? /\d+/.exec(parsed.data)?.[0] : undefined;
    if (number) return Number(number);
  }
  return null;
}

/** Extrahiert JSON-LD-Blöcke aus HTML. */
export function extractJsonLd(html: string): unknown[] {
  const blocks: unknown[] = [];
  const pattern = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  for (const match of html.matchAll(pattern)) {
    try {
      blocks.push(JSON.parse(match[1].trim()));
    } catch {
      // Defektes JSON-LD einzelner Blöcke ist auf Rezeptseiten häufig – übrige Blöcke zählen.
      continue;
    }
  }
  return blocks;
}

export function parseRecipeJsonLd(blocks: unknown[], sourceUrl: string): ImportedRecipe | null {
  const recipe = findRecipes(blocks)[0];
  if (!recipe) return null;
  const title = typeof recipe.name === "string" ? decodeEntities(recipe.name) : "";
  if (!title) return null;

  const keywords =
    typeof recipe.keywords === "string"
      ? recipe.keywords.split(",")
      : asArray(recipe.keywords as string[]);
  const tags = [
    ...keywords,
    ...asArray(recipe.recipeCategory as string[]),
    ...asArray(recipe.recipeCuisine as string[]),
  ]
    .filter((tag): tag is string => typeof tag === "string")
    .map((tag) => decodeEntities(tag))
    .filter((tag) => tag.length > 0 && tag.length <= 40);

  const author =
    asArray(recipe.publisher as unknown[])[0] ?? asArray(recipe.author as unknown[])[0];
  const sourceName =
    author &&
    typeof author === "object" &&
    typeof (author as Record<string, unknown>).name === "string"
      ? String((author as Record<string, unknown>).name)
      : null;

  return {
    title,
    description:
      typeof recipe.description === "string" ? decodeEntities(recipe.description) || null : null,
    servings: servingsOf(recipe.recipeYield),
    ingredientLines: asArray((recipe.recipeIngredient ?? recipe.ingredients) as unknown[])
      .filter((line): line is string => typeof line === "string")
      .map(decodeEntities)
      .filter(Boolean),
    steps: instructionTexts(recipe.recipeInstructions),
    prepMinutes: isoDurationMinutes(recipe.prepTime),
    cookMinutes: isoDurationMinutes(recipe.cookTime),
    tags: [...new Set(tags)].slice(0, 15),
    sourceUrl,
    sourceName,
  };
}

/** Lädt eine Rezeptseite (nur öffentliche Adressen) und liest das Rezept. */
export async function fetchRecipeFromUrl(url: string): Promise<ImportedRecipe | null> {
  const page = await safeFetchText(url, {
    accept: "text/html",
    maxBytes: 3_000_000,
    timeoutMs: 15_000,
  });
  return parseRecipeJsonLd(extractJsonLd(page.text), page.url);
}
