import { describe, expect, it } from "vitest";

import type { StoredCard } from "@/lib/skript/learn/plan";

import { mergeSnapshot } from "../model";

function card(lastReview: string): StoredCard {
  return {
    state: 2,
    due: "2026-10-20T00:00:00Z",
    stability: 5,
    difficulty: 5,
    scheduledDays: 5,
    learningSteps: 0,
    reps: 2,
    lapses: 0,
    lastReview,
    textHash: "h",
    createdAt: "2026-10-01T00:00:00Z",
  };
}

describe("Offline-Lernstand zusammenführen", () => {
  const generatedAt = "2026-10-14T10:00:00.000Z";

  it("übernimmt nach dem Erzeugen der Seite Gelerntes, sonst gilt der Server", () => {
    const server = new Map([
      ["a", card("2026-10-13T10:00:00.000Z")],
      ["b", card("2026-10-13T10:00:00.000Z")],
    ]);
    const merged = mergeSnapshot(
      server,
      [{ key: "a", at: "2026-10-13T10:00:00.000Z", rating: 3, mode: "drill" }],
      {
        cards: {
          a: card("2026-10-14T11:00:00.000Z"),
          b: card("2026-10-12T10:00:00.000Z"),
          // auf einem anderen Gerät zurückgesetzt: lokal alt, Server leer → weg
          c: card("2026-10-12T10:00:00.000Z"),
          d: card("2026-10-14T12:00:00.000Z"),
        },
        history: [
          { key: "a", at: "2026-10-14T11:00:00.000Z", rating: 3, mode: "flow" },
          { key: "a", at: "2026-10-13T10:00:00.000Z", rating: 3, mode: "drill" },
        ],
      },
      generatedAt,
    );
    expect(merged.cards.get("a")!.lastReview).toBe("2026-10-14T11:00:00.000Z");
    expect(merged.cards.get("b")!.lastReview).toBe("2026-10-13T10:00:00.000Z");
    expect(merged.cards.has("c")).toBe(false);
    expect(merged.cards.has("d")).toBe(true);
    expect(merged.history).toHaveLength(2);
  });
});
