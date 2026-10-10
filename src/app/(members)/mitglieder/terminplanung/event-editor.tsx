"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { CalendarEventKind } from "@prisma/client";
import { toast } from "sonner";

import { AudienceBuilder, type AudienceValue } from "@/components/calendar/audience-builder";
import {
  EventAgendaEditor,
  type SceneStatsView,
  type SceneUrgencyView,
} from "@/components/calendar/event-agenda-editor";
import { CalendarXIcon, PlusIcon, TrashIcon } from "@/components/ui/action-icons";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { SectionHeader } from "@/components/ui/section-header";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Textarea } from "@/components/ui/textarea";
import {
  agendaFromSchedule,
  computeAgendaTiming,
  scheduleFromAgenda,
  toTime,
  type AgendaItem,
  type StoredSchedule,
} from "@/lib/calendar/agenda";
import { CALENDAR_EVENT_KINDS } from "@/lib/calendar/event-kinds";
import { cn } from "@/lib/utils";
import {
  computeAudienceDrift,
  hasAudienceDrift,
  resolveAudience,
  type AudienceContext,
} from "@/lib/calendar/audience";
import type { DayAvailability } from "@/lib/calendar/day-availability";
import { computeSceneReadiness, type Absence } from "@/lib/calendar/scene-readiness";
import { HEAVY_WEEK_COUNT, type PersonLoad } from "@/lib/calendar/week-load";
import {
  DEFAULT_TIME_ZONE,
  formatIsoDateInTimeZone,
  formatIsoTimeInTimeZone,
  parseDateTimeInTimeZone,
} from "@/lib/date-time";

import { EventEditorHeader, type EventHeaderValue } from "./event-editor-header";
import {
  discardRehearsalDraftAction,
  publishRehearsalAction,
  updateRehearsalDraftAction,
} from "./actions/drafts";
import { planningReturnHref } from "./return-href";
import {
  cancelEventAction,
  deleteRehearsalAction,
  restoreEventAction,
  updateRehearsalAction,
} from "./actions/rehearsals";

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
    /** Grund einer Absage durch die Planung. */
    cancelReason?: string | null;
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
  initialWeekLoad: Record<string, PersonLoad>;
  declined: Record<string, string | null>;
  schedule: StoredSchedule;
  sceneStats: SceneStatsView;
  sceneUrgency: SceneUrgencyView;
};

const KIND_OPTIONS: CalendarEventKind[] = ["REHEARSAL", ...CALENDAR_EVENT_KINDS];
/** Keine Vorauswahl: Wer eingeladen ist, wählt die Planung bewusst aus. */
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Gewerk-Programmpunkte als Einladungsquelle (für Vorschau und Abweichungen). */
function audienceBlocks(
  blocks: readonly { type: string; departmentId: string | null; title: string }[],
) {
  return blocks.flatMap((block) =>
    block.type === "DEPARTMENT" && block.departmentId
      ? [{ departmentId: block.departmentId, title: block.title || null }]
      : [],
  );
}

