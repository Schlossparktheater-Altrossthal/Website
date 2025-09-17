"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { createRehearsalAction } from "./actions";

function formatDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function formatTime(value: Date) {
  return value.toISOString().slice(11, 16);
}

export function CreateRehearsalButton() {
  const now = new Date();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(() => formatDate(now));
  const [time, setTime] = useState(() => formatTime(now));
  const [location, setLocation] = useState("Noch offen");
  const [isPending, startTransition] = useTransition();

  const resetState = () => {
    setTitle("");
    const next = new Date();
    setDate(formatDate(next));
    setTime(formatTime(next));
    setLocation("Noch offen");
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    startTransition(() => {
      createRehearsalAction({ title, date, time, location })
        .then((result) => {
          if (result?.success) {
            toast.success("Probe erstellt. Die Benachrichtigungen wurden versendet.");
            resetState();
            setOpen(false);
          } else {
            toast.error(result?.error ?? "Speichern fehlgeschlagen.");
          }
        })
        .catch(() => {
          toast.error("Speichern fehlgeschlagen.");
        });
    });
  };

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}>
        Neue Probe anlegen
      </Button>

      <Modal
        open={open}
        onClose={() => {
          if (!isPending) setOpen(false);
        }}
        title="Neue Probe planen"
        description="Alle Mitglieder erhalten nach dem Speichern eine Benachrichtigung."
      >
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="rehearsal-title">
              Titel
            </label>
            <Input
              id="rehearsal-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="z. B. Leseprobe im Probenraum"
              required
              minLength={3}
              maxLength={120}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="rehearsal-location">
              Ort
            </label>
            <Input
              id="rehearsal-location"
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              placeholder="z. B. Probenraum, Bühne, Außenlocation"
              minLength={2}
              maxLength={120}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="rehearsal-date">
                Datum
              </label>
              <Input
                id="rehearsal-date"
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="rehearsal-time">
                Uhrzeit
              </label>
              <Input
                id="rehearsal-time"
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
                  setOpen(false);
                }
              }}
              disabled={isPending}
            >
              Abbrechen
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Speichern..." : "Probe erstellen"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
