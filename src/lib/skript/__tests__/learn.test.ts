import { describe, expect, it } from "vitest";

import { clozeWords, initialOnly, textHash, tokenizeBlock } from "../learn/chunks";
import {
  NEW_PER_DAY,
  itemKey,
  matchScenes,
  moreQueue,
  sceneProgress,
  summarize,
  todayQueue,
  weekDays,
  dayKey,
  type LearnItem,
  type StoredCard,
} from "../learn/plan";
import {
  CHANGED_MAX_STABILITY,
  applyRating,
  applyReview,
  autoRating,
  autoStage,
  capRating,
  progressOf,
} from "../learn/schedule";
import type { ScriptPart } from "../types";

const text = (value: string): ScriptPart => ({ kind: "text", text: value });

describe("tokenizeBlock", () => {
  it("lässt kurze Repliken ganz", () => {
    const { chunks } = tokenizeBlock([text("Wer bist du? Sag es mir.")]);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].words).toEqual(["Wer", "bist", "du?", "Sag", "es", "mir."]);
  });

  it("teilt lange Repliken an Satzenden", () => {
    const sentence = "Eins zwei drei vier fünf sechs sieben acht.";
    const { chunks } = tokenizeBlock([text(`${sentence} ${sentence} ${sentence}`)]);
    expect(chunks.map((chunk) => chunk.words.length)).toEqual([8, 8, 8]);
  });

  it("teilt überlange Sätze spätestens nach der Höchstlänge", () => {
    const words = Array.from({ length: 60 }, (_, i) => `w${i}`).join(" ");
    const { chunks } = tokenizeBlock([text(words)]);
    expect(chunks.length).toBeGreaterThan(1);
    expect(Math.max(...chunks.map((chunk) => chunk.words.length))).toBeLessThanOrEqual(25);
    expect(chunks.flatMap((chunk) => chunk.words)).toHaveLength(60);
  });

  it("behält Regie im Text, lernt sie aber nicht", () => {
    const { tokens, chunks } = tokenizeBlock([
      text("Komm her!"),
      { kind: "direction", text: "(lacht)" },
      text("Schnell."),
    ]);
    expect(tokens.some((token) => token.kind === "direction")).toBe(true);
    expect(chunks[0].words).toEqual(["Komm", "her!", "Schnell."]);
  });

  it("Prüfsumme ignoriert Satzzeichen und Großschreibung", () => {
    expect(textHash(["Komm", "her!"])).toBe(textHash(["komm", "her"]));
    expect(textHash(["Komm", "her"])).not.toBe(textHash(["Geh", "weg"]));
  });
});

describe("Verdecken", () => {
  it("Anfangsbuchstaben behalten Satzzeichen", () => {
    expect(initialOnly("Hallo,")).toBe("H····,");
  });
  it("Lücken verdecken nur Inhaltswörter und mindestens eins", () => {
    const hidden = clozeWords(["Ich", "bin", "da", "und", "warte"], 0);
    expect(hidden.size).toBeGreaterThan(0);
    expect(hidden.has(2)).toBe(false);
    expect(clozeWords(["ja"], 0).size).toBe(1);
  });
});

