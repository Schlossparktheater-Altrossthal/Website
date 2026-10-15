import { describe, expect, it } from "vitest";

import {
  extendTo,
  gapAfter,
  locatePoint,
  nudge,
  overlaps,
  pointContext,
  sentenceAround,
  wordAt,
  words,
} from "../note-logic";

const pick = (text: string, span: { start: number; end: number } | null) =>
  span ? text.slice(span.start, span.end) : null;

describe("wordAt", () => {
  const text = "TU – WAS – DU – WILLST! Bastian's Mantel";
  it("findet das Wort ohne Satzzeichen", () => {
    expect(pick(text, wordAt(text, text.indexOf("WILLST") + 2))).toBe("WILLST");
    expect(pick(text, wordAt(text, text.indexOf("Bastian")))).toBe("Bastian's");
  });
  it("nimmt zwischen Wörtern das davor", () => {
    expect(pick(text, wordAt(text, text.indexOf("!")))).toBe("WILLST");
    expect(pick(text, wordAt(text, 3))).toBe("TU");
  });
  it("nimmt am Anfang ohne Wort davor das danach", () => {
    expect(pick(" – Licht", wordAt(" – Licht", 0))).toBe("Licht");
    expect(wordAt(" – ", 1)).toBeNull();
  });
});

describe("Auswahl erweitern", () => {
  const text = "Guten Abend, verehrtes Publikum. Wie geht es dir?";
  const word = (w: string) => wordAt(text, text.indexOf(w))!;
  it("zweites Antippen erweitert in beide Richtungen", () => {
    expect(pick(text, extendTo(word("verehrtes"), word("Guten")))).toBe("Guten Abend, verehrtes");
    expect(pick(text, extendTo(word("Abend"), word("Publikum")))).toBe("Abend, verehrtes Publikum");
  });
  it("◀ ▶ verkürzt und verlängert am Ende", () => {
    expect(pick(text, nudge(text, word("Abend"), 1))).toBe("Abend, verehrtes");
    expect(pick(text, nudge(text, extendTo(word("Abend"), word("verehrtes")), -1))).toBe("Abend");
    expect(pick(text, nudge(text, word("Abend"), -1))).toBe("Abend");
    expect(pick(text, nudge(text, word("dir"), 1))).toBe("dir");
  });
  it("findet den Satz", () => {
    expect(pick(text, sentenceAround(text, word("verehrtes")))).toBe(
      "Guten Abend, verehrtes Publikum.",
    );
    expect(pick(text, sentenceAround(text, word("geht")))).toBe("Wie geht es dir?");
  });
  it("words und overlaps", () => {
    expect(words("a, b-c  d").map((w) => w.start)).toEqual([0, 3, 8]);
    expect(overlaps({ start: 0, end: 3 }, { start: 3, end: 5 })).toBe(false);
    expect(overlaps({ start: 0, end: 4 }, { start: 3, end: 5 })).toBe(true);
  });
});

describe("Stellen-Zeichen", () => {
  const text = "Guten Abend, verehrtes Publikum.";
  it("setzt hinter Satzzeichen", () => {
    expect(gapAfter(text, text.indexOf("Abend") + 5)).toBe(text.indexOf(",") + 1);
    expect(gapAfter(text, text.length - 1)).toBe(text.length);
  });
  it("findet die Stelle über den Kontext wieder", () => {
    const at = gapAfter(text, text.indexOf("Abend") + 5);
    const context = pointContext(text, at);
    expect(locatePoint(text, at, context)).toBe(at);
    const changed = "Ach, " + text;
    expect(locatePoint(changed, at, context)).toBe(at + 5);
    expect(locatePoint("Ganz anders.", at, context)).toBeNull();
  });
});
