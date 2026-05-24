"use client";

import { useState } from "react";
import { toast } from "sonner";

import { AsyncButton } from "@/components/ui/async-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { ShowRecord } from "./types";

type ShowFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  show?: ShowRecord;
  onSaved: (show: ShowRecord) => void;
};

function toDatetimeLocalValue(iso: string | null): string {
  if (!iso) return "";
  return iso.slice(0, 16);
}

function parseMeta(value: unknown): ShowRecord["meta"] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as ShowRecord["meta"];
}

type ShowApiResponse = {
  show?: {
    id: string;
    year: number;
    title: string | null;
    synopsis: string | null;
    dates: unknown;
    posterUrl: string | null;
    revealedAt: string | null;
    meta: unknown;
  };
  error?: string;
};

function serializeDates(value: unknown): string | null {
  if (typeof value === "string") return value || null;
  if (value !== null && value !== undefined) return JSON.stringify(value);
  return null;
}

export function ShowFormDialog({ open, onOpenChange, show, onSaved }: ShowFormDialogProps) {
  const isEdit = !!show;

  const [year, setYear] = useState(String(show?.year ?? new Date().getFullYear()));
  const [title, setTitle] = useState(show?.title ?? "");
  const [synopsis, setSynopsis] = useState(show?.synopsis ?? "");
  const [dates, setDates] = useState(show?.dates ?? "");
  const [posterUrl, setPosterUrl] = useState(show?.posterUrl ?? "");
  const [revealedAt, setRevealedAt] = useState(toDatetimeLocalValue(show?.revealedAt ?? null));
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    const yearNum = parseInt(year, 10);
    if (isNaN(yearNum) || yearNum < 1900 || yearNum > 2100) {
      toast.error("Bitte ein gültiges Jahr eingeben (1900–2100).", { duration: 5000 });
      return;
    }
    if (!title.trim()) {
      toast.error("Titel ist erforderlich.", { duration: 5000 });
      return;
    }

    setSaving(true);

    const payload = {
      year: yearNum,
      title: title.trim(),
      synopsis: synopsis.trim() || null,
      dates: dates.trim() || null,
      posterUrl: posterUrl.trim() || null,
      revealedAt: revealedAt ? new Date(revealedAt).toISOString() : null,
    };

    try {
      const url = isEdit
        ? `/api/chronik/shows/${encodeURIComponent(show.id)}`
        : "/api/chronik/shows";
      const method = isEdit ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = (await res.json().catch(() => ({}))) as ShowApiResponse;

      if (!res.ok || !data.show) {
        toast.error(data.error ?? "Speichern fehlgeschlagen.", { duration: 5000 });
        return;
      }

      const saved: ShowRecord = {
        id: data.show.id,
        year: data.show.year,
        title: data.show.title,
        synopsis: data.show.synopsis,
        dates: serializeDates(data.show.dates),
        posterUrl: data.show.posterUrl,
        revealedAt: data.show.revealedAt,
        meta: parseMeta(data.show.meta),
      };

      onSaved(saved);
      toast.success(isEdit ? "Produktion gespeichert." : "Produktion angelegt.", { duration: 3000 });
      onOpenChange(false);
    } catch {
      toast.error("Verbindungsfehler beim Speichern.", { duration: 5000 });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Produktion bearbeiten" : "Neue Produktion anlegen"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="show-year">Jahr</Label>
              <Input
                id="show-year"
                type="number"
                min={1900}
                max={2100}
                value={year}
                onChange={(e) => setYear(e.target.value)}
                disabled={isEdit}
              />
              {isEdit && (
                <p className="text-xs text-muted-foreground">
                  Jahr kann nach dem Anlegen nicht geändert werden.
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="show-revealed">Veröffentlicht ab</Label>
              <Input
                id="show-revealed"
                type="datetime-local"
                value={revealedAt}
                onChange={(e) => setRevealedAt(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="show-title">Titel</Label>
            <Input
              id="show-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="z.B. Bunbury – oder wichtig sein"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="show-synopsis">Kurzbeschreibung</Label>
            <Textarea
              id="show-synopsis"
              value={synopsis}
              onChange={(e) => setSynopsis(e.target.value)}
              rows={3}
              placeholder="Kurze Inhaltsbeschreibung …"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="show-dates">Aufführungstermine</Label>
            <Input
              id="show-dates"
              value={dates}
              onChange={(e) => setDates(e.target.value)}
              placeholder="z.B. 23.–26. Juli 2025"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="show-poster">Poster-URL</Label>
            <Input
              id="show-poster"
              value={posterUrl}
              onChange={(e) => setPosterUrl(e.target.value)}
              placeholder="https://…"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <AsyncButton isLoading={saving} onClick={handleSave}>
            {isEdit ? "Speichern" : "Anlegen"}
          </AsyncButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
