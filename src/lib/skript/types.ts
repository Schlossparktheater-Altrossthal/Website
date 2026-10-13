/**
 * Datenstruktur eines eingelesenen Skripts (docs/Plan/skript-plan.md).
 *
 * Ebene 1 (Extraktion) liefert `TextLine`s, Ebene 2 (Parser) `ScriptScene`s mit Absätzen.
 */

/** Benannte Farbe; `null` = Schwarz/keine Farbe. */
export type ColorName = "yellow" | "cyan" | "green" | "magenta" | "red" | "grey" | "other";

/** Gewerk bzw. Art eines technischen Hinweises. */
export type CueCategory = "ton" | "licht" | "nebel" | "effekt" | "umbau" | "aus" | "technik";

export type TextSpan = {
  text: string;
  bold: boolean;
  italic: boolean;
  /** Textfarbe. */
  color: ColorName | null;
  /** Markierung (gefülltes Rechteck hinter dem Text). */
  highlight: ColorName | null;
};

export type TextLine = {
  page: number;
  /** Linke/rechte Kante und Oberkante in PDF-Punkten, y von oben gemessen. */
  x0: number;
  x1: number;
  y: number;
  spans: TextSpan[];
};

export type ScriptPart =
  | { kind: "text"; text: string }
  | { kind: "direction"; text: string }
  | {
      kind: "cue";
      text: string;
      category: CueCategory;
      /** Nur über Stichwörter erkannt, ohne Markierung – im Prüfschritt bestätigen. */
      auto?: boolean;
    };

export type ScriptBlock = {
  kind: "speech" | "direction";
  /** Sprecher wie im PDF geschrieben (Normalisierung erst in `roles.ts`). */
  speaker: string | null;
  parts: ScriptPart[];
  page: number;
};

export type ScriptScene = {
  title: string;
  blocks: ScriptBlock[];
};
