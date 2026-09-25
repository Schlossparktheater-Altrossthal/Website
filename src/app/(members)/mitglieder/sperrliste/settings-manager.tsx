"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { AsyncButton } from "@/components/ui/async-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  type ClientSperrlisteSettings,
  type HolidaySourceMode,
  type HolidaySourceStatus,
} from "@/lib/sperrliste-settings";
import { WEEKDAY_OPTIONS, WEEKDAY_ORDER } from "@/lib/weekdays";
import type { HolidayRange } from "@/types/holidays";

export type SperrlisteSettingsChangePayload = {
  settings: ClientSperrlisteSettings;
  holidays?: HolidayRange[];
  defaults?: { holidaySourceUrl: string; publicHolidaySourceUrl: string };
  offline?: boolean;
  message?: string;
};

type SourceKey = "holiday" | "publicHoliday";
type SourceStatus = ClientSperrlisteSettings["holidayStatus"];
type DayRole = "none" | "core" | "exception";

const FREEZE_PRESETS = [0, 3, 5, 7, 10, 14, 21, 28];
const CHECKED_AT = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" });

const SOURCE_LABELS: Record<SourceKey, { title: string; defaultLabel: string }> = {
  holiday: { title: "Schulferien", defaultLabel: "Standard (Sachsen)" },
  publicHoliday: { title: "Feiertage", defaultLabel: "Standard (Sachsen)" },
};

const STATUS_TEXT: Record<HolidaySourceStatus, { label: string; className: string }> = {
  ok: { label: "Aktiv", className: "bg-success/15 text-success" },
  error: { label: "Fehler", className: "bg-destructive/15 text-destructive" },
  disabled: { label: "Aus", className: "bg-muted text-muted-foreground" },
  unknown: { label: "Nicht geprüft", className: "bg-info/15 text-info" },
};

const ROLE_STYLE: Record<DayRole, string> = {
  none: "border-border bg-card text-muted-foreground",
  core: "border-primary bg-primary text-primary-foreground",
  exception: "border-dashed border-primary bg-primary/10 text-primary",
};

const NEXT_ROLE: Record<DayRole, DayRole> = { none: "core", core: "exception", exception: "none" };

function sortDays(values: Iterable<number>) {
  const set = new Set(values);
  return WEEKDAY_ORDER.filter((weekday) => set.has(weekday));
}

function formatFreeze(value: number) {
  if (value === 0) return "Keine Sperrfrist";
  if (value % 7 === 0) return `${value} Tage (${value / 7} ${value === 7 ? "Woche" : "Wochen"})`;
  return `${value} Tage`;
}

type ManagerProps = {
  settings: ClientSperrlisteSettings;
  defaultHolidaySourceUrl: string;
  defaultPublicHolidaySourceUrl: string;
  onSettingsChange?: (payload: SperrlisteSettingsChangePayload) => void;
  onSaved?: () => void;
};

