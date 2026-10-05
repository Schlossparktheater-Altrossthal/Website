import sharp from "sharp";
import { z } from "zod";

import { safeFetchBytes } from "@/lib/food/recipes/safe-fetch";
import { prisma } from "@/lib/prisma";

/**
 * Rezeptbilder: übernommen von der Quellseite oder hochgeladen, immer mit Quellenangabe.
 * Gespeichert wird eine verkleinerte WebP-Fassung in der DB (wie Lagerfotos).
 */

export const MAX_RECIPE_IMAGES = 6;
const MAX_SOURCE_BYTES = 12 * 1024 * 1024;
const MAX_EDGE = 1600;

export const recipeImageMetaSchema = z.object({
  credit: z.string().trim().min(2, "Bitte angeben, von wem das Bild stammt.").max(200),
  sourceUrl: z.string().trim().url().max(1000).nullish(),
  license: z.string().trim().max(120).nullish(),
});

export type RecipeImageMeta = z.infer<typeof recipeImageMetaSchema>;

async function normalizeImage(input: Uint8Array) {
  const { data, info } = await sharp(input, { limitInputPixels: 60_000_000 })
    .rotate()
    .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer({ resolveWithObject: true });
  return { data: new Uint8Array(data), width: info.width, height: info.height };
}

export async function addRecipeImage(
  recipeId: string,
  input: Uint8Array,
  meta: RecipeImageMeta,
  userId: string,
) {
  const parsedMeta = recipeImageMetaSchema.parse(meta);
  const count = await prisma.recipeImage.count({ where: { recipeId } });
  if (count >= MAX_RECIPE_IMAGES)
    throw new Error(`Höchstens ${MAX_RECIPE_IMAGES} Bilder je Rezept.`);
  const image = await normalizeImage(input).catch(() => {
    throw new Error("Das Bild konnte nicht gelesen werden.");
  });
  return prisma.recipeImage.create({
    data: {
      recipeId,
      ...image,
      mimeType: "image/webp",
      sortOrder: count,
      credit: parsedMeta.credit,
      sourceUrl: parsedMeta.sourceUrl ?? null,
      license: parsedMeta.license ?? null,
      uploadedById: userId,
    },
    select: { id: true },
  });
}

/** Lädt das Bild einer Rezeptseite (nur öffentliche Adressen) und speichert es mit Quelle. */
export async function importRecipeImage(
  recipeId: string,
  imageUrl: string,
  meta: RecipeImageMeta,
  userId: string,
) {
  const file = await safeFetchBytes(imageUrl, {
    accept: "image/avif,image/webp,image/jpeg,image/png,image/*;q=0.8",
    maxBytes: MAX_SOURCE_BYTES,
    timeoutMs: 15_000,
  });
  if (file.contentType && !file.contentType.startsWith("image/")) {
    throw new Error("Die Adresse liefert kein Bild.");
  }
  return addRecipeImage(recipeId, file.data, meta, userId);
}

export async function deleteRecipeImage(recipeId: string, imageId: string) {
  await prisma.$transaction(async (tx) => {
    await tx.recipeImage.delete({ where: { id: imageId, recipeId } });
    const rest = await tx.recipeImage.findMany({
      where: { recipeId },
      orderBy: { sortOrder: "asc" },
      select: { id: true },
    });
    for (const [position, image] of rest.entries()) {
      await tx.recipeImage.update({ where: { id: image.id }, data: { sortOrder: position } });
    }
  });
}

/** Macht ein Bild zum Titelbild (an erste Stelle). */
export async function makeRecipeCoverImage(recipeId: string, imageId: string) {
  const images = await prisma.recipeImage.findMany({
    where: { recipeId },
    orderBy: { sortOrder: "asc" },
    select: { id: true },
  });
  const ordered = [
    ...images.filter((image) => image.id === imageId),
    ...images.filter((image) => image.id !== imageId),
  ];
  await prisma.$transaction(
    ordered.map((image, position) =>
      prisma.recipeImage.update({ where: { id: image.id }, data: { sortOrder: position } }),
    ),
  );
}

export function updateRecipeImageMeta(recipeId: string, imageId: string, meta: RecipeImageMeta) {
  const parsed = recipeImageMetaSchema.parse(meta);
  return prisma.recipeImage.update({
    where: { id: imageId, recipeId },
    data: {
      credit: parsed.credit,
      sourceUrl: parsed.sourceUrl ?? null,
      license: parsed.license ?? null,
    },
  });
}

/** Kleine Vorschau eines fremden Bildes als data-URL (die CSP erlaubt keine fremden Bildquellen). */
export async function previewRemoteImage(imageUrl: string): Promise<string> {
  const file = await safeFetchBytes(imageUrl, {
    accept: "image/avif,image/webp,image/jpeg,image/png,image/*;q=0.8",
    maxBytes: MAX_SOURCE_BYTES,
    timeoutMs: 15_000,
  });
  const preview = await sharp(file.data, { limitInputPixels: 60_000_000 })
    .rotate()
    .resize({ width: 480, height: 480, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 70 })
    .toBuffer();
  return `data:image/webp;base64,${preview.toString("base64")}`;
}
