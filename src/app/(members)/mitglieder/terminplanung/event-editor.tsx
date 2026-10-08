"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { CalendarEventKind } from "@prisma/client";
import { toast } from "sonner";

import { AudienceBuilder, type AudienceValue } from "@/components/calendar/audience-builder";
import {
  EventAgendaEditor,
  type EventBlockValue,
  type SceneScheduleValue,
  type SceneStatsView,
} from "@/components/calendar/event-agenda-editor";
import { MapPinIcon, PlusIcon, TrashIcon } from "@/components/ui/action-icons";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DateInput } from "@/components/ui/date-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { SectionHeader } from "@/components/ui/section-header";
import { SegmentedControl } from "@/components/ui/segmented-control";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { TimeInput } from "@/components/ui/time-input";
import { CALENDAR_EVENT_KINDS, CALENDAR_EVENT_KIND_LABELS } from "@/lib/calendar/event-kinds";
import { cn } from "@/lib/utils";
import {
  computeAudienceDrift,
  hasAudienceDrift,
  resolveAudience,
  type AudienceContext,
} from "@/lib/calendar/audience";
import type { DayAvailability } from "@/lib/calendar/day-availability";
import { computeSceneReadiness, type Absence } from "@/lib/calendar/scene-readiness";
import {
  DEFAULT_TIME_ZONE,
  formatIsoDateInTimeZone,
  formatIsoTimeInTimeZone,
  parseDateTimeInTimeZone,
} from "@/lib/date-time";

import {
  discardRehearsalDraftAction,
  publishRehearsalAction,
  updateRehearsalDraftAction,
} from "./actions/drafts";
import { planningReturnHref } from "./return-href";
import { deleteRehearsalAction, updateRehearsalAction } from "./actions/rehearsals";

type EventEditorProps = {
  rehearsal: {
    id: string;
    status: string;
    kind: CalendarEventKind;
    allDay: boolean;
    showId: string | null;
    title: string;
    start: string;
    end: string | null;
    location: string;
    description: string | null;
  };
  /** Produktion für „gilt für“ (die des Termins bzw. die gewählte). */
  production: { id: string; title: string } | null;
  context: AudienceContext;
  /** Zielgruppe nach einem Wechsel „gilt für“ (alle Mitglieder bzw. die Produktion). */
  otherContext: AudienceContext | null;
  audience: AudienceValue;
  /** Aktuell Eingeladene (für den Hinweis auf geänderte Besetzung). */
  invited: { userId: string; name: string; level: "REQUIRED" | "OPTIONAL" }[];
  initialAvailability: DayAvailability;
  declined: Record<string, string | null>;
  schedule: SceneScheduleValue & { blocks: EventBlockValue[] };
  sceneStats: SceneStatsView;
};

const KIND_OPTIONS: CalendarEventKind[] = ["REHEARSAL", ...CALENDAR_EVENT_KINDS];
/** Keine Vorauswahl: Wer eingeladen ist, wählt die Planung bewusst aus. */
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Gewerk-Bausteine als Einladungsquelle (für Vorschau und Abweichungen). */
function audienceBlocks(blocks: readonly EventBlockValue[]) {
  return blocks.flatMap((block) =>
    block.type === "DEPARTMENT" && block.departmentId
      ? [{ departmentId: block.departmentId, title: block.title || null }]
      : [],
  );
}

type SaveStatus = "idle" | "saving" | "saved" | "error";

