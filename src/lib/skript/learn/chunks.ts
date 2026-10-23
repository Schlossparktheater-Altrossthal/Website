import type { ScriptPart } from "../types";

/**
 * Abschnitte zum Lernen (docs/Plan/lernmodus-plan.md). Reine Logik ohne Prisma, damit Leser-Client
 * und Server dieselben Abschnitte bilden.
 */

/** Ab so vielen Wörtern darf an einem Satzende geteilt werden. */
export const CHUNK_MIN_WORDS = 8;
/** Spätestens nach so vielen Wörtern wird geteilt (auch ohne Satzende, dann an Komma/Wortgrenze). */
export const CHUNK_MAX_WORDS = 25;

export type LearnToken =
  | { kind: "word"; text: string; index: number; chunk: number }
  | { kind: "space"; text: string }
  | { kind: "direction"; text: string }
  | { kind: "cue"; part: Extract<ScriptPart, { kind: "cue" }> };

export type LearnChunk = { index: number; words: string[]; hash: string };

export type TokenizedBlock = { tokens: LearnToken[]; chunks: LearnChunk[] };

const SENTENCE_END = /[.!?…]["»“”']?$/;
const SOFT_END = /[,;:–—-]["»“”']?$/;

/** Zerlegt die Teile einer Replik in Wörter (nur Text-Teile) und teilt sie in Abschnitte. */
export function tokenizeBlock(parts: readonly ScriptPart[]): TokenizedBlock {
  const tokens: LearnToken[] = [];
  const words: Extract<LearnToken, { kind: "word" }>[] = [];
  // Liedtext: Strophenende wie Satzende, Zeilenende wie Komma (Repliken haben keine Umbrüche).
  const stanzaEnd = new Set<number>();
  const lineEnd = new Set<number>();
  for (const part of parts) {
    if (part.kind === "cue") {
      tokens.push({ kind: "cue", part });
      continue;
    }
    if (part.kind === "direction") {
      tokens.push({ kind: "direction", text: part.text });
      continue;
    }
    for (const piece of part.text.split(/(\s+)/)) {
      if (!piece) continue;
      if (/^\s+$/.test(piece)) {
        tokens.push({ kind: "space", text: piece });
        if (words.length && piece.includes("\n")) {
          (/\n\s*\n/.test(piece) ? stanzaEnd : lineEnd).add(words.length - 1);
        }
      } else {
        const token = { kind: "word" as const, text: piece, index: words.length, chunk: 0 };
        words.push(token);
        tokens.push(token);
      }
    }
  }

  // Grenzen: Satzende nach Mindestlänge; bei Überlänge weiches Ende, sonst hart.
  let chunk = 0;
  let size = 0;
  let lastSoft = -1;
  let chunkStart = 0;
  for (let i = 0; i < words.length; i++) {
    words[i].chunk = chunk;
    size += 1;
    const text = words[i].text;
    if (SOFT_END.test(text) || lineEnd.has(i)) lastSoft = i;
    const remaining = words.length - i - 1;
    if (remaining === 0) break;
    if (
      (SENTENCE_END.test(text) || stanzaEnd.has(i)) &&
      size >= CHUNK_MIN_WORDS &&
      remaining >= 3
    ) {
      chunk += 1;
      size = 0;
      lastSoft = -1;
      chunkStart = i + 1;
    } else if (size >= CHUNK_MAX_WORDS && remaining >= 3) {
      // Am letzten weichen Ende teilen, falls es nicht zu früh liegt.
      if (lastSoft >= chunkStart + CHUNK_MIN_WORDS - 1 && lastSoft < i) {
        for (let j = lastSoft + 1; j <= i; j++) words[j].chunk = chunk + 1;
        size = i - lastSoft;
      } else {
        size = 0;
      }
      chunk += 1;
      lastSoft = -1;
      chunkStart = i + 1 - size;
    }
  }

  const chunks: LearnChunk[] = [];
  for (const word of words) {
    (chunks[word.chunk] ??= { index: word.chunk, words: [], hash: "" }).words.push(word.text);
  }
  for (const entry of chunks) entry.hash = textHash(entry.words);
  return { tokens, chunks };
}

export function normalizeWord(word: string) {
  return word
    .toLocaleLowerCase("de")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\p{L}\p{N}]/gu, "");
}

/** Kurze Prüfsumme (FNV-1a) des normalisierten Wortlauts; Satzzeichen zählen nicht. */
export function textHash(words: readonly string[]) {
  let hash = 0x811c9dc5;
  const text = words.map(normalizeWord).filter(Boolean).join(" ");
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

/** Erster Buchstabe bzw. erste Ziffer eines Worts (für Anfangsbuchstaben und den Tippmodus). */
export function firstLetter(word: string) {
  const match = word.match(/[\p{L}\p{N}]/u);
  return match ? match[0] : "";
}

/** Anzeige „nur Anfangsbuchstabe“: Satzzeichen bleiben, Buchstaben werden zu Strich. */
export function initialOnly(word: string) {
  let seen = false;
  return word.replace(/[\p{L}\p{N}]/gu, (char) => {
    if (seen) return "·";
    seen = true;
    return char;
  });
}

/**
 * Wörter, die auf der Stufe „Lücken“ verdeckt werden: jedes zweite Inhaltswort ab drei
 * Buchstaben, verschoben je Abschnitt, damit nicht immer dieselben fehlen.
 */
export function clozeWords(words: readonly string[], seed: number) {
  const hidden = new Set<number>();
  let count = seed % 2;
  words.forEach((word, index) => {
    if (normalizeWord(word).length < 3) return;
    if (count % 2 === 0) hidden.add(index);
    count += 1;
  });
  if (!hidden.size && words.length) hidden.add(words.length - 1);
  return hidden;
}
