"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";

import { Countdown } from "@/components/countdown";
import { useFrontendEditing } from "@/components/frontend-editing/frontend-editing-provider";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Heading, Text } from "@/components/ui/typography";

type TerminInput = { datum: string; uhrzeit: string; label: string };

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

function getNextTermin(termine: TerminInput[]) {
  const now = Date.now();
  return termine.find((t) => {
    const iso = localInputToIso(`${t.datum}T${t.uhrzeit}`);
    if (!iso) return false;
    return parseIso(iso) > now;
  }) ?? null;
}

function Toggle({ checked, onCheckedChange, id }: { checked: boolean; onCheckedChange: (v: boolean) => void; id: string }) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onCheckedChange(!checked)}
      className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${checked ? "bg-primary" : "bg-muted"}`}
    >
      <span className={`h-5 w-5 rounded-full bg-background shadow transition-transform ${checked ? "translate-x-6" : "translate-x-1"}`} />
    </button>
  );
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

  useEffect(() => {
    setSettings({ ...props, countdownTarget: props.effectiveCountdownTarget });
    setFormDisabled(props.disabled);
  }, [props]);
  const nextTermin = useMemo(() => getNextTermin(settings.termine), [settings.termine]);
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
      <DialogContent>
        <DialogHeader><DialogTitle>Premieren-Countdown einstellen</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="flex items-center justify-between rounded-2xl border border-border/60 bg-background/60 p-4">
            <Label htmlFor="premiere-countdown-section-visible" className="text-sm font-semibold">Countdown auf der Startseite anzeigen</Label>
            <Toggle id="premiere-countdown-section-visible" checked={!formDisabled} onCheckedChange={(v) => setFormDisabled(!v)} />
          </div>

          <div className="space-y-3">
            {settings.termine.map((termin, index) => {
              const isNext = nextTermin ? nextTermin.label === termin.label : false;
              return <div key={termin.label} className={`grid grid-cols-1 gap-2 rounded-xl border p-3 md:grid-cols-2 ${isNext ? "border-primary" : "border-border"}`}>
                <Label className="md:col-span-2">Vorstellung {index + 1}</Label>
                <Input type="date" value={termin.datum} onChange={(event) => setSettings((prev) => ({ ...prev, termine: prev.termine.map((t, i) => i === index ? { ...t, datum: event.target.value } : t) }))} />
                <Input type="time" value={termin.uhrzeit} onChange={(event) => setSettings((prev) => ({ ...prev, termine: prev.termine.map((t, i) => i === index ? { ...t, uhrzeit: event.target.value } : t) }))} />
              </div>;
            })}
          </div>

          <div className="space-y-2">
            <Label htmlFor="after-show-text">Text nach allen Vorstellungen</Label>
            <Textarea id="after-show-text" value={settings.nachSommerText} onChange={(e) => setSettings((prev) => ({ ...prev, nachSommerText: e.target.value }))} />
          </div>

          {error ? <Text tone="destructive">{error}</Text> : null}
          {success ? <Text tone="success">{success}</Text> : null}
          <DialogFooter className="gap-2"><Button type="submit" disabled={saving}>{saving ? "Speichern…" : "Einstellungen speichern"}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  </div>;
}
