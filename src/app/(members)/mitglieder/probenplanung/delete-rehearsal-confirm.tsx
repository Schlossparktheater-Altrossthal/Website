"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";

import { deleteRehearsalAction } from "./actions";

export interface DeleteRehearsalConfirmProps {
  rehearsal: {
    id: string;
    title: string;
    start: Date;
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function DeleteRehearsalConfirm({
  rehearsal,
  open,
  onOpenChange,
  onSuccess,
}: DeleteRehearsalConfirmProps) {
  const [isPending, startTransition] = useTransition();

  const dateFormatter = new Intl.DateTimeFormat("de-DE", {
    dateStyle: "full",
    timeStyle: "short",
  });

  const handleDelete = () => {
    startTransition(() => {
      deleteRehearsalAction({ id: rehearsal.id })
        .then(async (result) => {
          if (result?.error) {
            toast.error(result.error);
            return;
          }

          toast.success("Probe gelöscht. Alle Beteiligten wurden benachrichtigt.");
          onOpenChange(false);
          onSuccess?.();
        })
        .catch(() => {
          toast.error("Löschen fehlgeschlagen.");
        });
    });
  };

  return (
    <Modal
      open={open}
      onClose={() => {
        if (!isPending) onOpenChange(false);
      }}
      title="Probe löschen"
      description="Bist du sicher, dass du diese Probe löschen möchtest?"
    >
      <div className="space-y-4">
        <div className="rounded-lg bg-muted/50 border p-4">
          <h3 className="font-medium text-foreground">{rehearsal.title}</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {dateFormatter.format(rehearsal.start)}
          </p>
        </div>
        
        <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3">
          <p className="text-sm text-destructive font-medium">
            ⚠️ Diese Aktion kann nicht rückgängig gemacht werden.
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Alle damit verbundenen Zusagen, Absagen und Benachrichtigungen werden ebenfalls gelöscht.
          </p>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              if (!isPending) {
                onOpenChange(false);
              }
            }}
            disabled={isPending}
          >
            Abbrechen
          </Button>
          <Button
            type="button"
            onClick={handleDelete}
            disabled={isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isPending ? "Löschen..." : "Probe löschen"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}