import { describe, expect, it } from "vitest";

import {
  LEAD_MAX,
  estimate,
  searchingUntil,
  weightedMedian,
  type EstimateState,
  type Report,
} from "../live/estimate";

/** Deterministischer Zufall für reproduzierbare Simulationen. */
function random(seed: number) {
  let x = seed;
  return () => {
    x = (x * 1103515245 + 12345) % 2 ** 31;
    return x / 2 ** 31;
  };
}

type Reader = {
  key: string;
  leader?: boolean;
  /** Wo die Lesezeile dieser Person relativ zur gesprochenen Stelle liegt. */
  offset: number;
  /** Scrollt alle n Sekunden (große Schritte wie am Handy). */
  every: number;
  pos: number;
  at: number;
};

/**
 * Lesung: gesprochen wird mit `speech(t)`; jede Person scrollt in Abständen auf ihre Stelle.
 * Liefert die größte Abweichung der Schätzung nach der Einlaufzeit.
 */
function simulate({
  readers,
  speech,
  seconds,
  warmup = 30,
  check,
}: {
  readers: Reader[];
  speech: (t: number) => number;
  seconds: number;
  warmup?: number;
  check?: (t: number, pos: number, confident: boolean) => void;
}) {
  const rnd = random(7);
  let state: EstimateState | null = null;
  let worst = 0;
  for (let step = 0; step <= seconds * 2; step += 1) {
    const t = step / 2;
    const now = t * 1000;
    for (const reader of readers) {
      if (step % (reader.every * 2) !== 0) continue;
      const target = speech(t) + reader.offset + (rnd() - 0.5) * 150;
      if (Math.abs(target - reader.pos) > 1) {
        reader.pos = Math.max(0, target);
        reader.at = now;
      }
    }
    const reports: Report[] = readers.map(({ key, leader, pos, at }) => ({ key, leader, pos, at }));
    const result = estimate(state, reports, now);
    if (!result) continue;
    state = result.state;
    check?.(t, result.pos, result.confident);
    if (t >= warmup) worst = Math.max(worst, Math.abs(result.pos - speech(t)));
  }
  return worst;
}

const reader = (key: string, offset: number, every: number, leader = false): Reader => ({
  key,
  leader,
  offset,
  every,
  pos: 0,
  at: -1,
});

describe("statistische Live-Stelle", () => {
  it("weightedMedian ignoriert Ausreißer", () => {
    expect(
      weightedMedian([
        { pos: 100, weight: 1 },
        { pos: 110, weight: 1 },
        { pos: 9000, weight: 1 },
      ]),
    ).toBe(110);
  });

  it("folgt einer Lesung trotz Nachleser und Vorausblätterer", () => {
    const worst = simulate({
      speech: (t) => 14 * t,
      seconds: 600,
      readers: [
        reader("souffleuse", -40, 2, true),
        reader("a", -150, 6),
        reader("b", -250, 9),
        reader("c", -100, 12),
        reader("d", -300, 8),
        reader("nachleser", -3000, 10),
        reader("voraus", 4000, 15),
      ],
    });
    expect(worst).toBeLessThan(450);
  });

  it("passt sich an ein langsameres Tempo an", () => {
    const worst = simulate({
      speech: (t) => 8 * t,
      seconds: 600,
      warmup: 90,
      readers: [reader("a", -100, 5), reader("b", -200, 7), reader("c", -150, 9)],
    });
    expect(worst).toBeLessThan(400);
  });

  it("hält bei einer langen Unterbrechung an", () => {
    // 0–120 s lesen, 120–300 s Gespräch, danach weiter.
    const speech = (t: number) => 14 * Math.min(t, 120) + 14 * Math.max(0, t - 300);
    let maxAhead = 0;
    simulate({
      speech,
      seconds: 420,
      readers: [reader("a", -100, 5), reader("b", -200, 7), reader("c", -150, 9)],
      check: (t, pos) => {
        if (t > 120 && t < 300) maxAhead = Math.max(maxAhead, pos - speech(t));
      },
    });
    expect(maxAhead).toBeLessThanOrEqual(LEAD_MAX + 200);
  });

  it("übernimmt einen gemeinsamen Sprung nach kurzer Bestätigung", () => {
    // Bei 200 s: „wir machen ab Seite 30 weiter“.
    const speech = (t: number) => (t < 200 ? 14 * t : 14 * t + 8000);
    let caughtUpAt: number | null = null;
    simulate({
      speech,
      seconds: 260,
      readers: [
        reader("a", -100, 2),
        reader("b", -200, 3),
        reader("c", -150, 2),
        reader("d", -120, 4),
      ],
      check: (t, pos) => {
        if (t > 200 && caughtUpAt === null && Math.abs(pos - speech(t)) < 600) caughtUpAt = t;
      },
    });
    expect(caughtUpAt).not.toBeNull();
    expect(caughtUpAt!).toBeLessThan(212);
  });

  it("ist unsicher, solange nur eine Person ohne Führung meldet", () => {
    const result = estimate(null, [{ key: "a", pos: 500, at: 0 }], 0);
    expect(result?.confident).toBe(false);
    const lead = estimate(null, [{ key: "a", pos: 500, at: 0, leader: true }], 0);
    expect(lead?.confident).toBe(true);
  });

  it("erkennt schnelles Blättern", () => {
    expect(searchingUntil({ pos: 0, at: 0 }, { pos: 5000, at: 1000 })).toBe(4000);
    expect(searchingUntil({ pos: 0, at: 0 }, { pos: 50, at: 1000 })).toBe(0);
  });
});
