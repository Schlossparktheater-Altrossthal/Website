import { AllergyLevel } from "@prisma/client";

type AllergyLevelStyle = {
  badge: string;
  accent: string;
  intensity: number;
};

export const ALLERGY_LEVEL_STYLES: Record<AllergyLevel, AllergyLevelStyle> = {
  MILD: {
    badge: "border-success/40 bg-success/10 text-success",
    accent: "from-success/70 to-success/40",
    intensity: 35,
  },
  MODERATE: {
    badge: "border-warning/40 bg-warning/10 text-warning",
    accent: "from-warning/70 to-warning/40",
    intensity: 55,
  },
  SEVERE: {
    badge: "border-destructive/40 bg-destructive/10 text-destructive",
    accent: "from-destructive/70 to-destructive/40",
    intensity: 75,
  },
  LETHAL: {
    badge: "border-destructive/50 bg-destructive/10 text-destructive",
    accent: "from-destructive/80 to-destructive/60",
    intensity: 95,
  },
};

export type AllergyLevelStyleKey = keyof typeof ALLERGY_LEVEL_STYLES;

/** Anzeigetext des Schweregrads. */
export const ALLERGY_LEVEL_LABELS: Record<AllergyLevel, string> = {
  MILD: "Leicht",
  MODERATE: "Mittel",
  SEVERE: "Schwer",
  LETHAL: "Lebensbedrohlich",
};

/** Die Werte des Prisma-Enums als Tupel, damit Schemas und Auswahllisten dieselbe Quelle nutzen. */
export const ALLERGY_LEVEL_VALUES = [
  "MILD",
  "MODERATE",
  "SEVERE",
  "LETHAL",
] as const satisfies readonly AllergyLevel[];

export const ALLERGY_LEVEL_OPTIONS: readonly { value: AllergyLevel; label: string }[] =
  ALLERGY_LEVEL_VALUES.map((value) => ({ value, label: ALLERGY_LEVEL_LABELS[value] }));

/** Ein Allergeneintrag mit einer Angabe zu Spuren: „nicht angegeben" ist ein eigener Zustand. */
export const ALLERGY_TRACES_OPTIONS = [
  { value: "unset", label: "Nicht angegeben" },
  { value: "ok", label: "Spuren sind unproblematisch" },
  { value: "risk", label: "Spuren sind gefährlich" },
] as const;

export type AllergyTracesChoice = (typeof ALLERGY_TRACES_OPTIONS)[number]["value"];

export function toAllergyTracesChoice(tracesOk: boolean | null): AllergyTracesChoice {
  if (tracesOk === true) return "ok";
  if (tracesOk === false) return "risk";
  return "unset";
}

export function fromAllergyTracesChoice(choice: AllergyTracesChoice): boolean | null {
  if (choice === "ok") return true;
  if (choice === "risk") return false;
  return null;
}
