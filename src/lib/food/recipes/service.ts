import type { FoodItem, FoodMatchStatus, Prisma } from "@prisma/client";
import { z } from "zod";

import { cleanBlsName } from "@/lib/food/bls/map";
import { foodTextVariants } from "@/lib/food/normalize";
import { computeRecipe, type RecipeComputed } from "@/lib/food/recipes/compute";
import { parseIngredientLine } from "@/lib/food/recipes/ingredient-line";
import { loadTaxonIndex } from "@/lib/food/taxonomy/store";
import type { TaxonIndex } from "@/lib/food/taxonomy/taxon-index";
import { prisma } from "@/lib/prisma";

/**
 * Rezepte anlegen/ändern mit automatischer Zutatenzuordnung und Auswertung
 * (docs/Plan/rezepte-plan.md). Oberflächen und Server Actions rufen nur diese Funktionen.
 */

export const recipeIngredientInputSchema = z.object({
  rawText: z.string().trim().min(1).max(300),
  /** Von Hand gewähltes Lebensmittel – überschreibt die automatische Zuordnung. */
  foodItemId: z.string().min(1).nullish(),
});

export const recipeInputSchema = z.object({
  title: z.string().trim().min(2).max(160),
  description: z.string().trim().max(4000).nullish(),
  servings: z.number().int().min(1).max(500),
  steps: z.array(z.string().trim().min(1).max(4000)).max(100),
  tags: z.array(z.string().trim().min(1).max(40)).max(20),
  sourceUrl: z.string().url().max(1000).nullish(),
  sourceName: z.string().trim().max(200).nullish(),
  prepMinutes: z.number().int().min(0).max(10_000).nullish(),
  cookMinutes: z.number().int().min(0).max(10_000).nullish(),
  ingredients: z.array(recipeIngredientInputSchema).min(1).max(100),
});

export type RecipeInput = z.infer<typeof recipeInputSchema>;

type IngredientMatch = {
  foodItem: FoodItem | null;
  taxonCodes: string[];
  status: FoodMatchStatus;
};

/**
 * Wählt das passende Lebensmittel zu einer erkannten Zutat. Ein Kandidat kommt nur in Frage,
 * wenn jedes seiner Taxa mit der Zutat verwandt ist (Ober- oder Unterbegriff) – sonst brächte er
 * fremde Inhaltsstoffe mit („Eier“ → Eier-Teigwaren mit Gluten) oder höbe welche auf
 * („Joghurt“ → laktosefreier Joghurt). Unter den passenden gewinnen gleichnamige, rohe, kurze.
 */
/** BLS-Gruppen mit Gerichten und Backwaren – als Grundzutat nur nachrangig. */
const DISH_GROUPS = new Set(["X", "Y", "D", "S"]);

export function pickFoodItem<
  T extends Pick<FoodItem, "nameDe" | "taxonCodes" | "matchStatus" | "groupCode"> & {
    stagePenalty?: number;
  },
>(index: TaxonIndex, ingredientName: string, taxonCode: string, candidates: T[]): T | null {
  const related = (code: string) =>
    code === taxonCode || index.closure(taxonCode).has(code) || index.closure(code).has(taxonCode);
  const variants = foodTextVariants(ingredientName);
  /**
   * Namensnähe nach deutscher Wortbildung – das Grundwort steht am Ende: „Schlagsahne“ ist Sahne,
   * „Sahnestandmittel“ nicht. 0 = gleich, 10 = Grundwort, 25 = anderes Wort, 35 = Bestimmungswort.
   */
  const nameDistance = (name: string) => {
    const words = cleanBlsName(name).split(" ").filter(Boolean);
    const first = words[0] ?? "";
    const matches = (word: string) =>
      foodTextVariants(word).some((variant) => variants.includes(variant));
    if (matches(first) || matches(words.slice(0, 2).join(""))) return 0;
    if (variants.some((variant) => first.endsWith(variant))) return 10;
    if (words.slice(1).some(matches)) return 25;
    if (variants.some((variant) => first.startsWith(variant))) return 35;
    return 50;
  };
  const named = (name: string) => nameDistance(name) < 50;
  const score = (item: T) =>
    nameDistance(item.nameDe) +
    (/\broh\b/i.test(item.nameDe) ? 0 : 5) +
    (/\bmit\b/i.test(item.nameDe) ? 10 : 0) +
    (item.groupCode && DISH_GROUPS.has(item.groupCode) ? 15 : 0) +
    (item.stagePenalty ?? 0) +
    item.nameDe.length / 100;
  // Grundzutat: sicher zugeordnetes Lebensmittel; Gerichte („Crème brûlée“ für „Sahne“) nur,
  // wenn der Name passt.
  const suitable = candidates.filter(
    (item) =>
      item.taxonCodes.length > 0 &&
      item.taxonCodes.every(related) &&
      (item.matchStatus === "MATCHED" || item.matchStatus === "MANUAL" || named(item.nameDe)),
  );
  return [...suitable].sort((a, b) => score(a) - score(b))[0] ?? null;
}

