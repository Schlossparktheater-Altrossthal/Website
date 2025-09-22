"use client";

import { useEffect, useId, useMemo, useState, type ReactNode } from "react";

import { AlertCircle, CheckCircle2, ChevronDown, Loader2, PlugZap, Sparkles } from "lucide-react";

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

const STATUS_CONTAINER_TONES: Record<HolidayStatusMeta["tone"], string> = {
  ok: "border-emerald-400/60 bg-emerald-500/10 text-emerald-700 dark:text-emerald-100",
  warning:
    "border-amber-400/60 bg-amber-100 text-amber-900 dark:border-amber-500/70 dark:bg-amber-500/10 dark:text-amber-100",
  disabled: "border-border/60 bg-muted/40 text-muted-foreground",
  unknown:
    "border-slate-400/50 bg-slate-100 text-slate-700 dark:border-slate-600/60 dark:bg-slate-800/40 dark:text-slate-100",
};

const STATUS_BADGE_TONES: Record<HolidayStatusMeta["tone"], string> = {
  ok: "bg-emerald-500/20 text-emerald-700 dark:bg-emerald-500/30 dark:text-emerald-100",
  warning:
    "bg-amber-500/20 text-amber-900 dark:bg-amber-500/30 dark:text-amber-100",
  disabled: "bg-muted text-muted-foreground",
  unknown:
    "bg-slate-500/20 text-slate-700 dark:bg-slate-500/30 dark:text-slate-100",
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

interface SettingsSectionProps {
  title: string;
  description?: string;
  summary?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}

function SettingsSection({ title, description, summary, defaultOpen = false, children }: SettingsSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const contentId = useId();

  const renderSummary = (className?: string) => {
    if (summary === undefined || summary === null) return null;
    return (
      <span className={cn("flex flex-wrap items-center gap-2 text-sm", className)}>
        {typeof summary === "string" ? <span className="text-muted-foreground">{summary}</span> : summary}
      </span>
    );
  };

  const summaryMobile = renderSummary();
  const summaryDesktop = renderSummary("text-muted-foreground");

  return (
    <section className="rounded-lg border border-border/60 bg-card/50">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-controls={contentId}
        className="flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
      >
        <div className="flex-1 space-y-1">
          <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
          {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
          {summaryMobile ? <div className="sm:hidden">{summaryMobile}</div> : null}
        </div>
        <div className="flex items-center gap-3">
          {summaryDesktop ? <div className="hidden sm:block">{summaryDesktop}</div> : null}
          <ChevronDown
            className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")}
            aria-hidden
          />
        </div>
      </button>
      <div
        id={contentId}
        className={cn("px-4 pb-4", open ? "block border-t border-border/60 pt-4" : "hidden")}
      >
        <div className="space-y-4">{children}</div>
      </div>
    </section>
  );
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

  const holidayModeSummary = useMemo(() => {
    switch (holidayMode) {
      case "default":
        return "Standardfeed (Schulferien Sachsen)";
      case "custom": {
        const trimmed = holidayUrl.trim();
        if (!trimmed) return "Eigener Feed (URL fehlt)";
        try {
          const parsed = new URL(trimmed);
          return `Eigener Feed (${parsed.hostname})`;
        } catch {
          return `Eigener Feed (${trimmed})`;
        }
      }
      case "disabled":
      default:
        return "Keine externe Quelle";
    }
  }, [holidayMode, holidayUrl]);

  const freezeDaysNumber = useMemo(() => {
    if (!freezeDaysValue) return null;
    const parsed = Number.parseInt(freezeDaysValue, 10);
    return Number.isFinite(parsed) ? parsed : null;
  }, [freezeDaysValue]);

  const freezeDaysSummary = useMemo(() => {
    if (freezeDaysNumber === null) return "Nicht gesetzt";
    const suffix = freezeDaysNumber === 1 ? "Tag" : "Tage";
    return `${freezeDaysNumber} ${suffix}`;
  }, [freezeDaysNumber]);

  const statusChipClasses = STATUS_BADGE_TONES[statusMeta.tone];

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
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid gap-4 lg:grid-cols-2">
            <div
              className={cn(
                "flex items-start gap-3 rounded-lg border p-4 text-sm leading-relaxed",
                STATUS_CONTAINER_TONES[statusMeta.tone],
              )}
            >
              {statusMeta.tone === "ok" ? (
                <CheckCircle2 className="mt-1 h-5 w-5 shrink-0" aria-hidden />
              ) : statusMeta.tone === "warning" ? (
                <AlertCircle className="mt-1 h-5 w-5 shrink-0" aria-hidden />
              ) : statusMeta.tone === "disabled" ? (
                <PlugZap className="mt-1 h-5 w-5 shrink-0" aria-hidden />
              ) : (
                <Loader2 className="mt-1 h-5 w-5 shrink-0 animate-spin" aria-hidden />
              )}
              <div className="space-y-1">
                <p className="text-sm font-semibold uppercase tracking-wide">{statusMeta.label}</p>
                <p className="text-sm opacity-90">
                  {status.message ?? statusMeta.description}
                </p>
                {formattedCheckedAt ? (
                  <p className="text-xs opacity-80">Zuletzt geprüft: {formattedCheckedAt}</p>
                ) : null}
              </div>
            </div>
            <div className="rounded-lg border border-dashed border-border/60 bg-muted/30 p-4">
              <Text variant="caption" uppercase className="text-muted-foreground">
                Kurzüberblick
              </Text>
              <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                <div className="space-y-1">
                  <Text variant="caption" uppercase className="text-muted-foreground">
                    Ferienmodus
                  </Text>
                  <Text variant="small">{holidayModeSummary}</Text>
                </div>
                <div className="space-y-1">
                  <Text variant="caption" uppercase className="text-muted-foreground">
                    Bevorzugte Tage
                  </Text>
                  <Text variant="small">{preferredList}</Text>
                </div>
                <div className="space-y-1">
                  <Text variant="caption" uppercase className="text-muted-foreground">
                    Ausnahmeproben
                  </Text>
                  <Text variant="small">{exceptionList}</Text>
                </div>
                <div className="space-y-1">
                  <Text variant="caption" uppercase className="text-muted-foreground">
                    Sperrfrist
                  </Text>
                  <Text variant="small">{freezeDaysSummary}</Text>
                </div>
              </dl>
            </div>
          </div>

          <SettingsSection
            title="Ferienquelle"
            description="Steuert, ob Ferien automatisch geladen werden oder die Sperrliste ohne externe Quelle arbeitet."
            summary={
              <span className="flex items-center gap-2 text-muted-foreground">
                <span>{holidayModeSummary}</span>
                <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase", statusChipClasses)}>
                  {statusMeta.label}
                </span>
              </span>
            }
            defaultOpen
          >
            <div
              className={cn(
                "flex items-start gap-3 rounded-md border border-dashed p-3 text-sm",
                STATUS_CONTAINER_TONES[statusMeta.tone],
              )}
            >
              {statusMeta.tone === "ok" ? (
                <CheckCircle2 className="mt-1 h-4 w-4 shrink-0" aria-hidden />
              ) : statusMeta.tone === "warning" ? (
                <AlertCircle className="mt-1 h-4 w-4 shrink-0" aria-hidden />
              ) : statusMeta.tone === "disabled" ? (
                <PlugZap className="mt-1 h-4 w-4 shrink-0" aria-hidden />
              ) : (
                <Loader2 className="mt-1 h-4 w-4 shrink-0 animate-spin" aria-hidden />
              )}
              <div className="space-y-1">
                <p className="text-sm font-semibold uppercase tracking-wide">{statusMeta.label}</p>
                <p className="text-xs opacity-80">
                  {status.message ?? statusMeta.description}
                  {formattedCheckedAt ? ` — geprüft am ${formattedCheckedAt}` : ""}
                </p>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
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
          </SettingsSection>

          <SettingsSection
            title="Probenplanung"
            description="Lege fest, welche Wochentage bevorzugt oder nur als Ausnahme berücksichtigt werden."
            summary={`Bevorzugt: ${preferredList} · Ausnahmen: ${exceptionList}`}
            defaultOpen
          >
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-3">
                <Text variant="small" tone="muted">
                  Bevorzugte Probentage
                </Text>
                <div className="flex flex-wrap gap-2">
                  {WEEKDAY_OPTIONS.map((option) =>
                    renderWeekdayToggle("preferred", option.value, option.label, option.short),
                  )}
                </div>
                <Text variant="caption" tone="muted">
                  Aktuell: {preferredList}
                </Text>
              </div>
              <div className="space-y-3">
                <Text variant="small" tone="muted">
                  Ausnahmeproben
                </Text>
                <div className="flex flex-wrap gap-2">
                  {WEEKDAY_OPTIONS.map((option) =>
                    renderWeekdayToggle("exception", option.value, option.label, option.short),
                  )}
                </div>
                <Text variant="caption" tone="muted">
                  Aktuell: {exceptionList}
                </Text>
              </div>
            </div>
          </SettingsSection>

          <SettingsSection
            title="Sperrfrist"
            description="Bestimme, wie viele Tage vor einer Probe neue Sperrtermine blockiert werden."
            summary={`Vorlauf: ${freezeDaysSummary}`}
          >
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
          </SettingsSection>

          <div className="space-y-3">
            {error ? (
              <div
                role="alert"
                className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              >
                {error}
              </div>
            ) : null}
            {success ? (
              <div
                role="status"
                className="rounded-md border border-emerald-400/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-200"
              >
                {success}
              </div>
            ) : null}
          </div>

          <div className="flex flex-col gap-3 border-t border-border/60 pt-4 sm:flex-row sm:items-center sm:justify-between">
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
