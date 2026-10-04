import type { FoodMatchStatus } from "@prisma/client";

import { AVATAR_USER_SELECT, toAvatarFields, type AvatarFields } from "@/lib/avatar-fields";
import type { ConflictVerdict } from "@/lib/food/conflicts";
import type { RecipeComputed } from "@/lib/food/recipes/compute";
import { loadTaxonIndex } from "@/lib/food/taxonomy/store";
import type { TaxonIndex } from "@/lib/food/taxonomy/taxon-index";
import { getUserDisplayName } from "@/lib/names";
import { prisma } from "@/lib/prisma";

/** Lese-Abfragen für die Rezeptseiten (docs/Plan/ernaehrung-rezepte-ui-plan.md, Phase 4). */

export type DietKey = keyof RecipeComputed["diets"];

export type AllergenLabel = { code: string; name: string; lmiv: boolean };

export type RecipeListItem = {
  id: string;
  title: string;
  servings: number;
  tags: string[];
  allergens: AllergenLabel[];
  diets: Record<DietKey, ConflictVerdict> | null;
  status: FoodMatchStatus | null;
  ratingAverage: number | null;
  ratingCount: number;
  totalMinutes: number | null;
  updatedAt: string;
};

/** Gespeicherte Auswertung lesen; ältere oder fehlende Auswertungen ergeben `null`. */
export function readComputed(value: unknown): RecipeComputed | null {
  if (!value || typeof value !== "object" || !("version" in value)) return null;
  const computed = value as Partial<RecipeComputed>;
  return computed.version === 1 && Array.isArray(computed.allergens) && computed.diets
    ? (computed as RecipeComputed)
    : null;
}

export function allergenLabels(index: TaxonIndex, codes: string[]): AllergenLabel[] {
  return codes.map((code) => {
    const entry = index.get(code);
    return { code, name: entry?.nameDe ?? entry?.nameEn ?? code, lmiv: entry?.lmiv ?? false };
  });
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10;
}

export async function listRecipes(): Promise<RecipeListItem[]> {
  const [recipes, index] = await Promise.all([
    prisma.recipe.findMany({
      where: { archivedAt: null },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        title: true,
        servings: true,
        tags: true,
        computed: true,
        prepMinutes: true,
        cookMinutes: true,
        updatedAt: true,
        ratings: { select: { stars: true } },
      },
    }),
    loadTaxonIndex(),
  ]);
  return recipes.map((recipe) => {
    const computed = readComputed(recipe.computed);
    const minutes = (recipe.prepMinutes ?? 0) + (recipe.cookMinutes ?? 0);
    return {
      id: recipe.id,
      title: recipe.title,
      servings: recipe.servings,
      tags: recipe.tags,
      allergens: allergenLabels(index, computed?.allergens ?? []),
      diets: computed?.diets ?? null,
      status: computed?.status ?? null,
      ratingAverage: average(recipe.ratings.map((rating) => rating.stars)),
      ratingCount: recipe.ratings.length,
      totalMinutes: minutes > 0 ? minutes : null,
      updatedAt: recipe.updatedAt.toISOString(),
    };
  });
}

type Person = { id: string; name: string; avatar: AvatarFields } | null;

const PERSON_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  name: true,
  ...AVATAR_USER_SELECT,
} as const;

function person(
  user: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    name: string | null;
    email: string | null;
    avatarSource: AvatarFields["avatarSource"];
    avatarImageUpdatedAt: Date | null;
  } | null,
): Person {
  return user
    ? { id: user.id, name: getUserDisplayName(user), avatar: toAvatarFields(user) }
    : null;
}

export async function getRecipeDetail(recipeId: string, userId: string) {
  const [recipe, index] = await Promise.all([
    prisma.recipe.findUnique({
      where: { id: recipeId },
      include: {
        createdBy: { select: PERSON_SELECT },
        updatedBy: { select: PERSON_SELECT },
        ingredients: {
          orderBy: { position: "asc" },
          include: { foodItem: { select: { id: true, nameDe: true, source: true } } },
        },
        ratings: { select: { userId: true, stars: true } },
        comments: {
          orderBy: { createdAt: "asc" },
          include: { user: { select: PERSON_SELECT } },
        },
        _count: { select: { revisions: true } },
      },
    }),
    loadTaxonIndex(),
  ]);
  if (!recipe) return null;
  const computed = readComputed(recipe.computed);

  return {
    id: recipe.id,
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
    version: recipe.version,
    revisionCount: recipe._count.revisions,
    createdBy: person(recipe.createdBy),
    updatedBy: person(recipe.updatedBy),
    updatedAt: recipe.updatedAt.toISOString(),
    ingredients: recipe.ingredients.map((line) => ({
      id: line.id,
      rawText: line.rawText,
      amount: line.amount,
      unit: line.unit,
      name: line.name,
      note: line.note,
      optional: line.optional,
      status: line.status,
      foodName: line.foodItem?.nameDe ?? null,
      taxonNames: line.taxonCodes.map((code) => index.get(code)?.nameDe ?? code),
    })),
    computed: computed
      ? {
          ...computed,
          allergenLabels: allergenLabels(index, computed.allergens),
          traceLabels: allergenLabels(index, computed.traces),
        }
      : null,
    ratingAverage: average(recipe.ratings.map((rating) => rating.stars)),
    ratingCount: recipe.ratings.length,
    myRating: recipe.ratings.find((rating) => rating.userId === userId)?.stars ?? null,
    comments: recipe.comments.map((comment) => ({
      id: comment.id,
      body: comment.body,
      createdAt: comment.createdAt.toISOString(),
      author: person(comment.user),
      own: comment.userId === userId,
    })),
  };
}

export type RecipeDetail = NonNullable<Awaited<ReturnType<typeof getRecipeDetail>>>;

export async function listRecipeRevisions(recipeId: string) {
  const revisions = await prisma.recipeRevision.findMany({
    where: { recipeId },
    orderBy: { version: "desc" },
    include: { editedBy: { select: PERSON_SELECT } },
  });
  return revisions.map((revision) => {
    const snapshot = revision.snapshot as { title?: unknown; ingredients?: unknown[] };
    return {
      version: revision.version,
      createdAt: revision.createdAt.toISOString(),
      editedBy: person(revision.editedBy),
      title: typeof snapshot.title === "string" ? snapshot.title : "",
      ingredientCount: Array.isArray(snapshot.ingredients) ? snapshot.ingredients.length : 0,
    };
  });
}
