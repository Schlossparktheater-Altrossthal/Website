"use client";

import { useEffect, useMemo, useState } from "react";

import { Countdown } from "@/components/countdown";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Heading, Text } from "@/components/ui/typography";

type HomepageCountdownProps = {
  initialCountdownTarget: string | null;
  effectiveCountdownTarget: string;
  defaultCountdownTarget: string;
  updatedAt: string | null;
  hasCustomCountdown: boolean;
  disabled: boolean;
  initialNow: number;
};

type CountdownSettingsState = {
  countdownTarget: string | null;
  effectiveCountdownTarget: string;
  updatedAt: string | null;
  hasCustomCountdown: boolean;
  disabled: boolean;
};

type SavedSettingsResponse = {
  settings?: {
    countdownTarget: string | null;
    effectiveCountdownTarget: string;
    updatedAt: string | null;
    hasCustomCountdown: boolean;
    disabled: boolean;
  };
  error?: string;
};

const COUNTDOWN_LABEL_FORMATTER = new Intl.DateTimeFormat("de-DE", {
  dateStyle: "full",
  timeStyle: "short",
  timeZone: "Europe/Berlin",
});

const UPDATED_AT_FORMATTER = new Intl.DateTimeFormat("de-DE", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Europe/Berlin",
});

function isoToLocalInputValue(iso: string | null) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const timezoneOffset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - timezoneOffset * 60_000);
  return local.toISOString().slice(0, 16);
}

function localInputToIso(value: string) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Date(date.getTime()).toISOString();
}

function formatIsoForDisplay(iso: string | null, formatter: Intl.DateTimeFormat) {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return formatter.format(date);
}

