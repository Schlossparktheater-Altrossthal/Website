import { z } from "zod";

import {
  DEFAULT_SCENE_COLUMNS,
  MATRIX_CELLS,
  SCENE_TABLE_COLUMNS,
  SCRIPT_PDF_SECTIONS,
} from "./export-options";
import { DEFAULT_SCENE_HEADER, sceneHeaderConfigSchema } from "./scene-header";
import { CUE_CATEGORIES } from "./stats";
import type { CueCategory } from "./types";

/**
 * „Ansicht“ des Skripts (docs/Plan/skript-ansicht-plan.md, Phase 5): legt fest, WAS Leser und PDF
 * zeigen. Geräteeinstellungen (Bildschirm anlassen, Probenmodus) gehören nicht dazu, die eigenen
 * Rollen nur zum persönlichen Stand, nicht zu geteilten Ansichten. Client-sicher.
 */

const cue = z.enum(CUE_CATEGORIES as [CueCategory, ...CueCategory[]]);

export const scriptViewSchema = z.object({
  fontSize: z.number().int().min(0).max(3),
  directions: z.enum(["show", "dim", "hide"]),
  cueLayout: z.enum(["below", "inline"]),
  hiddenCues: z.array(cue).max(CUE_CATEGORIES.length),
  followedCues: z.array(cue).max(CUE_CATEGORIES.length),
  dimOthers: z.boolean(),
  showNotes: z.boolean(),
  sceneHeader: sceneHeaderConfigSchema,
  pdfCover: z.boolean(),
  pdfSections: z.array(z.enum(SCRIPT_PDF_SECTIONS)).min(1).max(SCRIPT_PDF_SECTIONS.length),
  pdfSceneColumns: z.array(z.enum(SCENE_TABLE_COLUMNS)).max(SCENE_TABLE_COLUMNS.length),
  pdfMatrixCell: z.enum(MATRIX_CELLS),
  pdfSceneHeader: z.boolean(),
  pdfNotes: z.boolean(),
});
export type ScriptView = z.infer<typeof scriptViewSchema>;
export const SCRIPT_VIEW_KEYS = Object.keys(scriptViewSchema.shape) as (keyof ScriptView)[];

export const DEFAULT_SCRIPT_VIEW: ScriptView = {
  fontSize: 0,
  directions: "show",
  cueLayout: "below",
  hiddenCues: [],
  followedCues: [],
  dimOthers: false,
  showNotes: true,
  sceneHeader: DEFAULT_SCENE_HEADER,
  pdfCover: true,
  pdfSections: ["script"],
  pdfSceneColumns: DEFAULT_SCENE_COLUMNS,
  pdfMatrixCell: "mark",
  pdfSceneHeader: true,
  pdfNotes: true,
};

/** Teil-Ansicht robust lesen: ungültige oder unbekannte Felder fallen weg. */
export function sanitizeViewPatch(value: unknown): Partial<ScriptView> {
  if (!value || typeof value !== "object") return {};
  const result: Partial<ScriptView> = {};
  for (const key of SCRIPT_VIEW_KEYS) {
    const raw = (value as Record<string, unknown>)[key];
    if (raw === undefined) continue;
    const parsed = scriptViewSchema.shape[key].safeParse(raw);
    if (parsed.success) (result as Record<string, unknown>)[key] = parsed.data;
  }
  return result;
}

/** Nur die Ansicht-Felder aus allen Leser-Einstellungen. */
export function pickView(settings: ScriptView & Record<string, unknown>): ScriptView {
  return Object.fromEntries(SCRIPT_VIEW_KEYS.map((key) => [key, settings[key]])) as ScriptView;
}

/** Persönlicher Stand auf dem Server: Ansicht + eigene Rollen + Zeitpunkt (neuester gewinnt). */
export const readerStateSchema = z.object({
  view: z.unknown(),
  roleIds: z.array(z.string().min(1).max(64)).max(50),
  savedAt: z.number().int().nonnegative(),
});
export type ReaderState = { view: Partial<ScriptView>; roleIds: string[]; savedAt: number };

export type BuiltInView = { id: string; label: string; hint: string; view: Partial<ScriptView> };

/** Fertige Ansichten – Startpunkte, die man danach weiter anpassen kann. */
export const BUILT_IN_VIEWS: BuiltInView[] = [
  {
    id: "darsteller",
    label: "Darsteller",
    hint: "Eigener Text hervorgehoben, Kopf mit Mein Teil",
    view: {
      directions: "show",
      dimOthers: false,
      hiddenCues: ["ton", "licht", "nebel", "effekt", "technik"],
      sceneHeader: { mode: "compact", items: ["roles", "mine", "transition"], onlyMine: false },
      pdfSections: ["script"],
    },
  },
  {
    id: "regie",
    label: "Regie",
    hint: "Alles sichtbar, Kopf aufgeklappt, Notizen",
    view: {
      directions: "show",
      dimOthers: false,
      hiddenCues: [],
      showNotes: true,
      sceneHeader: {
        mode: "card",
        items: ["roles", "duration", "size", "cues", "transition", "notes"],
        onlyMine: false,
      },
      pdfSections: ["roleStats", "sceneTable", "matrix", "script"],
    },
  },
  {
    id: "technik",
    label: "Ton/Licht",
    hint: "Regie abgeblendet, Hinweise im Text, Kopf nur Technik",
    view: {
      directions: "dim",
      cueLayout: "inline",
      hiddenCues: [],
      sceneHeader: { mode: "card", items: ["cues", "duration"], onlyMine: false },
      pdfSections: ["cueList", "script"],
    },
  },
  {
    id: "souffleuse",
    label: "Souffleuse",
    hint: "Große Schrift, ohne Regie und Technik",
    view: {
      fontSize: 3,
      directions: "hide",
      hiddenCues: [...CUE_CATEGORIES],
      dimOthers: false,
      sceneHeader: { mode: "compact", items: ["roles"], onlyMine: false },
      pdfSections: ["script"],
    },
  },
  {
    id: "buehne",
    label: "Requisite/Bühne",
    hint: "Umbau und Effekte, wer auf der Bühne ist",
    view: {
      directions: "show",
      hiddenCues: ["ton", "licht", "aus"],
      sceneHeader: { mode: "card", items: ["roles", "cues", "transition"], onlyMine: false },
      pdfSections: ["sceneTable", "script"],
      pdfSceneColumns: ["roles", "umbau", "effekt", "nebel"],
    },
  },
];

/** Stimmt die aktuelle Einstellung mit einer (Teil-)Ansicht überein? */
export function matchesView(current: ScriptView, view: Partial<ScriptView>) {
  return (Object.keys(view) as (keyof ScriptView)[]).every(
    (key) => JSON.stringify(current[key]) === JSON.stringify(view[key]),
  );
}
