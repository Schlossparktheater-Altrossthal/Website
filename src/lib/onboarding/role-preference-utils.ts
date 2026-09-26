import type { OnboardingFocus } from "@prisma/client";

/**
 * Wort-Beschriftung für ein Wunschgewicht (0–100). Jeder Bereich wird einzeln bewertet – die
 * Gewichte sind kein Budget, das sich auf 100 summieren muss; deshalb nie als Prozent zeigen.
 */
export const ROLE_PREFERENCE_WEIGHT_LABELS: ReadonlyArray<{ threshold: number; label: string }> = [
  { threshold: 1, label: "Vielleicht" },
  { threshold: 30, label: "Gern" },
  { threshold: 55, label: "Sehr gern" },
  { threshold: 80, label: "Unbedingt" },
];

export function getRolePreferenceWeightLabel(weight: number): string {
  const normalized = normalizeRolePreferenceWeight(weight);
  const match = [...ROLE_PREFERENCE_WEIGHT_LABELS]
    .reverse()
    .find((entry) => normalized >= entry.threshold);
  return match?.label ?? "Kein Interesse";
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
