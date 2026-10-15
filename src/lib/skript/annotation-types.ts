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

/**
 * Zeichen im Text (docs/Plan/skript-notizen-plan.md, Schritt 3). `point`: sitzt an einer Stelle
 * zwischen Wörtern (Anfang = Ende), sonst gilt es für einen Bereich.
 */
export const SCRIPT_SIGNS = {
  pause: { label: "Pause", short: "Pause", glyph: "/", point: true },
  pause_lang: { label: "Lange Pause", short: "Lang", glyph: "//", point: true },
  atem: { label: "Atmer", short: "Atmer", glyph: "'", point: true },
  zaesur: { label: "Zäsur (Schnitt)", short: "Zäsur", glyph: "‖", point: true },
  betonung: { label: "Betonung", short: "Betonung", glyph: "_", point: false },
  betonung_stark: { label: "Starke Betonung", short: "Stark", glyph: "=", point: false },
  bogen: { label: "Bogen (durchziehen)", short: "Bogen", glyph: "⌒", point: false },
  lauter: { label: "Lauter werden", short: "lauter", glyph: "lauter", point: false },
  leiser: { label: "Leiser werden", short: "leiser", glyph: "leiser", point: false },
  schneller: { label: "Schneller werden", short: "schneller", glyph: "schneller", point: false },
  langsamer: { label: "Langsamer werden", short: "langsamer", glyph: "langsamer", point: false },
  stimmung: { label: "Stimmung", short: "Stimmung", glyph: "…", point: false },
} as const;
export type ScriptSign = keyof typeof SCRIPT_SIGNS;
export const SCRIPT_SIGN_KEYS = Object.keys(SCRIPT_SIGNS) as ScriptSign[];
export const isPointSign = (sign: ScriptSign | null | undefined) =>
  !!sign && SCRIPT_SIGNS[sign].point;

/** Vorschläge für Stimmungen; eigene Begriffe kommen dazu, zuletzt benutzte zuerst. */
export const MOOD_SUGGESTIONS = [
  "leise",
  "flüsternd",
  "laut",
  "wütend",
  "ironisch",
  "zögernd",
  "fröhlich",
  "traurig",
  "ängstlich",
  "drohend",
] as const;

export type ReaderAnnotation = {
  id: string;
  kind: "highlight" | "note" | "ink" | "sign";
  /** Zeichen (nur kind = sign). */
  sign: ScriptSign | null;
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
