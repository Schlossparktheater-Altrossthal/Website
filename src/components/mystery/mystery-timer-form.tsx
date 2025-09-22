"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Text } from "@/components/ui/typography";

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat("de-DE", {
  dateStyle: "full",
  timeStyle: "short",
  timeZone: "Europe/Berlin",
});

const UPDATED_AT_FORMATTER = new Intl.DateTimeFormat("de-DE", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Europe/Berlin",
});

const MAX_MESSAGE_LENGTH = 500;

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

export type MysteryTimerFormSavedSettings = {
  countdownTarget: string | null;
  expirationMessage: string | null;
  effectiveCountdownTarget: string;
  effectiveExpirationMessage: string;
  updatedAt: string | null;
  hasCustomCountdown: boolean;
  hasCustomMessage: boolean;
};

export type MysteryTimerFormProps = {
  scope: "public" | "members";
  initialCountdownTarget: string | null;
  initialExpirationMessage: string | null;
  effectiveCountdownTarget: string;
  effectiveExpirationMessage: string;
  defaultCountdownTarget: string;
  defaultExpirationMessage: string;
  updatedAt: string | null;
  hasCustomCountdown: boolean;
  hasCustomMessage: boolean;
  onSaved?: (settings: MysteryTimerFormSavedSettings) => void;
};

export function MysteryTimerForm({
  scope,
  initialCountdownTarget,
  initialExpirationMessage,
  effectiveCountdownTarget,
  effectiveExpirationMessage,
  defaultCountdownTarget,
  defaultExpirationMessage,
  updatedAt,
  hasCustomCountdown,
  hasCustomMessage,
  onSaved,
}: MysteryTimerFormProps) {
  const [countdownValue, setCountdownValue] = useState(() => isoToLocalInputValue(initialCountdownTarget));
  const [messageValue, setMessageValue] = useState(() => initialExpirationMessage ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [effectiveCountdown, setEffectiveCountdown] = useState(effectiveCountdownTarget);
  const [effectiveMessage, setEffectiveMessage] = useState(effectiveExpirationMessage);
  const [customCountdown, setCustomCountdown] = useState(hasCustomCountdown);
  const [customMessage, setCustomMessage] = useState(hasCustomMessage);
  const [lastUpdated, setLastUpdated] = useState(updatedAt);

  const formattedEffectiveCountdown = useMemo(
    () => formatIsoForDisplay(effectiveCountdown, DATE_TIME_FORMATTER),
    [effectiveCountdown],
  );
  const formattedDefaultCountdown = useMemo(
    () => formatIsoForDisplay(defaultCountdownTarget, DATE_TIME_FORMATTER),
    [defaultCountdownTarget],
  );
  const formattedUpdatedAt = useMemo(() => formatIsoForDisplay(lastUpdated, UPDATED_AT_FORMATTER), [lastUpdated]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    const isoCountdown = countdownValue ? localInputToIso(countdownValue) : null;
    if (countdownValue && !isoCountdown) {
      setError("Bitte gib ein gültiges Datum für den Countdown an.");
      return;
    }

    const trimmedMessage = messageValue.trim();
    const payload = {
      countdownTarget: isoCountdown,
      expirationMessage: trimmedMessage.length > 0 ? trimmedMessage : null,
    } as const;

    setSaving(true);
    try {
      const response = await fetch(`/api/mystery/settings?scope=${scope}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await response.json().catch(() => ({}))) as {
        settings?: MysteryTimerFormSavedSettings;
        error?: string;
      };

      if (!response.ok || !data?.settings) {
        throw new Error(data?.error || "Die Einstellungen konnten nicht gespeichert werden.");
      }

      const nextCountdownInput = isoToLocalInputValue(data.settings.countdownTarget);
      setCountdownValue(nextCountdownInput);
      setMessageValue(data.settings.expirationMessage ?? "");
      setEffectiveCountdown(data.settings.effectiveCountdownTarget);
      setEffectiveMessage(data.settings.effectiveExpirationMessage);
      setCustomCountdown(data.settings.hasCustomCountdown);
      setCustomMessage(data.settings.hasCustomMessage);
      setLastUpdated(data.settings.updatedAt ?? null);
      setSuccess("Die Mystery-Einstellungen wurden gespeichert.");
      onSaved?.(data.settings);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler beim Speichern.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="mystery-countdown">Countdown-Ziel</Label>
        <Input
          id="mystery-countdown"
          type="datetime-local"
          value={countdownValue}
          onChange={(event) => setCountdownValue(event.target.value)}
          aria-describedby="mystery-countdown-description"
        />
        <Text id="mystery-countdown-description" variant="small" tone="muted">
          Zeitzone wird als lokale Zeit interpretiert. Besucher sehen den Countdown automatisch in ihrer Systemsprache.
        </Text>
        <Text variant="small" tone="muted">
          {customCountdown
            ? formattedEffectiveCountdown
              ? `Aktuelles Veröffentlichungsdatum: ${formattedEffectiveCountdown}`
              : "Aktuelles Veröffentlichungsdatum ist gesetzt."
            : formattedDefaultCountdown
                ? `Kein eigenes Datum hinterlegt – Standard: ${formattedDefaultCountdown}`
                : "Kein eigenes Datum hinterlegt."}
        </Text>
      </div>

      <div className="space-y-2">
        <Label htmlFor="mystery-message">Hinweis nach Ablauf</Label>
        <Textarea
          id="mystery-message"
          value={messageValue}
          onChange={(event) => setMessageValue(event.target.value)}
          rows={4}
          maxLength={MAX_MESSAGE_LENGTH}
          aria-describedby="mystery-message-description"
        />
        <Text id="mystery-message-description" variant="small" tone="muted">
          Maximal {MAX_MESSAGE_LENGTH} Zeichen. Dieser Text ersetzt die Standardmeldung, sobald der Countdown abgelaufen ist.
        </Text>
        <Text variant="small" tone="muted">
          {customMessage
            ? `Aktueller Hinweistext: ${effectiveMessage}`
            : `Kein eigener Hinweistext hinterlegt – Standard: ${defaultExpirationMessage}`}
        </Text>
      </div>

      {formattedUpdatedAt && (
        <Text variant="small" tone="muted">
          Zuletzt aktualisiert: {formattedUpdatedAt}
        </Text>
      )}

      {error && <Text tone="destructive">{error}</Text>}
      {success && <Text tone="success">{success}</Text>}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
        <Button type="submit" disabled={saving} aria-busy={saving}>
          {saving ? "Speichern…" : "Einstellungen speichern"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={saving}
          onClick={() => {
            setCountdownValue(isoToLocalInputValue(null));
            setMessageValue("");
          }}
        >
          Zurücksetzen (Standard)
        </Button>
      </div>
    </form>
  );
}