/**
 * Ordnet eine Zutat zu: frühere manuelle Zuordnung desselben Namens → Taxon (Name, Synonym,
 * Alias) → passendes BLS-Lebensmittel. Ohne Lebensmittel bleiben die Taxa an der Zeile.
 */
export async function matchIngredient(
  index: TaxonIndex,
  name: string,
  rawText = name,
): Promise<IngredientMatch> {
  const match = await matchIngredientByName(index, name);
  return match.status === "MANUAL" ? match : veganAware(index, rawText, match);
}

const VEGAN_HINT = /\b(vegan\w*|pflanzlich\w*)\b/i;

/**
 * „veganer Parmesan“, „Joghurt (vegan)“: Der Name trifft das tierische Original. Tierische
 * Inhaltsstoffe und ein tierisches Lebensmittel werden verworfen, die Zeile bleibt zur Prüfung
 * offen (PARTIAL) – woraus das Ersatzprodukt besteht, hängt von der Marke ab.
 */
export function veganAware(
  index: TaxonIndex,
  rawText: string,
  match: IngredientMatch,
): IngredientMatch {
  if (!VEGAN_HINT.test(rawText)) return match;
  const isVegan = (code: string) => index.dietProperty(code, "vegan") !== "no";
  const taxonCodes = match.taxonCodes.filter(isVegan);
  const foodItem = match.foodItem?.taxonCodes.every(isVegan) ? match.foodItem : null;
  if (taxonCodes.length === match.taxonCodes.length && foodItem === match.foodItem) return match;
  return {
    foodItem,
    taxonCodes,
    status: taxonCodes.length > 0 || foodItem ? "PARTIAL" : "UNCLEAR",
  };
}

async function matchIngredientByName(index: TaxonIndex, name: string): Promise<IngredientMatch> {
  const learned = await prisma.recipeIngredient.findFirst({
    where: {
      name: { equals: name, mode: "insensitive" },
      status: "MANUAL",
      foodItemId: { not: null },
    },
    orderBy: { recipe: { updatedAt: "desc" } },
    include: { foodItem: true },
  });
  if (learned?.foodItem) return { foodItem: learned.foodItem, taxonCodes: [], status: "MANUAL" };
  // Von Hand nur Inhaltsstoffe gewählt (ohne Lebensmittel): ebenfalls lernen.
  const learnedTaxa = await prisma.recipeIngredient.findFirst({
    where: {
      name: { equals: name, mode: "insensitive" },
      status: "MANUAL",
      foodItemId: null,
      taxonCodes: { isEmpty: false },
    },
    orderBy: { recipe: { updatedAt: "desc" } },
  });
  if (learnedTaxa) return { foodItem: null, taxonCodes: learnedTaxa.taxonCodes, status: "MANUAL" };

  const exact = index.matchExact(name);
  const codes = exact ? [exact.code] : index.matchText(name).map((match) => match.code);
  if (codes.length === 0) return { foodItem: null, taxonCodes: [], status: "UNCLEAR" };
  if (!exact) return { foodItem: null, taxonCodes: codes, status: "PARTIAL" };

  // Erst die Zutat selbst, dann Unterbegriffe („Sahne“ → Schlagsahne), dann die direkten
  // Oberbegriffe („Hähnchenbrust“ → Hähnchen) – Oberbegriffe bringen nie mehr Auslöser mit.
  // Alle Stufen werden gesucht; spätere Stufen bekommen einen Abschlag, damit ein gut passender
  // Unterbegriff („Schlagsahne“) ein schlecht passendes Lebensmittel der Zutat selbst schlägt.
  const parents = index.get(exact.code)?.parentCodes ?? [];
  const stages = [[exact.code], index.descendants(exact.code, 60), parents];
  const found = await Promise.all(
    stages.map((codesToTry) =>
      codesToTry.length === 0
        ? Promise.resolve([])
        : prisma.foodItem.findMany({
            where: { source: "BLS", taxonCodes: { hasSome: codesToTry } },
            take: 300,
          }),
    ),
  );
  const foodItem = pickFoodItem(
    index,
    name,
    exact.code,
    found.flatMap((items, stage) => items.map((item) => ({ ...item, stagePenalty: stage * 6 }))),
  );
  // Genau erkannte Zutat ohne passendes Lebensmittel: Inhaltsstoffe sind sicher (MATCHED), es
  // fehlen nur die Nährwerte. PARTIAL bleibt den Wortteil-Treffern vorbehalten.
  // Die erkannten Taxa bleiben an der Zeile: Sie beschreiben die Zutat genauer als ein
  // Lebensmittel, das nur als Nährwertquelle dient.
  return { foodItem, taxonCodes: codes, status: "MATCHED" };
}

