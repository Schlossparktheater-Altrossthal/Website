import type { ScriptScene } from "./types";

/**
 * Korrekturen für Fehler einzelner Skripte, die der Parser nicht allgemein erkennen kann
 * (fehlender Rollenname, doppelte Szenennummer, Tippfehler im PDF). Sie greifen automatisch
 * bei jedem Einlesen, solange der Vorspann auf `match` passt. Eine Korrektur, die nichts mehr
 * findet (neue Fassung hat den Fehler behoben), wird übersprungen und in `missed` gemeldet.
 */
export type ScriptFix =
  /** Ab dem Text, der mit `startsWith` beginnt, spricht `speaker` (Rest wird eigene Replik). */
  | { kind: "speaker"; startsWith: string; speaker: string }
  /** Szenentitel ersetzen; `nth` = welches Vorkommen (0-basiert), sonst alle. */
  | { kind: "scene"; title: string; to: string; nth?: number }
  /** Text in Teilen ersetzen. */
  | { kind: "text"; from: string; to: string };

export type ScriptFixSet = { name: string; match: RegExp; fixes: ScriptFix[] };

export const SCRIPT_FIXES: readonly ScriptFixSet[] = [
  {
    name: "In 80 Tagen um die Welt",
    match: /In 80 Tagen um die Welt/i,
    fixes: [
      { kind: "speaker", startsWith: "Meinen Dank, Passepartout", speaker: "Fogg" },
      {
        kind: "scene",
        title: "20. SZENE: IM HAFEN VON NEW YORK",
        to: "20.A SZENE: IM HAFEN VON NEW YORK",
      },
      {
        kind: "scene",
        title: "20. SZENE: AN DECK DER HENRIETTE VON NEW YORK NACH ENGLAND",
        to: "20.B SZENE: AN DECK DER HENRIETTE VON NEW YORK NACH ENGLAND",
      },
      { kind: "text", from: "What a wonderful worldkom", to: "What a wonderful world" },
      // Strophengrenze fällt auf den Seitenumbruch (S. 44/45)
      {
        kind: "text",
        from: "What a wonderful world\nI see skies of blue",
        to: "What a wonderful world\n\nI see skies of blue",
      },
    ],
  },
];

function describe(fix: ScriptFix): string {
  if (fix.kind === "speaker") return `Rolle ${fix.speaker} ab „${fix.startsWith}“`;
  if (fix.kind === "scene") return `Szene „${fix.title}“ → „${fix.to}“`;
  return `Text „${fix.from}“ → „${fix.to}“`;
}

function applyFix(scenes: ScriptScene[], fix: ScriptFix): boolean {
  if (fix.kind === "scene") {
    const hits = scenes.filter((s) => s.title === fix.title);
    const targets = fix.nth === undefined ? hits : hits.slice(fix.nth, fix.nth + 1);
    for (const scene of targets) scene.title = fix.to;
    return targets.length > 0;
  }
  if (fix.kind === "text") {
    let hit = false;
    for (const part of scenes.flatMap((s) => s.blocks).flatMap((b) => b.parts)) {
      if (!part.text.includes(fix.from)) continue;
      part.text = part.text.split(fix.from).join(fix.to);
      hit = true;
    }
    return hit;
  }
  for (const scene of scenes) {
    for (let b = 0; b < scene.blocks.length; b++) {
      const block = scene.blocks[b];
      const p = block.parts.findIndex((part) => part.text.startsWith(fix.startsWith));
      if (p < 0) continue;
      const speech = {
        kind: "speech" as const,
        speaker: fix.speaker,
        parts: block.parts.slice(p),
        page: block.page,
      };
      if (p === 0) scene.blocks[b] = speech;
      else {
        block.parts = block.parts.slice(0, p);
        scene.blocks.splice(b + 1, 0, speech);
      }
      return true;
    }
  }
  return false;
}

/** Passende Korrekturen anwenden (ändert `scenes`). */
export function applyScriptFixes(
  scenes: ScriptScene[],
  frontMatter: string[],
  sets: readonly ScriptFixSet[] = SCRIPT_FIXES,
): { applied: string[]; missed: string[] } {
  const head = frontMatter.slice(0, 10).join("\n");
  const applied: string[] = [];
  const missed: string[] = [];
  for (const set of sets) {
    if (!set.match.test(head)) continue;
    for (const fix of set.fixes) (applyFix(scenes, fix) ? applied : missed).push(describe(fix));
  }
  return { applied, missed };
}