function sceneRuleIds(rules: readonly { type: string; targetId: string | null }[]) {
  return rules.flatMap((rule) => (rule.type === "SCENE" && rule.targetId ? [rule.targetId] : []));
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
  initialWeekLoad,
  declined,
  schedule: initialSchedule,
  sceneStats,
  sceneUrgency,
}: EventEditorProps) {
  const router = useRouter();
  const isDraft = rehearsal.status === "DRAFT";
  const isTentative = rehearsal.status === "TENTATIVE";
  const isCancelled = rehearsal.status === "CANCELLED";

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
  const [agendaState, setAgendaState] = useState<AgendaItem[]>(() =>
    agendaFromSchedule(initialSchedule, sceneRuleIds(initialAudience.rules), initialContext),
  );
  // Ohne bisherigen Ablauf: jeder kommt erst zu seinem ersten Punkt (Entscheidung 2026-10-10).
  const [mode, setMode] = useState<StoredSchedule["mode"]>(() =>
    agendaState.length ? initialSchedule.mode : "STAGGERED",
  );
  const [showBlocks, setShowBlocks] = useState(
    rehearsal.kind === "REHEARSAL" || agendaState.length > 0,
  );
  const initialTimes = useMemo(
    () => new Map(initialSchedule.blocks.map((block) => [block.id, `${block.start}-${block.end}`])),
    [initialSchedule],
  );
  const initialBlocks = useMemo(() => audienceBlocks(initialSchedule.blocks), [initialSchedule]);
  const [weekLoad, setWeekLoad] = useState<Record<string, PersonLoad>>(initialWeekLoad);
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

  const sceneIds = useMemo(() => sceneRuleIds(audience.rules), [audience.rules]);
  // Szenen kommen aus den Szenen-Regeln; der Ablauf ergänzt Reihenfolge, Dauer und Spur.
  const agenda = useMemo(() => {
    const kept = agendaState.filter((item) => !item.sceneId || sceneIds.includes(item.sceneId));
    const missing = sceneIds.filter((id) => !kept.some((item) => item.sceneId === id));
    if (!missing.length) return kept;
    return [
      ...kept,
      ...agendaFromSchedule(
        { mode, times: {}, rooms: {}, blocks: [], sceneMeta: {}, order: [] },
        missing,
        context,
      ),
    ];
  }, [agendaState, sceneIds, mode, context]);
  const currentBlocks = useMemo(() => audienceBlocks(agenda), [agenda]);
  const timing = useMemo(() => computeAgendaTiming(agenda, time), [agenda, time]);
  const plannedEnd = agenda.length && !allDay ? toTime(timing.end) : null;
  const scheduleToSave = useMemo(
    () => scheduleFromAgenda(agenda, timing, mode, initialTimes),
    [agenda, timing, mode, initialTimes],
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

  const changeAgenda = useCallback(
    (next: AgendaItem[]) => {
      const departments = (list: AgendaItem[]) =>
        audienceBlocks(list)
          .map((block) => block.departmentId)
          .sort()
          .join();
      // Andere Gewerke → andere Eingeladene; wie eine Änderung der Zielgruppe behandeln.
      if (departments(next) !== departments(agenda)) setAudienceTouched(true);
      setAgendaState(next);
      const nextScenes = next.flatMap((item) => (item.sceneId ? [item.sceneId] : []));
      if (nextScenes.join() !== sceneIds.join()) changeScenes(nextScenes);
    },
    [agenda, sceneIds, changeScenes],
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
    setAgendaState(agenda.filter((item) => item.type !== "DEPARTMENT" && item.type !== "SCENE"));
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
          weekLoad?: Record<string, PersonLoad>;
        };
        setAvailability(data.availability ?? {});
        setConflicts(data.conflicts ?? {});
        setWeekLoad(data.weekLoad ?? {});
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
      fetchDayChecks(
        date,
        allDay ? "00:00" : time,
        allDay ? "23:59" : endTime.trim() || plannedEnd || "",
      ).catch(() => null);
    }, 400);
    return () => clearTimeout(handle);
  }, [date, time, endTime, plannedEnd, allDay, fetchDayChecks]);

  /** Gemeinsame Felder für Speichern und Ansetzen. */
  const payload = useMemo(() => {
    // Ohne festes Ende gilt das Ende des Ablaufs.
    const trimmedEndTime = endTime.trim() || plannedEnd || "";
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
    plannedEnd,
  ]);

  // Nur speichern, was sich gegenüber dem zuletzt gespeicherten Stand geändert hat – beim Öffnen
  // (auch bei doppelt laufenden Effekten) gibt es sonst stille Speicherungen samt Benachrichtigung.
  const saveKey = JSON.stringify([payload, audienceTouched && !openAudience ? audience : null]);
  const lastSavedKey = useRef(saveKey);

  useEffect(() => {
    // Abgesagte Termine bleiben, wie sie waren; erst nach der Rücknahme wieder bearbeiten.
    if (saveKey === lastSavedKey.current || isCancelled) return;

    setSaveStatus("saving");
    const handle = setTimeout(() => {
      const updateAction = isDraft ? updateRehearsalDraftAction : updateRehearsalAction;
      updateAction({ ...payload, ...(audienceTouched && !openAudience ? { audience } : {}) })
        .then((result) => {
          if (result?.success) {
            lastSavedKey.current = saveKey;
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
  }, [saveKey, payload, audience, audienceTouched, openAudience, isDraft, isCancelled]);

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

  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [isCancelling, startCancel] = useTransition();

  const handleCancel = () => {
    startCancel(() => {
      void cancelEventAction({ id: rehearsal.id, reason: cancelReason.trim() || undefined })
        .then((result) => {
          if (result?.success) {
            setCancelOpen(false);
            toast.success(`${noun} abgesagt. Die Betroffenen wurden benachrichtigt.`);
            router.refresh();
          } else {
            toast.error(result?.error ?? "Das hat nicht geklappt.");
          }
        })
        .catch(() => toast.error("Das hat nicht geklappt."));
    });
  };

  const handleRestore = () => {
    startCancel(() => {
      void restoreEventAction({ id: rehearsal.id })
        .then((result) => {
          if (result?.success) {
            toast.success("Absage zurückgenommen. Die Betroffenen wurden benachrichtigt.");
            router.refresh();
          } else {
            toast.error(result?.error ?? "Das hat nicht geklappt.");
          }
        })
        .catch(() => toast.error("Das hat nicht geklappt."));
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

  const statusLabel = isDraft
    ? "Entwurf"
    : isTentative
      ? "Vorgemerkt"
      : isCancelled
        ? "Abgesagt"
        : "Angesetzt";
  const kindLocked = sceneIds.length > 0;

  const headerValue: EventHeaderValue = {
    title,
    kind: effectiveKind,
    date,
    allDay,
    multiDay,
    endDate,
    time,
    endTime,
    location,
    scope,
  };
  const changeHeader = (patch: Partial<EventHeaderValue>) => {
    if (patch.title !== undefined) setTitle(patch.title);
    if (patch.kind !== undefined) changeKind(patch.kind);
    if (patch.date !== undefined) setDate(patch.date);
    if (patch.allDay !== undefined) setAllDay(patch.allDay);
    if (patch.multiDay !== undefined) setMultiDay(patch.multiDay);
    if (patch.endDate !== undefined) setEndDate(patch.endDate);
    if (patch.time !== undefined) setTime(patch.time);
    if (patch.endTime !== undefined) setEndTime(patch.endTime);
    if (patch.location !== undefined) setLocation(patch.location);
  };

  // Statuszeile: wer eingeladen ist, wer fehlt, wer diese Woche schon oft da ist.
  const missingCount = openAudience
    ? 0
    : [...invitedIds].filter(
        (userId) => availability[userId] === "blocked" || conflicts[userId] || userId in declined,
      ).length;
  const heavyCount = openAudience
    ? 0
    : [...invitedIds].filter((userId) => (weekLoad[userId]?.count ?? 0) + 1 >= HEAVY_WEEK_COUNT)
        .length;
  const statusParts = openAudience
    ? [scope === "production" ? "für alle der Produktion" : "für alle"]
    : [
        `${invitedCount} eingeladen`,
        ...(missingCount ? [`${missingCount} können nicht`] : []),
        ...(heavyCount ? [`${heavyCount} diese Woche schon ≥ ${HEAVY_WEEK_COUNT - 1}×`] : []),
      ];

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
                      : isCancelled
                        ? "bg-destructive/15 text-destructive"
                        : "bg-success/15 text-success",
                )}
              >
                {statusLabel}
              </span>
              {!isCancelled ? (
                <span className="text-muted-foreground" aria-live="polite">
                  {saveLabel}
                </span>
              ) : null}
            </div>
            {isCancelled ? (
              <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
                <p className="font-medium text-destructive">
                  {noun} ist abgesagt und bleibt für alle durchgestrichen sichtbar.
                </p>
                {rehearsal.cancelReason ? (
                  <p className="mt-1 text-foreground/80">Grund: {rehearsal.cancelReason}</p>
                ) : null}
                <p className="mt-1 text-xs text-muted-foreground">
                  Änderungen werden nicht gespeichert. Zum Bearbeiten erst die Absage zurücknehmen.
                </p>
              </div>
            ) : null}

            <EventEditorHeader
              value={headerValue}
              onChange={changeHeader}
              kindOptions={KIND_OPTIONS}
              kindLocked={kindLocked}
              production={production}
              onScopeChange={changeScope}
              isRehearsal={isRehearsal}
              plannedEnd={plannedEnd}
              showDescription={showDescription}
              onShowDescription={() => setShowDescription(true)}
              status={
                <a href="#wer-ist-dabei" className="hover:text-foreground hover:underline">
                  {statusParts.join(" · ")}
                  {isCheckingBlocks ? " · prüft Sperrliste …" : ""}
                </a>
              }
            />

            {showDescription ? (
              <RichTextEditor
                value={description}
                onChange={setDescription}
                placeholder="Beschreibung: Ablauf, Ziele oder Materialien"
              />
            ) : null}
          </Card>

          <Card variant="plain" size="flush" className="space-y-3 border-border p-4">
            <SectionHeader
              title="Ablauf"
              size="sm"
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
                items={agenda}
                onItemsChange={changeAgenda}
                startTime={TIME_PATTERN.test(time) ? time : "18:00"}
                endTime={allDay ? "" : endTime.trim()}
                onSetEnd={setEndTime}
                mode={mode}
                onModeChange={setMode}
                stats={sceneStats}
                urgency={sceneUrgency}
                readiness={sceneReadiness}
                invitedIds={invitedIds}
                weekLoad={weekLoad}
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
          id="wer-ist-dabei"
          variant="plain"
          size="flush"
          className="min-w-0 scroll-mt-20 space-y-3 border-border p-4 lg:sticky lg:top-4"
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
              weekLoad={weekLoad}
              dayKey={date}
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
        {!isDraft && !isCancelled ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={isCancelling}
            aria-label="Absagen"
            onClick={() => setCancelOpen(true)}
          >
            <CalendarXIcon className="h-4 w-4" />
            <span className="hidden sm:inline">Absagen</span>
          </Button>
        ) : null}
        <div className="ml-auto flex flex-1 items-center justify-end gap-2 sm:flex-none">
          {isCancelled ? (
            <Button
              type="button"
              className="flex-1 sm:flex-none"
              onClick={handleRestore}
              disabled={isCancelling}
            >
              {isCancelling ? "Speichert …" : "Absage zurücknehmen"}
            </Button>
          ) : isDraft ? (
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
            : `${noun} wird endgültig gelöscht – mit allen Antworten und ohne Benachrichtigung. Fällt ${isRehearsal ? "sie" : "er"} aus, lieber „Absagen“ nutzen.`
        }
        confirmLabel={confirm === "discard" ? "Verwerfen" : "Löschen"}
        cancelLabel="Abbrechen"
        variant="destructive"
      />

      <Dialog open={cancelOpen} onOpenChange={(value) => !isCancelling && setCancelOpen(value)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{noun} absagen?</DialogTitle>
            <DialogDescription>
              Alle Eingeladenen und alle, die schon geantwortet haben, werden benachrichtigt. {noun}{" "}
              bleibt durchgestrichen im Kalender; die Absage lässt sich zurücknehmen.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="cancel-reason">Grund (optional)</Label>
            <Textarea
              id="cancel-reason"
              value={cancelReason}
              maxLength={500}
              placeholder="z. B. Regie krank, Bühne nicht verfügbar"
              onChange={(event) => setCancelReason(event.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setCancelOpen(false)}
              disabled={isCancelling}
            >
              Zurück
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleCancel}
              disabled={isCancelling}
            >
              {isCancelling ? "Sagt ab …" : `${noun} absagen`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
