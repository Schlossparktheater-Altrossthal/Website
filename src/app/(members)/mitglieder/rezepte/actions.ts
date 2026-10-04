"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { searchFoodItems } from "@/lib/food/items";
import { fetchRecipeFromUrl, type ImportedRecipe } from "@/lib/food/recipes/json-ld";
import {
  assignIngredientFood,
  commentRecipe,
  createRecipe,
  rateRecipe,
  recipeInputSchema,
  restoreRecipeRevision,
  updateRecipe,
  type RecipeInput,
} from "@/lib/food/recipes/service";
import { createLogger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";

/** Rezepte sind ein Wiki: jedes angemeldete Mitglied darf anlegen und ändern (E2). */

const logger = createLogger("recipes");
const BASE = "/mitglieder/rezepte";

type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

async function currentUserId(): Promise<string> {
  const session = await requireAuth();
  const id = session.user?.id;
  if (!id) throw new Error("Nicht angemeldet.");
  return id;
}

function failure(action: string, error: unknown, message: string): { ok: false; error: string } {
  logger.error(`Rezept: ${action} fehlgeschlagen`, { error });
  return { ok: false, error: message };
}

export async function saveRecipeAction(
  recipeId: string | null,
  input: RecipeInput,
): Promise<Result<{ id: string }>> {
  const userId = await currentUserId();
  const parsed = recipeInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Ungültige Angaben." };
  }
  try {
    const recipe = recipeId
      ? await updateRecipe(recipeId, parsed.data, userId)
      : await createRecipe(parsed.data, userId);
    revalidatePath(BASE);
    revalidatePath(`${BASE}/${recipe.id}`);
    return { ok: true, data: { id: recipe.id } };
  } catch (error) {
    return failure("speichern", error, "Rezept konnte nicht gespeichert werden.");
  }
}

export async function importRecipeAction(url: string): Promise<Result<ImportedRecipe>> {
  await currentUserId();
  if (!z.string().url().max(1000).safeParse(url).success) {
    return { ok: false, error: "Bitte einen vollständigen Link angeben." };
  }
  try {
    const recipe = await fetchRecipeFromUrl(url);
    return recipe
      ? { ok: true, data: recipe }
      : { ok: false, error: "Auf der Seite wurde kein Rezept gefunden." };
  } catch (error) {
    logger.warn("Rezept-Import fehlgeschlagen", { url, error });
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Seite konnte nicht geladen werden.",
    };
  }
}

export async function rateRecipeAction(recipeId: string, stars: number): Promise<Result> {
  const userId = await currentUserId();
  try {
    await rateRecipe(recipeId, userId, stars);
    revalidatePath(`${BASE}/${recipeId}`);
    return { ok: true, data: undefined };
  } catch (error) {
    return failure("bewerten", error, "Bewertung konnte nicht gespeichert werden.");
  }
}

export async function commentRecipeAction(recipeId: string, body: string): Promise<Result> {
  const userId = await currentUserId();
  try {
    await commentRecipe(recipeId, userId, body);
    revalidatePath(`${BASE}/${recipeId}`);
    return { ok: true, data: undefined };
  } catch (error) {
    return failure("kommentieren", error, "Kommentar konnte nicht gespeichert werden.");
  }
}

export async function deleteCommentAction(commentId: string): Promise<Result> {
  const userId = await currentUserId();
  const comment = await prisma.recipeComment.findUnique({ where: { id: commentId } });
  if (!comment || comment.userId !== userId) {
    return { ok: false, error: "Nur eigene Kommentare lassen sich löschen." };
  }
  await prisma.recipeComment.delete({ where: { id: commentId } });
  revalidatePath(`${BASE}/${comment.recipeId}`);
  return { ok: true, data: undefined };
}

export async function restoreRevisionAction(recipeId: string, version: number): Promise<Result> {
  const userId = await currentUserId();
  try {
    await restoreRecipeRevision(recipeId, version, userId);
    revalidatePath(`${BASE}/${recipeId}`);
    revalidatePath(`${BASE}/${recipeId}/verlauf`);
    return { ok: true, data: undefined };
  } catch (error) {
    return failure("wiederherstellen", error, "Stand konnte nicht wiederhergestellt werden.");
  }
}

export type FoodItemOption = { id: string; name: string; source: string };

export async function searchFoodItemsAction(query: string): Promise<FoodItemOption[]> {
  await currentUserId();
  const items = await searchFoodItems(query.slice(0, 80), 15);
  return items.map((item) => ({ id: item.id, name: item.nameDe, source: item.source }));
}

export async function assignIngredientFoodAction(
  recipeId: string,
  ingredientId: string,
  foodItemId: string,
): Promise<Result> {
  await currentUserId();
  const ingredient = await prisma.recipeIngredient.findUnique({ where: { id: ingredientId } });
  if (!ingredient || ingredient.recipeId !== recipeId) {
    return { ok: false, error: "Zutat nicht gefunden." };
  }
  try {
    await assignIngredientFood(ingredientId, foodItemId);
    revalidatePath(`${BASE}/${recipeId}`);
    return { ok: true, data: undefined };
  } catch (error) {
    return failure("zuordnen", error, "Zuordnung konnte nicht gespeichert werden.");
  }
}
