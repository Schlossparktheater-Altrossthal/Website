"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";

import { updateRehearsalAction } from "./actions";

function formatDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function formatTime(value: Date) {
  return value.toISOString().slice(11, 16);
}

export interface EditRehearsalModalProps {
  rehearsal: {
    id: string;
    title: string;
    start: Date;
    location: string | null;
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function EditRehearsalModal({
  rehearsal,
  open,
  onOpenChange,
  onSuccess,
}: EditRehearsalModalProps) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [location, setLocation] = useState("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    setTitle(rehearsal.title);
    setDate(formatDate(rehearsal.start));
    setTime(formatTime(rehearsal.start));
    setLocation(rehearsal.location || "");
  }, [open, rehearsal]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    startTransition(() => {
      updateRehearsalAction({
        id: rehearsal.id,
        title,
        date,
        time,
        location: location || undefined,
      })
        .then(async (result) => {
          if (result?.error) {
            toast.error(result.error);
            return;
          }

          toast.success("Probe aktualisiert. Die Änderungen wurden gespeichert.");
          onOpenChange(false);
          onSuccess?.();
        })
        .catch(() => {
          toast.error("Aktualisierung fehlgeschlagen.");
        });
    });
  };

  return (
    <Modal
      open={open}
      onClose={() => {
        if (!isPending) onOpenChange(false);
      }}
      title="Probe bearbeiten"
      description="Bearbeite die Details deiner geplanten Probe."
    >
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="edit-rehearsal-title">
            Titel
          </label>
          <Input
            id="edit-rehearsal-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="z. B. Leseprobe im Probenraum"
            required
            minLength={3}
            maxLength={120}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="edit-rehearsal-location">
            Ort
          </label>
          <Input
            id="edit-rehearsal-location"
            value={location}
            onChange={(event) => setLocation(event.target.value)}
            placeholder="z. B. Probenraum, Bühne, Außenlocation"
            minLength={0}
            maxLength={120}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="edit-rehearsal-date">
              Datum
            </label>
            <Input
              id="edit-rehearsal-date"
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="edit-rehearsal-time">
              Uhrzeit
            </label>
            <Input
              id="edit-rehearsal-time"
              type="time"
              value={time}
              onChange={(event) => setTime(event.target.value)}
              required
            />
          </div>
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
          <Button type="submit" disabled={isPending}>
            {isPending ? "Speichern..." : "Änderungen speichern"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}