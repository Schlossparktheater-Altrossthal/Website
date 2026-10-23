import { z } from "zod";

import { CUE_CATEGORIES } from "./stats";
import type { CueCategory } from "./types";
import type { ScriptView } from "./view-options";

/**
 * Wählbare Teile des Skript-PDFs (docs/Plan/skript-auswertungen-plan.md, Phase 3/4).
 * Client-sicher: ohne PDF-Engine, damit der Leser sie importieren kann.
 */

export const SCRIPT_PDF_SECTIONS = [
  "script",
  "roleStats",
  "sceneTable",
  "matrix",
  "mirror",
  "cueList",
  "cueScript",
] as const;
export type ScriptPdfSection = (typeof SCRIPT_PDF_SECTIONS)[number];

export const SCRIPT_PDF_SECTION_LABELS: Record<ScriptPdfSection, string> = {
  script: "Skript",
  roleStats: "Rollen in Zahlen",
  sceneTable: "Szenenübersicht",
  matrix: "Auftritte (Rolle × Szene)",
  mirror: "Szenenspiegel",
  cueList: "Technik-Fahrplan",
  cueScript: "Stichwortheft",
};

export const SCENE_TABLE_COLUMNS = [
  "roles",
  "words",
  "passages",
  "pages",
  "duration",
  ...CUE_CATEGORIES,
] as const;
export type SceneTableColumn = (typeof SCENE_TABLE_COLUMNS)[number];

export const SCENE_TABLE_COLUMN_LABELS: Record<SceneTableColumn, string> = {
  roles: "Rollen",
  words: "Wörter",
  passages: "Passagen",
  pages: "Seiten",
  duration: "Dauer",
  ton: "Ton",
  licht: "Licht",
  nebel: "Nebel",
  effekt: "Effekt",
  umbau: "Umbau",
  aus: "Off",
  technik: "Technik",
};

export const DEFAULT_SCENE_COLUMNS: SceneTableColumn[] = [
  "roles",
  "words",
  "passages",
  "duration",
  "ton",
  "licht",
];

export const CUE_LABELS: Record<CueCategory, string> = {
  ton: "Ton",
  licht: "Licht",
  nebel: "Nebel",
  effekt: "Effekt",
  umbau: "Umbau/Choreo",
  aus: "Off-Stimme",
  technik: "Technik",
};

/** Spaltenbreite im Szenenspiegel: gleich breit oder nach Szenendauer. */
export const MIRROR_WIDTHS = ["equal", "duration"] as const;
export type MirrorWidth = (typeof MIRROR_WIDTHS)[number];

export const MATRIX_CELLS = ["mark", "words", "passages"] as const;
export type MatrixCell = (typeof MATRIX_CELLS)[number];

/** Gespeicherte Zusammenstellung (Vorlage) – Abschnitte, Szenenspalten, Matrix-Inhalt. */
export const scriptExportConfigSchema = z.object({
  sections: z.array(z.enum(SCRIPT_PDF_SECTIONS)).min(1).max(SCRIPT_PDF_SECTIONS.length),
  sceneColumns: z.array(z.enum(SCENE_TABLE_COLUMNS)).max(SCENE_TABLE_COLUMNS.length),
  matrixCell: z.enum(MATRIX_CELLS),
  /**
   * Ganze Ansicht (Leser + PDF, docs/Plan/skript-ansicht-plan.md Phase 5). Fehlt sie, ist es eine
   * reine PDF-Vorlage. Wird beim Lesen mit `sanitizeViewPatch` geprüft.
   */
  view: z.record(z.string(), z.unknown()).optional(),
});
export type ScriptExportConfig = Omit<z.infer<typeof scriptExportConfigSchema>, "view"> & {
  view?: Partial<ScriptView>;
};

export type ScriptExportPresetItem = {
  id: string;
  name: string;
  shared: boolean;
  /** Darf die angemeldete Person sie löschen? */
  deletable: boolean;
  config: ScriptExportConfig;
};

/** Kurzname einer Szene für enge Spalten: „SZENE 10 A – Furcht“ → „10A“. */
export function sceneShortLabel(title: string, index: number) {
  const match = /^(?:szene|bild|auftritt)?\s*(\d+)\.?\s*([a-z])?\b/iu.exec(title.trim());
  if (match) return `${match[1]}${(match[2] ?? "").toUpperCase()}`;
  if (/^\(?vorspann\)?$/iu.test(title.trim())) return "V";
  if (/^pause/iu.test(title.trim())) return "P";
  if (/^prolog/iu.test(title.trim())) return "Pr";
  if (/^epilog/iu.test(title.trim())) return "Ep";
  if (/^ende\b/iu.test(title.trim())) return "E";
  return String(index + 1);
}

const SMALL_WORDS = new Set(
  "der die das des dem den ein eine einer eines und oder in im am an auf aus bei beim mit nach von vom zu zum zur über unter vor hinter für durch um".split(
    " ",
  ),
);

/** Wörter in Großbuchstaben lesbar setzen: „IM CLUB IN LONDON“ → „Im Club in London“. */
function readableCase(text: string) {
  let first = true;
  return text.replace(/\p{L}[\p{L}'’]*/gu, (word) => {
    const isFirst = first;
    first = false;
    if (word.length < 2 || word !== word.toLocaleUpperCase("de-DE")) return word;
    const lower = word.toLocaleLowerCase("de-DE");
    if (!isFirst && SMALL_WORDS.has(lower)) return lower;
    return lower.charAt(0).toLocaleUpperCase("de-DE") + lower.slice(1);
  });
}

/**
 * Szenentitel für Tabellen: Kurznummer + Name ohne „1. SZENE:“-Präfix, Großbuchstaben lesbar.
 * „1. SZENE: BEI FOGG ZUHAUSE“ → { short: "1", name: "Bei Fogg Zuhause" }.
 */
export function sceneDisplayTitle(title: string, index: number) {
  const short = sceneShortLabel(title, index);
  const rest = title
    .trim()
    .replace(
      /^(?:\d+\s*\.?\s*(?:[a-z]\b)?\s*)?(?:szene|bild|auftritt)\s*(?:\d+\s*[a-z]?\b)?\.?\s*[:–—-]?\s*/iu,
      "",
    )
    .trim();
  return { short, name: readableCase(rest || title.trim()) };
}
