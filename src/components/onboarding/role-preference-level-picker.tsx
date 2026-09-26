"use client";

import type { ReactNode } from "react";

import { SegmentedControl, type SegmentedOption } from "@/components/ui/segmented-control";
import {
  ROLE_PREFERENCE_LEVELS,
  getRolePreferenceLevel,
  getRolePreferenceLevelWeight,
  type RolePreferenceLevel,
} from "@/lib/onboarding/role-preference-utils";
import { cn } from "@/lib/utils";

type LevelValue = RolePreferenceLevel | "none";

const LEVEL_OPTIONS: SegmentedOption<LevelValue>[] = [
  { value: "none", label: "Nein" },
  ...ROLE_PREFERENCE_LEVELS.map((level) => ({ value: level.value, label: level.label })),
];

type RolePreferenceLevelPickerProps = {
  title: string;
  description?: string | null;
  /** Zusatz neben dem Titel, z. B. „Eigenes Gewerk“. */
  badge?: ReactNode;
  /** Aktion rechts oben, z. B. Entfernen eines eigenen Gewerks. */
  action?: ReactNode;
  enabled: boolean;
  weight: number;
  /** `null` = abgewählt, sonst das Gewicht der gewählten Stufe. */
  onChange: (weight: number | null) => void;
};

/**
 * Ein Rollen-/Gewerkewunsch mit Stufenauswahl (Nein · Gern · Sehr gern · Unbedingt).
 * Ersetzt den früheren Prozent-Slider: große Tippflächen statt schmalem Regler und keine
 * Prozentzahlen, die wie ein gemeinsames 100-%-Budget wirken.
 */
export function RolePreferenceLevelPicker({
  title,
  description,
  badge,
  action,
  enabled,
  weight,
  onChange,
}: RolePreferenceLevelPickerProps) {
  const level: LevelValue = enabled ? (getRolePreferenceLevel(weight) ?? "none") : "none";
  const active = level !== "none";

  return (
    <div
      className={cn(
        "space-y-2 rounded-lg border p-3 transition-colors",
        active ? "border-primary/60 bg-primary/5" : "border-border/70",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 space-y-0.5">
          <p className="flex flex-wrap items-center gap-1.5 text-sm font-medium text-foreground">
            {title}
            {badge}
          </p>
          {description ? (
            <p className="line-clamp-2 text-xs text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {action}
      </div>
      <SegmentedControl
        value={level}
        onValueChange={(next) =>
          onChange(next === "none" ? null : getRolePreferenceLevelWeight(next))
        }
        options={LEVEL_OPTIONS}
        aria-label={`Wie gern: ${title}`}
        size="md"
        fullWidth
        className="[&>button]:h-11 [&>button]:px-1 [&>button]:text-xs sm:[&>button]:text-sm"
        activeClassName={(value) =>
          value === "none" ? undefined : "bg-primary text-primary-foreground ring-primary"
        }
      />
    </div>
  );
}

/** Kurzer Hinweis über den Wunschlisten, damit niemand an ein 100-%-Budget denkt. */
export function RolePreferenceLevelHint({ className }: { className?: string }) {
  return (
    <p className={cn("text-xs text-muted-foreground", className)}>
      Bewerte jeden Bereich für sich – du kannst auch mehrfach „Unbedingt“ wählen.
    </p>
  );
}