export function HomepageCountdown({
  initialCountdownTarget,
  effectiveCountdownTarget,
  defaultCountdownTarget,
  updatedAt,
  hasCustomCountdown,
  disabled,
  initialNow,
}: HomepageCountdownProps) {
  const { hasFeature, openFeature, closeFeature, activeFeature } = useFrontendEditing();
  const canEdit = hasFeature("site.countdown");
  const editorOpen = canEdit && activeFeature === "site.countdown";

  const [settings, setSettings] = useState<CountdownSettingsState>(() => ({
    countdownTarget: initialCountdownTarget,
    effectiveCountdownTarget,
    updatedAt,
    hasCustomCountdown,
    disabled,
  }));
  const [countdownInputValue, setCountdownInputValue] = useState(() => isoToLocalInputValue(initialCountdownTarget));
  const [formDisabled, setFormDisabled] = useState(() => disabled);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    setSettings({
      countdownTarget: initialCountdownTarget,
      effectiveCountdownTarget,
      updatedAt,
      hasCustomCountdown,
      disabled,
    });
    setCountdownInputValue(isoToLocalInputValue(initialCountdownTarget));
    setFormDisabled(disabled);
  }, [initialCountdownTarget, effectiveCountdownTarget, updatedAt, hasCustomCountdown, disabled]);

  useEffect(() => {
    if (!editorOpen) {
      setError(null);
      setSuccess(null);
    }
  }, [editorOpen]);

  const countdownLabel = useMemo(
    () => formatIsoForDisplay(settings.effectiveCountdownTarget, COUNTDOWN_LABEL_FORMATTER),
    [settings.effectiveCountdownTarget],
  );

  const defaultCountdownLabel = useMemo(
    () => formatIsoForDisplay(defaultCountdownTarget, COUNTDOWN_LABEL_FORMATTER),
    [defaultCountdownTarget],
  );

  const updatedAtLabel = useMemo(
    () => formatIsoForDisplay(settings.updatedAt, UPDATED_AT_FORMATTER),
    [settings.updatedAt],
  );

  const countdownActive = !settings.disabled;

  const countdownReached = useMemo(() => {
    if (settings.disabled) return false;
    const target = new Date(settings.effectiveCountdownTarget);
    if (Number.isNaN(target.getTime())) return false;
    return target.getTime() <= Date.now();
  }, [settings.effectiveCountdownTarget, settings.disabled]);

  function handleToggleEditor() {
    if (!canEdit) return;
    if (editorOpen) {
      closeFeature();
    } else {
      openFeature("site.countdown");
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    const isoCountdown = countdownInputValue ? localInputToIso(countdownInputValue) : null;
    if (countdownInputValue && !isoCountdown) {
      setError("Bitte gib ein gültiges Datum für den Countdown an.");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/homepage/countdown", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ countdownTarget: isoCountdown, disabled: formDisabled }),
      });
      const data = (await response.json().catch(() => ({}))) as SavedSettingsResponse;

      if (!response.ok || !data?.settings) {
        throw new Error(data?.error || "Der Countdown konnte nicht gespeichert werden.");
      }

      const nextCountdownInput = isoToLocalInputValue(data.settings.countdownTarget ?? null);
      const wasDisabled = settings.disabled;
      setSettings({
        countdownTarget: data.settings.countdownTarget ?? null,
        effectiveCountdownTarget: data.settings.effectiveCountdownTarget,
        updatedAt: data.settings.updatedAt ?? null,
        hasCustomCountdown: data.settings.hasCustomCountdown,
        disabled: data.settings.disabled,
      });
      setCountdownInputValue(nextCountdownInput);
      setFormDisabled(data.settings.disabled);
      setSuccess(
        data.settings.disabled
          ? "Der Premieren-Countdown wurde deaktiviert."
          : wasDisabled
              ? "Der Premieren-Countdown wurde aktiviert."
              : "Der Premieren-Countdown wurde gespeichert.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler beim Speichern.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex w-full flex-col items-center gap-5 text-center">
      <div className="flex flex-col items-center gap-5">
        <Heading level="h3" align="center">
          {countdownActive ? (countdownReached ? "Premierenwochenende" : "Premiere in") : "Premieren-Countdown"}
        </Heading>
        {countdownActive ? (
          countdownReached ? (
            <Text variant="lead" tone="success" className="font-semibold">
              Das Ensemble steht auf der Bühne – wir sehen uns im Schlosspark!
            </Text>
          ) : (
            <Countdown targetDate={settings.effectiveCountdownTarget} initialNow={initialNow} />
          )
        ) : (
          <Text variant="lead" tone="muted" className="font-semibold">
            Der Countdown ist aktuell deaktiviert.
          </Text>
        )}
        <Text variant="small" tone="muted">
          {countdownActive
            ? countdownLabel
              ? countdownReached
                ? `Gestartet am ${countdownLabel}.`
                : `Erste Aufführung am ${countdownLabel}.`
              : "Das genaue Datum geben wir in Kürze bekannt."
            : "Sobald ein Datum kommuniziert werden soll, kannst du den Countdown wieder aktivieren."}
        </Text>
        {canEdit ? (
          <Button
            size="sm"
            variant={editorOpen ? "secondary" : "outline"}
            onClick={handleToggleEditor}
            aria-pressed={editorOpen}
          >
            {editorOpen ? "Einstellungen schließen" : "Countdown bearbeiten"}
          </Button>
        ) : null}
      </div>

      <Dialog
        open={editorOpen}
        onOpenChange={(open) => {
          if (!canEdit) return;
          if (open) {
            openFeature("site.countdown");
          } else {
            closeFeature();
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Premieren-Countdown einstellen</DialogTitle>
            <DialogDescription>
              Setze Datum und Uhrzeit für die erste Aufführung. Der Countdown ist direkt auf der Startseite sichtbar.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="homepage-countdown">Datum &amp; Uhrzeit</Label>
              <Input
                id="homepage-countdown"
                type="datetime-local"
                value={countdownInputValue}
                onChange={(event) => setCountdownInputValue(event.target.value)}
                aria-describedby="homepage-countdown-description"
              />
              <Text id="homepage-countdown-description" variant="small" tone="muted">
                Zeiten werden als lokale Zeit gespeichert. Gäste sehen den Countdown in ihrer Systemsprache.
              </Text>
              <Text variant="small" tone="muted">
                {settings.hasCustomCountdown
                  ? countdownLabel
                    ? `Aktuelles Veröffentlichungsdatum: ${countdownLabel}`
                    : "Aktuelles Veröffentlichungsdatum ist gesetzt."
                  : defaultCountdownLabel
                      ? `Kein eigenes Datum hinterlegt – Standard: ${defaultCountdownLabel}`
                      : "Kein eigenes Datum hinterlegt."}
              </Text>
            </div>

            <div className="space-y-2 rounded-2xl border border-border/60 bg-background/60 p-4 text-left">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <Label htmlFor="homepage-countdown-visible" className="text-sm font-semibold">
                    Countdown auf der Startseite anzeigen
                  </Label>
                  <Text variant="small" tone="muted">
                    Wenn deaktiviert, wird auf der Startseite kein Timer angezeigt – das gespeicherte Datum bleibt erhalten.
                  </Text>
                </div>
                <input
                  id="homepage-countdown-visible"
                  type="checkbox"
                  className="mt-1 h-5 w-5 rounded border-border/60 text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  checked={!formDisabled}
                  onChange={(event) => setFormDisabled(!event.target.checked)}
                />
              </div>
            </div>

            {updatedAtLabel ? (
              <Text variant="small" tone="muted">
                Zuletzt aktualisiert: {updatedAtLabel}
              </Text>
            ) : null}

            {error ? <Text tone="destructive">{error}</Text> : null}
            {success ? <Text tone="success">{success}</Text> : null}

            <DialogFooter className="gap-2">
              <Button type="submit" disabled={saving} aria-busy={saving}>
                {saving ? "Speichern…" : "Einstellungen speichern"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                disabled={saving}
                onClick={() => setCountdownInputValue(isoToLocalInputValue(null))}
              >
                Zurücksetzen (Standard)
              </Button>
              <DialogClose asChild>
                <Button type="button" variant="outline" disabled={saving}>
                  Schließen
                </Button>
              </DialogClose>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
