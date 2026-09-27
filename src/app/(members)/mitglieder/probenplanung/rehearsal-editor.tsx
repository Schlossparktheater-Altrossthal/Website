"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { AudienceBuilder, type AudienceValue } from "@/components/calendar/audience-builder";
import {
  SceneScheduleEditor,
  type SceneScheduleValue,
  type SceneStatsView,
} from "@/components/calendar/scene-schedule-editor";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DateInput } from "@/components/ui/date-input";
import { Input } from "@/components/ui/input";
import { TimeInput } from "@/components/ui/time-input";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import {
  computeAudienceDrift,
  hasAudienceDrift,
  resolveAudience,
  type AudienceContext,
} from "@/lib/calendar/audience";
import type { DayAvailability } from "@/lib/calendar/day-availability";
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
import { updateRehearsalAction } from "./actions/rehearsals";

type RehearsalEditorProps = {
  rehearsal: {
    id: string;
    status: string;
    title: string;
    start: string;
    end: string | null;
    location: string;
    description: string | null;
  };
  context: AudienceContext;
  audience: AudienceValue;
  /** Aktuell Eingeladene (für den Hinweis auf geänderte Besetzung). */
  invited: { userId: string; name: string; level: "REQUIRED" | "OPTIONAL" }[];
  initialAvailability: DayAvailability;
  declined: Record<string, string | null>;
  schedule: SceneScheduleValue;
  sceneStats: SceneStatsView;
};

type SaveStatus = "idle" | "saving" | "saved" | "error";

