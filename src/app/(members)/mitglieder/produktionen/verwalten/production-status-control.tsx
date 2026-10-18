"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ProductionStatus } from "@prisma/client";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { SegmentedControl } from "@/components/ui/segmented-control";
import {
  PRODUCTION_STATUSES,
  PRODUCTION_STATUS_LABELS,
  shouldCloseMemberships,
} from "@/lib/produktionen/status";

import { setProductionStatusAction } from "../actions/status";

const ACTIVE_CLASSES: Record<ProductionStatus, string> = {
  planning: "bg-warning/15 text-warning",
  active: "bg-success/15 text-success",
  finished: "bg-muted text-foreground",
  archived: "bg-muted text-muted-foreground",
};

/** Status als Umschalter mit vier Stufen – speichert sofort, Abschließen/Archivieren mit Rückfrage. */
export function ProductionStatusControl({
  showId,
  showTitle,
  status,
}: {
  showId: string;
  showTitle: string;
  status: ProductionStatus;
}) {
  const router = useRouter();
  const [value, setValue] = useState(status);
  const [pendingConfirm, setPendingConfirm] = useState<ProductionStatus | null>(null);
  const [isPending, startTransition] = useTransition();

  const save = (next: ProductionStatus) => {
    const previous = value;
    setValue(next);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("showId", showId);
      formData.set("status", next);
      formData.set("redirectPath", "/mitglieder/produktionen/verwalten");
      const result = await setProductionStatusAction(formData);
      if (!result.ok) {
        setValue(previous);
        toast.error(result.error);
        return;
      }
      toast.success(result.message ?? "Status wurde geändert.");
      router.refresh();
    });
  };

  const choose = (next: ProductionStatus) => {
    if (next === value || isPending) return;
    if (shouldCloseMemberships(next) && !shouldCloseMemberships(value)) {
      setPendingConfirm(next);
      return;
    }
    save(next);
  };

  return (
    <>
      <SegmentedControl
        aria-label={`Status von ${showTitle}`}
        value={value}
        onValueChange={choose}
        options={PRODUCTION_STATUSES.map((option) => ({
          value: option,
          label: PRODUCTION_STATUS_LABELS[option],
          disabled: isPending,
        }))}
        fullWidth
        activeClassName={(option) => ACTIVE_CLASSES[option]}
      />
      <ConfirmDialog
        open={pendingConfirm !== null}
        onOpenChange={(open) => !open && setPendingConfirm(null)}
        title={`„${showTitle}“ ${pendingConfirm === "archived" ? "archivieren" : "abschließen"}?`}
        description="Alle Mitgliedschaften dieser Produktion werden beendet. Wer in keiner anderen geplanten oder laufenden Produktion ist, kann danach über „Saison abschließen“ deaktiviert werden."
        confirmLabel={pendingConfirm === "archived" ? "Archivieren" : "Abschließen"}
        cancelLabel="Abbrechen"
        variant="destructive"
        onConfirm={() => {
          const next = pendingConfirm;
          setPendingConfirm(null);
          if (next) save(next);
        }}
        onCancel={() => setPendingConfirm(null)}
      />
    </>
  );
}
