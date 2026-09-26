"use client";

import type { ReactNode } from "react";

import { Slider } from "@/components/ui/slider";
import { getRolePreferenceWeightLabel } from "@/lib/onboarding/role-preference-utils";
import { cn } from "@/lib/utils";

type RolePreferenceLevelPickerProps = {
  title: string;
  description?: string | null;
  /** Zusatz neben dem Titel, z. B. „Eigenes Gewerk“. */
  badge?: ReactNode;
  /** Aktion rechts neben dem Label, z. B. Entfernen eines eigenen Gewerks. */
  action?: ReactNode;
  enabled: boolean;
  weight: number;
  /** `null` = ganz links (kein Interesse), sonst das Gewicht 1–100. */
  onChange: (weight: number | null) => void;
};

/**
 * Ein Rollen-/Gewerkewunsch als kompakte Zeile mit stufenlosem Regler. Angezeigt wird ein
 * Wort statt einer Prozentzahl, damit niemand an ein gemeinsames 100-%-Budget denkt.
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
  const value = enabled ? weight : 0;
  const active = value > 0;

  return (
    <div
      className={cn(
        "min-w-0 rounded-lg border px-3 pb-1 pt-2 transition-colors",
        active ? "border-primary/60 bg-primary/5" : "border-border/70",
      )}
    >
      <div className="flex items-baseline justify-between gap-2">
        <p className="flex min-w-0 items-center gap-1.5 text-sm font-medium text-foreground">
          <span className="truncate" title={description ?? undefined}>
            {title}
          </span>
          {badge}
        </p>
        <span className="flex shrink-0 items-center gap-1">
          <span
            className={cn("text-xs", active ? "font-medium text-primary" : "text-muted-foreground")}
          >
            {getRolePreferenceWeightLabel(value)}
          </span>
          {action}
        </span>
      </div>
      {description ? <p className="truncate text-xs text-muted-foreground">{description}</p> : null}
      <Slider
        min={0}
        max={100}
        step={1}
        value={[value]}
        onValueChange={([next]) => onChange(next > 0 ? next : null)}
        thumbLabel={`Wie gern: ${title}`}
      />
    </div>
  );
}

/** Kurzer Hinweis über den Wunschlisten, damit niemand an ein 100-%-Budget denkt. */
export function RolePreferenceLevelHint({ className }: { className?: string }) {
  return (
    <p className={cn("text-xs text-muted-foreground", className)}>
      Jeder Regler gilt für sich – es gibt kein Gesamtbudget, du kannst auch mehrere ganz nach
      rechts schieben.
    </p>
  );
}
