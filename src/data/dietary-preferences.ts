import { z } from "zod";

/**
 * Auswählbare Ernährungsstile. Die Reihenfolge ist die Reihenfolge im Formular.
 *
 * Bewusst kurz gehalten: Für die Verpflegung zählt, was die Küche unterscheiden muss. Feine
 * Vorlieben und Abneigungen („keine Pilze", „rohköstlich") gehören in die Liste der Abneigungen
 * und Besonderheiten, nicht in den Stil.
 */
export const DIETARY_STYLE_VALUES = [
  "omnivore",
  "flexitarian",
  "vegetarian",
  "vegan",
  "pescetarian",
  "halal",
  "kosher",
  "custom",
] as const;

export type DietaryStyleOption = (typeof DIETARY_STYLE_VALUES)[number];

export const DIETARY_STYLE_OPTIONS: readonly { value: DietaryStyleOption; label: string }[] = [
  { value: "omnivore", label: "Allesesser" },
  { value: "flexitarian", label: "Flexitarisch" },
  { value: "vegetarian", label: "Vegetarisch" },
  { value: "vegan", label: "Vegan" },
  { value: "pescetarian", label: "Pescetarisch" },
  { value: "halal", label: "Halal" },
  { value: "kosher", label: "Koscher" },
  { value: "custom", label: "Individueller Stil" },
];

/**
 * Unterform eines Stils. Nur dort, wo die Küche sonst raten müsste: „Vegetarisch" allein sagt
 * nicht, ob Ei und Milch auf den Teller dürfen.
 */
export const DIETARY_VARIANT_VALUES = ["ovo_lacto", "lacto", "ovo"] as const;

export type DietaryVariantOption = (typeof DIETARY_VARIANT_VALUES)[number];

export const DIETARY_VARIANT_OPTIONS: readonly { value: DietaryVariantOption; label: string }[] = [
  { value: "ovo_lacto", label: "Mit Ei und Milch (Standard)" },
  { value: "lacto", label: "Nur Milch, kein Ei" },
  { value: "ovo", label: "Nur Ei, keine Milch" },
];

/** Stile, für die eine Unterform angeboten wird. */
export const DIETARY_STYLES_WITH_VARIANT: readonly DietaryStyleOption[] = ["vegetarian"];

export function supportsDietaryVariant(style: DietaryStyleOption): boolean {
  return DIETARY_STYLES_WITH_VARIANT.includes(style);
}

export const DIETARY_STRICTNESS_VALUES = ["strict", "flexible", "situational"] as const;

export type DietaryStrictnessOption = (typeof DIETARY_STRICTNESS_VALUES)[number];

export const DIETARY_STRICTNESS_OPTIONS: readonly {
  value: DietaryStrictnessOption;
  label: string;
}[] = [
  { value: "strict", label: "Strikt – keine Ausnahmen" },
  { value: "flexible", label: "Flexibel – kleine Ausnahmen sind möglich" },
  { value: "situational", label: "Situationsabhängig / nach Rücksprache" },
];

export const DEFAULT_STRICTNESS: DietaryStrictnessOption = "flexible";
/** Anzeigetext, wenn der Stil keine Angabe zum Strengegrad braucht. */
export const STRICTNESS_NOT_RELEVANT_LABEL = "Nicht relevant";

/**
 * Altwerte aus der Zeit vor der kuratierten Liste. `none` war gleichbedeutend mit `omnivore` und
 * steht noch in älteren Datensätzen.
 */
const LEGACY_STYLE_ALIASES: Record<string, DietaryStyleOption> = { none: "omnivore" };

export function isStrictnessRelevant(style: DietaryStyleOption): boolean {
  return style !== "omnivore";
}

export const dietaryPreferenceSchema = z
  .object({
    style: z.enum(DIETARY_STYLE_VALUES),
    variant: z.enum(DIETARY_VARIANT_VALUES).optional().nullable(),
    customLabel: z
      .string()
      .max(120, "Die Bezeichnung darf höchstens 120 Zeichen haben.")
      .optional()
      .nullable()
      .transform((value) => value?.trim() || null),
    strictness: z.enum(DIETARY_STRICTNESS_VALUES),
  })
  .superRefine((value, ctx) => {
    if (value.style === "custom" && !value.customLabel) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["customLabel"],
        message: "Bitte gib eine Bezeichnung für deinen individuellen Ernährungsstil an.",
      });
    }
    if (value.variant && !supportsDietaryVariant(value.style)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["variant"],
        message: "Für diesen Stil gibt es keine Unterform.",
      });
    }
  });

export type DietaryPreferenceInput = z.infer<typeof dietaryPreferenceSchema>;

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

export function resolveDietaryVariantLabel(
  style: DietaryStyleOption,
  variant?: DietaryVariantOption | null,
): string | null {
  if (!variant || !supportsDietaryVariant(style)) {
    return null;
  }
  const option = DIETARY_VARIANT_OPTIONS.find((entry) => entry.value === variant);
  return option?.label ?? null;
}

export function resolveDietaryStrictnessLabel(
  style: DietaryStyleOption,
  strictness: DietaryStrictnessOption,
): string {
  if (!isStrictnessRelevant(style)) {
    return STRICTNESS_NOT_RELEVANT_LABEL;
  }
  const option = DIETARY_STRICTNESS_OPTIONS.find((entry) => entry.value === strictness);
  return option?.label ?? DEFAULT_STRICTNESS;
}

export function parseDietaryStyleFromLabel(label: string | null | undefined): {
  style: DietaryStyleOption;
  customLabel: string | null;
} {
  const trimmed = label?.trim();
  if (!trimmed) {
    return { style: "omnivore", customLabel: null };
  }
  const normalized = trimmed.toLowerCase();

  const legacy = LEGACY_STYLE_ALIASES[normalized];
  if (legacy) {
    return { style: legacy, customLabel: null };
  }

  const byLabel = DIETARY_STYLE_OPTIONS.find(
    (option) => option.label.toLowerCase() === normalized && option.value !== "custom",
  );
  if (byLabel) {
    return { style: byLabel.value, customLabel: null };
  }

  // Sicherheitsnetz: manche Stellen haben früher den Wert statt des Labels gespeichert.
  const byValue = DIETARY_STYLE_VALUES.find((value) => value === normalized && value !== "custom");
  if (byValue) {
    return { style: byValue, customLabel: null };
  }

  return { style: "custom", customLabel: trimmed };
}

export function parseDietaryVariantFromLabel(
  label: string | null | undefined,
): DietaryVariantOption | null {
  const trimmed = label?.trim();
  if (!trimmed) {
    return null;
  }
  const normalized = trimmed.toLowerCase();
  const match = DIETARY_VARIANT_OPTIONS.find(
    (option) => option.label.toLowerCase() === normalized || option.value === normalized,
  );
  return match?.value ?? null;
}

export function parseDietaryStrictnessFromLabel(
  label: string | null | undefined,
): DietaryStrictnessOption {
  const trimmed = label?.trim();
  if (!trimmed || trimmed === STRICTNESS_NOT_RELEVANT_LABEL) {
    return DEFAULT_STRICTNESS;
  }
  const normalized = trimmed.toLowerCase();
  const match = DIETARY_STRICTNESS_OPTIONS.find(
    (option) => option.label.toLowerCase() === normalized || option.value === normalized,
  );
  return match?.value ?? DEFAULT_STRICTNESS;
}
