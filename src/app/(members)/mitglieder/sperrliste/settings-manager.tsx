"use client";

import { useEffect, useMemo, useState } from "react";

import { AlertCircle, CheckCircle2, Loader2, PlugZap, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import type { ClientSperrlisteSettings, HolidaySourceStatus, HolidaySourceMode } from "@/lib/sperrliste-settings";
import { formatWeekdayList, WEEKDAY_OPTIONS, WEEKDAY_ORDER } from "@/lib/weekdays";
import type { HolidayRange } from "@/types/holidays";

const CHECKED_AT_FORMATTER = new Intl.DateTimeFormat("de-DE", {
  dateStyle: "medium",
  timeStyle: "short",
});

interface SperrlisteSettingsManagerProps {
  settings: ClientSperrlisteSettings;
  defaultHolidaySourceUrl: string;
  onSettingsChange?: (
    payload: {
      settings: ClientSperrlisteSettings;
      holidays?: HolidayRange[];
      defaults?: { holidaySourceUrl: string };
    },
  ) => void;
}

type HolidayStatusMeta = {
  label: string;
  tone: "ok" | "warning" | "disabled" | "unknown";
  description: string;
};

function getStatusMeta(status: HolidaySourceStatus): HolidayStatusMeta {
  switch (status) {
    case "ok":
      return {
        label: "Quelle aktiv",
        tone: "ok",
        description: "Der konfigurierte Feed lieferte nutzbare Termine.",
      };
    case "error":
      return {
        label: "Fehler bei der Quelle",
        tone: "warning",
        description: "Die zuletzt getestete Quelle konnte nicht geladen werden.",
      };
    case "disabled":
      return {
        label: "Quelle deaktiviert",
        tone: "disabled",
        description: "Es werden ausschließlich statische Ferientermine genutzt.",
      };
    default:
      return {
        label: "Status unbekannt",
        tone: "unknown",
        description: "Für die aktuelle Quelle liegt noch kein Prüfstatus vor.",
      };
  }
}

function sortArray(values: Iterable<number>) {
  const set = new Set<number>();
  for (const value of values) {
    if (!Number.isInteger(value)) continue;
    if (value < 0 || value > 6) continue;
    set.add(value);
  }
  return WEEKDAY_ORDER.filter((weekday) => set.has(weekday));
}

export function SperrlisteSettingsManager({
  settings,
  defaultHolidaySourceUrl,
  onSettingsChange,
}: SperrlisteSettingsManagerProps) {
  const [freezeDaysValue, setFreezeDaysValue] = useState(String(settings.freezeDays));
  const [holidayMode, setHolidayMode] = useState<HolidaySourceMode>(settings.holidaySource.mode);
  const [holidayUrl, setHolidayUrl] = useState(settings.holidaySource.url ?? "");
  const [preferredDays, setPreferredDays] = useState(() => new Set(settings.preferredWeekdays));
  const [exceptionDays, setExceptionDays] = useState(() => new Set(settings.exceptionWeekdays));
  const [status, setStatus] = useState(settings.holidayStatus);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [defaults, setDefaults] = useState({ holidaySourceUrl: defaultHolidaySourceUrl });

  useEffect(() => {
    setFreezeDaysValue(String(settings.freezeDays));
    setHolidayMode(settings.holidaySource.mode);
    setHolidayUrl(settings.holidaySource.url ?? "");
    setPreferredDays(new Set(settings.preferredWeekdays));
    setExceptionDays(new Set(settings.exceptionWeekdays));
    setStatus(settings.holidayStatus);
  }, [settings]);

  useEffect(() => {
    setDefaults({ holidaySourceUrl: defaultHolidaySourceUrl });
  }, [defaultHolidaySourceUrl]);

  const preferredList = useMemo(
    () => formatWeekdayList(preferredDays, { fallback: "keine bevorzugten Tage" }),
    [preferredDays],
  );
  const exceptionList = useMemo(
    () => formatWeekdayList(exceptionDays, { fallback: "keine Ausnahmen" }),
    [exceptionDays],
  );

  const statusMeta = useMemo(() => getStatusMeta(status.status), [status.status]);
  const formattedCheckedAt = useMemo(() => {
    if (!status.checkedAt) return null;
    const parsed = new Date(status.checkedAt);
    if (Number.isNaN(parsed.getTime())) return null;
    return CHECKED_AT_FORMATTER.format(parsed);
  }, [status.checkedAt]);

  const togglePreferred = (weekday: number) => {
    setPreferredDays((prev) => {
      const next = new Set(prev);
      if (next.has(weekday)) {
        next.delete(weekday);
      } else {
        next.add(weekday);
      }
      return next;
    });
    setExceptionDays((prev) => {
      if (!prev.has(weekday)) return prev;
      const next = new Set(prev);
      next.delete(weekday);
      return next;
    });
    setSuccess(null);
    setError(null);
  };

  const toggleException = (weekday: number) => {
    setExceptionDays((prev) => {
      const next = new Set(prev);
      if (next.has(weekday)) {
        next.delete(weekday);
      } else {
        next.add(weekday);
      }
      return next;
    });
    setPreferredDays((prev) => {
      if (!prev.has(weekday)) return prev;
      const next = new Set(prev);
      next.delete(weekday);
      return next;
    });
    setSuccess(null);
    setError(null);
  };

  const handleResetToDefaultUrl = () => {
    setHolidayUrl(defaults.holidaySourceUrl ?? "");
    setSuccess(null);
    setError(null);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    const parsedFreezeDays = Number.parseInt(freezeDaysValue, 10);
    if (!Number.isFinite(parsedFreezeDays) || parsedFreezeDays < 0) {
      setError("Bitte gib eine gültige Anzahl an Vorlauftagen an.");
      return;
    }

    const payload = {
      freezeDays: parsedFreezeDays,
      preferredWeekdays: sortArray(preferredDays),
      exceptionWeekdays: sortArray(exceptionDays),
      holidaySourceMode: holidayMode,
      holidaySourceUrl: holidayMode === "custom" ? holidayUrl.trim() : null,
    } as const;

    if (holidayMode === "custom" && !payload.holidaySourceUrl) {
      setError("Bitte hinterlege eine gültige URL für den individuellen Ferien-Feed.");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/sperrliste/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = (await response.json().catch(() => ({}))) as {
        settings?: ClientSperrlisteSettings;
        holidays?: HolidayRange[];
        defaults?: { holidaySourceUrl: string };
        error?: string;
      };

      if (!response.ok || !data?.settings) {
        throw new Error(data?.error || "Die Einstellungen konnten nicht gespeichert werden.");
      }

      setStatus(data.settings.holidayStatus);
      setDefaults({ holidaySourceUrl: data.defaults?.holidaySourceUrl ?? defaultHolidaySourceUrl });
      setSuccess("Die Sperrlisten-Einstellungen wurden aktualisiert.");
      onSettingsChange?.({
        settings: data.settings,
        holidays: data.holidays,
        defaults: data.defaults,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler beim Speichern.");
    } finally {
      setSaving(false);
    }
  };

  const renderWeekdayToggle = (
    type: "preferred" | "exception",
    weekday: number,
    label: string,
    shortLabel: string,
  ) => {
    const isPreferred = preferredDays.has(weekday);
    const isException = exceptionDays.has(weekday);
    const isActive = type === "preferred" ? isPreferred : isException;
    const onToggle = type === "preferred" ? togglePreferred : toggleException;

    return (
      <button
        key={`${type}-${weekday}`}
        type="button"
        onClick={() => onToggle(weekday)}
        aria-pressed={isActive}
        className={cn(
          "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary",
          isActive && type === "preferred" && "border-primary bg-primary/10 text-primary",
          isActive && type === "exception" &&
            "border-amber-400 bg-amber-100 text-amber-900 dark:border-amber-500/70 dark:bg-amber-500/10 dark:text-amber-100",
          !isActive && "border-border/60 bg-background/80 hover:border-primary/40",
        )}
      >
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/80">
          {shortLabel}
        </span>
        <span className="hidden text-sm sm:inline">{label}</span>
      </button>
    );
  };

  return (
    <Card>
      <CardHeader className="space-y-3">
        <CardTitle className="flex items-center gap-2 text-xl">
          <Sparkles className="h-5 w-5 text-primary" aria-hidden />
          Sperrlisten-Einstellungen
        </CardTitle>
        <Text variant="small" tone="muted">
          Lege fest, welche Ferienquelle genutzt wird, wie groß der Planungsvorlauf ist und welche Wochentage als bevorzugte
          oder Ausnahme-Proben gelten.
        </Text>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-8">
          <section className="space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Ferienquelle</h3>
                <p className="text-sm text-muted-foreground">
                  Wähle, ob die Ferien automatisch geladen werden oder ob die Sperrliste ohne externe Quelle arbeitet.
                </p>
              </div>
              <div
                className={cn(
                  "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm",
                  statusMeta.tone === "ok" && "border-emerald-400/60 bg-emerald-500/10 text-emerald-700 dark:text-emerald-100",
                  statusMeta.tone === "warning" && "border-amber-400/60 bg-amber-100 text-amber-900 dark:border-amber-500/70 dark:bg-amber-500/10 dark:text-amber-100",
                  statusMeta.tone === "disabled" && "border-border/60 bg-muted/50 text-muted-foreground",
                  statusMeta.tone === "unknown" && "border-slate-400/50 bg-slate-100 text-slate-700 dark:border-slate-600/60 dark:bg-slate-800/40 dark:text-slate-100",
                )}
              >
                {statusMeta.tone === "ok" ? (
                  <CheckCircle2 className="h-4 w-4" aria-hidden />
                ) : statusMeta.tone === "warning" ? (
                  <AlertCircle className="h-4 w-4" aria-hidden />
                ) : statusMeta.tone === "disabled" ? (
                  <PlugZap className="h-4 w-4" aria-hidden />
                ) : (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                )}
                <div className="flex flex-col">
                  <span className="text-xs font-semibold uppercase tracking-wide">{statusMeta.label}</span>
                  <span className="text-xs text-muted-foreground/80 dark:text-inherit">
                    {status.message ?? statusMeta.description}
                    {formattedCheckedAt ? ` — geprüft am ${formattedCheckedAt}` : ""}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="holiday-mode">Quelle auswählen</Label>
                <Select value={holidayMode} onValueChange={(value) => setHolidayMode(value as HolidaySourceMode)}>
                  <SelectTrigger id="holiday-mode">
                    <SelectValue placeholder="Modus wählen" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">Standardfeed (Schulferien Sachsen)</SelectItem>
                    <SelectItem value="custom">Eigener Feed (ICS oder JSON)</SelectItem>
                    <SelectItem value="disabled">Keine externe Quelle verwenden</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="holiday-url">Feed-URL</Label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    id="holiday-url"
                    type="url"
                    value={holidayUrl}
                    onChange={(event) => setHolidayUrl(event.target.value)}
                    placeholder={defaults.holidaySourceUrl}
                    disabled={holidayMode !== "custom" || saving}
                    className="sm:flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleResetToDefaultUrl}
                    disabled={holidayMode !== "custom" || saving}
                  >
                    Standard übernehmen
                  </Button>
                </div>
                <Text variant="small" tone="muted">
                  Für individuelle Quellen kannst du ICS-Kalender oder JSON-Endpunkte (z. B. ferien-api.de) hinterlegen.
                </Text>
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Bevorzugte Probentage
              </h3>
              <Text variant="small" tone="muted">
                Diese Tage werden im Kalender hervorgehoben und in der Übersicht standardmäßig angezeigt.
              </Text>
              <div className="mt-3 flex flex-wrap gap-2">
                {WEEKDAY_OPTIONS.map((option) =>
                  renderWeekdayToggle("preferred", option.value, option.label, option.short),
                )}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">Aktuell: {preferredList}</p>
            </div>

            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Ausnahmeproben
              </h3>
              <Text variant="small" tone="muted">
                Tage, die nur in besonderen Fällen eingeplant werden. Sie erscheinen in der Übersicht in warmen Gelbtönen.
              </Text>
              <div className="mt-3 flex flex-wrap gap-2">
                {WEEKDAY_OPTIONS.map((option) =>
                  renderWeekdayToggle("exception", option.value, option.label, option.short),
                )}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">Aktuell: {exceptionList}</p>
            </div>
          </section>

          <section className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="freeze-days">Vorlauf für Sperrtermine (Tage)</Label>
              <Input
                id="freeze-days"
                type="number"
                min={0}
                max={365}
                value={freezeDaysValue}
                onChange={(event) => setFreezeDaysValue(event.target.value.replace(/[^0-9]/g, ""))}
                disabled={saving}
              />
              <Text variant="small" tone="muted">
                Innerhalb dieses Zeitraums können Mitglieder keine neuen Sperrtage hinzufügen. Bestehende Einträge lassen sich
                weiterhin entfernen.
              </Text>
            </div>
          </section>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          {success ? <p className="text-sm text-emerald-600 dark:text-emerald-300">{success}</p> : null}

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <Text variant="small" tone="muted">
              Änderungen beeinflussen sofort die Hinweise im Kalender und die Farbgebung der Sperrlisten-Übersicht.
            </Text>
            <Button type="submit" disabled={saving} className="sm:w-auto">
              {saving ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Speichern …
                </span>
              ) : (
                "Änderungen speichern"
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
