"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Switch } from "@/components/ui/switch";

import { setDirectionViewAction } from "./actions";

/** Schalter „Nur Regie-Ansicht“ (docs/Plan/regie-plan.md). */
export function DirectionViewSwitch({ userId, enabled }: { userId: string; enabled: boolean }) {
  const router = useRouter();
  const [checked, setChecked] = useState(enabled);
  const [pending, startTransition] = useTransition();

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
      router.refresh();
    });
  };

  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border border-border/70 p-3">
      <div className="space-y-1">
        <div id="direction-view-label" className="text-sm font-medium">
          Nur Regie-Ansicht
        </div>
        <p className="text-xs text-muted-foreground">
          Ohne Menü: Die Person landet immer auf dem Regie-Dashboard. Welche Produktion sie sieht,
          kommt über das Gewerk Regie oder Regieassistenz.
        </p>
      </div>
      <Switch
        aria-labelledby="direction-view-label"
        checked={checked}
        disabled={pending}
        onCheckedChange={onChange}
      />
    </div>
  );
}
