"use client";

import { PlusIcon, Trash2Icon } from "@/components/ui/action-icons";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";

import { Countdown } from "@/components/countdown";
import { useFrontendEditing } from "@/components/frontend-editing/frontend-editing-provider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DateInput } from "@/components/ui/date-input";
import { TimeInput } from "@/components/ui/time-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Heading, Text } from "@/components/ui/typography";

type ShowDateInput = { date: string; time: string; label: string };
const MIN_DATES = 1;
const MAX_DATES = 8;

type ShowCountdownSectionProps = {
  initialCountdownTarget: string | null;
  effectiveCountdownTarget: string;
  updatedAt: string | null;
  hasCustomCountdown: boolean;
  disabled: boolean;
  scheduledDates: ShowDateInput[];
  postShowText: string;
};

type ShowCountdownSettingsState = {
  countdownTarget: string | null;
  effectiveCountdownTarget: string;
  updatedAt: string | null;
  hasCustomCountdown: boolean;
  disabled: boolean;
  scheduledDates: ShowDateInput[];
  postShowText: string;
};

type SavedSettingsResponse = { settings?: ShowCountdownSettingsState; error?: string };

function parseIso(iso: string | null) {
  return iso ? new Date(iso).getTime() : Number.NaN;
}
function localInputToIso(value: string) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function getNextShowDate(scheduledDates: ShowDateInput[], now: number) {
  return (
    scheduledDates.find((t) => {
      const iso = localInputToIso(`${t.date}T${t.time}`);
      if (!iso) return false;
      return parseIso(iso) > now;
    }) ?? null
  );
}

