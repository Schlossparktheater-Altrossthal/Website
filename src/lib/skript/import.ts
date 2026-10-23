import { extractLines } from "./extract";
import { extractCredits, type ScriptCredit } from "./credits";
import { applyScriptFixes } from "./fixes";
import { frontMatterLines, parseLines, scoreProfile } from "./parse";
import { SCRIPT_PROFILES, type ScriptProfile } from "./profiles";
import { findRoleTypos, normalizeRoles, resolveRoleNames, type RoleTypoSuspect } from "./roles";
import type { ScriptScene } from "./types";

export type ParsedScript = {
  profile: ScriptProfile;
  /** Anteil erkannter Zeilen (0–1); niedrig = Profil passt vermutlich nicht. */
  score: number;
  scenes: ScriptScene[];
  /** Schreibweise → zusammengeführte Rolle. */
  mergedRoles: Map<string, string>;
  roleTypos: RoleTypoSuspect[];
  /** Hinweise ohne Markierung, im Prüfschritt zu bestätigen. */
  uncertainCues: number;
  /** Mitwirkende aus dem Vorspann (Autor, Fassung, Regie …). */
  credits: ScriptCredit[];
  /** Skriptspezifische Korrekturen aus `fixes.ts`: angewendet bzw. nicht mehr gefunden. */
  fixes: { applied: string[]; missed: string[] };
};

/** PDF einlesen: Profil automatisch wählen, parsen, Rollen zusammenführen. */
export async function parseScriptPdf(
  data: Uint8Array,
  options: { profiles?: readonly ScriptProfile[]; aliases?: ReadonlyMap<string, string> } = {},
): Promise<ParsedScript> {
  const profiles = options.profiles ?? SCRIPT_PROFILES;
  let best: {
    profile: ScriptProfile;
    score: number;
    scenes: ScriptScene[];
    credits: ScriptCredit[];
    front: string[];
  } | null = null;
  for (const profile of profiles) {
    // pdfjs übernimmt den Puffer – je Profil eine Kopie übergeben.
    const lines = await extractLines(data.slice(), profile);
    const score = scoreProfile(lines, profile);
    if (!best || score > best.score) {
      const front = frontMatterLines(lines, profile);
      best = {
        profile,
        score,
        scenes: parseLines(lines, profile),
        credits: extractCredits(front),
        front,
      };
    }
  }
  if (!best) throw new Error("Kein Skript-Profil registriert");
  const fixes = applyScriptFixes(best.scenes, best.front);
  const mergedRoles = resolveRoleNames(best.scenes, options.aliases);
  const scenes = normalizeRoles(best.scenes, mergedRoles);
  const { front: _front, ...rest } = best;
  return {
    ...rest,
    fixes,
    scenes,
    mergedRoles,
    roleTypos: findRoleTypos(scenes),
    uncertainCues: scenes
      .flatMap((s) => s.blocks)
      .flatMap((b) => b.parts)
      .filter((p) => p.kind === "cue" && p.auto).length,
  };
}

export function isPdf(data: Uint8Array): boolean {
  // „%PDF-“ am Anfang (Word/Acrobat), manche Werkzeuge setzen ein paar Bytes davor.
  const head = new TextDecoder("latin1").decode(data.slice(0, 1024));
  return head.includes("%PDF-");
}
