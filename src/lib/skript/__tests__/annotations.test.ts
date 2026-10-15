import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { locateQuote, plainBlockText, resolveAnnotations } from "../annotations";
import type { ScriptPart } from "../types";

const text = (value: string): ScriptPart => ({ kind: "text", text: value });

function stored(overrides: Partial<Parameters<typeof resolveAnnotations>[0][number]>) {
  return {
    id: "n1",
    showId: "s",
    versionId: "v1",
    blockId: "b1",
    lineageId: "l1",
    kind: "note" as const,
    color: null,
    sign: null,
    body: "Hier lauter",
    partIndex: null,
    start: null,
    end: null,
    quote: null,
    ink: null,
    blockText: "Ich muss den Nachtalp finden.",
    authorId: "u",
    createdAt: new Date("2026-10-13T10:00:00Z"),
    updatedAt: new Date("2026-10-13T10:00:00Z"),
    ...overrides,
  };
}

describe("locateQuote", () => {
  const parts = [text("Ich muss den Nachtalp finden."), text("Schnell!")];

  it("nimmt die gespeicherte Stelle, wenn sie noch passt", () => {
    expect(locateQuote(parts, { partIndex: 0, start: 13, end: 21, quote: "Nachtalp" })).toEqual({
      partIndex: 0,
      start: 13,
      end: 21,
    });
  });

  it("sucht die Stelle, wenn sie sich verschoben hat", () => {
    expect(locateQuote(parts, { partIndex: 0, start: 0, end: 7, quote: "Schnell" })).toEqual({
      partIndex: 1,
      start: 0,
      end: 7,
    });
  });
});

describe("resolveAnnotations", () => {
  const sameBlock = { id: "b2", lineageId: "l1", parts: [text("Ich muss den Nachtalp finden.")] };
  const changedBlock = {
    id: "b2",
    lineageId: "l1",
    parts: [text("Ich muss den Nachtalp schnell finden.")],
  };

  it("übernimmt Notizen an unveränderten Absätzen still in die neue Fassung", () => {
    const [note] = resolveAnnotations([stored({})], "v2", [sameBlock]);
    expect(note).toMatchObject({ state: "ok", blockId: "b2" });
  });

  it("fragt bei geändertem Absatz nach und zeigt den alten Wortlaut", () => {
    const [note] = resolveAnnotations([stored({})], "v2", [changedBlock]);
    expect(note).toMatchObject({ state: "changed", previousText: "Ich muss den Nachtalp finden." });
  });

  it("Marker wandern mit, solange die Stelle noch im Text steht", () => {
    const [mark] = resolveAnnotations(
      [
        stored({
          kind: "highlight",
          body: null,
          partIndex: 0,
          start: 13,
          end: 21,
          quote: "Nachtalp",
        }),
      ],
      "v2",
      [changedBlock],
    );
    expect(mark).toMatchObject({ state: "ok", partIndex: 0, start: 13, end: 21 });
  });

  it("gestrichene Absätze ergeben Notizen ohne Platz", () => {
    const [note] = resolveAnnotations([stored({})], "v2", [
      { id: "b9", lineageId: "andere", parts: [text("Etwas anderes")] },
    ]);
    expect(note).toMatchObject({ state: "orphaned", blockId: null });
  });

  it("findet ohne gemeinsame Kennung den Absatz mit gleichem Wortlaut", () => {
    const [note] = resolveAnnotations([stored({})], "v2", [
      { id: "b7", lineageId: "neu", parts: [text("Ich muss den Nachtalp finden.")] },
    ]);
    expect(note).toMatchObject({ state: "ok", blockId: "b7" });
  });

  it("liest Freihand-Striche und verwirft ungültige", () => {
    const stroke = { color: "rot", size: 0.15, points: [[0.1, 0.5, 0.6, 30]] };
    const [ink] = resolveAnnotations(
      [stored({ kind: "ink", body: null, ink: { strokes: [stroke] } })],
      "v1",
      [{ id: "b1", lineageId: "l1", parts: [text("Ich muss den Nachtalp finden.")] }],
    );
    expect(ink.strokes).toEqual([stroke]);
    const [broken] = resolveAnnotations(
      [stored({ kind: "ink", body: null, ink: { strokes: [{ color: "lila" }] } })],
      "v1",
      [],
    );
    expect(broken.strokes).toEqual([]);
  });

  it("plainBlockText normalisiert Leerraum", () => {
    expect(plainBlockText([text(" Hallo  "), text("Welt ")])).toBe("Hallo Welt");
  });

  it("Pause wandert mit, wenn Text davor dazukommt", () => {
    const [pause] = resolveAnnotations(
      [
        stored({
          kind: "sign",
          sign: "pause",
          partIndex: 0,
          start: 12,
          end: 12,
          quote: "Guten Abend,",
          blockText: "Guten Abend, Publikum.",
        }),
      ],
      "v2",
      [{ id: "b2", lineageId: "l1", parts: [text("Ach, Guten Abend, Publikum.")] }],
    );
    expect(pause).toMatchObject({ state: "ok", start: 17, end: 17, sign: "pause" });
  });
});
