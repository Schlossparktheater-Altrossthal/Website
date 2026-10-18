import type { ScriptPart } from "../types";

/**
 * Positionsachse fürs Live-Mitlesen (docs/Plan/skript-mitlesen-plan.md): „gelesene Zeichen ab
 * Anfang“. Gesprochener Text zählt voll, Regie weniger (wird gespielt, nicht vorgelesen),
 * technische Hinweise gar nicht. Client-sicher, auch für den Realtime-Server gedacht.
 */

export const DIRECTION_WEIGHT = 0.4;
/** Jeder Absatz braucht etwas Zeit (Sprecherwechsel, Blick zur nächsten Zeile). */
export const BLOCK_MIN_WEIGHT = 8;

export type AxisBlock = { sceneId: string; parts: ScriptPart[] };

export type LiveAxis = {
  /** Beginn jedes Absatzes auf der Achse. */
  starts: number[];
  lengths: number[];
  total: number;
};

export type AxisPoint = { index: number; fraction: number };

export function blockWeight(block: AxisBlock): number {
  let weight = 0;
  for (const part of block.parts) {
    if (part.kind === "text") weight += part.text.length;
    else if (part.kind === "direction") weight += part.text.length * DIRECTION_WEIGHT;
  }
  return Math.max(BLOCK_MIN_WEIGHT, weight);
}

export function buildAxis(blocks: AxisBlock[]): LiveAxis {
  const starts: number[] = [];
  const lengths: number[] = [];
  let total = 0;
  for (const block of blocks) {
    const length = blockWeight(block);
    starts.push(total);
    lengths.push(length);
    total += length;
  }
  return { starts, lengths, total };
}

export function toAxis(axis: LiveAxis, point: AxisPoint): number {
  if (!axis.starts.length) return 0;
  const index = Math.min(Math.max(point.index, 0), axis.starts.length - 1);
  const fraction = Math.min(Math.max(point.fraction, 0), 1);
  return axis.starts[index] + axis.lengths[index] * fraction;
}

export function fromAxis(axis: LiveAxis, position: number): AxisPoint {
  const count = axis.starts.length;
  if (!count) return { index: 0, fraction: 0 };
  if (position <= 0) return { index: 0, fraction: 0 };
  if (position >= axis.total) return { index: count - 1, fraction: 1 };
  let low = 0;
  let high = count - 1;
  while (low < high) {
    const mid = (low + high + 1) >> 1;
    if (axis.starts[mid] <= position) low = mid;
    else high = mid - 1;
  }
  return { index: low, fraction: (position - axis.starts[low]) / axis.lengths[low] };
}
