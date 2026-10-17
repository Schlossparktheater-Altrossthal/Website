import { z } from "zod";

import {
  computeScriptStats,
  cueScript,
  CUE_CATEGORIES,
  type CueEntry,
  type Duration,
  type ScriptStats,
  type StatsInput,
} from "./stats";
import type { CueCategory } from "./types";

/**
 * Szenenkopf: kompakte Übersicht am Beginn jeder Szene (docs/Plan/skript-ansicht-plan.md).
 * Die Ansicht legt fest, WAS gezeigt wird; Leser und PDF stellen es je Medium eigen dar.
 * Rein und client-sicher – Leser und PDF bauen den Kopf aus demselben Modell.
 */

export const SCENE_HEADER_ITEMS = [
  "roles",
  "mine",
  "duration",
  "size",
  "cues",
  "transition",
  "notes",
] as const;
export type SceneHeaderItem = (typeof SCENE_HEADER_ITEMS)[number];

export const SCENE_HEADER_ITEM_LABELS: Record<SceneHeaderItem, string> = {
  roles: "Wer wird gebraucht",
  mine: "Mein Teil",
  duration: "Dauer",
  size: "Umfang",
  cues: "Technik",
  transition: "Aus der Szene davor",
  notes: "Meine Notizen",
};

export const SCENE_HEADER_ITEM_HINTS: Record<SceneHeaderItem, string> = {
  roles: "Sprechende Rollen, dazu nur in der Regie genannte",
  mine: "Eigene Repliken und das erste Stichwort",
  duration: "Gemessen, sonst geschätzte Sprechzeit",
  size: "Seiten, Wörter, Passagen",
  cues: "Ton, Licht … nummeriert – nur sichtbare Gewerke",
  transition: "Wer direkt aus der vorigen Szene weiterspielt",
  notes: "Anzahl eigener Notizen in der Szene (nur im Leser)",
};

export const SCENE_HEADER_MODES = ["off", "compact", "card"] as const;
export type SceneHeaderMode = (typeof SCENE_HEADER_MODES)[number];

export const DEFAULT_SCENE_HEADER_ITEMS: SceneHeaderItem[] = ["roles", "mine", "duration", "cues"];

export const sceneHeaderConfigSchema = z.object({
  mode: z.enum(SCENE_HEADER_MODES).default("compact"),
  items: z
    .array(z.enum(SCENE_HEADER_ITEMS))
    .max(SCENE_HEADER_ITEMS.length)
    .default(DEFAULT_SCENE_HEADER_ITEMS)
    .transform((list) => [...new Set(list)]),
  /** Kopf nur in Szenen, in denen eine der gewählten Rollen spricht. */
  onlyMine: z.boolean().default(false),
});
export type SceneHeaderConfig = z.infer<typeof sceneHeaderConfigSchema>;

export const DEFAULT_SCENE_HEADER: SceneHeaderConfig = {
  mode: "compact",
  items: DEFAULT_SCENE_HEADER_ITEMS,
  onlyMine: false,
};

/** Gespeicherte/übergebene Werte robust lesen (alte localStorage-Stände, URL-Parameter). */
export function sanitizeSceneHeader(value: unknown): SceneHeaderConfig {
  const parsed = sceneHeaderConfigSchema.safeParse(value ?? {});
  return parsed.success ? parsed.data : DEFAULT_SCENE_HEADER;
}

export type SceneHeaderModel = {
  sceneId: string;
  roles: { speaking: { id: string; words: number; mine: boolean }[]; mentioned: string[] } | null;
  mine: { words: number; passages: number; cueSpeaker: string | null; cue: string } | null;
  duration: Duration | null;
  size: { pages: { from: number; to: number } | null; words: number; passages: number } | null;
  cues: { category: CueCategory; entries: CueEntry[] }[] | null;
  transition: { continuing: string[] } | null;
  notes: number | null;
};

export type SceneHeaderOptions = {
  items: readonly SceneHeaderItem[];
  roleIds: readonly string[];
  hiddenCues: readonly string[];
  /** Eigene Notizen je Szene (nur Leser). */
  noteCounts?: ReadonlyMap<string, number>;
};

