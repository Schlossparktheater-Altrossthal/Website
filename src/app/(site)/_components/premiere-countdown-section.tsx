"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { Plus, Trash2 } from "lucide-react";

import { Countdown } from "@/components/countdown";
import { useFrontendEditing } from "@/components/frontend-editing/frontend-editing-provider";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DateInput } from "@/components/ui/date-input";
import { Input } from "@/components/ui/input";
import { TimeInput } from "@/components/ui/time-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Heading, Text } from "@/components/ui/typography";

type TerminInput = { datum: string; uhrzeit: string; label: string };
const MIN_TERMINE = 1;
const MAX_TERMINE = 8;

type PremiereCountdownSectionProps = {
  initialCountdownTarget: string | null;
  effectiveCountdownTarget: string;
  updatedAt: string | null;
  hasCustomCountdown: boolean;
  disabled: boolean;
  initialNow: number;
  termine: TerminInput[];
  nachSommerText: string;
};

type CountdownSettingsState = {
  countdownTarget: string | null;
  effectiveCountdownTarget: string;
  updatedAt: string | null;
  hasCustomCountdown: boolean;
  disabled: boolean;
  termine: TerminInput[];
  nachSommerText: string;
};

type SavedSettingsResponse = { settings?: CountdownSettingsState; error?: string };

function parseIso(iso: string | null) { return iso ? new Date(iso).getTime() : Number.NaN; }
function localInputToIso(value: string) { if (!value) return null; const date = new Date(value); return Number.isNaN(date.getTime()) ? null : date.toISOString(); }

function getNextTermin(termine: TerminInput[], now: number) {
  return termine.find((t) => {
    const iso = localInputToIso(`${t.datum}T${t.uhrzeit}`);
    if (!iso) return false;
    return parseIso(iso) > now;
  }) ?? null;
}

