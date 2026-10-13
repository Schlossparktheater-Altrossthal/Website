import type { ScriptBlock, ScriptScene } from "./types";

/** Rollen: Schreibweisen zusammenführen, Abkürzungen auflösen, Tippfehler vorschlagen. */

/** Schreibweisen-unabhängiger Schlüssel: Groß/klein, Akzente, ß/ss, Satzzeichen. */
export function roleKey(name: string): string {
  return name
    .toLocaleLowerCase("de")
    .replace(/ß/g, "ss")
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9/ ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function levenshtein(a: string, b: string): number {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

/** Jaro-Winkler-Ähnlichkeit (0–1); gewichtet gleiche Anfänge, gut für kurze Namen. */
export function jaroWinkler(a: string, b: string): number {
  if (a === b) return 1;
  if (!a.length || !b.length) return 0;
  const range = Math.max(0, Math.floor(Math.max(a.length, b.length) / 2) - 1);
  const matchedA = new Array<boolean>(a.length).fill(false);
  const matchedB = new Array<boolean>(b.length).fill(false);
  let matches = 0;
  for (let i = 0; i < a.length; i++) {
    for (let j = Math.max(0, i - range); j < Math.min(b.length, i + range + 1); j++) {
      if (!matchedB[j] && a[i] === b[j]) {
        matchedA[i] = matchedB[j] = true;
        matches++;
        break;
      }
    }
  }
  if (!matches) return 0;
  let transpositions = 0;
  let k = 0;
  for (let i = 0; i < a.length; i++) {
    if (!matchedA[i]) continue;
    while (!matchedB[k]) k++;
    if (a[i] !== b[k]) transpositions++;
    k++;
  }
  const jaro =
    (matches / a.length + matches / b.length + (matches - transpositions / 2) / matches) / 3;
  let prefix = 0;
  while (prefix < 4 && a[prefix] && a[prefix] === b[prefix]) prefix++;
  return jaro + prefix * 0.1 * (1 - jaro);
}

function countSpeakers(scenes: ScriptScene[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const scene of scenes) {
    for (const block of scene.blocks) {
      if (block.speaker) counts.set(block.speaker, (counts.get(block.speaker) ?? 0) + 1);
    }
  }
  return counts;
}

/** Abkürzung „KINDL. KAISERIN“ passt auf „KINDLICHE KAISERIN“ (Wort mit Punkt = Wortanfang). */
function abbreviates(short: string, long: string): boolean {
  const a = short.toLocaleLowerCase("de").split(/\s+/);
  const b = long.toLocaleLowerCase("de").split(/\s+/);
  return (
    a.length === b.length &&
    a.every((word, i) => (word.endsWith(".") ? b[i].startsWith(word.slice(0, -1)) : word === b[i]))
  );
}

/**
 * Ordnet jeder Schreibweise eine kanonische Rolle zu: die häufigste Schreibweise je `roleKey`,
 * Abkürzungen nur bei eindeutigem Treffer. `aliases` (bereits bestätigte Zuordnungen) haben
 * Vorrang. Ergebnis: Schreibweise → kanonischer Name (nur geänderte Einträge).
 */
export function resolveRoleNames(
  scenes: ScriptScene[],
  aliases: ReadonlyMap<string, string> = new Map(),
): Map<string, string> {
  const counts = countSpeakers(scenes);
  const byFrequency = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name);
  const canonical = new Map<string, string>();
  for (const name of byFrequency) {
    const key = roleKey(name);
    if (!canonical.has(key)) canonical.set(key, aliases.get(key) ?? name);
  }
  for (const name of byFrequency) {
    const key = roleKey(name);
    if (!name.includes(".") || aliases.has(key) || canonical.get(key) !== name) continue;
    const hits = new Set(
      byFrequency
        .filter((other) => other !== name && !other.includes(".") && abbreviates(name, other))
        .map((other) => canonical.get(roleKey(other))!),
    );
    if (hits.size === 1) canonical.set(key, [...hits][0]);
  }
  const result = new Map<string, string>();
  for (const name of byFrequency) {
    const target = canonical.get(roleKey(name))!;
    if (target !== name) result.set(name, target);
  }
  return result;
}

/** Wendet `resolveRoleNames` an; gibt eine Kopie zurück. */
export function normalizeRoles(scenes: ScriptScene[], mapping: ReadonlyMap<string, string>) {
  return scenes.map((scene) => ({
    ...scene,
    blocks: scene.blocks.map((block) =>
      block.speaker && mapping.has(block.speaker)
        ? { ...block, speaker: mapping.get(block.speaker)! }
        : block,
    ),
  }));
}

export type RoleTypoSuspect = {
  name: string;
  count: number;
  similarTo: string;
  levenshtein: number;
  jaroWinkler: number;
};

/** Seltene Namen, die einem häufigeren sehr ähnlich sind – nur Vorschläge zur Prüfung. */
export function findRoleTypos(scenes: ScriptScene[]): RoleTypoSuspect[] {
  const counts = countSpeakers(scenes);
  const names = [...counts.keys()];
  const suspects: RoleTypoSuspect[] = [];
  for (const name of names) {
    for (const other of names) {
      if (other === name || counts.get(other)! <= counts.get(name)!) continue;
      const a = roleKey(name);
      const b = roleKey(other);
      const distance = levenshtein(a, b);
      const similarity = jaroWinkler(a, b);
      if (
        (distance <= Math.max(1, Math.floor(b.length / 6)) && similarity > 0.85) ||
        similarity > 0.93
      ) {
        suspects.push({
          name,
          count: counts.get(name)!,
          similarTo: other,
          levenshtein: distance,
          jaroWinkler: Math.round(similarity * 1000) / 1000,
        });
        break;
      }
    }
  }
  return suspects;
}

/** Gemeinsame Repliken „Atreju/Bastian“, „Urgl und Engywuck“ → einzelne Rollen. */
export function splitSpeakerRoles(speaker: string): string[] {
  return speaker
    .split(/\s*(?:\/|\bund\b|&)\s*/i)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function countWords(block: ScriptBlock): number {
  return block.parts
    .filter((p) => p.kind === "text")
    .reduce((sum, p) => sum + (p.text.match(/[\p{L}\p{N}]+/gu)?.length ?? 0), 0);
}

export type RoleStats = { name: string; lines: number; words: number; scenes: string[] };

export function roleStatistics(scenes: ScriptScene[]): RoleStats[] {
  const stats = new Map<string, RoleStats>();
  for (const scene of scenes) {
    for (const block of scene.blocks) {
      if (!block.speaker) continue;
      const entry = stats.get(block.speaker) ?? {
        name: block.speaker,
        lines: 0,
        words: 0,
        scenes: [],
      };
      entry.lines++;
      entry.words += countWords(block);
      if (!entry.scenes.includes(scene.title)) entry.scenes.push(scene.title);
      stats.set(block.speaker, entry);
    }
  }
  return [...stats.values()].sort((a, b) => b.words - a.words);
}
