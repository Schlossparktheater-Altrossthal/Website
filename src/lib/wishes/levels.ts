import {
  ROLE_PREFERENCE_WEIGHT_LABELS,
  normalizeRolePreferenceWeight,
} from "@/lib/onboarding/role-preference-utils";

/**
 * Stufen der Wunschliste, abgeleitet aus dem gespeicherten Gewicht (0–100). Gleiche Grenzen wie
 * `ROLE_PREFERENCE_WEIGHT_LABELS`, damit Profil und Wunschliste dasselbe Wort zeigen.
 */
export type WishLevel = 4 | 3 | 2 | 1;

export const WISH_LEVELS: ReadonlyArray<{ level: WishLevel; label: string; weight: number }> = [
  { level: 4, label: "Unbedingt", weight: 90 },
  { level: 3, label: "Sehr gern", weight: 65 },
  { level: 2, label: "Gern", weight: 40 },
  { level: 1, label: "Vielleicht", weight: 15 },
];

export function wishLevelOf(weight: number): WishLevel {
  const normalized = normalizeRolePreferenceWeight(weight);
  const index = [...ROLE_PREFERENCE_WEIGHT_LABELS]
    .reverse()
    .findIndex((entry) => normalized >= entry.threshold);
  if (index < 0) return 1;
  return (ROLE_PREFERENCE_WEIGHT_LABELS.length - index) as WishLevel;
}

export function wishLevelLabel(level: WishLevel) {
  return WISH_LEVELS.find((entry) => entry.level === level)?.label ?? "Vielleicht";
}

/**
 * Top-Wunsch: alles in derselben Stufe wie der höchste Wunsch der Person. Die Regler sind stufenlos,
 * deshalb zählt die Stufe (das angezeigte Wort) und nicht das genaue Gewicht.
 */
export function isTopWish(weight: number, maxWeight: number) {
  return (
    normalizeRolePreferenceWeight(weight) > 0 && wishLevelOf(weight) === wishLevelOf(maxWeight)
  );
}

/** Markiert für eine Liste von Gewichten (0 = kein Wunsch) die Top-Wünsche. */
export function topWishFlags(weights: number[]): boolean[] {
  const max = Math.max(0, ...weights);
  return weights.map((weight) => isTopWish(weight, max));
}
