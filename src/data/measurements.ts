import { z } from "zod";

export const measurementTypeEnum = z.enum([
  "HEIGHT",
  "CHEST",
  "WAIST",
  "HIPS",
  "INSEAM",
  "SHOULDER",
  "SLEEVE",
  "SHOE_SIZE",
  "HEAD",
] as const);

export const measurementUnitEnum = z.enum([
  "CM",
  "INCH",
  "EU",
  "DE",
] as const);

const measurementNoteSchema = z.string().max(500, "Notizen dürfen höchstens 500 Zeichen haben.");

export const measurementSchema = z.object({
  type: measurementTypeEnum,
  value: z.number().min(0, "Der Wert muss positiv sein."),
  unit: measurementUnitEnum,
  note: measurementNoteSchema.optional(),
});

export const measurementResponseSchema = measurementSchema.extend({
  id: z.string(),
  userId: z.string().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  note: measurementNoteSchema.nullish(),
});

export type MeasurementType = z.infer<typeof measurementTypeEnum>;
export type MeasurementUnit = z.infer<typeof measurementUnitEnum>;
export type MeasurementFormData = z.infer<typeof measurementSchema>;

export const MEASUREMENT_TYPE_LABELS: Record<MeasurementType, string> = {
  HEIGHT: "Körpergröße",
  CHEST: "Brustumfang",
  WAIST: "Taillenumfang",
  HIPS: "Hüftumfang",
  INSEAM: "Innenbeinlänge",
  SHOULDER: "Schulterbreite",
  SLEEVE: "Armlänge",
  SHOE_SIZE: "Schuhgröße",
  HEAD: "Kopfumfang",
};

export const MEASUREMENT_TYPE_DESCRIPTIONS: Record<MeasurementType, string> = {
  HEIGHT:
    "Gemessen von der Oberseite des Kopfes bis zur Fußsohle – wichtig für den generellen Fit.",
  CHEST:
    "Horizontale Messung über die breiteste Stelle der Brust – entscheidend für Jacken und Oberteile.",
  WAIST:
    "Rund um die schmalste Stelle des Rumpfs auf Höhe des Bauchnabels gemessen.",
  HIPS:
    "Über die stärkste Stelle des Gesäßes geführt, sorgt diese Messung für eine passende Hüftweite.",
  INSEAM:
    "Vom Schritt bis zum Boden entlang der Beininnenseite gemessen – essenziell für Hosenlängen.",
  SHOULDER:
    "Von Schulterpunkt zu Schulterpunkt über den Rücken gemessen, definiert die Breite von Oberteilen.",
  SLEEVE:
    "Vom Schulterpunkt entlang des Arms bis zum Handgelenk – bestimmt die Ärmellänge.",
  SHOE_SIZE:
    "Innere Länge des Schuhs bzw. Fußlänge für das korrekte Schuhmaß.",
  HEAD:
    "Horizontal über Stirn und Hinterkopf geführt – Grundlage für Hüte und Kopfbedeckungen.",
};

export const MEASUREMENT_UNIT_LABELS: Record<MeasurementUnit, string> = {
  CM: "cm",
  INCH: "Zoll",
  EU: "EU",
  DE: "DE",
};

export const MEASUREMENT_TYPE_ORDER = measurementTypeEnum.options.reduce<
  Record<MeasurementType, number>
>((acc, type, index) => {
  acc[type] = index;
  return acc;
}, {} as Record<MeasurementType, number>);

export function sortMeasurements<T extends { type: MeasurementType }>(
  measurements: T[],
) {
  return [...measurements].sort((a, b) => {
    const orderA = MEASUREMENT_TYPE_ORDER[a.type] ?? 0;
    const orderB = MEASUREMENT_TYPE_ORDER[b.type] ?? 0;
    if (orderA !== orderB) return orderA - orderB;
    return 0;
  });
}