describe("Bewertung und Stufen", () => {
  it("leitet die Bewertung aus dem Aufdecken ab", () => {
    expect(autoRating(0, 10, false)).toBe(3);
    expect(autoRating(2, 10, false)).toBe(2);
    expect(autoRating(6, 10, false)).toBe(1);
    expect(autoRating(0, 10, true)).toBe(1);
  });

  it("Stufe wächst mit der Stabilität, geänderter Text fällt zurück", () => {
    const now = new Date("2026-10-13T10:00:00Z");
    expect(autoStage(null, false)).toBe("cloze");
    let state = applyRating(null, 3, now);
    for (let i = 0; i < 4; i++) {
      state = applyRating(state, 3, new Date(state.due));
    }
    expect(autoStage(state, false)).toBe("hidden");
    expect(autoStage(state, true)).toBe("cloze");
    expect(progressOf(state, false, new Date(state.lastReview!))).toBe("solid");
  });

  it("„sitzt“ verfällt, wenn lange nicht wiederholt", () => {
    const now = new Date("2026-10-13T10:00:00Z");
    let state = applyRating(null, 3, now);
    state = applyRating(state, 3, new Date(now.getTime() + 600_000));
    state = applyRating(state, 3, new Date(state.due));
    const last = new Date(state.lastReview!);
    expect(progressOf(state, false, last)).toBe("solid");
    expect(progressOf(state, false, new Date(last.getTime() + 90 * 86_400_000))).toBe("learning");
  });

  it("Hilfen deckeln die Bewertung", () => {
    expect(capRating(3, "cloze")).toBe(2);
    expect(capRating(4, "initials")).toBe(3);
    expect(capRating(4, "hidden")).toBe(4);
    expect(capRating(1, "cloze")).toBe(1);
  });

  it("geänderter Text: alter Lernstand zählt kaum, nächste Abfrage spätestens morgen", () => {
    const now = new Date("2026-10-13T10:00:00Z");
    let state = applyRating(null, 3, now);
    for (let i = 0; i < 4; i++) state = applyRating(state, 3, new Date(state.due));
    expect(state.stability).toBeGreaterThan(30);
    const at = new Date(state.due);
    const next = applyReview(state, 3, at, { changed: true, stage: "hidden" });
    expect(new Date(next.due).getTime() - at.getTime()).toBeLessThanOrEqual(86_400_000);
    expect(next.stability).toBeLessThanOrEqual(CHANGED_MAX_STABILITY);
  });
});

function item(id: string, sceneId: string, order: number, hash = "h"): LearnItem {
  return {
    key: itemKey("r", id, 0),
    roleId: "r",
    blockId: id,
    lineageId: id,
    sceneId,
    chunk: 0,
    hash,
    words: 5,
    order,
  };
}

function card(due: string, overrides: Partial<StoredCard> = {}): StoredCard {
  return {
    state: 2,
    due,
    stability: 5,
    difficulty: 5,
    scheduledDays: 5,
    learningSteps: 0,
    reps: 3,
    lapses: 0,
    lastReview: "2026-10-01T00:00:00Z",
    textHash: "h",
    createdAt: "2026-10-01T00:00:00Z",
    ...overrides,
  };
}

