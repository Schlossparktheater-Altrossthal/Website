"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { searchFoodItems } from "@/lib/food/items";
import {
  addRecipeImage,
  deleteRecipeImage,
  importRecipeImage,
  makeRecipeCoverImage,
  previewRemoteImage,
  recipeImageMetaSchema,
  updateRecipeImageMeta,
  type RecipeImageMeta,
} from "@/lib/food/recipes/images";
import {
  getIngredientOptions,
  searchFoodOptions,
  type FoodOption,
  type IngredientOptions,
} from "@/lib/food/recipes/ingredient-options";
import { fetchRecipeFromUrl, type ImportedRecipe } from "@/lib/food/recipes/json-ld";
import {
  assignIngredientFood,
  assignIngredientTaxa,
  confirmIngredient,
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

export type ImportImageChoice = RecipeImageMeta & { url: string };

export async function saveRecipeAction(
  recipeId: string | null,
  input: RecipeInput,
  importImage?: ImportImageChoice | null,
): Promise<Result<{ id: string; imageError?: string }>> {
  const userId = await currentUserId();
  const parsed = recipeInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Ungültige Angaben." };
  }
  try {
    const recipe = recipeId
      ? await updateRecipe(recipeId, parsed.data, userId)
      : await createRecipe(parsed.data, userId);
    // Das Bild ist eine Zugabe: scheitert der Abruf, bleibt das Rezept trotzdem gespeichert.
    let imageError: string | undefined;
    if (importImage) {
      try {
        const { url, ...meta } = importImage;
        await importRecipeImage(recipe.id, url, meta, userId);
      } catch (error) {
        logger.warn("Rezeptbild-Import fehlgeschlagen", { url: importImage.url, error });
        imageError = error instanceof Error ? error.message : "Bild konnte nicht geladen werden.";
      }
    }
    revalidatePath(BASE);
    revalidatePath(`${BASE}/${recipe.id}`);
    return { ok: true, data: { id: recipe.id, imageError } };
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

const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);

/** Eigenes Bild hochladen (FormData: file, credit, sourceUrl?, license?). */
export async function uploadRecipeImageAction(
  recipeId: string,
  formData: FormData,
): Promise<Result> {
  const userId = await currentUserId();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Kein Bild gewählt." };
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    return { ok: false, error: "Bitte ein Bild als JPEG, PNG, WebP oder AVIF hochladen." };
  }
  if (file.size > 12 * 1024 * 1024) return { ok: false, error: "Das Bild ist zu groß." };
  const meta = recipeImageMetaSchema.safeParse({
    credit: formData.get("credit"),
    sourceUrl: formData.get("sourceUrl") || null,
    license: formData.get("license") || null,
  });
  if (!meta.success)
    return { ok: false, error: meta.error.issues[0]?.message ?? "Angaben fehlen." };
  try {
    await addRecipeImage(recipeId, new Uint8Array(await file.arrayBuffer()), meta.data, userId);
    revalidatePath(`${BASE}/${recipeId}`);
    revalidatePath(BASE);
    return { ok: true, data: undefined };
  } catch (error) {
    return failure("Bild hochladen", error, error instanceof Error ? error.message : "Fehler.");
  }
}

/** Bild von einer Adresse übernehmen (z. B. nachträglich von der Rezeptseite). */
export async function importRecipeImageAction(
  recipeId: string,
  choice: ImportImageChoice,
): Promise<Result> {
  const userId = await currentUserId();
  if (!z.string().url().max(1000).safeParse(choice.url).success) {
    return { ok: false, error: "Bitte eine vollständige Bildadresse angeben." };
  }
  const meta = recipeImageMetaSchema.safeParse(choice);
  if (!meta.success)
    return { ok: false, error: meta.error.issues[0]?.message ?? "Angaben fehlen." };
  try {
    await importRecipeImage(recipeId, choice.url, meta.data, userId);
    revalidatePath(`${BASE}/${recipeId}`);
    revalidatePath(BASE);
    return { ok: true, data: undefined };
  } catch (error) {
    return failure("Bild übernehmen", error, error instanceof Error ? error.message : "Fehler.");
  }
}

