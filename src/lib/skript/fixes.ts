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
  /**
   * Text in Teilen ersetzen. Mit `speakers` nur im gesprochenen Text dieser Rollen (Namen wie im
   * PDF), mit `word` nur als ganzes Wort.
   */
  | { kind: "text"; from: string; to: string; speakers?: readonly string[]; word?: boolean }
  /** Rolle umbenennen (gleiche Figur, andere Schreibweise). */
  | { kind: "role"; from: string; to: string }
  /** Fetter Name war keine Rolle, sondern Teil einer Regieanweisung („Fogg und der Kapitän treten auf“). */
  | { kind: "direction"; speaker: string };

export type ScriptFixSet = { name: string; match: RegExp; fixes: ScriptFix[] };

/** Rollen in „In 80 Tagen um die Welt“, die Briten sind (Schreibweisen wie im PDF). */
const BRITEN_80_TAGE = [
  "Fogg",
  "Fix",
  "Stuart",
  "Honeysuckle",
  "Bankdirektor Humphrey Honeysuckle",
  "Earl Grey",
  "Earl of Earl Grey",
  "Sotheby",
  "Sothebys",
  "Fairbanks",
  "Sergeant Mayer",
  "Sir Elton",
  "Kapitän",
  "Kapitän der Mongolia",
  "Kapitän der Rangun",
];

/** Briten sprechen englisch an: Madame/Mademoiselle → Miss, Monsieur → Mister. */
const ANREDE_BRITEN: ScriptFix[] = [
  ["Madame", "Miss"],
  ["Mademoiselle", "Miss"],
  ["Monsieur", "Mister"],
].map(([from, to]) => ({ kind: "text", from, to, speakers: BRITEN_80_TAGE, word: true }));

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
      { kind: "role", from: "Earl Grey", to: "Earl of Earl Grey" },
      { kind: "role", from: "Bankdirektor Humphrey Honeysuckle", to: "Honeysuckle" },
      { kind: "role", from: "Passpartout", to: "Passepartout" },
      { kind: "role", from: "Sothebys", to: "Sotheby" },
      { kind: "role", from: "Prinzessin", to: "Aouda" },
      // S. 11/12 an Deck der Mongolia
      { kind: "role", from: "Kapitän", to: "Kapitän der Mongolia" },
      { kind: "direction", speaker: "Fogg und der Kapitän" },
      // Strophengrenze fällt auf den Seitenumbruch (S. 44/45)
      {
        kind: "text",
        from: "What a wonderful world\nI see skies of blue",
        to: "What a wonderful world\n\nI see skies of blue",
      },
      ...ANREDE_BRITEN,
    ],
  },
];

function describe(fix: ScriptFix): string {
  if (fix.kind === "speaker") return `Rolle ${fix.speaker} ab „${fix.startsWith}“`;
  if (fix.kind === "role") return `Rolle „${fix.from}“ → „${fix.to}“`;
  if (fix.kind === "direction") return `„${fix.speaker}“ ist Regie`;
  if (fix.kind === "scene") return `Szene „${fix.title}“ → „${fix.to}“`;
  return `Text „${fix.from}“ → „${fix.to}“${fix.speakers ? " (Briten)" : ""}`;
}

function applyFix(scenes: ScriptScene[], fix: ScriptFix): boolean {
  if (fix.kind === "scene") {
    const hits = scenes.filter((s) => s.title === fix.title);
    const targets = fix.nth === undefined ? hits : hits.slice(fix.nth, fix.nth + 1);
    for (const scene of targets) scene.title = fix.to;
    return targets.length > 0;
  }
  if (fix.kind === "role" || fix.kind === "direction") {
    const name = fix.kind === "role" ? fix.from : fix.speaker;
    const blocks = scenes.flatMap((s) => s.blocks).filter((b) => b.speaker === name);
    for (const block of blocks) {
      if (fix.kind === "role") {
        block.speaker = fix.to;
      } else {
        block.kind = "direction";
        block.speaker = null;
        const [first, ...rest] = block.parts;
        block.parts =
          first?.kind === "direction"
            ? [{ kind: "direction", text: `${name} ${first.text}` }, ...rest]
            : [{ kind: "direction", text: name }, ...block.parts];
      }
    }
    return blocks.length > 0;
  }
  if (fix.kind === "text") {
    let hit = false;
    const speakers = fix.speakers && new Set(fix.speakers);
    const pattern = fix.word
      ? new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(fix.from)}(?![\\p{L}\\p{N}])`, "gu")
      : null;
    for (const block of scenes.flatMap((s) => s.blocks)) {
      if (speakers && !(block.speaker && speakers.has(block.speaker))) continue;
      for (const part of block.parts) {
        // Mit Rollen nur Gesprochenes, nicht Regie/Hinweise.
        if (speakers && part.kind !== "text") continue;
        const next = pattern
          ? part.text.replace(pattern, fix.to)
          : part.text.split(fix.from).join(fix.to);
        if (next === part.text) continue;
        part.text = next;
        hit = true;
      }
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

function escapeRegExp(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Passende Korrekturen anwenden (ändert `scenes`). `showTitle` (Titel der Produktion) zählt mit,
 * damit auch einzeln geschickte Szenen ohne Titelseite erkannt werden.
 */
export function applyScriptFixes(
  scenes: ScriptScene[],
  frontMatter: string[],
  sets: readonly ScriptFixSet[] = SCRIPT_FIXES,
  showTitle?: string | null,
): { applied: string[]; missed: string[] } {
  const head = [...(showTitle ? [showTitle] : []), ...frontMatter.slice(0, 10)].join("\n");
  const applied: string[] = [];
  const missed: string[] = [];
  for (const set of sets) {
    if (!set.match.test(head)) continue;
    for (const fix of set.fixes) (applyFix(scenes, fix) ? applied : missed).push(describe(fix));
  }
  return { applied, missed };
}
