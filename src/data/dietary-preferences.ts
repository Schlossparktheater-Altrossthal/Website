import { z } from "zod";

export const DIETARY_STYLE_OPTIONS = [
  { value: "none", label: "Keine besondere Ernährung" },
  { value: "omnivore", label: "Allesesser:in" },
  { value: "vegetarian", label: "Vegetarisch" },
  { value: "vegan", label: "Vegan" },
  { value: "pescetarian", label: "Pescetarisch" },
  { value: "flexitarian", label: "Flexitarisch" },
  { value: "halal", label: "Halal" },
  { value: "kosher", label: "Koscher" },
  { value: "custom", label: "Individueller Stil" },
] as const;

export type DietaryStyleOption = (typeof DIETARY_STYLE_OPTIONS)[number]["value"];

export const DIETARY_STRICTNESS_OPTIONS = [
  { value: "strict", label: "Strikt – keine Ausnahmen" },
  { value: "flexible", label: "Flexibel – kleine Ausnahmen sind möglich" },
  { value: "situational", label: "Situationsabhängig / nach Rücksprache" },
] as const;

export type DietaryStrictnessOption =
  (typeof DIETARY_STRICTNESS_OPTIONS)[number]["value"];

export const dietaryPreferenceSchema = z.object({
  style: z.enum([
    "none",
    "omnivore",
    "vegetarian",
    "vegan",
    "pescetarian",
    "flexitarian",
    "halal",
    "kosher",
    "custom",
  ]),
  customLabel: z
    .string()
    .max(120)
    .optional()
    .nullable()
    .transform((value) => value?.trim() ?? null),
  strictness: z.enum(["strict", "flexible", "situational"]),
});

export const DEFAULT_STRICTNESS_FOR_NONE: DietaryStrictnessOption = "flexible";
export const NONE_STRICTNESS_LABEL = "Nicht relevant";

export function resolveDietaryStyleLabel(
  style: DietaryStyleOption,
  customLabel?: string | null,
): { label: string; custom: string | null } {
  if (style === "custom") {
    const normalized = customLabel?.trim() ?? "";
    if (!normalized) {
      return { label: DIETARY_STYLE_OPTIONS[0].label, custom: null };
    }
    return { label: normalized, custom: normalized };
  }
  const option = DIETARY_STYLE_OPTIONS.find((entry) => entry.value === style);
  return {
    label: option?.label ?? DIETARY_STYLE_OPTIONS[0].label,
    custom: null,
  };
}

export function resolveDietaryStrictnessLabel(
  style: DietaryStyleOption,
  strictness: DietaryStrictnessOption,
): string {
  if (style === "none") {
    return NONE_STRICTNESS_LABEL;
  }
  const option = DIETARY_STRICTNESS_OPTIONS.find(
    (entry) => entry.value === strictness,
  );
  return option?.label ?? DIETARY_STRICTNESS_OPTIONS[1].label;
}

export function parseDietaryStyleFromLabel(
  label: string | null | undefined,
): { style: DietaryStyleOption; customLabel: string | null } {
  const trimmed = label?.trim();
  if (!trimmed) {
    return { style: "none", customLabel: null };
  }
  const match = DIETARY_STYLE_OPTIONS.find(
    (option) => option.label.toLowerCase() === trimmed.toLowerCase(),
  );
  if (!match || match.value === "custom") {
    return { style: "custom", customLabel: trimmed };
  }
  return { style: match.value, customLabel: null };
}

export function parseDietaryStrictnessFromLabel(
  label: string | null | undefined,
): DietaryStrictnessOption {
  const trimmed = label?.trim();
  if (!trimmed || trimmed === NONE_STRICTNESS_LABEL) {
    return DEFAULT_STRICTNESS_FOR_NONE;
  }
  const match = DIETARY_STRICTNESS_OPTIONS.find(
    (option) => option.label.toLowerCase() === trimmed.toLowerCase(),
  );
  return match?.value ?? DIETARY_STRICTNESS_OPTIONS[1].value;
}
