"use client";

import { useMemo, useState } from "react";

import { ChevronLeftIcon, ChevronRightIcon } from "@/components/ui/action-icons";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { HEAVY_WEEK_COUNT, shiftDayKey, weekBounds, weekdayShort } from "@/lib/calendar/week-load";
import { cn } from "@/lib/utils";

import type { PlanningAvailability, PlanningEvent, PlanningMember } from "./page-client";

type DayState = {
  events: { id: string; title: string; declined: boolean; rehearsal: boolean }[];
  availability: PlanningAvailability | null;
};

const SHORT_DATE = new Intl.DateTimeFormat("de-DE", {
  day: "numeric",
  month: "numeric",
  timeZone: "UTC",
});

function formatKey(key: string) {
  return SHORT_DATE.format(new Date(`${key}T12:00:00Z`));
}

const AVAILABILITY_CELL: Record<PlanningAvailability["status"], string> = {
  blocked: "bg-destructive/15 text-destructive",
  limited: "bg-warning/15 text-warning",
  preferred: "bg-success/10 text-success",
};

const AVAILABILITY_TEXT: Record<PlanningAvailability["status"], string> = {
  blocked: "gesperrt",
  limited: "eingeschränkt",
  preferred: "bevorzugt",
};

function DayCell({ state, compact }: { state: DayState | undefined; compact?: boolean }) {
  const events = state?.events ?? [];
  const availability = state?.availability;
  if (!events.length && !availability) return <span className="text-muted-foreground/40">·</span>;
  return (
    <span
      className={cn(
        "flex min-h-9 w-full flex-col justify-center gap-0.5 rounded-md px-1.5 py-1 text-[0.6875rem] leading-tight",
        availability ? AVAILABILITY_CELL[availability.status] : "bg-muted",
      )}
      title={[
        ...events.map((event) => `${event.title}${event.declined ? " (abgesagt)" : ""}`),
        availability
          ? `${AVAILABILITY_TEXT[availability.status]}${availability.reason ? `: ${availability.reason}` : ""}`
          : null,
      ]
        .filter(Boolean)
        .join("\n")}
    >
      {events.map((event) => (
        <span
          key={event.id}
          className={cn(
            "truncate font-medium text-info",
            event.declined && "text-muted-foreground line-through",
          )}
        >
          {compact ? (event.rehearsal ? "Probe" : "Termin") : event.title}
        </span>
      ))}
      {availability && (!events.length || !compact) ? (
        <span className="truncate">
          {availability.reason || AVAILABILITY_TEXT[availability.status]}
        </span>
      ) : null}
    </span>
  );
}

/**
 * Wer ist in einer Woche wann eingeladen, gesperrt oder frei – Personen × Tage. Am Handy ein Tag
 * nach dem anderen als Liste.
 */
