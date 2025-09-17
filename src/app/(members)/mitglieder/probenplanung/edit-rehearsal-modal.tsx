"use client";

"use client";
import * as React from "react";
import { useState, useTransition } from "react";
import { updateRehearsalAction } from "./actions";
import { EditIcon } from "@/components/ui/icons";

interface EditRehearsalModalProps {
  rehearsal: {
    id: string;
    title: string;
    start: Date;
    location: string | null;
  };
  isOpen: boolean;
  onClose: () => void;
}

export function EditRehearsalModal({ rehearsal, isOpen, onClose }: EditRehearsalModalProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string>("");

  const formatDate = (date: Date) => {
    return date.toISOString().split('T')[0];
  };

  const formatTime = (date: Date) => {
    return date.toTimeString().split(' ')[0].substring(0, 5);
  };

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    
    startTransition(async () => {
      const result = await updateRehearsalAction({
        id: rehearsal.id,
        title: formData.get("title") as string,
        date: formData.get("date") as string,
        time: formData.get("time") as string,
        location: formData.get("location") as string || undefined,
      });

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
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <EditIcon className="w-5 h-5" />
            Probe bearbeiten
          </h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Schließen"
          >
            ✕
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}
          
          <div className="space-y-2">
            <label htmlFor="edit-title" className="text-sm font-medium">
              Titel
            </label>
            <input
              id="edit-title"
              name="title"
              type="text"
              defaultValue={rehearsal.title}
              required
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="edit-date" className="text-sm font-medium">
                Datum
              </label>
              <input
                id="edit-date"
                name="date"
                type="date"
                defaultValue={formatDate(rehearsal.start)}
                required
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="edit-time" className="text-sm font-medium">
                Uhrzeit
              </label>
              <input
                id="edit-time"
                name="time"
                type="time"
                defaultValue={formatTime(rehearsal.start)}
                required
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="edit-location" className="text-sm font-medium">
              Ort
            </label>
            <input
              id="edit-location"
              name="location"
              type="text"
              defaultValue={rehearsal.location || ""}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            />
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
              type="submit"
              disabled={isPending}
              className="flex-1 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isPending ? "Speichern..." : "Speichern"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}