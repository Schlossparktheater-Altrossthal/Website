import { CUE_CATEGORIES } from "./stats";
import type { CueCategory } from "./types";

/**
 * Wählbare Teile des Skript-PDFs (docs/Plan/skript-auswertungen-plan.md, Phase 3/4).
 * Client-sicher: ohne PDF-Engine, damit der Leser sie importieren kann.
 */

export const SCRIPT_PDF_SECTIONS = [
  "script",
  "roleStats",
  "sceneTable",
  "matrix",
  "cueList",
  "cueScript",
] as const;
export type ScriptPdfSection = (typeof SCRIPT_PDF_SECTIONS)[number];

export const SCRIPT_PDF_SECTION_LABELS: Record<ScriptPdfSection, string> = {
  script: "Skript",
  roleStats: "Rollen in Zahlen",
  sceneTable: "Szenenübersicht",
  matrix: "Auftritte (Rolle × Szene)",
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
  duration: "Sprechzeit",
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
