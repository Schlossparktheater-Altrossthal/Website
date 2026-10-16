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

/** Ab dieser Stufe gilt ein Wunsch als Top-Wunsch („Sehr gern“). */
const TOP_THRESHOLD =
  ROLE_PREFERENCE_WEIGHT_LABELS.find((entry) => entry.label === "Sehr gern")?.threshold ?? 55;

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

/** Top-Wunsch: ab „Sehr gern“ oder – wenn die Person nichts so hoch hat – ihr höchster Wunsch. */
export function isTopWish(weight: number, maxWeight: number) {
  return weight >= TOP_THRESHOLD || (maxWeight < TOP_THRESHOLD && weight === maxWeight);
}
