"use client";

"use client";
import * as React from "react";
import { useState, useTransition } from "react";
import { deleteRehearsalAction } from "./actions";
import { TrashIcon } from "@/components/ui/icons";

interface DeleteRehearsalConfirmProps {
  rehearsal: {
    id: string;
    title: string;
    start: Date;
  };
  isOpen: boolean;
  onClose: () => void;
}

export function DeleteRehearsalConfirm({ rehearsal, isOpen, onClose }: DeleteRehearsalConfirmProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string>("");

  const dateFormatter = new Intl.DateTimeFormat("de-DE", {
    dateStyle: "full",
    timeStyle: "short",
  });

  async function handleDelete() {
    startTransition(async () => {
      const result = await deleteRehearsalAction({ id: rehearsal.id });

      if (result.error) {
        setError(result.error);
      } else {
        onClose();
        setError("");
      }
    });
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg bg-card border border-border shadow-lg">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold flex items-center gap-2 text-destructive">
            <TrashIcon className="w-5 h-5" />
            Probe löschen
          </h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Schließen"
          >
            ✕
          </button>
        </div>
        
        <div className="p-4 space-y-4">
          {error && (
            <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}
          
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Bist du sicher, dass du diese Probe löschen möchtest?
            </p>
            
            <div className="rounded-lg bg-muted/50 border border-border p-3">
              <h3 className="font-medium text-foreground">{rehearsal.title}</h3>
              <p className="text-sm text-muted-foreground">
                {dateFormatter.format(rehearsal.start)}
              </p>
            </div>
            
            <p className="text-sm text-destructive font-medium">
              ⚠️ Diese Aktion kann nicht rückgängig gemacht werden.
            </p>
            
            <p className="text-xs text-muted-foreground">
              Alle damit verbundenen Zusagen, Absagen und Benachrichtigungen werden ebenfalls gelöscht.
            </p>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              Abbrechen
            </button>
            <button
              onClick={handleDelete}
              disabled={isPending}
              className="flex-1 rounded-md bg-destructive px-3 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isPending ? "Löschen..." : "Probe löschen"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}