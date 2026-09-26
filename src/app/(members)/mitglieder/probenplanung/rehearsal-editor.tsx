"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { AudienceBuilder, type AudienceValue } from "@/components/calendar/audience-builder";
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
import { formatIsoDateInTimeZone, formatIsoTimeInTimeZone } from "@/lib/date-time";

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
};

type SaveStatus = "idle" | "saving" | "saved" | "error";

export function RehearsalEditor({
  rehearsal,
  context,
  audience: initialAudience,
  invited,
  initialAvailability,
}: RehearsalEditorProps) {
  const router = useRouter();
  const isDraft = rehearsal.status === "DRAFT";

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
  const [isCheckingBlocks, setIsCheckingBlocks] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [isPublishing, startPublish] = useTransition();
  const [isDiscarding, startDiscard] = useTransition();

  const invitedCount = useMemo(
    () =>
      resolveAudience(audience.rules, audience.overrides, context).filter(
        (entry) => !entry.excluded,
      ).length,
    [audience, context],
  );
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

  const fetchBlockedForDate = useCallback(async (dateValue: string) => {
    setIsCheckingBlocks(true);
    try {
      const response = await fetch(`/api/rehearsals/blocked?date=${dateValue}`);
      if (!response.ok) {
        throw new Error("Request failed");
      }
      const data = (await response.json()) as { availability?: DayAvailability };
      setAvailability(data.availability ?? {});
    } catch (error) {
      console.error("Failed to load blocked members", error);
      toast.error("Sperrtermine konnten nicht geladen werden.");
    } finally {
      setIsCheckingBlocks(false);
    }
  }, []);

  useEffect(() => {
    fetchBlockedForDate(date).catch(() => null);
  }, [date, fetchBlockedForDate]);

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
    rehearsal.id,
    isDraft,
  ]);

  const handlePublish = () => {
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
        audience,
      })
        .then((result) => {
          if (result?.success && result.id) {
            toast.success("Probe veröffentlicht. Einladungen wurden versendet.");
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
                Du kannst die Probe veröffentlichen, sobald alle Informationen vollständig sind.
              </div>
              <Button
                type="button"
                onClick={handlePublish}
                disabled={isPublishing || !invitedCount}
              >
                {isPublishing ? "Veröffentliche…" : "Probe veröffentlichen"}
              </Button>
            </div>
          </>
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
