import { describe, expect, it } from "vitest";

import { BLOCK_MIN_WEIGHT, buildAxis, fromAxis, toAxis } from "../live/axis";
import {
  FOLLOWING,
  LIVE_FOLLOW,
  SOLO_TEMPO,
  checkResume,
  scrollStep,
  userInput,
} from "../live/follow";
import { DEFAULT_CPS, advance, blockRates } from "../live/tempo";

const text = (sceneId: string, length: number) => ({
  sceneId,
  parts: [{ kind: "text" as const, text: "x".repeat(length) }],
});
const blocks = [
  text("s1", 100),
  { sceneId: "s1", parts: [{ kind: "direction" as const, text: "y".repeat(100) }] },
  { sceneId: "s2", parts: [{ kind: "cue" as const, text: "Licht", category: "light" as const }] },
  text("s2", 200),
];
const axis = buildAxis(blocks);

describe("Positionsachse", () => {
  it("gewichtet Text voll, Regie weniger, Hinweise mit Mindestgewicht", () => {
    expect(axis.lengths).toEqual([100, 40, BLOCK_MIN_WEIGHT, 200]);
    expect(axis.total).toBe(348);
  });

  it("rechnet Absatz + Anteil hin und zurück", () => {
    const pos = toAxis(axis, { index: 3, fraction: 0.25 });
    expect(pos).toBe(198);
    expect(fromAxis(axis, pos)).toEqual({ index: 3, fraction: 0.25 });
    expect(fromAxis(axis, -5)).toEqual({ index: 0, fraction: 0 });
    expect(fromAxis(axis, 9999)).toEqual({ index: 3, fraction: 1 });
  });
});

describe("Tempo", () => {
  it("nimmt gemessene Szenenzeit, sonst den Standard", () => {
    const rates = blockRates(blocks, [
      { id: "s1", measuredSeconds: 14 },
      { id: "s2", measuredSeconds: null },
    ]);
    expect(rates).toEqual([10, 10, DEFAULT_CPS, DEFAULT_CPS]);
  });

  it("läuft über Absatzgrenzen mit wechselndem Tempo", () => {
    const rates = [10, 10, 20, 20];
    // 14 s: 140 Zeichen in s1 (10/s), dann 1 s mit 20/s.
    expect(advance(axis, rates, 0, 15)).toBeCloseTo(160);
    // Faktor 2: s1 in 7 s, Hinweis in 0,2 s, dann 2,8 s mit 40/s.
    expect(advance(axis, rates, 0, 10, 2)).toBeCloseTo(148 + 112);
    expect(advance(axis, rates, 300, 1000)).toBe(axis.total);
  });
});

describe("Folgen", () => {
  it("pausiert bei eigenem Scrollen und folgt nach Ruhe in der Nähe wieder", () => {
    const paused = userInput(0, 1000, 900, LIVE_FOLLOW);
    expect(checkResume(paused, 5000, 1000, 1100, LIVE_FOLLOW).resume).toBe(false);
    expect(checkResume(paused, 8000, 1000, 1100, LIVE_FOLLOW)).toEqual({
      resume: true,
      reanchor: false,
    });
  });

  it("bleibt beim Nachlesen weit hinten stehen", () => {
    const paused = userInput(0, 100, 5000, LIVE_FOLLOW);
    expect(checkResume(paused, 60_000, 100, 5000, LIVE_FOLLOW).resume).toBe(false);
  });

  it("wartet beim Vorausblättern, bis die Live-Stelle aufholt", () => {
    const paused = userInput(0, 9000, 1000, LIVE_FOLLOW);
    expect(checkResume(paused, 60_000, 9000, 8000, LIVE_FOLLOW).resume).toBe(false);
    expect(checkResume(paused, 60_000, 9000, 9001, LIVE_FOLLOW).resume).toBe(true);
  });

  it("Lesetempo allein: eigene Stelle wird nach kurzer Ruhe übernommen", () => {
    const paused = userInput(0, 9000, 1000, SOLO_TEMPO);
    expect(checkResume(paused, 1000, 9000, 1000, SOLO_TEMPO).resume).toBe(false);
    expect(checkResume(paused, 2000, 9000, 1000, SOLO_TEMPO)).toEqual({
      resume: true,
      reanchor: true,
    });
    expect(checkResume(FOLLOWING, 2000, 0, 0, SOLO_TEMPO).resume).toBe(false);
  });

  it("scrollt sanft, mindestens 1 px, große Sprünge sofort", () => {
    expect(scrollStep(0.5, 0.016, 800)).toBe(0);
    expect(scrollStep(10, 0.016, 800)).toBe(1);
    expect(scrollStep(-100, 0.016, 800)).toBeCloseTo(-6.4);
    expect(scrollStep(2000, 0.016, 800)).toBe(2000);
  });
});
