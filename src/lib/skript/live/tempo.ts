import { blockWeight, type AxisBlock, type LiveAxis } from "./axis";

/**
 * Sprechtempo in Achsen-Zeichen pro Sekunde (docs/Plan/skript-mitlesen-plan.md). Ohne gemessene
 * Szenenzeit ~14 Zeichen/s (≈ 150 Wörter/min); mit gemessener Dauer das Tempo dieser Szene.
 */

export const DEFAULT_CPS = 14;
export const MIN_CPS = 4;
export const MAX_CPS = 40;
export const TEMPO_FACTORS = [0.5, 0.6, 0.7, 0.8, 0.9, 1, 1.1, 1.25, 1.4, 1.6, 1.8, 2];

export type TempoScene = { id: string; measuredSeconds: number | null };

/** Tempo je Absatz (aus der Szene, in der er steht). */
export function blockRates(blocks: AxisBlock[], scenes: TempoScene[]): number[] {
  const weights = new Map<string, number>();
  for (const block of blocks) {
    weights.set(block.sceneId, (weights.get(block.sceneId) ?? 0) + blockWeight(block));
  }
  const rates = new Map<string, number>();
  for (const scene of scenes) {
    const weight = weights.get(scene.id);
    if (!weight || !scene.measuredSeconds || scene.measuredSeconds < 10) continue;
    rates.set(scene.id, clampCps(weight / scene.measuredSeconds));
  }
  return blocks.map((block) => rates.get(block.sceneId) ?? DEFAULT_CPS);
}

export function clampCps(cps: number) {
  return Math.min(MAX_CPS, Math.max(MIN_CPS, cps));
}

/** Position nach `seconds` Lesezeit; Absatzgrenzen mit anderem Tempo werden berücksichtigt. */
export function advance(
  axis: LiveAxis,
  rates: number[],
  position: number,
  seconds: number,
  factor = 1,
): number {
  let pos = Math.max(0, position);
  let left = Math.max(0, seconds);
  let index = indexAt(axis, pos);
  while (left > 0 && index < axis.starts.length) {
    const rate = (rates[index] ?? DEFAULT_CPS) * factor;
    const end = axis.starts[index] + axis.lengths[index];
    const needed = (end - pos) / rate;
    if (needed >= left) return pos + left * rate;
    left -= needed;
    pos = end;
    index += 1;
  }
  return Math.min(pos, axis.total);
}

function indexAt(axis: LiveAxis, position: number) {
  let low = 0;
  let high = axis.starts.length - 1;
  while (low < high) {
    const mid = (low + high + 1) >> 1;
    if (axis.starts[mid] <= position) low = mid;
    else high = mid - 1;
  }
  return low;
}

export function nearestFactorIndex(factor: number) {
  let best = 0;
  TEMPO_FACTORS.forEach((value, index) => {
    if (Math.abs(value - factor) < Math.abs(TEMPO_FACTORS[best] - factor)) best = index;
  });
  return best;
}
