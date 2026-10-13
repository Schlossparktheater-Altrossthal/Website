/** Typen und Konstanten der Skript-Notizen ohne Server-Abhängigkeiten (auch für Client-Code). */

import { z } from "zod";

export const ANNOTATION_COLORS = ["gelb", "gruen", "blau", "rosa"] as const;
export type AnnotationColor = (typeof ANNOTATION_COLORS)[number];

export class ScriptAnnotationError extends Error {}

/** Wie eine Notiz zur gerade gelesenen Fassung passt. */
export type AnnotationState =
  /** Absatz unverändert (oder in dieser Fassung angelegt). */
  | "ok"
  /** Absatz in dieser Fassung geändert – Rückfrage, `previousText` zeigt den alten Wortlaut. */
  | "changed"
  /** Absatz gibt es in dieser Fassung nicht mehr – neu zuordnen oder löschen. */
  | "orphaned";

export type ReaderAnnotation = {
  id: string;
  kind: "highlight" | "note" | "ink";
  /** Freihand-Striche (nur kind = ink). */
  strokes: InkStroke[];
  color: AnnotationColor | null;
  body: string | null;
  partIndex: number | null;
  start: number | null;
  end: number | null;
  quote: string | null;
  /** Absatz in der gelesenen Fassung (null bei „orphaned“). */
  blockId: string | null;
  state: AnnotationState;
  previousText: string;
  createdAt: string;
  updatedAt: string;
};

/** Stiftfarben der Freihandnotizen (Schlüssel, Farbe kommt aus src/config/category-colors.ts). */
export const INK_COLORS = ["schwarz", "rot", "blau", "gruen"] as const;
export type InkColor = (typeof INK_COLORS)[number];

/**
 * Ein Strich: Punkte `[x, y, Druck, Neigung]` relativ zum Absatz – x als Anteil der Breite
 * (0–1), y in em ab Oberkante, damit die Zeichnung bei anderer Breite und Schriftgröße mitgeht.
 */
export const inkStrokeSchema = z.object({
  color: z.enum(INK_COLORS),
  /** Grundstärke in em. */
  size: z.number().min(0.02).max(1),
  points: z
    .array(z.tuple([z.number(), z.number(), z.number().min(0).max(1), z.number().min(0).max(90)]))
    .min(1)
    .max(4000),
});
export type InkStroke = z.infer<typeof inkStrokeSchema>;

export const inkSchema = z.object({ strokes: z.array(inkStrokeSchema).max(500) });
