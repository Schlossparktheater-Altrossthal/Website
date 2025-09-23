"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";

import { useFrontendEditing } from "@/components/frontend-editing/frontend-editing-provider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Text } from "@/components/ui/typography";

const FEATURE_KEY = "chronik.dates" as const;

type ChronikPerformanceDatesCardProps = {
  showId: string;
  initialDates: string | null;
};

type UpdateResponse = {
  show?: {
    id: string;
    dates: string | null;
  };
  error?: string;
};

function formatDisplayValue(value: string | null) {
  if (!value) {
    return "Noch keine Termine eingetragen.";
  }

  return value;
}

export function ChronikPerformanceDatesCard({ showId, initialDates }: ChronikPerformanceDatesCardProps) {
  const { hasFeature, activeFeature, openFeature, closeFeature } = useFrontendEditing();
  const canEdit = hasFeature(FEATURE_KEY);
  const editorOpen = canEdit && activeFeature === FEATURE_KEY;

  const [dates, setDates] = useState<string | null>(initialDates ?? null);
  const [textareaValue, setTextareaValue] = useState<string>(initialDates ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    setDates(initialDates ?? null);
    setTextareaValue(initialDates ?? "");
  }, [initialDates]);

  useEffect(() => {
    if (!editorOpen) {
      setError(null);
      setSuccess(null);
      setTextareaValue(dates ?? "");
    }
  }, [editorOpen, dates]);

  const displayValue = useMemo(() => formatDisplayValue(dates), [dates]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`/api/chronik/shows/${encodeURIComponent(showId)}/dates`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dates: textareaValue }),
      });

      const data = (await response.json().catch(() => ({}))) as UpdateResponse;

      if (!response.ok || !data?.show) {
        throw new Error(data?.error || "Die Aufführungstermine konnten nicht gespeichert werden.");
      }

      const nextValue = typeof data.show.dates === "string" && data.show.dates.trim().length > 0
        ? data.show.dates
        : null;

      setDates(nextValue);
      setTextareaValue(nextValue ?? "");
      setSuccess("Die Termine wurden gespeichert.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler beim Speichern.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="rounded-2xl border border-border/60 bg-muted/40 p-4 text-foreground/90 shadow-inner">
        <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/80">
          Aufführungstermine
        </dt>
        <dd className="mt-1 space-y-3 text-base font-semibold md:text-lg">
          <span className={dates ? "block whitespace-pre-line" : "block font-normal text-muted-foreground"}>
            {displayValue}
          </span>
          {canEdit ? (
            <Button
              type="button"
              size="xs"
              variant={editorOpen ? "secondary" : "outline"}
              onClick={() => {
                if (editorOpen) {
                  closeFeature();
                } else {
                  openFeature(FEATURE_KEY);
                }
              }}
            >
              {editorOpen ? "Editor schließen" : "Termine bearbeiten"}
            </Button>
          ) : null}
        </dd>
      </div>

      {canEdit ? (
        <Dialog
          open={editorOpen}
          onOpenChange={(open) => {
            if (!canEdit) return;
            if (open) {
              openFeature(FEATURE_KEY);
            } else {
              closeFeature();
            }
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Aufführungstermine bearbeiten</DialogTitle>
              <DialogDescription>
                Ergänze oder aktualisiere die Termine dieser Produktion. Änderungen werden sofort in der Chronik sichtbar.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="chronik-performance-dates">Termine</Label>
                <Textarea
                  id="chronik-performance-dates"
                  value={textareaValue}
                  onChange={(event) => setTextareaValue(event.target.value)}
                  rows={4}
                  aria-describedby="chronik-performance-dates-hint"
                />
                <Text id="chronik-performance-dates-hint" variant="small" tone="muted">
                  Nutze Zeilenumbrüche, um mehrere Aufführungstage zu trennen.
                </Text>
              </div>

              {error ? <Text tone="destructive">{error}</Text> : null}
              {success ? <Text tone="success">{success}</Text> : null}

              <DialogFooter className="gap-2">
                <Button type="submit" disabled={saving} aria-busy={saving}>
                  {saving ? "Speichern…" : "Termine speichern"}
                </Button>
                <DialogClose asChild>
                  <Button type="button" variant="ghost" disabled={saving}>
                    Schließen
                  </Button>
                </DialogClose>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      ) : null}
    </>
  );
}
