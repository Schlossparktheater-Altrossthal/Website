import { AllergyLevel } from "@prisma/client";

type AllergyLevelStyle = {
  badge: string;
  accent: string;
  intensity: number;
};

export const ALLERGY_LEVEL_STYLES: Record<AllergyLevel, AllergyLevelStyle> = {
  MILD: {
    badge: "border-emerald-400/40 bg-emerald-500/10 text-emerald-600",
    accent: "from-emerald-400/70 to-emerald-500/70",
    intensity: 35,
  },
  MODERATE: {
    badge: "border-amber-400/40 bg-amber-500/10 text-amber-600",
    accent: "from-amber-400/70 to-orange-400/70",
    intensity: 55,
  },
  SEVERE: {
    badge: "border-rose-400/40 bg-rose-500/10 text-rose-600",
    accent: "from-rose-400/70 to-rose-500/70",
    intensity: 75,
  },
  LETHAL: {
    badge: "border-red-500/50 bg-red-500/10 text-red-600",
    accent: "from-red-500/80 to-red-600/80",
    intensity: 95,
  },
};

export type AllergyLevelStyleKey = keyof typeof ALLERGY_LEVEL_STYLES;