export function ShowCountdownSection(props: ShowCountdownSectionProps) {
  const { hasFeature, openFeature, closeFeature, activeFeature } = useFrontendEditing();
  const { status } = useSession();
  const canEdit = status === "authenticated" && hasFeature("FEATURE.HOME.COUNTDOWN");
  const editorOpen = canEdit && activeFeature === "FEATURE.HOME.COUNTDOWN";
  const [settings, setSettings] = useState<ShowCountdownSettingsState>(() => ({
    ...props,
    countdownTarget: props.effectiveCountdownTarget,
  }));
  const [formDisabled, setFormDisabled] = useState(() => props.disabled);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNow(Date.now());
    }, 30_000);

    return () => window.clearInterval(interval);
  }, []);

  const nextTermin = useMemo(
    () => getNextShowDate(settings.scheduledDates, now),
    [settings.scheduledDates, now],
  );
  const countdownActive = !settings.disabled;
  const allDone = countdownActive && !nextTermin;
  if (!countdownActive && !canEdit) return null;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const countdownTarget = nextTermin
        ? localInputToIso(`${nextTermin.date}T${nextTermin.time}`)
        : null;
      const response = await fetch("/api/website/show-countdown", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          countdownTarget,
          disabled: formDisabled,
          scheduledDates: settings.scheduledDates,
          postShowText: settings.postShowText,
        }),
      });
      const data = (await response.json().catch(() => ({}))) as SavedSettingsResponse;
      if (!response.ok || !data.settings)
        throw new Error(data.error || "Der Countdown konnte nicht gespeichert werden.");
      setSettings(data.settings);
      setFormDisabled(data.settings.disabled);
      setSuccess("Der Premieren-Countdown wurde gespeichert.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex w-full flex-col items-center gap-5 text-center">
      <div className="flex flex-col items-center gap-5">
        {countdownActive ? (
          <Heading
            level="h2"
            align="center"
            className="text-[clamp(2.2rem,7vw,4.1rem)] font-extrabold"
          >
            {nextTermin
              ? settings.hasCustomCountdown
                ? "Premiere in"
                : "Nächste Vorstellung in"
              : "Vorstellungen beendet"}
          </Heading>
        ) : null}
        {countdownActive ? (
          allDone ? (
            settings.postShowText ? (
              <Text variant="lead">{settings.postShowText}</Text>
            ) : null
          ) : (
            <Countdown
              targetDate={
                localInputToIso(`${nextTermin?.date}T${nextTermin?.time}`) ??
                settings.effectiveCountdownTarget
              }
            />
          )
        ) : null}
        {canEdit ? (
          <Button
            size="sm"
            variant={editorOpen ? "secondary" : "outline"}
            onClick={() => (editorOpen ? closeFeature() : openFeature("FEATURE.HOME.COUNTDOWN"))}
          >
            {editorOpen ? "Einstellungen schließen" : "Countdown bearbeiten"}
          </Button>
        ) : null}
      </div>

      <Dialog
        open={editorOpen}
        onOpenChange={(open) => (open ? openFeature("FEATURE.HOME.COUNTDOWN") : closeFeature())}
      >
        <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col overflow-hidden sm:max-h-[85dvh]">
          <DialogHeader>
            <DialogTitle>Premieren-Countdown einstellen</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
            <div className="space-y-6 overflow-y-auto pr-1">
              <div className="flex items-center justify-between rounded-2xl border border-border/60 bg-background/60 p-4">
                <Label htmlFor="show-countdown-section-visible" className="text-sm font-semibold">
                  Countdown auf der Startseite anzeigen
                </Label>
                <Switch
                  id="show-countdown-section-visible"
                  checked={!formDisabled}
                  onCheckedChange={(v) => setFormDisabled(!v)}
                />
              </div>

              <div className="space-y-3">
                {settings.scheduledDates.map((scheduledDate, index) => {
                  const isNext = nextTermin ? nextTermin.label === scheduledDate.label : false;
                  return (
                    <div
                      key={`${scheduledDate.label}-${index}`}
                      className={`grid grid-cols-1 gap-2 overflow-hidden rounded-xl border p-3 md:grid-cols-2 md:[grid-template-columns:minmax(0,1fr)_minmax(0,1fr)] ${isNext ? "border-primary" : "border-border"}`}
                    >
                      <div className="min-w-0 md:col-span-2 flex items-center justify-between gap-2">
                        <Label>Vorstellung {index + 1}</Label>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          disabled={settings.scheduledDates.length <= MIN_DATES}
                          aria-label={`Vorstellung ${index + 1} entfernen`}
                          onClick={() =>
                            setSettings((prev) => ({
                              ...prev,
                              scheduledDates:
                                prev.scheduledDates.length <= MIN_DATES
                                  ? prev.scheduledDates
                                  : prev.scheduledDates.filter((_, i) => i !== index),
                            }))
                          }
                        >
                          <Trash2Icon className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="min-w-0">
                        <DateInput
                          className="min-w-0"
                          value={scheduledDate.date}
                          onChange={(event) =>
                            setSettings((prev) => ({
                              ...prev,
                              scheduledDates: prev.scheduledDates.map((t, i) =>
                                i === index ? { ...t, date: event.target.value } : t,
                              ),
                            }))
                          }
                        />
                      </div>
                      <div className="min-w-0">
                        <TimeInput
                          className="min-w-0"
                          value={scheduledDate.time}
                          onChange={(event) =>
                            setSettings((prev) => ({
                              ...prev,
                              scheduledDates: prev.scheduledDates.map((t, i) =>
                                i === index ? { ...t, time: event.target.value } : t,
                              ),
                            }))
                          }
                        />
                      </div>
                    </div>
                  );
                })}
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  disabled={settings.scheduledDates.length >= MAX_DATES}
                  onClick={() =>
                    setSettings((prev) => ({
                      ...prev,
                      scheduledDates:
                        prev.scheduledDates.length >= MAX_DATES
                          ? prev.scheduledDates
                          : [
                              ...prev.scheduledDates,
                              {
                                date: "",
                                time: "",
                                label: `Vorstellung ${prev.scheduledDates.length + 1}`,
                              },
                            ],
                    }))
                  }
                >
                  <PlusIcon className="mr-2 h-4 w-4" />
                  Vorstellung hinzufügen
                </Button>
              </div>

              <div className="space-y-2">
                <Label htmlFor="after-show-text">Text nach allen Vorstellungen</Label>
                <Textarea
                  id="after-show-text"
                  value={settings.postShowText}
                  onChange={(e) =>
                    setSettings((prev) => ({ ...prev, postShowText: e.target.value }))
                  }
                />
              </div>

              {error ? <Text tone="destructive">{error}</Text> : null}
              {success ? <Text tone="success">{success}</Text> : null}
            </div>
            <DialogFooter className="mt-6 gap-2 border-t border-border/60 pt-4">
              <Button type="submit" disabled={saving}>
                {saving ? "Speichern…" : "Einstellungen speichern"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
