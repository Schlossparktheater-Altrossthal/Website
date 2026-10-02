import { z } from "zod";

/** Feste Kategorien der Konfektionsgrößen (`MemberSize.category`). */
export const sizeCategoryEnum = z.enum(["TOP", "PANTS", "DRESS_SUIT", "SHOES", "HAT"] as const);

export type SizeCategory = z.infer<typeof sizeCategoryEnum>;

export const SIZE_CATEGORY_LABELS: Record<SizeCategory, string> = {
  TOP: "Oberteil",
  PANTS: "Hose",
  DRESS_SUIT: "Kleid / Anzug",
  SHOES: "Schuhe",
  HAT: "Hut",
};

export const SIZE_CATEGORY_HINTS: Record<SizeCategory, string> = {
  TOP: "z. B. M, 40 oder 52",
  PANTS: "z. B. 38, M oder W32/L34",
  DRESS_SUIT: "z. B. 38 oder 50",
  SHOES: "EU-Größe, z. B. 42",
  HAT: "z. B. 57 oder M",
};

export const sizeSchema = z.object({
  category: sizeCategoryEnum,
  size: z.string().trim().min(1, "Bitte eine Größe angeben.").max(30, "Höchstens 30 Zeichen."),
  note: z.string().trim().max(200, "Notizen dürfen höchstens 200 Zeichen haben.").optional(),
});

export type SizeFormData = z.infer<typeof sizeSchema>;

export type SizeEntry = {
  id: string;
  category: SizeCategory;
  size: string;
  note: string | null;
};

export function isSizeCategory(value: string): value is SizeCategory {
  return sizeCategoryEnum.safeParse(value).success;
}
