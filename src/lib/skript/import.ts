import { extractLines } from "./extract";
import { parseLines, scoreProfile } from "./parse";
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
};

/** PDF einlesen: Profil automatisch wählen, parsen, Rollen zusammenführen. */
export async function parseScriptPdf(
  data: Uint8Array,
  options: { profiles?: readonly ScriptProfile[]; aliases?: ReadonlyMap<string, string> } = {},
): Promise<ParsedScript> {
  const profiles = options.profiles ?? SCRIPT_PROFILES;
  let best: { profile: ScriptProfile; score: number; scenes: ScriptScene[] } | null = null;
  for (const profile of profiles) {
    // pdfjs übernimmt den Puffer – je Profil eine Kopie übergeben.
    const lines = await extractLines(data.slice(), profile);
    const score = scoreProfile(lines, profile);
    if (!best || score > best.score) best = { profile, score, scenes: parseLines(lines, profile) };
  }
  if (!best) throw new Error("Kein Skript-Profil registriert");
  const mergedRoles = resolveRoleNames(best.scenes, options.aliases);
  const scenes = normalizeRoles(best.scenes, mergedRoles);
  return {
    ...best,
    scenes,
    mergedRoles,
    roleTypos: findRoleTypos(scenes),
    uncertainCues: scenes
      .flatMap((s) => s.blocks)
      .flatMap((b) => b.parts)
      .filter((p) => p.kind === "cue" && p.auto).length,
  };
}
