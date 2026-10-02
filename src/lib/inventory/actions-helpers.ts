import { revalidatePath } from "next/cache";
import { z } from "zod";

import { INVENTORY_BASE_PATH } from "@/lib/inventory/constants";

export type InventoryActionResult<T = undefined> =
  | ({ ok: true; message?: string } & ([T] extends [undefined]
      ? { data?: undefined }
      : { data: T }))
  | { ok: false; error: string };

export const MAX_PHOTO_BYTES = 900 * 1024;
export const ALLOWED_PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export function failure(error: unknown, fallback: string): { ok: false; error: string } {
  if (error instanceof z.ZodError) {
    return { ok: false, error: error.issues[0]?.message ?? fallback };
  }
  if (error instanceof Error && error.message) {
    return { ok: false, error: error.message };
  }
  return { ok: false, error: fallback };
}

export function revalidateInventory(...paths: (string | null | undefined)[]) {
  revalidatePath(INVENTORY_BASE_PATH, "layout");
  for (const path of paths) {
    if (path) revalidatePath(path);
  }
}

export const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Höchstens ${max} Zeichen.`)
    .optional()
    .nullable()
    .transform((value) => (value ? value : null));

export const optionalId = z
  .string()
  .trim()
  .optional()
  .nullable()
  .transform((value) => (value ? value : null));

/** Liest ein (im Browser verkleinertes) Foto aus FormData. */
export async function readPhotoFile(
  formData: FormData,
  key = "photo",
): Promise<{ data: Uint8Array<ArrayBuffer>; mimeType: string } | null> {
  const file = formData.get(key);
  if (!(file instanceof File) || file.size === 0) return null;
  if (!ALLOWED_PHOTO_TYPES.has(file.type)) {
    throw new Error("Bitte ein Foto als JPEG, PNG oder WebP hochladen.");
  }
  if (file.size > MAX_PHOTO_BYTES) {
    throw new Error("Das Foto ist zu groß.");
  }
  return { data: new Uint8Array(await file.arrayBuffer()), mimeType: file.type };
}

export function readJsonField<T>(formData: FormData, key: string, schema: z.ZodType<T>): T {
  const raw = formData.get(key);
  const parsed = typeof raw === "string" && raw ? JSON.parse(raw) : {};
  return schema.parse(parsed);
}