/** Köpfe aller Szenen; `null`, wo nichts anzuzeigen ist. */
export function buildSceneHeaders(
  input: StatsInput,
  options: SceneHeaderOptions,
  stats: ScriptStats = computeScriptStats(input),
): Map<string, SceneHeaderModel | null> {
  const items = new Set(options.items);
  const own = new Set(options.roleIds);
  const hidden = new Set(options.hiddenCues);
  const firstCue = new Map<string, { cueSpeaker: string | null; cue: string }>();
  if (items.has("mine") && own.size) {
    for (const line of cueScript(input, options.roleIds)) {
      if (!firstCue.has(line.sceneId)) firstCue.set(line.sceneId, line);
    }
  }
  const result = new Map<string, SceneHeaderModel | null>();
  stats.scenes.forEach((scene, index) => {
    const previous = index > 0 ? stats.scenes[index - 1] : null;
    const mineRoles = scene.roles.filter((role) => own.has(role.id));
    const model: SceneHeaderModel = {
      sceneId: scene.id,
      roles:
        items.has("roles") && (scene.roles.length || scene.mentionedRoleIds.length)
          ? {
              speaking: scene.roles.map((role) => ({
                id: role.id,
                words: role.words,
                mine: own.has(role.id),
              })),
              mentioned: scene.mentionedRoleIds,
            }
          : null,
      mine:
        items.has("mine") && mineRoles.length
          ? {
              // Gemeinsame Repliken mehrerer eigener Rollen nicht doppelt zählen.
              words: Math.max(...mineRoles.map((role) => role.words)),
              passages: Math.max(...mineRoles.map((role) => role.passages)),
              cueSpeaker: firstCue.get(scene.id)?.cueSpeaker ?? null,
              cue: firstCue.get(scene.id)?.cue ?? "",
            }
          : null,
      duration: items.has("duration") && scene.duration.seconds > 0 ? scene.duration : null,
      size:
        items.has("size") && (scene.words || scene.pages)
          ? { pages: scene.pages, words: scene.words, passages: scene.passages }
          : null,
      cues: items.has("cues")
        ? CUE_CATEGORIES.filter(
            (category) => !hidden.has(category) && scene.cues[category].length,
          ).map((category) => ({ category, entries: scene.cues[category] }))
        : null,
      transition: null,
      notes: items.has("notes") ? (options.noteCounts?.get(scene.id) ?? 0) || null : null,
    };
    if (model.cues && !model.cues.length) model.cues = null;
    if (items.has("transition") && previous) {
      const before = new Set(previous.roles.map((role) => role.id));
      const continuing = scene.roles.filter((role) => before.has(role.id)).map((role) => role.id);
      if (continuing.length) model.transition = { continuing };
    }
    const empty =
      !model.roles &&
      !model.mine &&
      !model.duration &&
      !model.size &&
      !model.cues &&
      !model.transition &&
      !model.notes;
    result.set(scene.id, empty ? null : model);
  });
  return result;
}

/** „S. 4–6“ */
export function formatPages(pages: { from: number; to: number } | null) {
  if (!pages) return "";
  return pages.from === pages.to ? `S. ${pages.from}` : `S. ${pages.from}–${pages.to}`;
}

/** Hinweisnummern kompakt: „L3–L5“, „T2“, „L3, L7“. */
export function formatCueNumbers(category: CueCategory, entries: readonly CueEntry[]) {
  const prefix = CUE_PREFIX[category];
  if (!entries.length) return "";
  const numbers = entries.map((entry) => entry.number);
  const consecutive = numbers.every((n, i) => i === 0 || n === numbers[i - 1] + 1);
  if (numbers.length === 1) return `${prefix}${numbers[0]}`;
  if (consecutive) return `${prefix}${numbers[0]}–${prefix}${numbers[numbers.length - 1]}`;
  return numbers.map((n) => `${prefix}${n}`).join(", ");
}

/** Kürzel vor der Hinweisnummer (Pult-Sprache). */
export const CUE_PREFIX: Record<CueCategory, string> = {
  ton: "T",
  licht: "L",
  nebel: "N",
  effekt: "E",
  umbau: "U",
  aus: "O",
  technik: "X",
};

/**
 * Bringt der Hinweis seine eigene Nummer aus dem Skript mit („LICHT 4 Abendrot“)? Dann keine
 * zweite, automatische Nummer davor – die des Skripts gilt.
 */
export function hasOwnCueNumber(text: string) {
  return /^\p{L}+\.?\s*\d+/u.test(text.trim());
}

/** Kürzel + laufende Nummer, außer der Hinweis bringt seine eigene mit. */
export function cueTag(category: CueCategory, entry: Pick<CueEntry, "number" | "text">) {
  return hasOwnCueNumber(entry.text) ? null : `${CUE_PREFIX[category]}${entry.number}`;
}
