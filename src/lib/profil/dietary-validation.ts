import { AllergyLevel, RestrictionKind } from "@prisma/client";
import { z } from "zod";

/**
 * Serverseitige Schemata für Ernährungsangaben. Sie liegen außerhalb von `app/`, damit sie
 * sowohl aus API-Routen als auch aus Client-Komponenten verwendet werden können, ohne die
 * `"use server"`-Regel von Turbopack zu berühren.
 */

/** Leere Zeichenketten und reine Leerzeichen gelten als „nicht angegeben". */
function optionalText(max: number, message: string) {
  return z
    .string()
    .trim()
    .max(max, message)
    .optional()
    .nullable()
    .transform((value) => (value ? value : null));
}

export const allergyInputSchema = z.object({
  allergen: z
    .string()
    .trim()
    .min(2, "Bitte gib ein Allergen an.")
    .max(160, "Das Allergen darf höchstens 160 Zeichen haben."),
  kind: z.nativeEnum(RestrictionKind).default(RestrictionKind.ALLERGY),
  level: z.nativeEnum(AllergyLevel),
  /** `null` heißt „nicht angegeben" – die Küche behandelt das als ungeklärt. */
  tracesOk: z
    .boolean()
    .nullish()
    .transform((value) => value ?? null),
  diagnosed: z.boolean().default(false),
  symptoms: optionalText(500, "Die Symptome dürfen höchstens 500 Zeichen haben."),
  treatment: optionalText(500, "Die Notfallhilfe darf höchstens 500 Zeichen haben."),
  note: optionalText(500, "Die Notiz darf höchstens 500 Zeichen haben."),
});

export type AllergyInput = z.infer<typeof allergyInputSchema>;

export const aversionInputSchema = z.object({
  label: z
    .string()
    .trim()
    .min(2, "Bitte gib eine Besonderheit an.")
    .max(120, "Die Besonderheit darf höchstens 120 Zeichen haben."),
  note: optionalText(500, "Die Notiz darf höchstens 500 Zeichen haben."),
});

export type AversionInput = z.infer<typeof aversionInputSchema>;

/** Erste Meldung aus einem fehlgeschlagenen `safeParse`. */
export function firstIssueMessage(error: { issues: readonly { message?: string | undefined }[] }) {
  return error.issues[0]?.message ?? "Ungültige Eingaben.";
}