export function PeopleWeekView({
  members,
  availability,
  events,
  initialDay,
  onOpenDay,
}: {
  members: PlanningMember[];
  availability: PlanningAvailability[];
  events: PlanningEvent[];
  initialDay: string;
  onOpenDay: (dayKey: string) => void;
}) {
  const [weekStart, setWeekStart] = useState(() => weekBounds(initialDay).from);
  const [mobileDay, setMobileDay] = useState(initialDay);
  const days = useMemo(
    () => Array.from({ length: 7 }, (_, index) => shiftDayKey(weekStart, index)),
    [weekStart],
  );

  const grid = useMemo(() => {
    const map = new Map<string, DayState>();
    const cell = (userId: string, day: string) => {
      const key = `${userId}:${day}`;
      let state = map.get(key);
      if (!state) {
        state = { events: [], availability: null };
        map.set(key, state);
      }
      return state;
    };
    for (const event of events) {
      if (!event.invitedIds || !days.includes(event.dayKey)) continue;
      for (const userId of event.invitedIds) {
        cell(userId, event.dayKey).events.push({
          id: event.id,
          title: event.title,
          declined: event.declinedIds.includes(userId),
          rehearsal: event.kind === "REHEARSAL",
        });
      }
    }
    for (const entry of availability) {
      if (days.includes(entry.date)) cell(entry.userId, entry.date).availability = entry;
    }
    return map;
  }, [events, availability, days]);

  const countOf = (userId: string) =>
    days.reduce(
      (sum, day) =>
        sum + (grid.get(`${userId}:${day}`)?.events.filter((event) => !event.declined).length ?? 0),
      0,
    );
  const rows = members.map((member) => ({ ...member, count: countOf(member.id) }));
  const weekLabel = `${formatKey(days[0] ?? weekStart)} – ${formatKey(days[6] ?? weekStart)}`;

  const moveWeek = (offset: number) => {
    const next = shiftDayKey(weekStart, offset * 7);
    setWeekStart(next);
    setMobileDay(next);
  };

  return (
    <Card variant="plain" size="flush" className="space-y-3 border-border p-3 sm:p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold">Woche {weekLabel}</h2>
        <div className="flex gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-11 w-11 p-0"
            aria-label="Vorherige Woche"
            onClick={() => moveWeek(-1)}
          >
            <ChevronLeftIcon className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-11 w-11 p-0"
            aria-label="Nächste Woche"
            onClick={() => moveWeek(1)}
          >
            <ChevronRightIcon className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Desktop/Tablet: Personen × Tage */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full table-fixed border-separate border-spacing-0.5 text-sm">
          <thead>
            <tr>
              <th
                scope="col"
                className="w-44 p-1 text-left text-xs font-medium text-muted-foreground"
              >
                Person
              </th>
              {days.map((day) => (
                <th key={day} scope="col" className="p-0">
                  <button
                    type="button"
                    onClick={() => onOpenDay(day)}
                    className="w-full rounded-md p-1 text-center text-xs font-medium text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label={`${weekdayShort(day)} ${formatKey(day)} im Kalender öffnen`}
                  >
                    {weekdayShort(day)} {formatKey(day)}
                  </button>
                </th>
              ))}
              <th
                scope="col"
                className="w-16 p-1 text-right text-xs font-medium text-muted-foreground"
              >
                Proben
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <th scope="row" className="truncate p-1 text-left text-sm font-medium">
                  {row.name}
                </th>
                {days.map((day) => (
                  <td key={day} className="p-0 align-top">
                    <DayCell state={grid.get(`${row.id}:${day}`)} />
                  </td>
                ))}
                <td
                  className={cn(
                    "p-1 text-right tabular-nums",
                    row.count >= HEAVY_WEEK_COUNT
                      ? "font-semibold text-warning"
                      : "text-muted-foreground",
                  )}
                >
                  {row.count || "–"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Handy: Tag wählen, dann Personen */}
      <div className="space-y-3 md:hidden">
        <div className="grid grid-cols-7 gap-1" role="group" aria-label="Tag wählen">
          {days.map((day) => (
            <button
              key={day}
              type="button"
              onClick={() => setMobileDay(day)}
              aria-pressed={day === mobileDay}
              className={cn(
                "flex min-h-11 flex-col items-center justify-center rounded-md text-xs",
                day === mobileDay
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground",
              )}
            >
              <span className="font-medium">{weekdayShort(day)}</span>
              <span>{formatKey(day)}</span>
            </button>
          ))}
        </div>
        <ul className="divide-y divide-border rounded-md border border-border">
          {rows.map((row) => (
            <li key={row.id} className="flex min-h-11 items-center gap-2 px-3 py-1.5">
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{row.name}</span>
              <span className="w-28 shrink-0">
                <DayCell state={grid.get(`${row.id}:${mobileDay}`)} compact />
              </span>
              <span
                className={cn(
                  "w-10 shrink-0 text-right text-xs tabular-nums",
                  row.count >= HEAVY_WEEK_COUNT
                    ? "font-semibold text-warning"
                    : "text-muted-foreground",
                )}
                aria-label={`${row.count} Proben diese Woche`}
              >
                {row.count}×
              </span>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}