describe("Warteschlange", () => {
  const now = new Date("2026-10-13T10:00:00Z");

  it("geänderte Stellen vor fälligen, fällige vor neuen", () => {
    const items = [item("a", "s1", 1), item("b", "s1", 2, "neu"), item("c", "s1", 3)];
    const cards = new Map([
      [items[0].key, card("2026-10-12T00:00:00Z")],
      [items[1].key, card("2026-11-01T00:00:00Z")],
    ]);
    const queue = todayQueue({ items, cards, rehearsals: new Map(), now });
    expect(queue.map((entry) => entry.lineageId)).toEqual(["b", "a", "c"]);
  });

  it("zieht bald geprobte Szenen vor und begrenzt neue Stellen", () => {
    const items = Array.from({ length: 30 }, (_, i) => item(`x${i}`, i < 15 ? "s1" : "s2", i));
    const queue = todayQueue({
      items,
      cards: new Map(),
      rehearsals: new Map([["s2", "2026-10-15T18:00:00Z"]]),
      now,
    });
    expect(queue).toHaveLength(NEW_PER_DAY);
    expect(queue[0].sceneId).toBe("s2");
  });

  it("Mehr lernen liefert neue, danach vorgezogene Wiederholungen", () => {
    const items = [item("a", "s1", 1), item("b", "s1", 2)];
    const cards = new Map([
      [items[0].key, card("2026-11-01T00:00:00Z", { stability: 9 })],
      [items[1].key, card("2026-11-01T00:00:00Z", { stability: 2 })],
    ]);
    const input = { items, cards, rehearsals: new Map(), now };
    expect(todayQueue(input)).toHaveLength(0);
    expect(moreQueue(input, new Set()).map((entry) => entry.lineageId)).toEqual(["b", "a"]);
    expect(moreQueue({ ...input, cards: new Map() }, new Set())).toHaveLength(2);
  });

  it("zählt Fortschritt je Szene", () => {
    const items = [item("a", "s1", 1), item("b", "s1", 2)];
    const cards = new Map([[items[0].key, card("2026-11-01T00:00:00Z", { stability: 20 })]]);
    const [progress] = sceneProgress({ items, cards, rehearsals: new Map(), now });
    expect(progress).toMatchObject({ total: 2, solid: 1, new: 1 });
    expect(summarize({ items, cards, rehearsals: new Map(), now }).fresh).toHaveLength(1);
  });

  it("zählt gemeinsame Repliken mehrerer Rollen als eine Stelle (schwächste Karte)", () => {
    const a = item("a", "s1", 1);
    const b = { ...a, key: itemKey("r2", "a", 0), roleId: "r2" };
    const sure = card("2026-11-01T00:00:00Z", {
      stability: 20,
      lastReview: "2026-10-12T00:00:00Z",
    });
    const both = new Map([
      [a.key, sure],
      [b.key, sure],
    ]);
    expect(
      sceneProgress({ items: [a, b], cards: both, rehearsals: new Map(), now })[0],
    ).toMatchObject({ total: 1, solid: 1 });
    const one = new Map([[a.key, sure]]);
    expect(
      sceneProgress({ items: [a, b], cards: one, rehearsals: new Map(), now })[0],
    ).toMatchObject({ total: 1, new: 1 });
  });

  it("frischt wacklige Stellen vor einer Probe auf", () => {
    const items = [item("a", "s1", 1)];
    const cards = new Map([
      [
        items[0].key,
        card("2026-10-20T00:00:00Z", { stability: 5, lastReview: "2026-10-08T00:00:00Z" }),
      ],
    ]);
    const without = summarize({ items, cards, rehearsals: new Map(), now });
    expect(without.due).toHaveLength(0);
    const before = summarize({
      items,
      cards,
      rehearsals: new Map([["s1", "2026-10-14T18:00:00Z"]]),
      now,
    });
    expect(before.due).toHaveLength(1);
    const progress = sceneProgress({
      items,
      cards,
      rehearsals: new Map([["s1", "2026-10-14T18:00:00Z"]]),
      now,
    });
    expect(progress[0].due).toBe(1);
  });
});

describe("Wochenziel und Szenenzuordnung", () => {
  it("markiert Lerntage der laufenden Woche", () => {
    const now = new Date(2026, 9, 14, 12); // Mittwoch
    const days = weekDays(new Set([dayKey(new Date(2026, 9, 12)), dayKey(now)]), now);
    expect(days).toEqual([true, false, true, false, false, false, false]);
  });

  it("ordnet Szenen über Titel, Nummer oder Reihenfolge zu", () => {
    const script = [
      { id: "a", title: "1. Im Wald" },
      { id: "b", title: "Szene 2: Die Burg" },
    ];
    expect(
      matchScenes(
        [
          { id: "x", title: "Die Burg", identifier: "1.2" },
          { id: "y", title: "Wald", identifier: "1.1" },
        ],
        script,
      ),
    ).toEqual(
      new Map([
        ["x", "b"],
        ["y", "a"],
      ]),
    );
    expect(
      matchScenes(
        [
          { id: "x", title: null, identifier: null },
          { id: "y", title: null, identifier: null },
        ],
        script,
      ),
    ).toEqual(
      new Map([
        ["x", "a"],
        ["y", "b"],
      ]),
    );
  });
});
