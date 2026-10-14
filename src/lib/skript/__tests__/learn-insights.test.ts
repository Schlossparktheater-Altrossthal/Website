import { describe, expect, it } from "vitest";

import {
  confidenceHistory,
  cueWeaknesses,
  dailyCounts,
  forecast,
  goalWeeks,
  milestones,
  problemUnits,
} from "../learn/insights";
import { itemKey, type LearnItem, type StoredCard } from "../learn/plan";

const now = new Date("2026-10-14T10:00:00");

function item(id: string, sceneId = "s1"): LearnItem {
  return {
    key: itemKey("r", id, 0),
    roleId: "r",
    blockId: id,
    lineageId: id,
    sceneId,
    chunk: 0,
    hash: "h",
    words: 5,
    order: 0,
  };
}

function card(overrides: Partial<StoredCard> = {}): StoredCard {
  return {
    state: 2,
    due: "2026-10-20T00:00:00Z",
    stability: 10,
    difficulty: 5,
    scheduledDays: 10,
    learningSteps: 0,
    reps: 3,
    lapses: 0,
    lastReview: "2026-10-13T10:00:00Z",
    textHash: "h",
    createdAt: "2026-10-01T00:00:00Z",
    ...overrides,
  };
}

describe("Lern-Statistik", () => {
  it("zählt Abfragen je Tag über 12 Wochen bis Sonntag der laufenden Woche", () => {
    const days = dailyCounts(
      [
        { key: "a", at: "2026-10-14T08:00:00", rating: 3, mode: "drill" },
        { key: "b", at: "2026-10-14T09:00:00", rating: 3, mode: "flow" },
      ],
      now,
    );
    expect(days).toHaveLength(84);
    expect(days.at(-1)!.day).toBe("2026-10-18");
    expect(days.find((day) => day.day === "2026-10-14")!.count).toBe(2);
  });

  it("Prognose sinkt ohne Lernen", () => {
    const items = [item("a")];
    const cards = new Map([[items[0].key, card()]]);
    const [today, , week] = forecast({ items, cards, rehearsals: new Map(), now });
    expect(today.value).toBeGreaterThan(week.value);
    expect(today.days).toBe(0);
  });

  it("Problemstellen: oft vergessen zuerst, neue nicht", () => {
    const items = [item("a"), item("b"), item("c")];
    const cards = new Map([
      [items[0].key, card({ difficulty: 8 })],
      [items[1].key, card({ lapses: 3 })],
    ]);
    const result = problemUnits({ items, cards, rehearsals: new Map(), now });
    expect(result.map((entry) => entry.unitId)).toEqual(["b|0", "a|0"]);
  });

  it("Stichwort-Schwächen: im Fluss deutlich schlechter als in der Abfrage", () => {
    const items = [item("a"), item("b")];
    const at = "2026-10-13T10:00:00Z";
    const history = [
      { key: items[0].key, at, rating: 3, mode: "drill" },
      { key: items[0].key, at, rating: 1, mode: "flow" },
      { key: items[1].key, at, rating: 3, mode: "drill" },
      { key: items[1].key, at, rating: 3, mode: "flow" },
    ];
    expect(cueWeaknesses(history, items).map((entry) => entry.unitId)).toEqual(["a|0"]);
  });

  it("Verlauf der Textsicherheit steigt am Lerntag und fällt danach", () => {
    const items = [item("a")];
    const history = [
      { key: items[0].key, at: "2026-10-10T09:00:00", rating: 3, mode: "drill" },
      { key: items[0].key, at: "2026-10-10T09:10:00", rating: 3, mode: "drill" },
    ];
    const points = confidenceHistory(
      { items, cards: new Map(), rehearsals: new Map(), now },
      history,
    );
    expect(points[0].day).toBe("2026-10-10");
    expect(points).toHaveLength(5);
    expect(points[0].value).toBeGreaterThan(0.9);
    expect(points.at(-1)!.value).toBeLessThan(points[0].value);
  });

  it("Meilensteine und Wochenziel", () => {
    const items = [item("a"), item("b", "s2")];
    const cards = new Map([[items[0].key, card({ stability: 30 })]]);
    const history = ["2026-10-12", "2026-10-13", "2026-10-14"].map((day) => ({
      key: items[0].key,
      at: `${day}T09:00:00`,
      rating: 3,
      mode: "drill",
    }));
    expect(goalWeeks(history, 3)).toBe(1);
    expect(goalWeeks(history, 4)).toBe(0);
    const result = milestones({ items, cards, rehearsals: new Map(), now }, history, 3);
    const byId = Object.fromEntries(result.map((entry) => [entry.id, entry]));
    expect(byId["erste-stelle"].achieved).toBe(true);
    expect(byId["erste-szene"].achieved).toBe(true);
    expect(byId["ganze-rolle"]).toMatchObject({ achieved: false, current: 1, target: 2 });
    expect(byId["alles-angefangen"]).toMatchObject({ current: 1, target: 2 });
    expect(byId["wochenziel"].achieved).toBe(true);
  });
});