export async function updateRecipeImageAction(
  recipeId: string,
  imageId: string,
  meta: RecipeImageMeta,
): Promise<Result> {
  await currentUserId();
  const parsed = recipeImageMetaSchema.safeParse(meta);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Angaben fehlen." };
  }
  try {
    await updateRecipeImageMeta(recipeId, imageId, parsed.data);
    revalidatePath(`${BASE}/${recipeId}`);
    return { ok: true, data: undefined };
  } catch (error) {
    return failure("Bildangaben speichern", error, "Angaben konnten nicht gespeichert werden.");
  }
}

export async function deleteRecipeImageAction(recipeId: string, imageId: string): Promise<Result> {
  await currentUserId();
  try {
    await deleteRecipeImage(recipeId, imageId);
    revalidatePath(`${BASE}/${recipeId}`);
    revalidatePath(BASE);
    return { ok: true, data: undefined };
  } catch (error) {
    return failure("Bild löschen", error, "Bild konnte nicht gelöscht werden.");
  }
}

export async function makeRecipeCoverImageAction(
  recipeId: string,
  imageId: string,
): Promise<Result> {
  await currentUserId();
  try {
    await makeRecipeCoverImage(recipeId, imageId);
    revalidatePath(`${BASE}/${recipeId}`);
    revalidatePath(BASE);
    return { ok: true, data: undefined };
  } catch (error) {
    return failure("Titelbild setzen", error, "Titelbild konnte nicht gesetzt werden.");
  }
}

export async function previewRecipeImageAction(url: string): Promise<Result<string>> {
  await currentUserId();
  if (!z.string().url().max(1000).safeParse(url).success) {
    return { ok: false, error: "Ungültige Bildadresse." };
  }
  try {
    return { ok: true, data: await previewRemoteImage(url) };
  } catch (error) {
    logger.warn("Rezeptbild-Vorschau fehlgeschlagen", { url, error });
    return { ok: false, error: "Bild konnte nicht geladen werden." };
  }
}

async function ingredientOf(recipeId: string, ingredientId: string) {
  const ingredient = await prisma.recipeIngredient.findUnique({ where: { id: ingredientId } });
  return ingredient && ingredient.recipeId === recipeId ? ingredient : null;
}

export async function ingredientOptionsAction(
  recipeId: string,
  ingredientId: string,
): Promise<Result<IngredientOptions>> {
  await currentUserId();
  if (!(await ingredientOf(recipeId, ingredientId))) {
    return { ok: false, error: "Zutat nicht gefunden." };
  }
  return { ok: true, data: await getIngredientOptions(ingredientId) };
}

export async function searchFoodOptionsAction(query: string): Promise<FoodOption[]> {
  await currentUserId();
  return searchFoodOptions(query.slice(0, 80));
}

export async function assignIngredientTaxaAction(
  recipeId: string,
  ingredientId: string,
  taxonCodes: string[],
): Promise<Result> {
  await currentUserId();
  if (!(await ingredientOf(recipeId, ingredientId))) {
    return { ok: false, error: "Zutat nicht gefunden." };
  }
  if (!z.array(z.string().min(3).max(120)).min(1).max(10).safeParse(taxonCodes).success) {
    return { ok: false, error: "Ungültige Auswahl." };
  }
  try {
    await assignIngredientTaxa(ingredientId, taxonCodes);
    revalidatePath(`${BASE}/${recipeId}`);
    return { ok: true, data: undefined };
  } catch (error) {
    return failure("zuordnen", error, "Zuordnung konnte nicht gespeichert werden.");
  }
}

export async function confirmIngredientAction(
  recipeId: string,
  ingredientId: string,
): Promise<Result> {
  await currentUserId();
  if (!(await ingredientOf(recipeId, ingredientId))) {
    return { ok: false, error: "Zutat nicht gefunden." };
  }
  try {
    await confirmIngredient(ingredientId);
    revalidatePath(`${BASE}/${recipeId}`);
    return { ok: true, data: undefined };
  } catch (error) {
    return failure("bestätigen", error, "Bestätigung konnte nicht gespeichert werden.");
  }
}