/** Einstellungen der Sperrliste: Kerntage, Sperrfrist, Ferien- und Feiertagsquellen. */
export function BlocklistSettingsManager({
  settings,
  defaultHolidaySourceUrl,
  defaultPublicHolidaySourceUrl,
  onSettingsChange,
  onSaved,
}: ManagerProps) {
  const initialRoles = useMemo(() => {
    const roles: Record<number, DayRole> = {};
    for (const weekday of WEEKDAY_ORDER) roles[weekday] = "none";
    for (const weekday of settings.exceptionWeekdays) roles[weekday] = "exception";
    for (const weekday of settings.preferredWeekdays) roles[weekday] = "core";
    return roles;
  }, [settings.exceptionWeekdays, settings.preferredWeekdays]);

  const [roles, setRoles] = useState(initialRoles);
  const [freezeDays, setFreezeDays] = useState(settings.freezeDays);
  const [sources, setSources] = useState({
    holiday: { mode: settings.holidaySource.mode, url: settings.holidaySource.url ?? "" },
    publicHoliday: {
      mode: settings.publicHolidaySource.mode,
      url: settings.publicHolidaySource.url ?? "",
    },
  });
  const [statuses, setStatuses] = useState<Record<SourceKey, SourceStatus>>({
    holiday: settings.holidayStatus,
    publicHoliday: settings.publicHolidayStatus,
  });
  const [checking, setChecking] = useState<SourceKey | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setRoles(initialRoles);
    setFreezeDays(settings.freezeDays);
  }, [initialRoles, settings.freezeDays]);

  const preferred = sortDays(WEEKDAY_ORDER.filter((day) => roles[day] === "core"));
  const exceptions = sortDays(WEEKDAY_ORDER.filter((day) => roles[day] === "exception"));

  const dirty =
    freezeDays !== settings.freezeDays ||
    preferred.join() !== sortDays(settings.preferredWeekdays).join() ||
    exceptions.join() !== sortDays(settings.exceptionWeekdays).join() ||
    sources.holiday.mode !== settings.holidaySource.mode ||
    (sources.holiday.mode === "custom" &&
      sources.holiday.url.trim() !== (settings.holidaySource.url ?? "")) ||
    sources.publicHoliday.mode !== settings.publicHolidaySource.mode ||
    (sources.publicHoliday.mode === "custom" &&
      sources.publicHoliday.url.trim() !== (settings.publicHolidaySource.url ?? ""));

  const updateSource = (
    key: SourceKey,
    patch: Partial<{ mode: HolidaySourceMode; url: string }>,
  ) => {
    setSources((current) => ({ ...current, [key]: { ...current[key], ...patch } }));
    setStatuses((current) => ({
      ...current,
      [key]: { status: "unknown", message: null, checkedAt: null },
    }));
    setError(null);
  };

  const discard = () => {
    setRoles(initialRoles);
    setFreezeDays(settings.freezeDays);
    setSources({
      holiday: { mode: settings.holidaySource.mode, url: settings.holidaySource.url ?? "" },
      publicHoliday: {
        mode: settings.publicHolidaySource.mode,
        url: settings.publicHolidaySource.url ?? "",
      },
    });
    setStatuses({ holiday: settings.holidayStatus, publicHoliday: settings.publicHolidayStatus });
    setError(null);
  };

  const checkSource = async (key: SourceKey) => {
    const source = sources[key];
    if (source.mode === "custom" && !source.url.trim()) {
      setError(`Bitte eine URL für ${SOURCE_LABELS[key].title} angeben.`);
      return;
    }
    setChecking(key);
    setError(null);
    try {
      const response = await fetch("/api/sperrliste/settings/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: key,
          mode: source.mode,
          url: source.mode === "custom" ? source.url.trim() : null,
        }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        holidayStatus?: SourceStatus;
        publicHolidayStatus?: SourceStatus;
        error?: string;
      };
      if (!response.ok) throw new Error(data.error ?? "Quelle konnte nicht geprüft werden.");
      setStatuses((current) => ({
        holiday: data.holidayStatus ?? current.holiday,
        publicHoliday: data.publicHolidayStatus ?? current.publicHoliday,
      }));
    } catch (checkError) {
      console.error("[sperrliste:settings-check]", checkError);
      setError(checkError instanceof Error ? checkError.message : "Prüfung fehlgeschlagen.");
    } finally {
      setChecking(null);
    }
  };

  const save = async () => {
    for (const key of ["holiday", "publicHoliday"] as const) {
      if (sources[key].mode === "custom" && !sources[key].url.trim()) {
        setError(`Bitte eine URL für ${SOURCE_LABELS[key].title} angeben.`);
        return;
      }
    }
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/sperrliste/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          freezeDays,
          preferredWeekdays: preferred,
          exceptionWeekdays: exceptions,
          holidaySourceMode: sources.holiday.mode,
          holidaySourceUrl: sources.holiday.mode === "custom" ? sources.holiday.url.trim() : null,
          publicHolidaySourceMode: sources.publicHoliday.mode,
          publicHolidaySourceUrl:
            sources.publicHoliday.mode === "custom" ? sources.publicHoliday.url.trim() : null,
        }),
      });
      const data = (await response.json().catch(() => ({}))) as Partial<
        SperrlisteSettingsChangePayload & { error: string }
      >;
      if (!response.ok || !data.settings) {
        throw new Error(data.error ?? "Einstellungen konnten nicht gespeichert werden.");
      }
      onSettingsChange?.({
        settings: data.settings,
        holidays: data.holidays,
        defaults: data.defaults,
        offline: data.offline,
        message: data.message,
      });
      toast.success("Einstellungen gespeichert", { duration: 3000 });
      onSaved?.();
    } catch (saveError) {
      console.error("[sperrliste:settings-save]", saveError);
      setError(saveError instanceof Error ? saveError.message : "Speichern fehlgeschlagen.");
    } finally {
      setSaving(false);
    }
  };

  const freezeOptions = [...new Set([...FREEZE_PRESETS, freezeDays])].sort((a, b) => a - b);

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-1 pb-4">
        <section className="space-y-3">
          <div>
            <h3 className="text-sm font-semibold">Kerntage</h3>
            <p className="text-xs text-muted-foreground">
              An Kerntagen wird üblicherweise geprobt; sie sind hervorgehoben. Ausnahmetage werden
              mit angezeigt. Tippe auf einen Tag: Kerntag → Ausnahmetag → aus.
            </p>
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {WEEKDAY_OPTIONS.map((weekday) => {
              const role = roles[weekday.value] ?? "none";
              return (
                <button
                  key={weekday.value}
                  type="button"
                  onClick={() =>
                    setRoles((current) => ({ ...current, [weekday.value]: NEXT_ROLE[role] }))
                  }
                  aria-label={`${weekday.label}: ${
                    role === "core" ? "Kerntag" : role === "exception" ? "Ausnahmetag" : "aus"
                  }`}
                  className={cn(
                    "flex h-14 flex-col items-center justify-center rounded-lg border text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    ROLE_STYLE[role],
                  )}
                >
                  {weekday.short}
                  <span className="text-[0.625rem] font-normal opacity-80">
                    {role === "core" ? "Kern" : role === "exception" ? "Ausn." : "–"}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="space-y-2 border-t border-border pt-5">
          <div>
            <h3 className="text-sm font-semibold">Sperrfrist</h3>
            <p className="text-xs text-muted-foreground">
              So kurzfristig darf niemand mehr sperren – „Eingeschränkt“ geht immer.
            </p>
          </div>
          <Select
            value={String(freezeDays)}
            onValueChange={(value) => setFreezeDays(Number(value))}
          >
            <SelectTrigger className="h-11 sm:w-64" aria-label="Sperrfrist">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {freezeOptions.map((value) => (
                <SelectItem key={value} value={String(value)}>
                  {formatFreeze(value)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </section>

        <section className="space-y-3 border-t border-border pt-5">
          <div>
            <h3 className="text-sm font-semibold">Ferien & Feiertage</h3>
            <p className="text-xs text-muted-foreground">
              Werden im Kalender angezeigt; Ferientage unter der Woche gelten als Ausnahmetage.
            </p>
          </div>
          {(["holiday", "publicHoliday"] as const).map((key) => {
            const source = sources[key];
            const status = statuses[key];
            const statusText = STATUS_TEXT[status.status];
            const defaultUrl =
              key === "holiday" ? defaultHolidaySourceUrl : defaultPublicHolidaySourceUrl;
            return (
              <div key={key} className="space-y-2 rounded-lg border border-border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">{SOURCE_LABELS[key].title}</span>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[0.6875rem] font-medium",
                      statusText.className,
                    )}
                  >
                    {statusText.label}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    className="ml-auto"
                    disabled={checking !== null || source.mode === "disabled"}
                    onClick={() => checkSource(key)}
                  >
                    {checking === key ? "Prüft …" : "Prüfen"}
                  </Button>
                </div>
                <Select
                  value={source.mode}
                  onValueChange={(value) => {
                    if (value === "default" || value === "custom" || value === "disabled") {
                      updateSource(key, { mode: value });
                    }
                  }}
                >
                  <SelectTrigger
                    className="h-11"
                    aria-label={`Quelle für ${SOURCE_LABELS[key].title}`}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">{SOURCE_LABELS[key].defaultLabel}</SelectItem>
                    <SelectItem value="custom">Eigene Kalender-URL (ICS)</SelectItem>
                    <SelectItem value="disabled">Nicht anzeigen</SelectItem>
                  </SelectContent>
                </Select>
                {source.mode === "custom" ? (
                  <Input
                    value={source.url}
                    placeholder={defaultUrl}
                    inputMode="url"
                    className="h-11"
                    aria-label={`URL für ${SOURCE_LABELS[key].title}`}
                    onChange={(event) => updateSource(key, { url: event.target.value })}
                  />
                ) : null}
                {status.message || status.checkedAt ? (
                  <p className="break-words text-xs text-muted-foreground">
                    {status.message}
                    {status.checkedAt
                      ? ` Geprüft am ${CHECKED_AT.format(new Date(status.checkedAt))}.`
                      : null}
                  </p>
                ) : null}
              </div>
            );
          })}
        </section>
      </div>

      <div className="flex flex-col gap-2 border-t border-border pt-3">
        {error ? (
          <p className="rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <div className="flex items-center justify-end gap-2">
          <Button type="button" variant="ghost" disabled={!dirty || saving} onClick={discard}>
            Verwerfen
          </Button>
          <AsyncButton
            type="button"
            isLoading={saving}
            loadingText="Speichert …"
            disabled={!dirty}
            onClick={save}
          >
            Speichern
          </AsyncButton>
        </div>
      </div>
    </div>
  );
}
