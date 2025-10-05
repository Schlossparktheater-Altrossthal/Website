"use client";

import { useEffect, useMemo, useState, type ComponentProps } from "react";
import { AlertCircle, CheckCircle2, Loader2, PlugZap, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import {
  type ClientSperrlisteSettings,
  type HolidaySourceStatus,
  type HolidaySourceMode,
} from "@/lib/sperrliste-settings";
import { formatWeekdayList, WEEKDAY_OPTIONS, WEEKDAY_ORDER } from "@/lib/weekdays";
import type { HolidayRange } from "@/types/holidays";

const CHECKED_AT_FORMATTER = new Intl.DateTimeFormat("de-DE", {
  dateStyle: "medium",
  timeStyle: "short",
});

const FREEZE_DAY_PRESETS = [0, 3, 5, 7, 10, 14, 21, 28, 30] as const;

export type SperrlisteSettingsChangePayload = {
  settings: ClientSperrlisteSettings;
  holidays?: HolidayRange[];
  defaults?: { holidaySourceUrl: string; publicHolidaySourceUrl: string };
};

interface SperrlisteSettingsManagerProps {
  settings: ClientSperrlisteSettings;
  defaultHolidaySourceUrl: string;
  defaultPublicHolidaySourceUrl: string;
  onSettingsChange?: (payload: SperrlisteSettingsChangePayload) => void;
}

type ErrorState = {
  message: string;
  details?: string;
};

type HolidayStatusMeta = {
  label: string;
  tone: "ok" | "warning" | "disabled" | "unknown";
  description: string;
};

const STATUS_LINE_CLASSES: Record<HolidayStatusMeta["tone"], string> = {
  ok: "border-emerald-500/50 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100",
  warning: "border-amber-500/50 bg-amber-500/10 text-amber-900 dark:text-amber-100",
  disabled: "border-border bg-muted text-muted-foreground",
  unknown: "border-slate-400/60 bg-slate-400/10 text-slate-800 dark:text-slate-100",
};

const STATUS_BADGE_VARIANTS = {
  ok: "success",
  warning: "warning",
  disabled: "muted",
  unknown: "info",
} as const satisfies Record<HolidayStatusMeta["tone"], ComponentProps<typeof Badge>["variant"]>;

const STATUS_ICONS = {
  ok: CheckCircle2,
  warning: AlertCircle,
  disabled: PlugZap,
  unknown: Loader2,
} as const;

function getStatusMeta(status: HolidaySourceStatus): HolidayStatusMeta {
  switch (status) {
    case "ok":
      return {
        label: "Quelle aktiv",
        tone: "ok",
        description: "Die Ferienquelle liefert nutzbare Termine.",
      };
    case "error":
      return {
        label: "Quelle fehlerhaft",
        tone: "warning",
        description: "Beim Abruf der Ferienquelle trat ein Fehler auf.",
      };
    case "disabled":
      return {
        label: "Quelle deaktiviert",
        tone: "disabled",
        description: "Es werden nur hinterlegte Ferientermine genutzt.",
      };
    default:
      return {
        label: "Quelle nicht geprüft",
        tone: "unknown",
        description: "Für diese Konfiguration liegt noch kein Prüfergebnis vor.",
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

function areArraysEqual(a: number[], b: number[]) {
  if (a.length !== b.length) return false;
  return a.every((value, index) => value === b[index]);
}

function formatFreezeLabel(value: number) {
  if (value === 0) return "Keine Sperrfrist";
  if (value === 1) return "1 Tag";
  if (value === 7) return "7 Tage (1 Woche)";
  if (value === 14) return "14 Tage (2 Wochen)";
  if (value === 21) return "21 Tage (3 Wochen)";
  if (value === 28) return "28 Tage (4 Wochen)";
  return `${value} Tage`;
}

function buildFreezeOptions(current: number | null) {
  const values = new Set<number>(FREEZE_DAY_PRESETS);
  if (current !== null) {
    values.add(current);
  }
  return Array.from(values)
    .sort((a, b) => a - b)
    .map((value) => ({
      value: String(value),
      label: formatFreezeLabel(value),
    }));
}

export function SperrlisteSettingsManager({
  settings,
  defaultHolidaySourceUrl,
  defaultPublicHolidaySourceUrl,
  onSettingsChange,
}: SperrlisteSettingsManagerProps) {
  const [freezeDaysValue, setFreezeDaysValue] = useState(String(settings.freezeDays));
  const [holidayModeState, setHolidayModeState] = useState<HolidaySourceMode>(settings.holidaySource.mode);
  const [holidayUrlState, setHolidayUrlState] = useState(settings.holidaySource.url ?? "");
  const [publicHolidayModeState, setPublicHolidayModeState] = useState<HolidaySourceMode>(
    settings.publicHolidaySource.mode,
  );
  const [publicHolidayUrlState, setPublicHolidayUrlState] = useState(
    settings.publicHolidaySource.url ?? "",
  );
  const [preferredDays, setPreferredDays] = useState(() => new Set(settings.preferredWeekdays));
  const [exceptionDays, setExceptionDays] = useState(() => new Set(settings.exceptionWeekdays));
  const [status, setStatus] = useState(settings.holidayStatus);
  const [publicStatus, setPublicStatus] = useState(settings.publicHolidayStatus);
  const [saving, setSaving] = useState(false);
  const [checkingSource, setCheckingSource] = useState<"holiday" | "publicHoliday" | null>(null);
  const [error, setError] = useState<ErrorState | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [defaults, setDefaults] = useState({
    holidaySourceUrl: defaultHolidaySourceUrl,
    publicHolidaySourceUrl: defaultPublicHolidaySourceUrl,
  });

  useEffect(() => {
    setFreezeDaysValue(String(settings.freezeDays));
    setHolidayModeState(settings.holidaySource.mode);
    setHolidayUrlState(settings.holidaySource.url ?? "");
    setPublicHolidayModeState(settings.publicHolidaySource.mode);
    setPublicHolidayUrlState(settings.publicHolidaySource.url ?? "");
    setPreferredDays(new Set(settings.preferredWeekdays));
    setExceptionDays(new Set(settings.exceptionWeekdays));
    setStatus(settings.holidayStatus);
    setPublicStatus(settings.publicHolidayStatus);
  }, [settings]);

  useEffect(() => {
    setDefaults({
      holidaySourceUrl: defaultHolidaySourceUrl,
      publicHolidaySourceUrl: defaultPublicHolidaySourceUrl,
    });
  }, [defaultHolidaySourceUrl, defaultPublicHolidaySourceUrl]);

  const resetFeedback = () => {
    setError(null);
    setSuccess(null);
  };

  const markStatusPending = (target: "holiday" | "publicHoliday") => {
    const setter = target === "holiday" ? setStatus : setPublicStatus;
    setter((prev) => {
      if (prev.status === "unknown" && !prev.checkedAt) {
        return prev;
      }
      return {
        status: "unknown",
        message: null,
        checkedAt: null,
      };
    });
  };

  const handleHolidayModeChange = (value: HolidaySourceMode) => {
    if (value === holidayModeState) {
      return;
    }
    setHolidayModeState(value);
    resetFeedback();
    markStatusPending("holiday");
  };

  const handleHolidayUrlInput = (value: string) => {
    if (value === holidayUrlState) {
      return;
    }
    setHolidayUrlState(value);
    resetFeedback();
    markStatusPending("holiday");
  };

  const handlePublicHolidayModeChange = (value: HolidaySourceMode) => {
    if (value === publicHolidayModeState) {
      return;
    }
    setPublicHolidayModeState(value);
    resetFeedback();
    markStatusPending("publicHoliday");
  };

  const handlePublicHolidayUrlInput = (value: string) => {
    if (value === publicHolidayUrlState) {
      return;
    }
    setPublicHolidayUrlState(value);
    resetFeedback();
    markStatusPending("publicHoliday");
  };

  const holidayMode = holidayModeState;
  const holidayUrl = holidayUrlState;
  const publicHolidayMode = publicHolidayModeState;
  const publicHolidayUrl = publicHolidayUrlState;
  const isCheckingHoliday = checkingSource === "holiday";
  const isCheckingPublicHoliday = checkingSource === "publicHoliday";
  const isCheckingAnything = checkingSource !== null;

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

  const publicStatusMeta = useMemo(() => getStatusMeta(publicStatus.status), [publicStatus.status]);
  const publicFormattedCheckedAt = useMemo(() => {
    if (!publicStatus.checkedAt) return null;
    const parsed = new Date(publicStatus.checkedAt);
    if (Number.isNaN(parsed.getTime())) return null;
    return CHECKED_AT_FORMATTER.format(parsed);
  }, [publicStatus.checkedAt]);

  const holidayModeSummary = useMemo(() => {
    switch (holidayMode) {
      case "default":
        return "Standardfeed (Schulferien Sachsen)";
      case "custom": {
        const trimmed = holidayUrl.trim();
        if (!trimmed) return "Eigene URL (noch nicht gesetzt)";
        try {
          const parsed = new URL(trimmed);
          return `Eigene URL (${parsed.hostname})`;
        } catch {
          return `Eigene URL (${trimmed})`;
        }
      }
      case "disabled":
      default:
        return "Keine Ferienquelle";
    }
  }, [holidayMode, holidayUrl]);

  const holidaySourceDetails = useMemo(() => {
    if (holidayMode === "disabled") {
      return null;
    }

    const rawUrl =
      holidayMode === "custom" ? holidayUrl : defaults.holidaySourceUrl ?? "";
    const trimmed = rawUrl.trim();

    if (!trimmed) {
      return null;
    }

    try {
      const parsed = new URL(trimmed);
      const label = `${parsed.hostname}${parsed.pathname}${parsed.search}${parsed.hash}`.replace(/\/$/, "");

      return {
        href: parsed.toString(),
        label: label || parsed.hostname,
      };
    } catch {
      if (/^https?:\/\//i.test(trimmed)) {
        return {
          href: trimmed,
          label: trimmed,
        };
      }

      return {
        href: null,
        label: trimmed,
      };
    }
  }, [defaults.holidaySourceUrl, holidayMode, holidayUrl]);

  const publicHolidayModeSummary = useMemo(() => {
    switch (publicHolidayMode) {
      case "default": {
        const trimmed = defaults.publicHolidaySourceUrl?.trim();
        if (!trimmed) {
          return "Standardfeed (nicht konfiguriert)";
        }
        try {
          const parsed = new URL(trimmed);
          const label = `${parsed.hostname}${parsed.pathname}${parsed.search}${parsed.hash}`.replace(/\/$/, "");
          return `Standardfeed (${label || parsed.hostname})`;
        } catch {
          return `Standardfeed (${trimmed})`;
        }
      }
      case "custom": {
        const trimmed = publicHolidayUrl.trim();
        if (!trimmed) return "Eigene URL (noch nicht gesetzt)";
        try {
          const parsed = new URL(trimmed);
          return `Eigene URL (${parsed.hostname})`;
        } catch {
          return `Eigene URL (${trimmed})`;
        }
      }
      case "disabled":
      default:
        return "Keine Feiertagsquelle";
    }
  }, [defaults.publicHolidaySourceUrl, publicHolidayMode, publicHolidayUrl]);

  const publicHolidaySourceDetails = useMemo(() => {
    if (publicHolidayMode === "disabled") {
      return null;
    }

    const rawUrl =
      publicHolidayMode === "custom"
        ? publicHolidayUrl
        : defaults.publicHolidaySourceUrl ?? "";
    const trimmed = rawUrl.trim();

    if (!trimmed) {
      return null;
    }

    try {
      const parsed = new URL(trimmed);
      const label = `${parsed.hostname}${parsed.pathname}${parsed.search}${parsed.hash}`.replace(/\/$/, "");

      return {
        href: parsed.toString(),
        label: label || parsed.hostname,
      };
    } catch {
      if (/^https?:\/\//i.test(trimmed)) {
        return {
          href: trimmed,
          label: trimmed,
        };
      }

      return {
        href: null,
        label: trimmed,
      };
    }
  }, [defaults.publicHolidaySourceUrl, publicHolidayMode, publicHolidayUrl]);

  const freezeDaysNumber = useMemo(() => {
    const parsed = Number.parseInt(freezeDaysValue, 10);
    return Number.isFinite(parsed) ? parsed : null;
  }, [freezeDaysValue]);

  const freezeOptions = useMemo(() => buildFreezeOptions(freezeDaysNumber), [freezeDaysNumber]);

  const freezeDaysSummary = useMemo(() => {
    if (freezeDaysNumber === null) return "Unbekannt";
    return formatFreezeLabel(freezeDaysNumber);
  }, [freezeDaysNumber]);

  const currentPreferredWeekdays = useMemo(() => sortArray(preferredDays), [preferredDays]);
  const currentExceptionWeekdays = useMemo(() => sortArray(exceptionDays), [exceptionDays]);
  const initialPreferredWeekdays = useMemo(
    () => sortArray(settings.preferredWeekdays),
    [settings.preferredWeekdays],
  );
  const initialExceptionWeekdays = useMemo(
    () => sortArray(settings.exceptionWeekdays),
    [settings.exceptionWeekdays],
  );

  const hasUnsavedChanges = useMemo(() => {
    if (freezeDaysNumber === null) {
      return true;
    }
    if (freezeDaysNumber !== settings.freezeDays) {
      return true;
    }
    if (!areArraysEqual(currentPreferredWeekdays, initialPreferredWeekdays)) {
      return true;
    }
    if (!areArraysEqual(currentExceptionWeekdays, initialExceptionWeekdays)) {
      return true;
    }
    if (holidayMode !== settings.holidaySource.mode) {
      return true;
    }
    const trimmedUrl = holidayMode === "custom" ? holidayUrl.trim() : null;
    const initialUrl = settings.holidaySource.url ?? null;
    if ((trimmedUrl ?? null) !== (initialUrl ?? null)) {
      return true;
    }
    if (publicHolidayMode !== settings.publicHolidaySource.mode) {
      return true;
    }
    const trimmedPublicUrl = publicHolidayMode === "custom" ? publicHolidayUrl.trim() : null;
    const initialPublicUrl = settings.publicHolidaySource.url ?? null;
    if ((trimmedPublicUrl ?? null) !== (initialPublicUrl ?? null)) {
      return true;
    }
    return false;
  }, [
    freezeDaysNumber,
    currentPreferredWeekdays,
    initialPreferredWeekdays,
    currentExceptionWeekdays,
    initialExceptionWeekdays,
    holidayMode,
    holidayUrl,
    publicHolidayMode,
    publicHolidayUrl,
    settings.freezeDays,
    settings.holidaySource.mode,
    settings.holidaySource.url,
    settings.publicHolidaySource.mode,
    settings.publicHolidaySource.url,
  ]);

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
    resetFeedback();
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
    resetFeedback();
  };

  const handleResetHolidayToDefault = () => {
    const targetUrl = defaults.holidaySourceUrl ?? "";
    const shouldUpdateStatus =
      holidayModeState !== "default" || holidayUrlState.trim() !== targetUrl.trim();

    if (holidayModeState !== "default") {
      setHolidayModeState("default");
    }
    if (holidayUrlState !== targetUrl) {
      setHolidayUrlState(targetUrl);
    }

    if (shouldUpdateStatus) {
      markStatusPending("holiday");
    }
    resetFeedback();
  };

  const handleResetPublicToDefault = () => {
    const targetUrl = defaults.publicHolidaySourceUrl ?? "";
    const shouldUpdateStatus =
      publicHolidayModeState !== "default" ||
      publicHolidayUrlState.trim() !== targetUrl.trim();

    if (publicHolidayModeState !== "default") {
      setPublicHolidayModeState("default");
    }
    if (publicHolidayUrlState !== targetUrl) {
      setPublicHolidayUrlState(targetUrl);
    }

    if (shouldUpdateStatus) {
      markStatusPending("publicHoliday");
    }
    resetFeedback();
  };

  const handleDiscardChanges = () => {
    resetFeedback();
    setFreezeDaysValue(String(settings.freezeDays));
    setHolidayModeState(settings.holidaySource.mode);
    setHolidayUrlState(settings.holidaySource.url ?? "");
    setPublicHolidayModeState(settings.publicHolidaySource.mode);
    setPublicHolidayUrlState(settings.publicHolidaySource.url ?? "");
    setPreferredDays(new Set(settings.preferredWeekdays));
    setExceptionDays(new Set(settings.exceptionWeekdays));
    setStatus(settings.holidayStatus);
    setPublicStatus(settings.publicHolidayStatus);
  };

  const handleCheckSource = async (target: "holiday" | "publicHoliday") => {
    resetFeedback();

    const mode = target === "holiday" ? holidayMode : publicHolidayMode;
    const url = target === "holiday" ? holidayUrl : publicHolidayUrl;
    const label = target === "holiday" ? "Ferienquelle" : "Feiertagsquelle";

    if (mode === "custom" && !url.trim()) {
      setError({ message: `Bitte gib eine gültige URL für die ${label.toLowerCase()} an.` });
      return;
    }

    setCheckingSource(target);
    try {
      const response = await fetch("/api/sperrliste/settings/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: target,
          mode,
          url: mode === "custom" ? url.trim() : null,
        }),
      });

      const data = (await response.json().catch(() => ({}))) as {
        holidayStatus?: ClientSperrlisteSettings["holidayStatus"];
        publicHolidayStatus?: ClientSperrlisteSettings["holidayStatus"];
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data?.error || `${label} konnte nicht geprüft werden.`);
      }

      if (data.holidayStatus) {
        setStatus(data.holidayStatus);
      }
      if (data.publicHolidayStatus) {
        setPublicStatus(data.publicHolidayStatus);
      }
    } catch (err) {
      setError({
        message: `${label} konnte nicht geprüft werden.`,
        details: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setCheckingSource(null);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    resetFeedback();

    const trimmedUrl = holidayMode === "custom" ? holidayUrl.trim() : null;
    const trimmedPublicUrl = publicHolidayMode === "custom" ? publicHolidayUrl.trim() : null;
    const parsedFreezeDays = Number.parseInt(freezeDaysValue, 10);

    if (!Number.isFinite(parsedFreezeDays) || parsedFreezeDays < 0) {
      setError({ message: "Bitte wähle eine gültige Sperrfrist." });
      return;
    }

    if (holidayMode === "custom" && !trimmedUrl) {
      setError({ message: "Bitte gib eine gültige URL für die Ferienquelle an." });
      return;
    }

    if (publicHolidayMode === "custom" && !trimmedPublicUrl) {
      setError({ message: "Bitte gib eine gültige URL für die Feiertagsquelle an." });
      return;
    }

    const payload = {
      freezeDays: parsedFreezeDays,
      preferredWeekdays: currentPreferredWeekdays,
      exceptionWeekdays: currentExceptionWeekdays,
      holidaySourceMode: holidayMode,
      holidaySourceUrl: trimmedUrl,
      publicHolidaySourceMode: publicHolidayMode,
      publicHolidaySourceUrl: trimmedPublicUrl,
    } as const;

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
        defaults?: { holidaySourceUrl: string; publicHolidaySourceUrl: string };
        error?: string;
      };

      if (!response.ok || !data?.settings) {
        throw new Error(data?.error || "Die Sperrlisten-Einstellungen konnten nicht gespeichert werden.");
      }

      setStatus(data.settings.holidayStatus);
      setPublicStatus(data.settings.publicHolidayStatus);
      setDefaults({
        holidaySourceUrl: data.defaults?.holidaySourceUrl ?? defaultHolidaySourceUrl,
        publicHolidaySourceUrl:
          data.defaults?.publicHolidaySourceUrl ?? defaultPublicHolidaySourceUrl,
      });
      setSuccess("Sperrlisten-Einstellungen gespeichert.");

      onSettingsChange?.({
        settings: data.settings,
        holidays: data.holidays,
        defaults: data.defaults,
      });
    } catch (err) {
      setError({
        message: "Änderungen konnten nicht gespeichert werden.",
        details: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  const renderSummaryList = (layout: "compact" | "sidebar", className?: string) => (
    <dl
      className={cn(
        "text-sm text-foreground",
        layout === "compact"
          ? "grid grid-cols-1 gap-y-6 sm:grid-cols-2 sm:gap-x-10"
          : "grid grid-cols-1 gap-y-6",
        className,
      )}
    >
      <div className="space-y-6">
        <div className="space-y-2">
          <Text asChild variant="caption" uppercase className="text-muted-foreground">
            <dt>Bevorzugte Tage</dt>
          </Text>
          <dd className="leading-5">{preferredList}</dd>
        </div>
        <div className="space-y-2">
          <Text asChild variant="caption" uppercase className="text-muted-foreground">
            <dt>Ausnahmen</dt>
          </Text>
          <dd className="leading-5">{exceptionList}</dd>
        </div>
      </div>
      <div className="space-y-6">
        <div className="space-y-2">
          <Text asChild variant="caption" uppercase className="text-muted-foreground">
            <dt>Ferienquelle</dt>
          </Text>
          <dd className="space-y-2 leading-5">
            <div className="flex flex-wrap items-center gap-2">
              <span>{holidayModeSummary}</span>
              <Badge variant={STATUS_BADGE_VARIANTS[statusMeta.tone]}>{statusMeta.label}</Badge>
            </div>
            {holidaySourceDetails ? (
              holidaySourceDetails.href ? (
                <a
                  href={holidaySourceDetails.href}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="block break-words text-xs text-muted-foreground underline-offset-2 hover:underline sm:text-sm"
                >
                  {holidaySourceDetails.label}
                </a>
              ) : (
                <span className="block break-words text-xs text-muted-foreground sm:text-sm">
                  {holidaySourceDetails.label}
                </span>
              )
            ) : null}
          </dd>
        </div>
        <div className="space-y-2">
          <Text asChild variant="caption" uppercase className="text-muted-foreground">
            <dt>Feiertagsquelle</dt>
          </Text>
          <dd className="space-y-2 leading-5">
            <div className="flex flex-wrap items-center gap-2">
              <span>{publicHolidayModeSummary}</span>
              <Badge variant={STATUS_BADGE_VARIANTS[publicStatusMeta.tone]}>
                {publicStatusMeta.label}
              </Badge>
            </div>
            {publicHolidaySourceDetails ? (
              publicHolidaySourceDetails.href ? (
                <a
                  href={publicHolidaySourceDetails.href}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="block break-words text-xs text-muted-foreground underline-offset-2 hover:underline sm:text-sm"
                >
                  {publicHolidaySourceDetails.label}
                </a>
              ) : (
                <span className="block break-words text-xs text-muted-foreground sm:text-sm">
                  {publicHolidaySourceDetails.label}
                </span>
              )
            ) : null}
          </dd>
        </div>
        <div className="space-y-2">
          <Text asChild variant="caption" uppercase className="text-muted-foreground">
            <dt>Sperrfrist</dt>
          </Text>
          <dd className="leading-5">{freezeDaysSummary}</dd>
        </div>
      </div>
    </dl>
  );

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
          "flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary",
          isActive &&
            (type === "preferred"
              ? "border-primary bg-primary/10 text-primary"
              : "border-amber-500 bg-amber-500/15 text-amber-900 dark:border-amber-500/60 dark:text-amber-100"),
          !isActive && "border-border/60 bg-background hover:border-primary/40 hover:text-primary",
        )}
      >
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/80">
          {shortLabel}
        </span>
        <span className="hidden text-sm sm:inline">{label}</span>
      </button>
    );
  };

  const HolidayStatusIcon = STATUS_ICONS[statusMeta.tone];
  const PublicStatusIcon = STATUS_ICONS[publicStatusMeta.tone];

  return (
    <Card>
      <CardHeader className="space-y-4">
        <div className="space-y-3">
          <CardTitle className="flex items-center gap-2 text-xl">
            <Sparkles className="h-5 w-5 text-primary" aria-hidden />
            Sperrlisten-Einstellungen
          </CardTitle>
          <Text variant="small" tone="muted">
            Verwalte Ferien- und Feiertagsquellen, Probenplanung und Sperrfrist in einem kompakten Ablauf.
          </Text>
        </div>
      </CardHeader>
      <CardContent className="space-y-8">
        <div className="rounded-lg border border-dashed border-border/60 bg-muted/40 p-4 lg:hidden">
          <Text variant="caption" uppercase className="text-muted-foreground">
            Kurzüberblick
          </Text>
          {renderSummaryList("compact", "mt-3")}
        </div>
        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="flex flex-col gap-8 lg:flex-row">
            <div className="flex-1 space-y-6">
              <section className="space-y-4 rounded-lg border border-border/60 bg-card/40 p-4">
                <header className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold leading-5">Ferienquelle</p>
                    <p className="text-sm text-muted-foreground">
                      Wähle, wie Ferien automatisch berücksichtigt werden.
                    </p>
                  </div>
                  <Badge variant={STATUS_BADGE_VARIANTS[statusMeta.tone]}>{statusMeta.label}</Badge>
                </header>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="holiday-mode">Quelle</Label>
                    <Select
                      value={holidayMode}
                      onValueChange={(value) => handleHolidayModeChange(value as HolidaySourceMode)}
                      disabled={saving}
                    >
                      <SelectTrigger id="holiday-mode">
                        <SelectValue placeholder="Modus wählen" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="default">Standardfeed (Schulferien Sachsen)</SelectItem>
                        <SelectItem value="custom">Eigene URL</SelectItem>
                        <SelectItem value="disabled">Keine Ferienquelle</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="holiday-url">Eigene URL</Label>
                    <Input
                      id="holiday-url"
                      type="url"
                      value={holidayUrl}
                      onChange={(event) => handleHolidayUrlInput(event.target.value)}
                      placeholder={defaults.holidaySourceUrl}
                      disabled={holidayMode !== "custom" || saving}
                    />
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleCheckSource("holiday")}
                    disabled={isCheckingHoliday || saving}
                  >
                    {isCheckingHoliday ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                        Quelle prüfen
                      </span>
                    ) : (
                      "Quelle prüfen"
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={handleResetHolidayToDefault}
                    disabled={isCheckingHoliday || saving}
                  >
                    Auf Standard zurücksetzen
                  </Button>
                </div>
                <div
                  className={cn(
                    "flex items-start gap-3 rounded-md border px-3 py-2 text-sm",
                    STATUS_LINE_CLASSES[statusMeta.tone],
                  )}
                >
                  <HolidayStatusIcon
                    className={cn(
                      "mt-0.5 h-4 w-4 shrink-0",
                      statusMeta.tone === "unknown" && isCheckingHoliday ? "animate-spin" : undefined,
                    )}
                    aria-hidden
                  />
                  <div className="space-y-1">
                    <p className="font-medium leading-5">{statusMeta.label}</p>
                    <p className="text-xs leading-5 opacity-80">
                      {status.message ?? statusMeta.description}
                      {formattedCheckedAt ? ` – geprüft am ${formattedCheckedAt}` : ""}
                    </p>
                  </div>
                </div>
              </section>

              <section className="space-y-4 rounded-lg border border-border/60 bg-card/40 p-4">
                <header className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold leading-5">Feiertagsquelle</p>
                    <p className="text-sm text-muted-foreground">
                      Steuere, ob gesetzliche Feiertage automatisch eingefärbt werden.
                    </p>
                  </div>
                  <Badge variant={STATUS_BADGE_VARIANTS[publicStatusMeta.tone]}>
                    {publicStatusMeta.label}
                  </Badge>
                </header>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="public-holiday-mode">Quelle</Label>
                    <Select
                      value={publicHolidayMode}
                      onValueChange={(value) => handlePublicHolidayModeChange(value as HolidaySourceMode)}
                      disabled={saving}
                    >
                      <SelectTrigger id="public-holiday-mode">
                        <SelectValue placeholder="Modus wählen" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="default">Standardfeed (Sachsen, OfficeHolidays)</SelectItem>
                        <SelectItem value="custom">Eigene URL</SelectItem>
                        <SelectItem value="disabled">Keine Feiertagsquelle</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="public-holiday-url">Eigene URL</Label>
                    <Input
                      id="public-holiday-url"
                      type="url"
                      value={publicHolidayUrl}
                      onChange={(event) => handlePublicHolidayUrlInput(event.target.value)}
                      placeholder={defaults.publicHolidaySourceUrl ?? ""}
                      disabled={publicHolidayMode !== "custom" || saving}
                    />
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleCheckSource("publicHoliday")}
                    disabled={isCheckingPublicHoliday || saving}
                  >
                    {isCheckingPublicHoliday ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                        Quelle prüfen
                      </span>
                    ) : (
                      "Quelle prüfen"
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={handleResetPublicToDefault}
                    disabled={isCheckingPublicHoliday || saving}
                  >
                    Auf Standard zurücksetzen
                  </Button>
                </div>
                <div
                  className={cn(
                    "flex items-start gap-3 rounded-md border px-3 py-2 text-sm",
                    STATUS_LINE_CLASSES[publicStatusMeta.tone],
                  )}
                >
                  <PublicStatusIcon
                    className={cn(
                      "mt-0.5 h-4 w-4 shrink-0",
                      publicStatusMeta.tone === "unknown" && isCheckingPublicHoliday
                        ? "animate-spin"
                        : undefined,
                    )}
                    aria-hidden
                  />
                  <div className="space-y-1">
                    <p className="font-medium leading-5">{publicStatusMeta.label}</p>
                    <p className="text-xs leading-5 opacity-80">
                      {publicStatus.message ?? publicStatusMeta.description}
                      {publicFormattedCheckedAt ? ` – geprüft am ${publicFormattedCheckedAt}` : ""}
                    </p>
                  </div>
                </div>
              </section>

              <section className="space-y-4 rounded-lg border border-border/60 bg-card/40 p-4">
                <header className="space-y-1">
                  <p className="text-sm font-semibold leading-5">Probenplanung</p>
                  <p className="text-sm text-muted-foreground">
                    Markiere bevorzugte Probentage und seltene Ausnahmen.
                  </p>
                </header>
                <div className="grid gap-6 md:grid-cols-2">
                  <fieldset className="space-y-3">
                    <legend className="text-sm font-semibold">Bevorzugte Tage</legend>
                    <p className="text-xs text-muted-foreground">
                      Diese Wochentage werden bei Vorschlägen priorisiert.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {WEEKDAY_OPTIONS.map((option) =>
                        renderWeekdayToggle("preferred", option.value, option.label, option.short),
                      )}
                    </div>
                  </fieldset>
                  <fieldset className="space-y-3">
                    <legend className="text-sm font-semibold">Ausnahmen</legend>
                    <p className="text-xs text-muted-foreground">
                      Markiere Tage, an denen nur im Ausnahmefall geplant wird.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {WEEKDAY_OPTIONS.map((option) =>
                        renderWeekdayToggle("exception", option.value, option.label, option.short),
                      )}
                    </div>
                  </fieldset>
                </div>
              </section>

              <section className="space-y-4 rounded-lg border border-border/60 bg-card/40 p-4">
                <header className="space-y-1">
                  <p className="text-sm font-semibold leading-5">Sperrfrist</p>
                  <p className="text-sm text-muted-foreground">
                    Lege fest, wie viele Tage vor einer Probe keine neuen Sperrtage mehr eingetragen werden können.
                  </p>
                </header>
                <div className="space-y-2">
                  <Label htmlFor="freeze-days">Sperrfrist</Label>
                  <Select
                    value={freezeDaysValue}
                    onValueChange={setFreezeDaysValue}
                    disabled={saving}
                  >
                    <SelectTrigger id="freeze-days">
                      <SelectValue placeholder="Sperrfrist wählen" />
                    </SelectTrigger>
                    <SelectContent>
                      {freezeOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Innerhalb der Sperrfrist lassen sich keine neuen Sperrtage eintragen. Bestehende Termine bleiben editierbar.
                  </p>
                </div>
              </section>
            </div>

            <aside className="hidden rounded-lg border border-dashed border-border/60 bg-muted/30 p-4 lg:block lg:w-72 lg:flex-shrink-0">
              <Text variant="caption" uppercase className="text-muted-foreground">
                Kurzüberblick
              </Text>
              {renderSummaryList("sidebar", "mt-3")}
            </aside>
          </div>

          <div className="space-y-3">
            {error ? (
              <div
                role="alert"
                className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
              >
                <p className="font-medium">{error.message}</p>
                {error.details ? (
                  <details className="mt-2 text-xs">
                    <summary className="cursor-pointer text-destructive">Technische Details</summary>
                    <p className="mt-2 whitespace-pre-wrap break-words text-destructive/80">{error.details}</p>
                  </details>
                ) : null}
              </div>
            ) : null}
            {success ? (
              <div
                role="status"
                className="rounded-md border border-emerald-400/40 bg-emerald-500/10 p-3 text-sm text-emerald-900 dark:text-emerald-100"
              >
                {success}
              </div>
            ) : null}
          </div>

          <div className="flex flex-col gap-3 border-t border-border/60 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <Text variant="small" tone="muted">
              Änderungen wirken sich sofort auf Kalender und Sperrlistenfarben aus.
            </Text>
            <div className="flex flex-wrap items-center gap-2">
              {hasUnsavedChanges ? (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleDiscardChanges}
                  disabled={saving || isCheckingAnything}
                >
                  Verwerfen
                </Button>
              ) : null}
              <Button type="submit" disabled={saving}>
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
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
