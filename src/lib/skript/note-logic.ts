/**
 * Auswahl im Notizmodus des Lesers (docs/Plan/skript-notizen-plan.md, Schritt 2): Wörter per
 * Antippen statt System-Textauswahl. Reine Funktionen auf dem Text eines Absatz-Teils.
 */

export type Span = { start: number; end: number };

const WORD_CHAR = /[\p{L}\p{N}'’-]/u;

function isWordChar(char: string | undefined) {
  return !!char && WORD_CHAR.test(char);
}

/** Wort an Position `index` (ohne Satzzeichen). Liegt `index` zwischen Wörtern: das davor. */
export function wordAt(text: string, index: number): Span | null {
  let at = Math.max(0, Math.min(index, text.length - 1));
  if (!isWordChar(text[at])) {
    let left = at;
    while (left >= 0 && !isWordChar(text[left])) left -= 1;
    if (left >= 0) at = left;
    else {
      let right = at;
      while (right < text.length && !isWordChar(text[right])) right += 1;
      if (right >= text.length) return null;
      at = right;
    }
  }
  let start = at;
  let end = at + 1;
  while (start > 0 && isWordChar(text[start - 1])) start -= 1;
  while (end < text.length && isWordChar(text[end])) end += 1;
  // Bindestriche am Rand („ – “) gehören nicht zum Wort.
  while (start < end && /['’-]/.test(text[start])) start += 1;
  while (end > start && /['’-]/.test(text[end - 1])) end -= 1;
  return start < end ? { start, end } : null;
}

/** Alle Wörter eines Textes. */
export function words(text: string): Span[] {
  const found: Span[] = [];
  let index = 0;
  while (index < text.length) {
    if (!isWordChar(text[index])) {
      index += 1;
      continue;
    }
    const word = wordAt(text, index);
    let next = index;
    while (next < text.length && isWordChar(text[next])) next += 1;
    if (word) found.push(word);
    index = next;
  }
  return found;
}

/** Zweites Antippen: Auswahl vom bisherigen Wort bis zum neuen (in beide Richtungen). */
export function extendTo(current: Span, word: Span): Span {
  return { start: Math.min(current.start, word.start), end: Math.max(current.end, word.end) };
}

/** ◀ / ▶: Auswahl um ein Wort am Ende verkürzen bzw. verlängern (mind. ein Wort bleibt). */
export function nudge(text: string, current: Span, direction: -1 | 1): Span {
  const list = words(text);
  if (!list.length) return current;
  const lastInside = list.findLastIndex((word) => word.start < current.end);
  if (direction === 1) {
    const next = list[lastInside + 1];
    return next ? { start: current.start, end: next.end } : current;
  }
  const firstInside = list.findIndex((word) => word.end > current.start);
  if (lastInside <= firstInside) return current;
  return { start: current.start, end: list[lastInside - 1].end };
}

/** Satz um die Auswahl (bis . ! ? … bzw. Textrand), ohne Leerraum am Rand. */
export function sentenceAround(text: string, current: Span): Span {
  const isEnd = (char: string | undefined) => !!char && /[.!?…]/.test(char);
  let start = current.start;
  while (start > 0 && !isEnd(text[start - 1])) start -= 1;
  let end = current.end;
  while (end < text.length && !isEnd(text[end - 1])) end += 1;
  // Folgezeichen („?!“, „…“, Anführung) mitnehmen.
  while (end < text.length && /[.!?…"“”»«)]/.test(text[end])) end += 1;
  while (start < end && /\s/.test(text[start])) start += 1;
  while (end > start && /\s/.test(text[end - 1])) end -= 1;
  return { start, end };
}

/** Überschneiden sich zwei Bereiche? */
export function overlaps(a: Span, b: Span) {
  return a.start < b.end && b.start < a.end;
}
