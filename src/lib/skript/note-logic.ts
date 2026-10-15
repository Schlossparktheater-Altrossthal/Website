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

/**
 * Stelle hinter einem Wort für Zeichen wie Pause: nach anhängenden Satzzeichen („Abend,/“),
 * vor dem Leerraum.
 */
export function gapAfter(text: string, end: number) {
  let at = end;
  while (at < text.length && !/\s/.test(text[at])) at += 1;
  return at;
}

/** Kontext vor einer Stelle (zum Wiederfinden in neuen Fassungen). */
export function pointContext(text: string, at: number, length = 24) {
  return text.slice(Math.max(0, at - length), at);
}

/**
 * Stelle über ihren Kontext wiederfinden: erst an alter Position, sonst hinter dem Text davor,
 * sonst vor dem Text danach (falls nur davor etwas geändert wurde).
 */
export function locatePoint(
  text: string,
  at: number | null,
  context: string | null,
  after: string | null = null,
) {
  if (!context && !after) return at !== null && at <= text.length ? at : null;
  if (
    at !== null &&
    at >= (context?.length ?? 0) &&
    (!context || text.slice(at - context.length, at) === context)
  ) {
    return at;
  }
  if (context) {
    const found = text.indexOf(context);
    if (found >= 0) return found + context.length;
  }
  if (after) {
    const found = text.indexOf(after);
    if (found >= 0) return found;
  }
  return null;
}

/** Text vor und nach einem Bereich – hilft, ihn in einer neuen Fassung wiederzufinden. */
export function rangeContext(text: string, start: number, end: number, length = 32) {
  return {
    prefix: text.slice(Math.max(0, start - length), start),
    suffix: text.slice(end, end + length),
  };
}

function sharedEnd(a: string, b: string) {
  let n = 0;
  while (n < a.length && n < b.length && a[a.length - 1 - n] === b[b.length - 1 - n]) n += 1;
  return n;
}

function sharedStart(a: string, b: string) {
  let n = 0;
  while (n < a.length && n < b.length && a[n] === b[n]) n += 1;
  return n;
}

export type RangeAnchor = {
  partIndex: number | null;
  start: number | null;
  end: number | null;
  quote: string | null;
  prefix?: string | null;
  suffix?: string | null;
};

/**
 * Bereich in den Teilen eines Absatzes wiederfinden (wie W3C TextQuoteSelector): erst an der
 * alten Stelle, sonst unter allen Vorkommen des Wortlauts das mit dem passendsten Text davor und
 * danach (bei Gleichstand: gleicher Teil, dann nächste Position). `null`, wenn der Wortlaut fehlt.
 */
export function locateRange(
  texts: string[],
  anchor: RangeAnchor,
): { partIndex: number; start: number; end: number } | null {
  const { partIndex, start, end, quote } = anchor;
  if (partIndex === null || !quote) return null;
  if (start !== null && end !== null && texts[partIndex]?.slice(start, end) === quote) {
    return { partIndex, start, end };
  }
  const prefix = anchor.prefix ?? "";
  const suffix = anchor.suffix ?? "";
  let best: { partIndex: number; start: number; end: number; score: number } | null = null;
  texts.forEach((text, index) => {
    for (let found = text.indexOf(quote); found >= 0; found = text.indexOf(quote, found + 1)) {
      const after = found + quote.length;
      const score =
        sharedEnd(text.slice(0, found), prefix) +
        sharedStart(text.slice(after), suffix) +
        (index === partIndex ? 0.5 : 0) -
        Math.abs(found - (start ?? found)) / 10_000;
      if (!best || score > best.score) best = { partIndex: index, start: found, end: after, score };
    }
  });
  const found = best as { partIndex: number; start: number; end: number } | null;
  return found ? { partIndex: found.partIndex, start: found.start, end: found.end } : null;
}
