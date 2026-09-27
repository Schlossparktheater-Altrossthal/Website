"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { AudienceBuilder, type AudienceValue } from "@/components/calendar/audience-builder";
import { DateFinderResults } from "@/components/calendar/date-finder-results";
import { WeekdayPicker } from "@/components/calendar/weekday-picker";
import { AsyncButton } from "@/components/ui/async-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DateInput } from "@/components/ui/date-input";
import { Label } from "@/components/ui/label";
import { TimeInput } from "@/components/ui/time-input";
import type { AudienceContext } from "@/lib/calendar/audience";

import { createRehearsalDraftAction } from "../actions/drafts";
import { findRehearsalDatesAction, type FinderResult } from "../actions/finder";

function addDays(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Zielgruppe + Zeitraum → beste Tage; Klick legt einen Probenentwurf mit dieser Zielgruppe an. */
export function DateFinder({ context, today }: { context: AudienceContext; today: string }) {
  const router = useRouter();
  const [audience, setAudience] = useState<AudienceValue>({
    rules: [
      {
        type: context.hasProduction ? "ALL_CAST" : "PRODUCTION_ALL",
        targetId: null,
        level: "REQUIRED",
      },
    ],
    overrides: [],
  });
  const [from, setFrom] = useState(addDays(today, 1));
  const [to, setTo] = useState(addDays(today, 28));
  const [weekdays, setWeekdays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [startTime, setStartTime] = useState("19:00");
  const [endTime, setEndTime] = useState("22:00");
  const [result, setResult] = useState<Extract<FinderResult, { ok: true }> | null>(null);
  const [searching, startSearch] = useTransition();
  const [creating, setCreating] = useState<string | null>(null);

  const search = () =>
    startSearch(async () => {
      const response = await findRehearsalDatesAction({
        audience,
        from,
        to,
        weekdays,
        startTime,
        endTime,
      });
      if (!response.ok) {
        toast.error("Keine Vorschläge", { description: response.error, duration: 5000 });
        return;
      }
      setResult(response);
    });

  const pick = async (dateKey: string) => {
    setCreating(dateKey);
    try {
      const response = await createRehearsalDraftAction({
        date: dateKey,
        time: startTime,
        endTime,
        audience,
      });
      if (response?.success && response.id) {
        toast.success("Entwurf mit dieser Zielgruppe angelegt.");
        router.push(`/mitglieder/probenplanung/proben/${response.id}`);
        return;
      }
      toast.error(response?.error ?? "Der Entwurf konnte nicht erstellt werden.");
    } catch {
      toast.error("Der Entwurf konnte nicht erstellt werden.");
    }
    setCreating(null);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Wer soll dabei sein?</CardTitle>
        </CardHeader>
        <CardContent>
          <AudienceBuilder
            context={context}
            value={audience}
            onChange={(value) => {
              setAudience(value);
              setResult(null);
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Wann?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5">
              <Label htmlFor="finder-from">Von</Label>
              <DateInput
                id="finder-from"
                value={from}
                min={today}
                onChange={(event) => setFrom(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="finder-to">Bis</Label>
              <DateInput
                id="finder-to"
                value={to}
                min={from}
                onChange={(event) => setTo(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="finder-start">Beginn</Label>
              <TimeInput
                id="finder-start"
                value={startTime}
                onChange={(event) => setStartTime(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="finder-end">Ende</Label>
              <TimeInput
                id="finder-end"
                value={endTime}
                onChange={(event) => setEndTime(event.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <span className="text-sm font-medium">Wochentage</span>
            <WeekdayPicker value={weekdays} onChange={setWeekdays} />
          </div>
          <AsyncButton
            type="button"
            isLoading={searching}
            loadingText="Sucht…"
            disabled={!from || !to || !startTime || !endTime}
            onClick={search}
          >
            Termine finden
          </AsyncButton>
        </CardContent>
      </Card>

      {result ? (
        <Card>
          <CardHeader>
            <CardTitle>Vorschläge</CardTitle>
            <p className="text-sm text-muted-foreground">
              Für {result.participantCount} Personen, beste Tage zuerst. Benötigte zählen mehr als
              optionale; ein anderer Termin im Zeitfenster zählt wie eine Sperre.
              {result.truncated ? " Nur die ersten 120 Tage wurden geprüft." : ""}
            </p>
          </CardHeader>
          <CardContent>
            <DateFinderResults
              days={result.days}
              names={result.names}
              onPick={pick}
              pickLabel="Probe anlegen"
              pendingDateKey={creating}
            />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
