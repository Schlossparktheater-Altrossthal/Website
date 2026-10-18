export const ACTIVE_MS: number;
export const PRESENT_MS: number;
export const SEARCH_CPS: number;
export const SEARCH_HOLD_MS: number;
export const WINDOW: number;
export const JUMP_CONFIRM_MS: number;
export const STILL_MS: number;
export const LEAD_MAX: number;
export const START_CPS: number;
export const MAX_CPS: number;

export type Report = {
  key: string;
  pos: number;
  /** Zeitpunkt der letzten Bewegung (ms). */
  at: number;
  leader?: boolean;
  searchingUntil?: number;
};

export type EstimateState = {
  pos: number;
  rate: number;
  t: number;
  jump: { pos: number; since: number } | null;
};

export type Estimate = {
  pos: number;
  rate: number;
  confident: boolean;
  active: number;
  state: EstimateState;
};

export function weightedMedian(items: { pos: number; weight: number }[]): number | null;
export function estimate(
  state: EstimateState | null,
  reports: Report[],
  now: number,
): Estimate | null;
export function searchingUntil(
  previous: { pos: number; at: number; searchingUntil?: number } | null,
  next: { pos: number; at: number },
): number;