export function PremiereCountdownSection(props: PremiereCountdownSectionProps) {
  const { hasFeature, openFeature, closeFeature, activeFeature } = useFrontendEditing();
  const { status } = useSession();
  const canEdit = status === "authenticated" && hasFeature("website.premiere-countdown");
  const editorOpen = canEdit && activeFeature === "website.premiere-countdown";
  const [settings, setSettings] = useState<CountdownSettingsState>(() => ({
    ...props,
    countdownTarget: props.effectiveCountdownTarget,
  }));
  const [formDisabled, setFormDisabled] = useState(() => props.disabled);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [now, setNow] = useState(() => props.initialNow);

  useEffect(() => {
    setSettings({ ...props, countdownTarget: props.effectiveCountdownTarget });
    setFormDisabled(props.disabled);
  }, [props]);

  useEffect(() => {
    setNow(Date.now());

    const interval = window.setInterval(() => {
      setNow(Date.now());
    }, 30_000);

    return () => window.clearInterval(interval);
  }, []);

  const nextTermin = useMemo(() => getNextTermin(settings.termine, now), [settings.termine, now]);
  const countdownActive = !settings.disabled;
  const allDone = countdownActive && !nextTermin;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true); setError(null); setSuccess(null);
    try {
      const countdownTarget = nextTermin ? localInputToIso(`${nextTermin.datum}T${nextTermin.uhrzeit}`) : null;
      const response = await fetch("/api/website/premiere-countdown", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ countdownTarget, disabled: formDisabled, termine: settings.termine, nachSommerText: settings.nachSommerText }),
      });
      const data = (await response.json().catch(() => ({}))) as SavedSettingsResponse;
      if (!response.ok || !data.settings) throw new Error(data.error || "Der Countdown konnte nicht gespeichert werden.");
      setSettings(data.settings); setFormDisabled(data.settings.disabled); setSuccess("Der Premieren-Countdown wurde gespeichert.");
    } catch (err) { setError(err instanceof Error ? err.message : "Unbekannter Fehler."); }
    finally { setSaving(false); }
  }

  return <div className="flex w-full flex-col items-center gap-5 text-center">
    <div className="flex flex-col items-center gap-5">
      <Heading level="h2" align="center" className="text-[clamp(2.2rem,7vw,4.1rem)] font-extrabold">
        {!countdownActive ? "Premieren-Countdown" : nextTermin ? (settings.hasCustomCountdown ? "Premiere in" : "Nächste Vorstellung in") : "Vorstellungen beendet"}
      </Heading>
      {countdownActive ? (allDone ? (settings.nachSommerText ? <Text variant="lead">{settings.nachSommerText}</Text> : null) : <Countdown targetDate={localInputToIso(`${nextTermin?.datum}T${nextTermin?.uhrzeit}`) ?? settings.effectiveCountdownTarget} initialNow={props.initialNow} />) : <Text variant="lead" tone="muted" className="font-semibold">Der Countdown ist aktuell deaktiviert.</Text>}
      {canEdit ? <Button size="sm" variant={editorOpen ? "secondary" : "outline"} onClick={() => (editorOpen ? closeFeature() : openFeature("website.premiere-countdown"))}>{editorOpen ? "Einstellungen schließen" : "Countdown bearbeiten"}</Button> : null}
    </div>

    <Dialog open={editorOpen} onOpenChange={(open) => (open ? openFeature("website.premiere-countdown") : closeFeature())}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col overflow-hidden sm:max-h-[85dvh]">
        <DialogHeader><DialogTitle>Premieren-Countdown einstellen</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="space-y-6 overflow-y-auto pr-1">
          <div className="flex items-center justify-between rounded-2xl border border-border/60 bg-background/60 p-4">
            <Label htmlFor="premiere-countdown-section-visible" className="text-sm font-semibold">Countdown auf der Startseite anzeigen</Label>
            <Switch id="premiere-countdown-section-visible" checked={!formDisabled} onCheckedChange={(v) => setFormDisabled(!v)} />
          </div>

          <div className="space-y-3">
            {settings.termine.map((termin, index) => {
              const isNext = nextTermin ? nextTermin.label === termin.label : false;
              return <div key={`${termin.label}-${index}`} className={`grid grid-cols-1 gap-2 overflow-hidden rounded-xl border p-3 md:grid-cols-2 md:[grid-template-columns:minmax(0,1fr)_minmax(0,1fr)] ${isNext ? "border-primary" : "border-border"}`}>
                <div className="min-w-0 md:col-span-2 flex items-center justify-between gap-2">
                  <Label>Vorstellung {index + 1}</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={settings.termine.length <= MIN_TERMINE}
                    aria-label={`Vorstellung ${index + 1} entfernen`}
                    onClick={() =>
                      setSettings((prev) => ({
                        ...prev,
                        termine: prev.termine.length <= MIN_TERMINE ? prev.termine : prev.termine.filter((_, i) => i !== index),
                      }))
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="min-w-0">
                  <DateInput className="min-w-0" value={termin.datum} onChange={(event) => setSettings((prev) => ({ ...prev, termine: prev.termine.map((t, i) => i === index ? { ...t, datum: event.target.value } : t) }))} />
                </div>
                <div className="min-w-0">
                  <TimeInput className="min-w-0" value={termin.uhrzeit} onChange={(event) => setSettings((prev) => ({ ...prev, termine: prev.termine.map((t, i) => i === index ? { ...t, uhrzeit: event.target.value } : t) }))} />
                </div>
              </div>;
            })}
            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={settings.termine.length >= MAX_TERMINE}
              onClick={() =>
                setSettings((prev) => ({
                  ...prev,
                  termine:
                    prev.termine.length >= MAX_TERMINE
                      ? prev.termine
                      : [...prev.termine, { datum: "", uhrzeit: "", label: `Vorstellung ${prev.termine.length + 1}` }],
                }))
              }
            >
              <Plus className="mr-2 h-4 w-4" />
              Vorstellung hinzufügen
            </Button>
          </div>

          <div className="space-y-2">
            <Label htmlFor="after-show-text">Text nach allen Vorstellungen</Label>
            <Textarea id="after-show-text" value={settings.nachSommerText} onChange={(e) => setSettings((prev) => ({ ...prev, nachSommerText: e.target.value }))} />
          </div>

          {error ? <Text tone="destructive">{error}</Text> : null}
          {success ? <Text tone="success">{success}</Text> : null}
          </div>
          <DialogFooter className="mt-6 gap-2 border-t border-border/60 pt-4"><Button type="submit" disabled={saving}>{saving ? "Speichern…" : "Einstellungen speichern"}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  </div>;
}
