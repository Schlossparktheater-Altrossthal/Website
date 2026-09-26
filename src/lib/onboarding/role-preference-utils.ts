import type { OnboardingFocus } from "@prisma/client";

/**
 * Stufen für Rollen- und Gewerkewünsche. Jeder Bereich wird einzeln bewertet – die Gewichte
 * sind kein Budget, das sich auf 100 summieren muss. Gespeichert wird weiterhin `weight` (0–100).
 */
export const ROLE_PREFERENCE_LEVELS = [
  { value: "like", label: "Gern", weight: 50 },
  { value: "keen", label: "Sehr gern", weight: 75 },
  { value: "love", label: "Unbedingt", weight: 100 },
] as const;

export type RolePreferenceLevel = (typeof ROLE_PREFERENCE_LEVELS)[number]["value"];

/** Ordnet ein gespeichertes Gewicht (auch alte Slider-Werte) der nächstliegenden Stufe zu. */
export function getRolePreferenceLevel(weight: number): RolePreferenceLevel | null {
  const normalized = normalizeRolePreferenceWeight(weight);
  if (normalized <= 0) return null;
  if (normalized < 63) return "like";
  if (normalized < 88) return "keen";
  return "love";
}

export function getRolePreferenceLevelWeight(level: RolePreferenceLevel): number {
  return ROLE_PREFERENCE_LEVELS.find((entry) => entry.value === level)?.weight ?? 50;
}

export function getRolePreferenceWeightLabel(weight: number): string {
  const level = getRolePreferenceLevel(weight);
  return ROLE_PREFERENCE_LEVELS.find((entry) => entry.value === level)?.label ?? "Kein Interesse";
}

export function normalizeRolePreferenceWeight(weight: number): number {
  if (!Number.isFinite(weight)) {
    return 0;
  }
  const rounded = Math.round(weight);
  if (rounded < 0) return 0;
  if (rounded > 100) return 100;
  return rounded;
}

export function createCustomRolePreferenceCode(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `custom-${crypto.randomUUID()}`;
  }
  return `custom-${Math.random().toString(36).slice(2, 10)}`;
}

type FocusPreferenceCandidate = {
  domain: "acting" | "crew";
  weight: number;
  enabled?: boolean;
};

export function deriveOnboardingFocusFromPreferences(
  preferences: Iterable<FocusPreferenceCandidate>,
): OnboardingFocus | null {
  let actingSelected = false;
  let crewSelected = false;

  for (const preference of preferences) {
    if (preference.enabled === false) {
      continue;
    }
    if (!Number.isFinite(preference.weight) || preference.weight <= 0) {
      continue;
    }

    if (preference.domain === "acting") {
      actingSelected = true;
    } else if (preference.domain === "crew") {
      crewSelected = true;
    }

    if (actingSelected && crewSelected) {
      return "both";
    }
  }

  if (crewSelected) {
    return "tech";
  }
  if (actingSelected) {
    return "acting";
  }
  return null;
}