export function EventEditor({
  rehearsal,
  production,
  context: initialContext,
  otherContext,
  audience: initialAudience,
  invited,
  initialAvailability,
  declined,
  schedule: initialSchedule,
  sceneStats,
}: EventEditorProps) {
  const router = useRouter();
  const isDraft = rehearsal.status === "DRAFT";
  const isTentative = rehearsal.status === "TENTATIVE";

  const [title, setTitle] = useState(rehearsal.title);
  const [kind, setKind] = useState<CalendarEventKind>(rehearsal.kind);
  const [date, setDate] = useState(() => formatIsoDateInTimeZone(rehearsal.start));
  const [allDay, setAllDay] = useState(rehearsal.allDay);
  const [endDate, setEndDate] = useState(() => {
    const last = rehearsal.end ? formatIsoDateInTimeZone(rehearsal.end) : "";
    return last > formatIsoDateInTimeZone(rehearsal.start) ? last : "";
  });
  const [multiDay, setMultiDay] = useState(Boolean(endDate));
  const [time, setTime] = useState(() =>
    rehearsal.allDay ? "18:00" : formatIsoTimeInTimeZone(rehearsal.start),
  );
  const [endTime, setEndTime] = useState(() =>
    rehearsal.end && !rehearsal.allDay ? formatIsoTimeInTimeZone(rehearsal.end) : "",
  );
  const [location, setLocation] = useState(
    rehearsal.location === "Noch offen" ? "" : rehearsal.location,
  );
  const [description, setDescription] = useState(rehearsal.description ?? "");
  const [showDescription, setShowDescription] = useState(Boolean(rehearsal.description));
  /** Wechsel „gilt für“ – nur gesendet, wenn geändert. */
  const [scope, setScope] = useState<"production" | "all">(rehearsal.showId ? "production" : "all");
  const scopeChanged = scope !== (rehearsal.showId ? "production" : "all");
  const context = scopeChanged && otherContext ? otherContext : initialContext;
  const [audience, setAudience] = useState<AudienceValue>(initialAudience);
  /**
   * Termin für alle (der Produktion bzw. alle Mitglieder), ohne Einladung – bei jeder Art.
   * Neue Proben beginnen mit „Bestimmte Personen“, weil sie meist gezielt einladen.
   */
  const [open, setOpen] = useState(
    !initialAudience.rules.length &&
      !initialAudience.overrides.length &&
      !(isDraft && rehearsal.kind === "REHEARSAL"),
  );
  // Veröffentlichte Termine: Zielgruppe nur senden, wenn die Planung sie geändert oder
  // Abweichungen übernommen hat – sonst keine stillen Einladungen.
  const [audienceTouched, setAudienceTouched] = useState(isDraft);
  const [availability, setAvailability] = useState<DayAvailability>(initialAvailability);
  const [schedule, setSchedule] = useState<SceneScheduleValue>(initialSchedule);
  const [blocks, setBlocks] = useState<EventBlockValue[]>(initialSchedule.blocks);
  const [showBlocks, setShowBlocks] = useState(
    rehearsal.kind === "REHEARSAL" || initialSchedule.blocks.length > 0,
  );
  const initialBlocks = useMemo(() => audienceBlocks(initialSchedule.blocks), [initialSchedule]);
  const currentBlocks = useMemo(() => audienceBlocks(blocks), [blocks]);
  // Nur vollständige Uhrzeiten speichern; halb ausgefüllte Felder blockieren sonst das Speichern.
  const scheduleToSave = useMemo(
    () => ({
      mode: schedule.mode,
      times: Object.fromEntries(
        Object.entries(schedule.times).filter(([, time]) =>
          [time.start, time.end].every((value) => TIME_PATTERN.test(value)),
        ),
      ),
      rooms: Object.fromEntries(
        Object.entries(schedule.rooms)
          .map(([sceneId, room]) => [sceneId, room.trim()] as const)
          .filter(([, room]) => room),
      ),
      blocks: blocks.map((block) => {
        const timed = TIME_PATTERN.test(block.start) && TIME_PATTERN.test(block.end);
        return {
          ...block,
          start: timed ? block.start : "",
          end: timed ? block.end : "",
        };
      }),
    }),
    [schedule, blocks],
  );
  const [conflicts, setConflicts] = useState<Partial<Record<string, string>>>({});
  const [isCheckingBlocks, setIsCheckingBlocks] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [isPublishing, startPublish] = useTransition();
  const [isDiscarding, startDiscard] = useTransition();

  // Wer an dem Tag fehlt: Sperrliste, Absage, anderer Termin – Grundlage für „probbar“.
  const sceneReadiness = useMemo(() => {
    const absences: Partial<Record<string, Absence>> = {};
    for (const [userId, kind] of Object.entries(availability)) {
      if (kind) absences[userId] = { kind };
    }
    for (const [userId, title] of Object.entries(conflicts)) {
      if (title && absences[userId]?.kind !== "blocked")
        absences[userId] = { kind: "parallel", reason: title };
    }
    for (const [userId, reason] of Object.entries(declined)) {
      absences[userId] = { kind: "declined", reason };
    }
    return computeSceneReadiness(context, absences);
  }, [availability, conflicts, declined, context]);

  const sceneIds = useMemo(
    () =>
      audience.rules.flatMap((rule) =>
        rule.type === "SCENE" && rule.targetId ? [rule.targetId] : [],
      ),
    [audience.rules],
  );
  // Mit Szenen ist es immer eine Probe.
  const effectiveKind: CalendarEventKind = sceneIds.length ? "REHEARSAL" : kind;
  const isRehearsal = effectiveKind === "REHEARSAL";
  // Szenen laden ihre Besetzung ein – dann gibt es kein „Alle“.
  const openAudience = open && !sceneIds.length;
  const noun = isRehearsal ? "Probe" : "Termin";

  const invitedIds = useMemo(
    () =>
      new Set(
        openAudience
          ? []
          : resolveAudience(audience.rules, audience.overrides, context, currentBlocks)
              .filter((entry) => !entry.excluded)
              .map((entry) => entry.userId),
      ),
    [audience, context, currentBlocks, openAudience],
  );
  const invitedCount = invitedIds.size;
  const canPublish = openAudience || invitedCount > 0;
  const drift = useMemo(
    () =>
      isDraft || audienceTouched || openAudience
        ? null
        : computeAudienceDrift(
            invited,
            resolveAudience(
              initialAudience.rules,
              initialAudience.overrides,
              context,
              initialBlocks,
            ),
          ),
    [isDraft, audienceTouched, openAudience, invited, initialAudience, context, initialBlocks],
  );

  const changeAudience = useCallback((next: AudienceValue) => {
    setAudience(next);
    setAudienceTouched(true);
  }, []);

  const changeBlocks = useCallback(
    (next: EventBlockValue[]) => {
      const departments = (list: EventBlockValue[]) =>
        audienceBlocks(list)
          .map((block) => block.departmentId)
          .sort()
          .join();
      // Andere Gewerke → andere Eingeladene; wie eine Änderung der Zielgruppe behandeln.
      if (departments(next) !== departments(blocks)) setAudienceTouched(true);
      setBlocks(next);
    },
    [blocks],
  );

  const changeScenes = useCallback(
    (nextSceneIds: string[]) => {
      const levels = new Map(
        audience.rules
          .filter((rule) => rule.type === "SCENE")
          .map((rule) => [rule.targetId, rule.level]),
      );
      if (nextSceneIds.length) setOpen(false);
      changeAudience({
        ...audience,
        rules: [
          ...audience.rules.filter((rule) => rule.type !== "SCENE"),
          ...nextSceneIds.map((targetId) => ({
            type: "SCENE" as const,
            targetId,
            level: levels.get(targetId) ?? ("REQUIRED" as const),
          })),
        ],
      });
    },
    [audience, changeAudience],
  );

  const changeKind = (next: CalendarEventKind) => {
    setKind(next);
    if (next === "REHEARSAL") setShowBlocks(true);
  };

  const changeScope = (next: "production" | "all") => {
    setScope(next);
    // Gewerke, Rollen und Szenen gehören zur Produktion und fallen weg; einzeln ausgewählte
    // Personen bleiben.
    changeAudience({
      rules: audience.rules.filter((rule) => rule.type === "USER"),
      overrides: audience.overrides.filter((entry) => entry.override === "INCLUDED"),
    });
    changeBlocks(blocks.filter((block) => block.type !== "DEPARTMENT"));
  };

  const fetchDayChecks = useCallback(
    async (dateValue: string, timeValue: string, endValue: string) => {
      setIsCheckingBlocks(true);
      try {
        const params = new URLSearchParams({ date: dateValue, eventId: rehearsal.id });
        try {
          const start = parseDateTimeInTimeZone(dateValue, timeValue, DEFAULT_TIME_ZONE);
          let end = endValue
            ? parseDateTimeInTimeZone(dateValue, endValue, DEFAULT_TIME_ZONE)
            : new Date(start.getTime() + 2 * 60 * 60 * 1000);
          if (end < start) end = new Date(end.getTime() + 24 * 60 * 60 * 1000);
          params.set("start", start.toISOString());
          params.set("end", end.toISOString());
        } catch {
          // Unvollständige Uhrzeit: nur die Sperrliste prüfen.
        }
        const response = await fetch(`/api/rehearsals/blocked?${params}`);
        if (!response.ok) {
          throw new Error("Request failed");
        }
        const data = (await response.json()) as {
          availability?: DayAvailability;
          conflicts?: Partial<Record<string, string>>;
        };
        setAvailability(data.availability ?? {});
        setConflicts(data.conflicts ?? {});
      } catch (error) {
        console.error("Failed to load blocked members", error);
        toast.error("Sperrtermine konnten nicht geladen werden.");
      } finally {
        setIsCheckingBlocks(false);
      }
    },
    [rehearsal.id],
  );

  useEffect(() => {
    const handle = setTimeout(() => {
      fetchDayChecks(date, allDay ? "00:00" : time, allDay ? "23:59" : endTime.trim()).catch(
        () => null,
      );
    }, 400);
    return () => clearTimeout(handle);
  }, [date, time, endTime, allDay, fetchDayChecks]);

  /** Gemeinsame Felder für Speichern und Ansetzen. */
  const payload = useMemo(() => {
    const trimmedEndTime = endTime.trim();
    return {
      id: rehearsal.id,
      kind: effectiveKind,
      title,
      date,
      time: TIME_PATTERN.test(time) ? time : "18:00",
      ...(trimmedEndTime && !allDay ? { endTime: trimmedEndTime } : {}),
      endDate: multiDay && endDate > date ? endDate : null,
      allDay,
      ...(scopeChanged ? { scope } : {}),
      ...(openAudience ? { openAudience: true } : {}),
      location,
      description,
      schedule: scheduleToSave,
    };
  }, [
    endTime,
    rehearsal.id,
    effectiveKind,
    title,
    date,
    time,
    allDay,
    multiDay,
    endDate,
    scopeChanged,
    scope,
    openAudience,
    location,
    description,
    scheduleToSave,
  ]);

  const skipInitialSave = useRef(true);

  useEffect(() => {
    if (skipInitialSave.current) {
      skipInitialSave.current = false;
      return;
    }

    setSaveStatus("saving");
    const handle = setTimeout(() => {
      const updateAction = isDraft ? updateRehearsalDraftAction : updateRehearsalAction;
      updateAction({ ...payload, ...(audienceTouched && !openAudience ? { audience } : {}) })
        .then((result) => {
          if (result?.success) {
            setSaveStatus("saved");
            setLastSavedAt(new Date());
          } else {
            setSaveStatus("error");
            toast.error(result?.error ?? "Änderungen konnten nicht gespeichert werden.");
          }
        })
        .catch(() => {
          setSaveStatus("error");
          toast.error("Änderungen konnten nicht gespeichert werden.");
        });
    }, 800);

    return () => clearTimeout(handle);
  }, [payload, audience, audienceTouched, openAudience, isDraft]);

  const handlePublish = (target: "TENTATIVE" | "SCHEDULED") => {
    startPublish(() => {
      publishRehearsalAction({
        ...payload,
        // Vorgemerkte Termine: Zielgruppe nur mitschicken, wenn sie geändert wurde.
        ...((isDraft || audienceTouched) && !openAudience ? { audience } : {}),
        target,
      })
        .then((result) => {
          if (result?.success && result.id) {
            toast.success(
              target === "TENTATIVE"
                ? `${noun} vorgemerkt. Die Eingeladenen sehen ${isRehearsal ? "sie" : "ihn"} und können absagen.`
                : openAudience
                  ? `${noun} angesetzt.`
                  : `${noun} angesetzt. Einladungen wurden versendet.`,
            );
            router.push(`/mitglieder/termine/${result.id}`);
          } else {
            toast.error(result?.error ?? `${noun} konnte nicht veröffentlicht werden.`);
          }
        })
        .catch(() => {
          toast.error(`${noun} konnte nicht veröffentlicht werden.`);
        });
    });
  };

  const [confirm, setConfirm] = useState<"discard" | "delete" | null>(null);

  const confirmRemove = () => {
    const mode = confirm;
    setConfirm(null);
    startDiscard(() => {
      const action =
        mode === "discard"
          ? discardRehearsalDraftAction({ id: rehearsal.id })
          : deleteRehearsalAction({ id: rehearsal.id });
      action
        .then((result) => {
          if (result?.success) {
            toast.success(mode === "discard" ? "Entwurf verworfen." : `${noun} gelöscht.`);
            router.push(planningReturnHref());
          } else {
            toast.error(result?.error ?? "Das hat nicht geklappt.");
          }
        })
        .catch(() => {
          toast.error("Das hat nicht geklappt.");
        });
    });
  };

  const saveLabel = useMemo(() => {
    switch (saveStatus) {
      case "saving":
        return "Speichert …";
      case "saved":
        return lastSavedAt
          ? `Gespeichert ${lastSavedAt.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}`
          : "Gespeichert";
      case "error":
        return "Speichern fehlgeschlagen";
      default:
        return "Speichert automatisch";
    }
  }, [saveStatus, lastSavedAt]);

  const statusLabel = isDraft ? "Entwurf" : isTentative ? "Vorgemerkt" : "Angesetzt";
  const kindLocked = sceneIds.length > 0;

  const kindOptions = KIND_OPTIONS.map((value) => ({
    value,
    label: CALENDAR_EVENT_KIND_LABELS[value],
  }));

  return (
    <div className="space-y-4 pb-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_26rem] lg:items-start">
        <div className="min-w-0 space-y-4">
          <Card variant="plain" size="flush" className="space-y-3 border-border p-4">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 font-medium",
                  isDraft
                    ? "bg-muted text-foreground/80"
                    : isTentative
                      ? "bg-warning/20 text-warning"
                      : "bg-success/15 text-success",
                )}
              >
                {statusLabel}
              </span>
              <span className="text-muted-foreground" aria-live="polite">
                {saveLabel}
              </span>
            </div>

            <Input
              id="event-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              minLength={3}
              maxLength={120}
              required
              placeholder={`Titel ${isRehearsal ? "der Probe" : "des Termins"}`}
              aria-label="Titel"
              className="h-12 text-base font-semibold sm:text-lg"
            />

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)]">
              <div className="col-span-2 space-y-1 sm:col-span-1">
                <Label htmlFor="event-kind" className="text-xs text-muted-foreground">
                  Art
                </Label>
                <Select
                  value={effectiveKind}
                  disabled={kindLocked}
                  onValueChange={(value) => {
                    const next = KIND_OPTIONS.find((entry) => entry === value);
                    if (next) changeKind(next);
                  }}
                >
                  <SelectTrigger
                    id="event-kind"
                    className="h-10"
                    title={kindLocked ? "Mit Szenen ist es immer eine Probe." : undefined}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {kindOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2 space-y-1 sm:col-span-1">
                <Label htmlFor="event-date" className="text-xs text-muted-foreground">
                  {multiDay ? "Von" : "Datum"}
                </Label>
                <DateInput
                  id="event-date"
                  value={date}
                  onChange={(event) => {
                    const value = event.target.value;
                    setDate(value);
                    if (endDate && endDate < value) setEndDate(value);
                  }}
                  required
                />
              </div>
              {!allDay ? (
                <>
                  <div className="space-y-1">
                    <Label htmlFor="event-time" className="text-xs text-muted-foreground">
                      Beginn
                    </Label>
                    <TimeInput
                      id="event-time"
                      value={time}
                      onChange={(event) => setTime(event.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="event-end" className="text-xs text-muted-foreground">
                      Ende
                    </Label>
                    <TimeInput
                      id="event-end"
                      value={endTime}
                      onChange={(event) => setEndTime(event.target.value)}
                    />
                  </div>
                </>
              ) : null}
              {multiDay ? (
                <div className="col-span-2 space-y-1 sm:col-span-1">
                  <Label htmlFor="event-end-date" className="text-xs text-muted-foreground">
                    Bis
                  </Label>
                  <DateInput
                    id="event-end-date"
                    value={endDate}
                    min={date}
                    onChange={(event) => setEndDate(event.target.value)}
                  />
                </div>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
              <label className="flex min-h-10 items-center gap-2">
                <Switch checked={allDay} onCheckedChange={setAllDay} />
                Ganztägig
              </label>
              <label className="flex min-h-10 items-center gap-2">
                <Switch
                  checked={multiDay}
                  onCheckedChange={(value) => {
                    setMultiDay(value);
                    if (value && !endDate) setEndDate(date);
                  }}
                />
                Mehrtägig
              </label>
            </div>

            <div className="relative">
              <MapPinIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="event-location"
                value={location}
                onChange={(event) => setLocation(event.target.value)}
                placeholder={isRehearsal ? "Ort – leer lassen, wenn noch offen" : "Ort (optional)"}
                aria-label="Ort"
                className="h-10 pl-9"
              />
            </div>

            {showDescription ? (
              <RichTextEditor
                value={description}
                onChange={setDescription}
                placeholder="Beschreibung: Ablauf, Ziele oder Materialien"
              />
            ) : (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="-ml-2"
                onClick={() => setShowDescription(true)}
              >
                <PlusIcon className="h-4 w-4" aria-hidden />
                Beschreibung
              </Button>
            )}

            {production ? (
              <div className="flex flex-col gap-1.5 border-t border-border pt-3 sm:flex-row sm:items-center sm:gap-3">
                <span className="shrink-0 text-xs text-muted-foreground">Gehört zu</span>
                <SegmentedControl
                  aria-label="Gehört zu"
                  fullWidth
                  size="md"
                  value={scope}
                  onValueChange={changeScope}
                  options={[
                    { value: "production", label: production.title },
                    { value: "all", label: "Keiner Produktion" },
                  ]}
                />
              </div>
            ) : null}
          </Card>

          <Card variant="plain" size="flush" className="space-y-3 border-border p-4">
            <SectionHeader
              title="Ablauf"
              size="sm"
              description={
                showBlocks
                  ? "Szenen, Gewerk-Arbeit und sonstige Punkte – auch parallel in eigenen Räumen."
                  : undefined
              }
              action={
                showBlocks ? null : (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setShowBlocks(true)}
                  >
                    <PlusIcon className="h-4 w-4" aria-hidden />
                    Ablauf planen
                  </Button>
                )
              }
            />
            {showBlocks ? (
              <EventAgendaEditor
                context={context}
                sceneIds={sceneIds}
                onScenesChange={changeScenes}
                schedule={schedule}
                onScheduleChange={setSchedule}
                stats={sceneStats}
                blocks={blocks}
                onBlocksChange={changeBlocks}
                eventStartTime={time}
                invitedIds={invitedIds}
                readiness={sceneReadiness}
                dateKey={date}
              />
            ) : null}
            {showBlocks && scope === "all" ? (
              <p className="text-xs text-muted-foreground">
                Szenen und Gewerke gibt es nur bei Terminen einer Produktion.
                {production ? (
                  <>
                    {" "}
                    <button
                      type="button"
                      className="font-medium text-foreground underline"
                      onClick={() => changeScope("production")}
                    >
                      Zu {production.title} zuordnen
                    </button>
                  </>
                ) : null}
              </p>
            ) : null}
          </Card>
        </div>

        <Card
          variant="plain"
          size="flush"
          className="min-w-0 space-y-3 border-border p-4 lg:sticky lg:top-4"
        >
          <SectionHeader
            title="Wer ist dabei?"
            size="sm"
            description={
              openAudience
                ? scope === "production"
                  ? "Der Termin erscheint bei allen der Produktion – ohne Einladung."
                  : "Der Termin erscheint bei allen – ohne Einladung."
                : isCheckingBlocks
                  ? "Sperrliste wird geprüft …"
                  : undefined
            }
          />
          {!sceneIds.length ? (
            <SegmentedControl
              aria-label="Wer ist eingeladen?"
              fullWidth
              size="md"
              value={openAudience ? "all" : "targeted"}
              onValueChange={(value) => {
                setOpen(value === "all");
                setAudienceTouched(true);
              }}
              options={[
                { value: "all", label: scope === "production" ? "Alle der Produktion" : "Alle" },
                { value: "targeted", label: "Bestimmte Personen" },
              ]}
            />
          ) : null}
          {drift && hasAudienceDrift(drift) ? (
            <div className="space-y-3 rounded-lg border border-warning bg-warning/10 p-3 text-sm">
              <p className="font-medium">Die Besetzung hat sich seit dem Ansetzen geändert.</p>
              <ul className="space-y-1 text-muted-foreground">
                {drift.added.length ? (
                  <li>Neu dabei: {drift.added.map((entry) => entry.name).join(", ")}</li>
                ) : null}
                {drift.removed.length ? (
                  <li>Nicht mehr dabei: {drift.removed.map((entry) => entry.name).join(", ")}</li>
                ) : null}
                {drift.levelChanged.length ? (
                  <li>
                    Verbindlichkeit geändert:{" "}
                    {drift.levelChanged.map((entry) => entry.name).join(", ")}
                  </li>
                ) : null}
              </ul>
              <Button type="button" size="sm" onClick={() => setAudienceTouched(true)}>
                Änderungen übernehmen
              </Button>
            </div>
          ) : null}
          {!openAudience ? (
            <AudienceBuilder
              context={context}
              value={audience}
              onChange={changeAudience}
              availability={availability}
              conflicts={conflicts}
              declined={declined}
              blocks={currentBlocks}
              hideSceneRules={showBlocks && context.scenes.length > 0}
            />
          ) : null}
        </Card>
      </div>

      {/* Aktionsleiste: bleibt beim Scrollen unten sichtbar. */}
      <div
        role="region"
        aria-label="Aktionen"
        className="sticky bottom-3 z-30 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card/95 p-2.5 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-card/80"
      >
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-destructive hover:text-destructive"
          disabled={isDiscarding}
          aria-label={isDraft ? "Verwerfen" : "Löschen"}
          onClick={() => setConfirm(isDraft ? "discard" : "delete")}
        >
          <TrashIcon className="h-4 w-4" aria-hidden />
          <span className="hidden sm:inline">{isDraft ? "Verwerfen" : "Löschen"}</span>
        </Button>
        <div className="ml-auto flex flex-1 items-center justify-end gap-2 sm:flex-none">
          {isDraft ? (
            <>
              <Button
                type="button"
                variant="outline"
                className="flex-1 sm:flex-none"
                onClick={() => handlePublish("TENTATIVE")}
                disabled={isPublishing || !canPublish}
                title="Eingeladene sehen den Termin schon und können absagen"
              >
                Vormerken
              </Button>
              <Button
                type="button"
                className="flex-1 sm:flex-none"
                onClick={() => handlePublish("SCHEDULED")}
                disabled={isPublishing || !canPublish}
              >
                {isPublishing ? "Speichert …" : "Ansetzen"}
              </Button>
            </>
          ) : isTentative ? (
            <Button
              type="button"
              className="flex-1 sm:flex-none"
              onClick={() => handlePublish("SCHEDULED")}
              disabled={isPublishing || !canPublish}
            >
              {isPublishing ? "Speichert …" : "Verbindlich ansetzen"}
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              className="flex-1 sm:flex-none"
              onClick={() => router.push(planningReturnHref())}
            >
              Fertig
            </Button>
          )}
        </div>
        {isDraft && !canPublish ? (
          <p className="w-full px-1 text-xs text-muted-foreground">
            Zum Ansetzen mindestens eine Person einladen.
          </p>
        ) : null}
      </div>

      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(value) => {
          if (!value) setConfirm(null);
        }}
        onCancel={() => setConfirm(null)}
        onConfirm={confirmRemove}
        title={confirm === "discard" ? "Entwurf verwerfen?" : `${noun} löschen?`}
        description={
          confirm === "discard"
            ? "Der Entwurf wird endgültig gelöscht."
            : `${noun} verschwindet für alle aus dem Kalender. Eingeladene werden informiert.`
        }
        confirmLabel={confirm === "discard" ? "Verwerfen" : "Löschen"}
        cancelLabel="Abbrechen"
        variant="destructive"
      />
    </div>
  );
}
