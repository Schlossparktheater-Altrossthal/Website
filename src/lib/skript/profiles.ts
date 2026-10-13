import type { ColorName, CueCategory } from "./types";

/**
 * Formatprofil: beschreibt, wie ein Skript formatiert ist. Neue Formate bekommen ein neues
 * Profil oder überschreiben einzelne Werte pro Stück – der Parser bleibt gleich.
 */
export type ScriptProfile = {
  id: string;
  name: string;
  /** Szenen-/Teil-Überschriften (Zeile komplett fett). */
  sceneRe: RegExp;
  /** Markierungsfarbe → Gewerk. */
  highlights: Partial<Record<ColorName, CueCategory>>;
  /** Textfarbe → Kategorie; `umbau` wird Hinweis, `aus` bleibt Text/Regie mit Kennzeichnung. */
  textColors: Partial<Record<ColorName, CueCategory>>;
  /** Großgeschriebene Stichwörter für unmarkierte Hinweise im Text. */
  cueKeywords: Record<string, CueCategory>;
  /** Wörter, nach denen ein unmarkierter Hinweis endet („läuft aus“). */
  cueEndWords: ReadonlySet<string>;
  cueMaxTailWords: number;
  speakerMaxLength: number;
  /** Seitenzahl-Zone: unterer Anteil der Seitenhöhe. */
  pageNumberZone: number;
};

export const BOLD_COLON_PROFILE: ScriptProfile = {
  id: "bold-colon",
  name: "Rolle fett mit Doppelpunkt, Regie kursiv",
  sceneRe: /^(SZENE|BILD|AKT|\d+\.\s*TEIL|PAUSE)\b/i,
  highlights: { yellow: "ton", cyan: "licht", green: "nebel", magenta: "effekt" },
  textColors: { red: "umbau", grey: "aus" },
  cueKeywords: {
    TON: "ton",
    MUSIK: "ton",
    LICHT: "licht",
    BEL: "licht",
    BELWECHSEL: "licht",
    NEBEL: "nebel",
    HAZER: "nebel",
  },
  cueEndWords: new Set(["aus", "an", "ein", "ab", "zu", "auf", "weg"]),
  cueMaxTailWords: 5,
  speakerMaxLength: 40,
  pageNumberZone: 0.09,
};

export const SCRIPT_PROFILES: readonly ScriptProfile[] = [BOLD_COLON_PROFILE];

export function findScriptProfile(id: string): ScriptProfile | undefined {
  return SCRIPT_PROFILES.find((profile) => profile.id === id);
}
