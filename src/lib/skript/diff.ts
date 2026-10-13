import type { ScriptBlock, ScriptPart, ScriptScene } from "./types";

/** Ebene 3: Fassungsvergleich auf Szenen- und Absatz-Ebene. */

/** Ähnlichkeit 0–1 über die längste gemeinsame Teilfolge der Wörter (wie difflib.ratio). */
export function similarity(a: string, b: string): number {
  if (a === b) return 1;
  const x = a.split(/\s+/).filter(Boolean);
  const y = b.split(/\s+/).filter(Boolean);
  if (!x.length || !y.length) return 0;
  return (2 * lcsLength(x, y)) / (x.length + y.length);
}

function lcsLength<T>(a: T[], b: T[]): number {
  let prev = new Array<number>(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i++) {
    const cur = [0];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = a[i - 1] === b[j - 1] ? prev[j - 1] + 1 : Math.max(prev[j], cur[j - 1]);
    }
    prev = cur;
  }
  return prev[b.length];
}

export function blockText(block: ScriptBlock, kinds: ScriptPart["kind"][] = ["text"]): string {
  return block.parts
    .filter((p) => kinds.includes(p.kind))
    .map((p) => p.text)
    .join(" ");
}

/** Ähnlichkeit zweier Absätze; verschiedene Rollen nur bei fast gleichem Text (Umbenennung). */
export function blockSimilarity(a: ScriptBlock, b: ScriptBlock): number {
  const textA = blockText(a);
  const textB = blockText(b);
  if (a.speaker !== b.speaker) {
    const r = textA && textB ? similarity(textA, textB) : 0;
    return r > 0.8 ? r * 0.9 : 0;
  }
  const keyA = textA || blockText(a, ["direction", "cue"]);
  const keyB = textB || blockText(b, ["direction", "cue"]);
  return similarity(keyA, keyB);
}

export type AlignedPair<T> = [T | null, T | null];

/**
 * Sequenz-Alignment (Needleman-Wunsch): Paare mit Ähnlichkeit ≥ `threshold` werden zugeordnet,
 * der Rest gilt als entfernt/neu. Reihenfolge bleibt erhalten.
 */
export function align<T>(
  before: T[],
  after: T[],
  sim: (a: T, b: T) => number,
  threshold = 0.5,
): AlignedPair<T>[] {
  const n = before.length;
  const m = after.length;
  const scores = before.map((a) => after.map((b) => sim(a, b)));
  const gain = (i: number, j: number) => (scores[i][j] >= threshold ? scores[i][j] : -1);
  const table = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      table[i][j] = Math.max(
        table[i - 1][j],
        table[i][j - 1],
        table[i - 1][j - 1] + gain(i - 1, j - 1),
      );
    }
  }
  const pairs: AlignedPair<T>[] = [];
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    if (
      i > 0 &&
      j > 0 &&
      scores[i - 1][j - 1] >= threshold &&
      Math.abs(table[i][j] - (table[i - 1][j - 1] + gain(i - 1, j - 1))) < 1e-9
    ) {
      pairs.push([before[i - 1], after[j - 1]]);
      i--;
      j--;
    } else if (i > 0 && (j === 0 || Math.abs(table[i][j] - table[i - 1][j]) < 1e-9)) {
      pairs.push([before[i - 1], null]);
      i--;
    } else {
      pairs.push([null, after[j - 1]]);
      j--;
    }
  }
  return pairs.reverse();
}

/** Aufeinanderfolgende Anweisungsabsätze zusammenfassen (Regie bricht je Fassung anders um). */
export function mergeDirections(blocks: ScriptBlock[]): ScriptBlock[] {
  const out: ScriptBlock[] = [];
  for (const block of blocks) {
    const last = out.at(-1);
    if (last && !last.speaker && !block.speaker) {
      out[out.length - 1] = { ...last, parts: [...last.parts, ...block.parts] };
    } else {
      out.push(block);
    }
  }
  return out;
}

export function sameBlock(a: ScriptBlock, b: ScriptBlock): boolean {
  return (
    a.speaker === b.speaker &&
    a.parts.length === b.parts.length &&
    a.parts.every((p, i) => p.kind === b.parts[i].kind && p.text === b.parts[i].text)
  );
}

export type BlockChange =
  | { type: "same"; before: ScriptBlock; after: ScriptBlock }
  | { type: "changed"; before: ScriptBlock; after: ScriptBlock }
  | { type: "added"; after: ScriptBlock }
  | { type: "removed"; before: ScriptBlock };

export type SceneChange = {
  title: string;
  previousTitle?: string;
  type: "same" | "changed" | "added" | "removed";
  blocks: BlockChange[];
};

export type ScriptDiff = {
  scenes: SceneChange[];
  stats: { same: number; changed: number; added: number; removed: number };
};

export function diffScripts(before: ScriptScene[], after: ScriptScene[]): ScriptDiff {
  const stats = { same: 0, changed: 0, added: 0, removed: 0 };
  const scenes: SceneChange[] = [];
  for (const [a, b] of align(before, after, (x, y) => similarity(x.title, y.title), 0.4)) {
    if (!a || !b) {
      const scene = (b ?? a)!;
      scenes.push({
        title: scene.title,
        type: b ? "added" : "removed",
        blocks: scene.blocks.map((block) =>
          b ? { type: "added", after: block } : { type: "removed", before: block },
        ),
      });
      continue;
    }
    const blocks: BlockChange[] = [];
    for (const [x, y] of align(
      mergeDirections(a.blocks),
      mergeDirections(b.blocks),
      blockSimilarity,
      0.5,
    )) {
      if (x && y) blocks.push({ type: sameBlock(x, y) ? "same" : "changed", before: x, after: y });
      else if (y) blocks.push({ type: "added", after: y });
      else if (x) blocks.push({ type: "removed", before: x });
    }
    for (const change of blocks) stats[change.type]++;
    scenes.push({
      title: b.title,
      previousTitle: a.title !== b.title ? a.title : undefined,
      type: blocks.every((c) => c.type === "same") && a.title === b.title ? "same" : "changed",
      blocks,
    });
  }
  return { scenes, stats };
}

export type WordDiffToken = { op: "equal" | "insert" | "delete"; text: string };

/** Wortweiser Unterschied zweier Texte (LCS). */
export function wordDiff(before: string, after: string): WordDiffToken[] {
  const a = before.split(/\s+/).filter(Boolean);
  const b = after.split(/\s+/).filter(Boolean);
  const table = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      table[i][j] =
        a[i] === b[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }
  const out: WordDiffToken[] = [];
  const push = (op: WordDiffToken["op"], text: string) => {
    const last = out.at(-1);
    if (last?.op === op) last.text += ` ${text}`;
    else out.push({ op, text });
  };
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      push("equal", a[i]);
      i++;
      j++;
    } else if (table[i + 1][j] >= table[i][j + 1]) {
      push("delete", a[i++]);
    } else {
      push("insert", b[j++]);
    }
  }
  while (i < a.length) push("delete", a[i++]);
  while (j < b.length) push("insert", b[j++]);
  return out;
}
