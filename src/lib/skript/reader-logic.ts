import type { CueCategory, ScriptPart } from "./types";

/** Reine Logik des Lesers (ohne DOM), damit sie testbar bleibt. */

export type LogicBlock = { kind: "speech" | "direction"; roleIds: string[]; parts: ScriptPart[] };

/** Anzahl Wörter am Ende der Vorgänger-Replik, die als Stichwort betont werden. */
export const CUE_LINE_WORDS = 6;

export function isRoleBlock(block: LogicBlock, roleIds: ReadonlySet<string>) {
  return block.kind === "speech" && block.roleIds.some((id) => roleIds.has(id));
}

export function cueParts(block: LogicBlock, categories: ReadonlySet<CueCategory>) {
  return block.parts.filter(
    (part): part is Extract<ScriptPart, { kind: "cue" }> =>
      part.kind === "cue" && categories.has(part.category),
  );
}

export type NextTarget = {
  index: number;
  /** Repliken zwischen dem sichtbaren Bereich und dem Ziel. */
  linesAway: number;
};

/**
 * Nächstes Ziel unterhalb des sichtbaren Bereichs `[first, last]`. Ist schon ein Ziel sichtbar,
 * gibt es keine Vorschau – die Passage läuft dann normal im Text mit.
 */
export function findNextTarget<B extends LogicBlock>(
  blocks: readonly B[],
  isTarget: (block: B) => boolean,
  first: number,
  last: number,
): NextTarget | null {
  for (let i = Math.max(0, first); i <= last && i < blocks.length; i++) {
    if (isTarget(blocks[i])) return null;
  }
  let linesAway = 0;
  for (let i = last + 1; i < blocks.length; i++) {
    if (isTarget(blocks[i])) return { index: i, linesAway };
    if (blocks[i].kind === "speech") linesAway += 1;
  }
  return null;
}

/**
 * Stichwort-Absätze: die letzte fremde Replik vor einer eigenen Passage (Regie dazwischen wird
 * übersprungen). Ergebnis: Index der Stichwort-Replik.
 */
export function cueLineIndices(blocks: readonly LogicBlock[], roleIds: ReadonlySet<string>) {
  const result = new Set<number>();
  if (!roleIds.size) return result;
  for (let i = 1; i < blocks.length; i++) {
    if (!isRoleBlock(blocks[i], roleIds)) continue;
    for (let j = i - 1; j >= 0; j--) {
      if (blocks[j].kind !== "speech") continue;
      if (!isRoleBlock(blocks[j], roleIds)) result.add(j);
      break;
    }
  }
  return result;
}

/** Teilt einen Text in Anfang und die letzten `count` Wörter (Leerraum bleibt erhalten). */
export function splitTail(text: string, count = CUE_LINE_WORDS): [string, string] {
  const words = text.trimEnd().split(/(\s+)/);
  let seen = 0;
  for (let i = words.length - 1; i >= 0; i--) {
    if (/\S/.test(words[i])) seen += 1;
    if (seen === count) return [words.slice(0, i).join(""), words.slice(i).join("")];
  }
  return ["", text.trimEnd()];
}

/** Index des ersten Elements, dessen Unterkante unter `offset` liegt (Binärsuche). */
export function firstVisibleIndex(bottoms: readonly number[], offset: number) {
  let lo = 0;
  let hi = bottoms.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (bottoms[mid] <= offset) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** Satzende am Schluss eines Teils (auch mit schließendem Anführungszeichen/Klammer). */
const SENTENCE_END = /[.!?…:][\s"'“”„»«)]*$/;

export type CueSegment<P> = {
  /** Hinweise vor dem ersten Text des Abschnitts – stehen über dem Text, ohne Marke. */
  before: P[];
  /** Text- und Regieteile in Reihenfolge; `mark` ist eine Hinweismarke im Text. */
  items: ({ type: "part"; entry: P } | { type: "mark"; entry: P; number: number | null })[];
  /** Hinweise, die als eigene Zeile unter dem Abschnitt stehen. */
  after: { entry: P; number: number | null }[];
};

/**
 * Teilt einen Absatz für die Anzeige in Abschnitte bis zum nächsten Satzende, damit Hinweise
 * nicht den Satz zerreißen, sondern als Zeile darunter stehen. Im Text bleibt nur eine Marke –
 * nummeriert, sobald ein Abschnitt mehrere Hinweise mit Marke hat. Hinweise am Abschnittsende
 * brauchen keine Marke, sie stehen ohnehin direkt darunter.
 */
export function cueSegments<P extends { part: ScriptPart }>(parts: readonly P[]): CueSegment<P>[] {
  const raw: { before: P[]; items: { cue: boolean; entry: P }[] }[] = [];
  let current: (typeof raw)[number] = { before: [], items: [] };
  for (const entry of parts) {
    if (entry.part.kind === "cue") {
      if (current.items.length === 0) current.before.push(entry);
      else current.items.push({ cue: true, entry });
      continue;
    }
    current.items.push({ cue: false, entry });
    if (current.items.some((item) => item.cue) && SENTENCE_END.test(entry.part.text)) {
      raw.push(current);
      current = { before: [], items: [] };
    }
  }
  if (current.before.length || current.items.length) raw.push(current);

  return raw.map(({ before, items }) => {
    const lastText = items.findLastIndex((item) => !item.cue);
    const cues = items.filter((item) => item.cue);
    const marked = items.some((item, index) => item.cue && index < lastText);
    const numbered = marked && cues.length > 1;
    let counter = 0;
    const segment: CueSegment<P> = { before, items: [], after: [] };
    for (const [index, item] of items.entries()) {
      if (!item.cue) {
        segment.items.push({ type: "part", entry: item.entry });
        continue;
      }
      const number = numbered ? ++counter : null;
      if (marked && (numbered || index < lastText)) {
        segment.items.push({ type: "mark", entry: item.entry, number });
      }
      segment.after.push({ entry: item.entry, number });
    }
    return segment;
  });
}
