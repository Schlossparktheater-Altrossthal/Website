/** Typen und Konstanten der Skript-Notizen ohne Server-Abhängigkeiten (auch für Client-Code). */

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
  kind: "highlight" | "note";
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
