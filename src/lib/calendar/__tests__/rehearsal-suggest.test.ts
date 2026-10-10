import { describe, expect, it } from "vitest";

import {
  optimizeOrder,
  pickScenes,
  rankScenes,
  totalWait,
  type SceneCandidate,
} from "@/lib/calendar/rehearsal-suggest";

function candidate(sceneId: string, patch: Partial<SceneCandidate> = {}): SceneCandidate {
  return {
    sceneId,
    label: `Sz. ${sceneId}`,
    durationMinutes: 30,
    readiness: "ready",
    people: [],
    done: 2,
    planned: 0,
    blocksSince: 0,
    behind: [],
    ...patch,
  };
}

describe("rankScenes", () => {
  it("prefers never rehearsed and long-ago scenes, drops unplayable ones", () => {
    const ranked = rankScenes([
      candidate("fresh", { done: 5 }),
      candidate("never", { done: 0 }),
      candidate("old", { blocksSince: 2 }),
      candidate("missing", { readiness: "missing", done: 0 }),
    ]);
    expect(ranked.map((entry) => entry.sceneId)).toEqual(["never", "old", "fresh"]);
    expect(ranked[0]?.reasons).toContain("noch nie geprobt");
  });
});

describe("pickScenes", () => {
  it("fills the budget and favours shared casts", () => {
    const ranked = rankScenes([
      candidate("a", { people: ["max", "ben"] }),
      candidate("b", { people: ["max"] }),
      candidate("c", { people: ["lena", "tom", "eva"] }),
    ]);
    const result = pickScenes(ranked, 60);
    expect(result.used).toBe(60);
    expect(result.picked.map((entry) => entry.sceneId).sort()).toEqual(["a", "b"]);
    expect(result.people).toBe(2);
  });

  it("never exceeds the budget", () => {
    const result = pickScenes(rankScenes([candidate("long", { durationMinutes: 90 })]), 60);
    expect(result.picked).toEqual([]);
  });
});

describe("optimizeOrder", () => {
  it("groups scenes of the same people to cut waiting", () => {
    const items = [
      { id: "1", durationMinutes: 30, people: ["max"] },
      { id: "2", durationMinutes: 30, people: ["ben"] },
      { id: "3", durationMinutes: 30, people: ["max"] },
      { id: "4", durationMinutes: 30, people: ["ben"] },
    ];
    expect(totalWait(items)).toBe(60);
    const order = optimizeOrder(items);
    expect(totalWait(order)).toBe(0);
  });
});