export function RehearsalEditor({
  rehearsal,
  context,
  audience: initialAudience,
  invited,
  initialAvailability,
  declined,
  schedule: initialSchedule,
  sceneStats,
}: RehearsalEditorProps) {
  const router = useRouter();
  const isDraft = rehearsal.status === "DRAFT";
  const isTentative = rehearsal.status === "TENTATIVE";

  const [title, setTitle] = useState(rehearsal.title);
  const [date, setDate] = useState(() => formatIsoDateInTimeZone(rehearsal.start));
  const [time, setTime] = useState(() => formatIsoTimeInTimeZone(rehearsal.start));
  const [endTime, setEndTime] = useState(() =>
    rehearsal.end ? formatIsoTimeInTimeZone(rehearsal.end) : "",
  );
  const [location, setLocation] = useState(rehearsal.location);
  const [description, setDescription] = useState(rehearsal.description ?? "");
  const [audience, setAudience] = useState<AudienceValue>(initialAudience);
  // Veröffentlichte Proben: Zielgruppe nur senden, wenn die Planung sie geändert oder
  // Abweichungen übernommen hat – sonst keine stillen Einladungen.
  const [audienceTouched, setAudienceTouched] = useState(isDraft);
  const [availability, setAvailability] = useState<DayAvailability>(initialAvailability);
  const [schedule, setSchedule] = useState<SceneScheduleValue>(initialSchedule);
  // Nur vollständige Uhrzeiten speichern; halb ausgefüllte Felder blockieren sonst das Speichern.
  const scheduleToSave = useMemo<SceneScheduleValue>(
    () => ({
      mode: schedule.mode,
      times: Object.fromEntries(
        Object.entries(schedule.times).filter(([, time]) =>
          [time.start, time.end].every((value) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value)),
        ),
      ),
    }),
    [schedule],
  );
  const [conflicts, setConflicts] = useState<Partial<Record<string, string>>>({});
  const [isCheckingBlocks, setIsCheckingBlocks] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [isPublishing, startPublish] = useTransition();
  const [isDiscarding, startDiscard] = useTransition();

  const invitedIds = useMemo(
    () =>
      new Set(
        resolveAudience(audience.rules, audience.overrides, context)
          .filter((entry) => !entry.excluded)
          .map((entry) => entry.userId),
      ),
    [audience, context],
  );
  const invitedCount = invitedIds.size;
  const drift = useMemo(
    () =>
      isDraft || audienceTouched
        ? null
        : computeAudienceDrift(
            invited,
            resolveAudience(initialAudience.rules, initialAudience.overrides, context),
          ),
    [isDraft, audienceTouched, invited, initialAudience, context],
  );

  const changeAudience = useCallback((next: AudienceValue) => {
    setAudience(next);
    setAudienceTouched(true);
  }, []);

  const sceneIds = useMemo(
    () =>
      audience.rules.flatMap((rule) =>
        rule.type === "SCENE" && rule.targetId ? [rule.targetId] : [],
      ),
    [audience.rules],
  );
  const changeScenes = useCallback(
    (nextSceneIds: string[]) => {
      const levels = new Map(
        audience.rules
          .filter((rule) => rule.type === "SCENE")
          .map((rule) => [rule.targetId, rule.level]),
      );
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
      fetchDayChecks(date, time, endTime.trim()).catch(() => null);
    }, 400);
    return () => clearTimeout(handle);
  }, [date, time, endTime, fetchDayChecks]);

  const skipInitialSave = useRef(true);

  useEffect(() => {
    if (skipInitialSave.current) {
      skipInitialSave.current = false;
      return;
    }

    setSaveStatus("saving");
    const handle = setTimeout(() => {
      const updateAction = isDraft ? updateRehearsalDraftAction : updateRehearsalAction;
      const trimmedEndTime = endTime.trim();
      const actionParams = {
        id: rehearsal.id,
        title,
        date,
        time,
        ...(trimmedEndTime ? { endTime: trimmedEndTime } : {}),
        location,
        description,
        ...(audienceTouched ? { audience } : {}),
        schedule: scheduleToSave,
      };

      updateAction(actionParams)
        .then((result) => {
          if (result?.success) {
            setSaveStatus("saved");
            setLastSavedAt(new Date());
          } else {
            setSaveStatus("error");
            const errorMessage = isDraft
              ? "Entwurf konnte nicht gespeichert werden."
              : "Probe konnte nicht aktualisiert werden.";
            toast.error(result?.error ?? errorMessage);
          }
        })
        .catch(() => {
          setSaveStatus("error");
          const errorMessage = isDraft
            ? "Entwurf konnte nicht gespeichert werden."
            : "Probe konnte nicht aktualisiert werden.";
          toast.error(errorMessage);
        });
    }, 800);

    return () => clearTimeout(handle);
  }, [
    description,
    date,
    time,
    endTime,
    title,
    location,
    audience,
    audienceTouched,
    scheduleToSave,
    rehearsal.id,
    isDraft,
  ]);

  const handlePublish = (target: "TENTATIVE" | "SCHEDULED") => {
    startPublish(() => {
      const trimmedEndTime = endTime.trim();
      publishRehearsalAction({
        id: rehearsal.id,
        title,
        date,
        time,
        ...(trimmedEndTime ? { endTime: trimmedEndTime } : {}),
        location,
        description,
        // Vorgemerkte Proben: Zielgruppe nur mitschicken, wenn sie geändert wurde.
        ...(isDraft || audienceTouched ? { audience } : {}),
        schedule: scheduleToSave,
        target,
      })
        .then((result) => {
          if (result?.success && result.id) {
            toast.success(
              target === "TENTATIVE"
                ? "Probe vorgemerkt. Die Eingeladenen sehen sie und können absagen."
                : "Probe angesetzt. Einladungen wurden versendet.",
            );
            router.push(`/mitglieder/proben/${result.id}`);
          } else {
            toast.error(result?.error ?? "Probe konnte nicht veröffentlicht werden.");
          }
        })
        .catch(() => {
          toast.error("Probe konnte nicht veröffentlicht werden.");
        });
    });
  };

  const handleDiscard = () => {
    if (!confirm("Möchtest du diesen Entwurf wirklich verwerfen?")) {
      return;
    }
    startDiscard(() => {
      discardRehearsalDraftAction({ id: rehearsal.id })
        .then((result) => {
          if (result?.success) {
            toast.success("Entwurf verworfen.");
            router.push("/mitglieder/probenplanung");
          } else {
            toast.error(result?.error ?? "Der Entwurf konnte nicht verworfen werden.");
          }
        })
        .catch(() => {
          toast.error("Der Entwurf konnte nicht verworfen werden.");
        });
    });
  };

  const saveLabel = useMemo(() => {
    const formattedTime = lastSavedAt?.toLocaleTimeString("de-DE");

    if (isDraft) {
      switch (saveStatus) {
        case "saving":
          return "Speichert…";
        case "saved":
          return formattedTime ? `Entwurf gespeichert (${formattedTime})` : "Entwurf gespeichert";
        case "error":
          return "Speichern fehlgeschlagen";
        default:
          return "Bereit";
      }
    }

    switch (saveStatus) {
      case "saving":
        return "Speichert Änderungen…";
      case "saved":
        return formattedTime
          ? `Änderungen gespeichert (${formattedTime})`
          : "Änderungen gespeichert";
      case "error":
        return "Speichern fehlgeschlagen";
      default:
        return "Änderungen werden automatisch gespeichert.";
    }
  }, [saveStatus, lastSavedAt, isDraft]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Allgemeine Informationen</CardTitle>
          <p className="text-sm text-muted-foreground">{saveLabel}</p>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="rehearsal-title">
                Titel
              </label>
              <Input
                id="rehearsal-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                minLength={3}
                maxLength={120}
                required
              />
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="rehearsal-date">
                  Datum
                </label>
                <DateInput
                  id="rehearsal-date"
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="rehearsal-time">
                  Uhrzeit
                </label>
                <TimeInput
                  id="rehearsal-time"
                  value={time}
                  onChange={(event) => setTime(event.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="rehearsal-end">
                  Ende
                </label>
                <TimeInput
                  id="rehearsal-end"
                  value={endTime}
                  onChange={(event) => setEndTime(event.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="rehearsal-location">
                Ort
              </label>
              <Input
                id="rehearsal-location"
                value={location}
                onChange={(event) => setLocation(event.target.value)}
                placeholder="z. B. Probenraum"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Beschreibung</label>
              <RichTextEditor
                value={description}
                onChange={setDescription}
                placeholder="Beschreibe Ablauf, Ziele oder Materialien."
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {context.scenes.length ? (
        <Card>
          <CardHeader>
            <CardTitle>Szenen & Ablauf</CardTitle>
            <p className="text-sm text-muted-foreground">
              Welche Szenen geprobt werden – mit Blick darauf, was schon wie oft dran war.
            </p>
          </CardHeader>
          <CardContent>
            <SceneScheduleEditor
              context={context}
              sceneIds={sceneIds}
              onScenesChange={changeScenes}
              schedule={schedule}
              onScheduleChange={setSchedule}
              stats={sceneStats}
              eventStartTime={time}
              invitedIds={invitedIds}
            />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Wer ist dabei?</CardTitle>
          <p className="text-sm text-muted-foreground">
            Gruppen, Rollen und Szenen schlagen Teilnehmer vor. Einzelne Personen kannst du
            jederzeit ausnehmen oder hinzufügen.
            {isCheckingBlocks ? " (Sperrliste wird aktualisiert…)" : null}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {drift && hasAudienceDrift(drift) ? (
            <div className="space-y-3 rounded-lg border border-warning bg-warning/10 p-4 text-sm">
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
          <AudienceBuilder
            context={context}
            value={audience}
            onChange={changeAudience}
            availability={availability}
            conflicts={conflicts}
            declined={declined}
            hideSceneRules={context.scenes.length > 0}
          />
        </CardContent>
      </Card>

      <div className="flex flex-col-reverse gap-3 md:flex-row md:items-center md:justify-between">
        {isDraft ? (
          <>
            <Button type="button" variant="outline" onClick={handleDiscard} disabled={isDiscarding}>
              {isDiscarding ? "Verwerfe Entwurf…" : "Entwurf verwerfen"}
            </Button>
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-3">
              <div className="text-xs text-muted-foreground">
                Vormerken: Die Eingeladenen sehen die Probe schon und können absagen. Ansetzen:
                verbindlich mit Einladung und Erinnerungen.
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => handlePublish("TENTATIVE")}
                disabled={isPublishing || !invitedCount}
              >
                Vormerken
              </Button>
              <Button
                type="button"
                onClick={() => handlePublish("SCHEDULED")}
                disabled={isPublishing || !invitedCount}
              >
                {isPublishing ? "Speichert…" : "Probe ansetzen"}
              </Button>
            </div>
          </>
        ) : isTentative ? (
          <div className="flex flex-col gap-2 md:ml-auto md:flex-row md:items-center md:gap-3">
            <div className="text-xs text-muted-foreground">
              Vorgemerkt – Änderungen werden automatisch gespeichert. Absagen bleiben beim Ansetzen
              erhalten.
            </div>
            <Button
              type="button"
              onClick={() => handlePublish("SCHEDULED")}
              disabled={isPublishing || !invitedCount}
            >
              {isPublishing ? "Speichert…" : "Jetzt verbindlich ansetzen"}
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-3 md:ml-auto">
            <div className="text-xs text-muted-foreground">
              Änderungen werden automatisch gespeichert. Alle Teilnehmer erhalten Benachrichtigungen
              über Updates.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
