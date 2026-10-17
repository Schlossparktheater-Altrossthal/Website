import { describe, expect, it } from "vitest";

import { blockNotes, segmentText, type PdfNote } from "@/lib/skript/pdf-notes";

const note = (extra: Partial<PdfNote>): PdfNote => ({
  id: "n",
  kind: "note",
  sign: null,
  strokes: [],
  color: null,
  body: null,
  partIndex: 0,
  start: 0,
  end: 0,
  quote: null,
  blockId: "b",
  state: "ok",
  ...extra,
});

describe("Notizen im PDF", () => {
  it("nummeriert verankerte Notizen fortlaufend, unverankerte ohne Nummer", () => {
    const counter = { value: 2 };
    const result = blockNotes(
      [
        note({ body: "lauter!", start: 4, end: 7 }),
        note({ body: "ganzer Absatz", partIndex: null, start: null, end: null }),
        note({ body: "verrutscht", state: "changed", quote: "alt" }),
        note({ body: "weg", state: "orphaned" }),
      ],
      counter,
    );
    expect(result.lines.map((l) => [l.number, l.body, l.quote])).toEqual([
      [3, "lauter!", null],
      [null, "ganzer Absatz", null],
      [null, "verrutscht", "alt"],
    ]);
    expect(result.parts.get(0)?.[0]).toMatchObject({ after: "[3]", underline: true });
    expect(counter.value).toBe(3);
  });

  it("setzt Zeichen druckbar: Pause als Glyphe, Zäsur als ||, Stimmung als Etikett", () => {
    const result = blockNotes(
      [
        note({ kind: "sign", sign: "pause", start: 3, end: 3 }),
        note({ kind: "sign", sign: "zaesur", start: 5, end: 5 }),
        note({ kind: "sign", sign: "stimmung", body: "wütend", start: 0, end: 4 }),
        note({ kind: "highlight", color: "gelb", partIndex: null, start: null, end: null }),
      ],
      { value: 0 },
    );
    const befores = result.parts.get(0)?.map((d) => d.before);
    expect(befores).toEqual([" / ", " || ", "(wütend) "]);
    expect(result.blockColor).toBe("#b45309");
  });

  it("zerlegt Text an Grenzen und setzt Einschübe an die Stelle", () => {
    const segments = segmentText("Wo bin ich", [
      { start: 3, end: 6, color: "c", underline: true, bold: false, after: "[1]" },
      { start: 3, end: 3, color: "c", underline: false, bold: true, before: " / " },
    ]);
    expect(segments.map((s) => [s.text, s.inserts.map((i) => i.text), s.covering.length])).toEqual([
      ["Wo ", [], 0],
      ["bin", [" / "], 1],
      [" ich", ["[1]"], 0],
    ]);
  });
});
