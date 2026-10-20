"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Switch } from "@/components/ui/switch";

import { setDirectionViewAction } from "@/app/(members)/mitglieder/mitgliederverwaltung/[userId]/actions";

/** Schalter „Nur Regie-Ansicht“ (docs/Plan/regie-plan.md). */
export function DirectionViewSwitch({
  userId,
  enabled,
  onChanged,
}: {
  userId: string;
  enabled: boolean;
  /** Nach erfolgreichem Speichern, z. B. um eine Tabellenzeile nachzuziehen. */
  onChanged?: (enabled: boolean) => void;
}) {
  const router = useRouter();
  const [checked, setChecked] = useState(enabled);
  const [pending, startTransition] = useTransition();
  const labelId = useId();

  const onChange = (next: boolean) => {
    setChecked(next);
    startTransition(async () => {
      const result = await setDirectionViewAction({ userId, enabled: next });
      if (!result.ok) {
        setChecked(!next);
        toast.error(result.error);
        return;
      }
      toast.success(next ? "Regie-Ansicht eingeschaltet" : "Regie-Ansicht ausgeschaltet");
      onChanged?.(next);
      router.refresh();
    });
  };

  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border border-border/70 p-3">
      <div className="space-y-1">
        <div id={labelId} className="text-sm font-medium">
          Nur Regie-Ansicht
        </div>
        <p className="text-xs text-muted-foreground">
          Ohne Menü: Die Person landet immer auf dem Regie-Dashboard. Welche Produktion sie sieht,
          kommt über das Gewerk Regie oder Regieassistenz.
        </p>
      </div>
      <Switch
        aria-labelledby={labelId}
        checked={checked}
        disabled={pending}
        onCheckedChange={onChange}
      />
    </div>
  );
}