async function buildIngredientRows(index: TaxonIndex, input: RecipeInput) {
  const manualIds = input.ingredients.flatMap((line) => (line.foodItemId ? [line.foodItemId] : []));
  const manualItems = new Map(
    (await prisma.foodItem.findMany({ where: { id: { in: manualIds } } })).map((item) => [
      item.id,
      item,
    ]),
  );

  return Promise.all(
    input.ingredients.map(async (line, position) => {
      const parsed = parseIngredientLine(line.rawText);
      const manual = line.foodItemId ? manualItems.get(line.foodItemId) : undefined;
      const match: IngredientMatch = manual
        ? { foodItem: manual, taxonCodes: [], status: "MANUAL" }
        : await matchIngredient(index, parsed.name, parsed.rawText);
      return {
        row: {
          position,
          rawText: parsed.rawText,
          amount: parsed.amountMax ?? parsed.amount,
          unit: parsed.unit,
          name: parsed.name,
          note: parsed.note,
          optional: parsed.optional,
          foodItemId: match.foodItem?.id ?? null,
          taxonCodes: match.taxonCodes,
          status: match.status,
        },
        foodItem: match.foodItem,
      };
    }),
  );
}

function computedJson(computed: RecipeComputed): Prisma.InputJsonObject {
  return computed;
}

type RecipeWithLines = Prisma.RecipeGetPayload<{ include: { ingredients: true } }>;

/** Stand eines Rezepts in Eingabeform – so wird er in der Historie gesichert und wiederhergestellt. */
export function recipeToInput(recipe: RecipeWithLines): RecipeInput {
  return {
    title: recipe.title,
    description: recipe.description,
    servings: recipe.servings,
    steps: Array.isArray(recipe.steps)
      ? recipe.steps.filter((step): step is string => typeof step === "string")
      : [],
    tags: recipe.tags,
    sourceUrl: recipe.sourceUrl,
    sourceName: recipe.sourceName,
    prepMinutes: recipe.prepMinutes,
    cookMinutes: recipe.cookMinutes,
    ingredients: [...recipe.ingredients]
      .sort((a, b) => a.position - b.position)
      .map((line) => ({
        rawText: line.rawText,
        // Nur manuelle Zuordnungen gehören zum Stand; automatische werden neu ermittelt.
        foodItemId: line.status === "MANUAL" ? line.foodItemId : null,
      })),
  };
}

async function writeRecipe(recipeId: string | null, input: RecipeInput, userId: string) {
  const index = await loadTaxonIndex();
  const rows = await buildIngredientRows(index, input);
  const computed = computeRecipe(index, {
    servings: input.servings,
    ingredients: rows.map(({ row, foodItem }) => ({ ...row, foodItem })),
  });
  const data = {
    title: input.title,
    description: input.description ?? null,
    servings: input.servings,
    steps: input.steps,
    tags: input.tags,
    sourceUrl: input.sourceUrl ?? null,
    sourceName: input.sourceName ?? null,
    prepMinutes: input.prepMinutes ?? null,
    cookMinutes: input.cookMinutes ?? null,
    computed: computedJson(computed),
    computedAt: new Date(),
    updatedById: userId,
  };
  const ingredientRows = rows.map(({ row }) => row);

  if (recipeId === null) {
    return prisma.recipe.create({
      data: { ...data, createdById: userId, ingredients: { create: ingredientRows } },
    });
  }
  return prisma.$transaction(async (tx) => {
    const previous = await tx.recipe.findUniqueOrThrow({
      where: { id: recipeId },
      include: { ingredients: true },
    });
    await tx.recipeRevision.create({
      data: {
        recipeId,
        version: previous.version,
        snapshot: recipeToInput(previous),
        editedById: previous.updatedById ?? previous.createdById,
        createdAt: previous.updatedAt,
      },
    });
    await tx.recipeIngredient.deleteMany({ where: { recipeId } });
    return tx.recipe.update({
      where: { id: recipeId },
      data: { ...data, version: previous.version + 1, ingredients: { create: ingredientRows } },
    });
  });
}

export function createRecipe(input: RecipeInput, userId: string) {
  return writeRecipe(null, recipeInputSchema.parse(input), userId);
}

/** Ändern (Wiki-Prinzip): der vorherige Stand wird als Revision gesichert. */
export function updateRecipe(recipeId: string, input: RecipeInput, userId: string) {
  return writeRecipe(recipeId, recipeInputSchema.parse(input), userId);
}

