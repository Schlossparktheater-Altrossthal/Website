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
