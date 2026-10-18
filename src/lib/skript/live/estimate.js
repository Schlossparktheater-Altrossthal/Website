/**
 * Statistische Live-Stelle (docs/Plan/skript-mitlesen-plan.md, „Grundidee der statistischen
 * Live-Stelle“, Phase 3). Reine Funktion ohne DOM und ohne Netz: der Realtime-Server ruft sie je
 * Raum etwa zweimal pro Sekunde auf, die Tests mit simulierten Lesungen.
 *
 * Positionen sind Achsen-Zeichen (src/lib/skript/live/axis.ts). Plain JS, weil der
 * Realtime-Server ohne Build läuft; Typen in estimate.d.ts.
 */

/** Nur wer sich in dieser Zeit bewegt hat, zählt für die Messung. */
export const ACTIVE_MS = 20_000;
/** Wer länger nichts bewegt hat, gilt als weg (Gerät liegt weg). */
export const PRESENT_MS = 120_000;
/** Schneller als das = blättert/sucht gerade (Zeichen/s), zählt eine Weile nicht. */
export const SEARCH_CPS = 120;
export const SEARCH_HOLD_MS = 3_000;
/** Fenster um die Vorhersage, in dem Meldungen als „liest mit“ gelten. */
export const WINDOW = 1_500;
/** Bestätigung, bevor die Mehrheit woanders als Sprung übernommen wird. */
export const JUMP_CONFIRM_MS = 3_000;
/** Stehen alle so lange still, wird angehalten (Gespräch, Pause). */
export const STILL_MS = 30_000;
/** Die Stelle läuft höchstens so weit vor der vordersten Lesezeile. */
export const LEAD_MAX = 800;
export const START_CPS = 14;
export const MAX_CPS = 40;
const ALPHA = 0.35;
const BETA = 0.05;
const LEADER_WEIGHT = 3;

/**
 * @typedef {{ key: string; pos: number; at: number; leader?: boolean; searchingUntil?: number }} Report
 * @typedef {{ pos: number; rate: number; t: number; jump: { pos: number; since: number } | null }} EstimateState
 * @typedef {{ pos: number; rate: number; confident: boolean; active: number; state: EstimateState }} Estimate
 */

/** Gewichteter Median: robust gegen einzelne Nachleser und Vorausblätterer. */
export function weightedMedian(items) {
  if (!items.length) return null;
  const sorted = [...items].sort((a, b) => a.pos - b.pos);
  const total = sorted.reduce((sum, item) => sum + item.weight, 0);
  let acc = 0;
  for (const item of sorted) {
    acc += item.weight;
    if (acc >= total / 2) return item.pos;
  }
  return sorted[sorted.length - 1].pos;
}

const weightOf = (report) => (report.leader ? LEADER_WEIGHT : 1);

/**
 * @param {EstimateState | null} state  vorheriger Stand (null = neu)
 * @param {Report[]} reports            letzte Meldung je Person (ohne Folgende/Echos)
 * @param {number} now                  ms
 * @returns {Estimate | null}
 */
export function estimate(state, reports, now) {
  const present = reports.filter((report) => now - report.at <= PRESENT_MS);
  const active = present.filter(
    (report) =>
      now - report.at <= ACTIVE_MS && !(report.searchingUntil && report.searchingUntil > now),
  );
  const weighted = active.map((report) => ({ pos: report.pos, weight: weightOf(report) }));

  if (!state) {
    const start = weightedMedian(weighted);
    if (start === null) return null;
    const next = { pos: start, rate: START_CPS, t: now, jump: null };
    return finish(next, active, start, now);
  }

  const dt = Math.max(0, (now - state.t) / 1000);
  const anyMoved = present.some((report) => now - report.at < STILL_MS);
  // Niemand meldet mehr (alle folgen automatisch): mit dem bisherigen Tempo weiter.
  // Alle noch da, aber seit langem still: anhalten (Gespräch, Pause).
  const rate = present.length && !anyMoved ? 0 : state.rate;
  const predicted = state.pos + rate * dt;

  if (!active.length) {
    return {
      pos: predicted,
      rate,
      confident: false,
      active: 0,
      state: { pos: predicted, rate, t: now, jump: null },
    };
  }

  const inside = weighted.filter((item) => Math.abs(item.pos - predicted) <= WINDOW);
  const outside = weighted.filter((item) => Math.abs(item.pos - predicted) > WINDOW);
  const insideWeight = inside.reduce((sum, item) => sum + item.weight, 0);
  const outsideWeight = outside.reduce((sum, item) => sum + item.weight, 0);

  // Mehrheit liest woanders und liegt dort beisammen → nach Bestätigung springen.
  if (outsideWeight > insideWeight && outside.length >= Math.min(2, active.length)) {
    const target = weightedMedian(outside);
    const together = outside.every((item) => Math.abs(item.pos - target) <= WINDOW);
    if (together) {
      const jump =
        state.jump && Math.abs(state.jump.pos - target) <= WINDOW
          ? { pos: target, since: state.jump.since }
          : { pos: target, since: now };
      if (now - jump.since >= JUMP_CONFIRM_MS) {
        const next = { pos: target, rate: Math.max(rate, START_CPS / 2), t: now, jump: null };
        return finish(next, active, target, now);
      }
      return {
        pos: predicted,
        rate,
        confident: false,
        active: active.length,
        state: { pos: predicted, rate, t: now, jump },
      };
    }
  }

  const measured = weightedMedian(inside);
  if (measured === null) {
    return {
      pos: predicted,
      rate,
      confident: false,
      active: active.length,
      state: { pos: predicted, rate, t: now, jump: null },
    };
  }

  // α-β-Filter: Stelle zur Messung ziehen, Tempo langsam nachführen.
  const residual = measured - predicted;
  let pos = predicted + ALPHA * residual;
  const nextRate =
    rate === 0 ? 0 : Math.min(MAX_CPS, Math.max(0, rate + (dt > 0 ? (BETA * residual) / dt : 0)));
  const front = Math.max(...inside.map((item) => item.pos));
  pos = Math.min(pos, front + LEAD_MAX);
  // Wieder Bewegung nach einer Pause: mit Starttempo anlaufen.
  const resumed = rate === 0 && anyMoved ? Math.max(state.rate, START_CPS / 2) : nextRate;
  return finish({ pos, rate: resumed, t: now, jump: null }, active, measured, now);
}

function finish(state, active, measured, now) {
  const near = active.filter((report) => Math.abs(report.pos - measured) <= WINDOW);
  const leaderNear = near.some((report) => report.leader);
  return {
    pos: state.pos,
    rate: state.rate,
    confident: near.length >= 2 || leaderNear,
    active: near.length,
    state: { ...state, t: now },
  };
}

/** Sucht/blättert jemand? Aus zwei Meldungen derselben Person. */
export function searchingUntil(previous, next) {
  if (!previous) return 0;
  const dt = (next.at - previous.at) / 1000;
  if (dt <= 0) return previous.searchingUntil ?? 0;
  const speed = Math.abs(next.pos - previous.pos) / dt;
  return speed > SEARCH_CPS ? next.at + SEARCH_HOLD_MS : (previous.searchingUntil ?? 0);
}