/** Stellt einen früheren Stand wieder her – selbst wieder als neue Version, nichts geht verloren. */
export async function restoreRecipeRevision(recipeId: string, version: number, userId: string) {
  const revision = await prisma.recipeRevision.findUniqueOrThrow({
    where: { recipeId_version: { recipeId, version } },
  });
  const snapshot = recipeInputSchema.parse(revision.snapshot);
  return writeRecipe(recipeId, snapshot, userId);
}

/** Ordnet eine Zutat von Hand einem Lebensmittel zu (wird für gleichnamige Zutaten gelernt). */
export async function assignIngredientFood(ingredientId: string, foodItemId: string) {
  const ingredient = await prisma.recipeIngredient.update({
    where: { id: ingredientId },
    data: { foodItemId, status: "MANUAL", taxonCodes: [] },
  });
  await recomputeRecipe(ingredient.recipeId);
  return ingredient;
}

/** Ordnet einer Zutat nur Inhaltsstoffe zu (ohne Lebensmittel, also ohne Nährwerte). */
export async function assignIngredientTaxa(ingredientId: string, taxonCodes: string[]) {
  const index = await loadTaxonIndex();
  const codes = taxonCodes.filter((code) => index.has(code));
  if (codes.length === 0) throw new Error("Unbekannter Eintrag.");
  const ingredient = await prisma.recipeIngredient.update({
    where: { id: ingredientId },
    data: { foodItemId: null, taxonCodes: codes, status: "MANUAL" },
  });
  await recomputeRecipe(ingredient.recipeId);
  return ingredient;
}

/** Bestätigt die automatische Zuordnung („passt so“) – sie gilt dann als sicher und gelernt. */
export async function confirmIngredient(ingredientId: string) {
  const ingredient = await prisma.recipeIngredient.update({
    where: { id: ingredientId },
    data: { status: "MANUAL" },
  });
  await recomputeRecipe(ingredient.recipeId);
  return ingredient;
}

/** Neu auswerten, z. B. nach einem Taxonomie- oder BLS-Update. */
export async function recomputeRecipe(recipeId: string): Promise<RecipeComputed> {
  const index = await loadTaxonIndex();
  const recipe = await prisma.recipe.findUniqueOrThrow({
    where: { id: recipeId },
    include: { ingredients: { include: { foodItem: true }, orderBy: { position: "asc" } } },
  });
  const computed = computeRecipe(index, recipe);
  await prisma.recipe.update({
    where: { id: recipeId },
    data: { computed: computedJson(computed), computedAt: new Date() },
  });
  return computed;
}

/**
 * Ordnet die automatisch zugeordneten Zutaten aller Rezepte neu zu und wertet sie neu aus –
 * nach jedem Taxonomie- oder BLS-Import. Manuelle Zuordnungen bleiben, eine neue Version
 * entsteht nicht (der Text ändert sich nicht, nur die Datengrundlage).
 */
export async function rematchRecipes(): Promise<{ recipes: number; changed: number }> {
  const index = await loadTaxonIndex({ fresh: true });
  const recipes = await prisma.recipe.findMany({
    where: { archivedAt: null },
    select: { id: true, ingredients: { where: { status: { not: "MANUAL" } } } },
  });
  let changed = 0;
  for (const recipe of recipes) {
    for (const line of recipe.ingredients) {
      const parsed = parseIngredientLine(line.rawText);
      const match = await matchIngredient(index, parsed.name, parsed.rawText);
      const data = {
        amount: parsed.amountMax ?? parsed.amount,
        unit: parsed.unit,
        name: parsed.name,
        note: parsed.note,
        optional: parsed.optional,
        foodItemId: match.foodItem?.id ?? null,
        taxonCodes: match.taxonCodes,
        status: match.status,
      };
      const same =
        line.foodItemId === data.foodItemId &&
        line.status === data.status &&
        line.name === data.name &&
        line.taxonCodes.join() === data.taxonCodes.join();
      if (same) continue;
      changed += 1;
      await prisma.recipeIngredient.update({ where: { id: line.id }, data });
    }
    await recomputeRecipe(recipe.id);
  }
  return { recipes: recipes.length, changed };
}

export async function rateRecipe(recipeId: string, userId: string, stars: number) {
  const value = z.number().int().min(1).max(5).parse(stars);
  return prisma.recipeRating.upsert({
    where: { recipeId_userId: { recipeId, userId } },
    create: { recipeId, userId, stars: value },
    update: { stars: value },
  });
}

export async function commentRecipe(recipeId: string, userId: string, body: string) {
  const text = z.string().trim().min(1).max(4000).parse(body);
  return prisma.recipeComment.create({ data: { recipeId, userId, body: text } });
}
