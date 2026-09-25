"use client";

import { useMemo, useState } from "react";

import { EventDialog, type EventDialogState } from "@/components/calendar/event-dialog";
import { CalendarPlusIcon } from "@/components/ui/action-icons";
import { AvailabilityBar } from "@/components/ui/availability-bar";
import { StatusDot } from "@/components/ui/availability-status";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DateBadge } from "@/components/ui/date-badge";
import { SegmentedControl } from "@/components/ui/segmented-control";
import {
  CALENDAR_EVENT_KINDS,
  CALENDAR_EVENT_KIND_LABELS,
  expandEntryDayKeys,
  getCalendarEntryKindLabel,
  type CalendarEntry,
} from "@/lib/calendar/event-kinds";
import { formatIsoTimeInTimeZone } from "@/lib/date-time";
import { toDayKey } from "@/lib/sperrliste/day-tiers";
import { cn } from "@/lib/utils";

export type EventAbsence = {
  date: string;
  status: "blocked" | "limited";
  name: string;
  reason: string | null;
};

type KindFilter = "all" | (typeof CALENDAR_EVENT_KINDS)[number];

const MONTH = new Intl.DateTimeFormat("de-DE", {
  month: "long",
  year: "numeric",
  timeZone: "Europe/Berlin",
});

function formatWhen(entry: CalendarEntry) {
  const days = expandEntryDayKeys(entry);
  const range = days.length > 1 ? `${days.length} Tage` : null;
  if (entry.allDay) return [range ?? "ganztägig"].join("");
  const start = formatIsoTimeInTimeZone(entry.start);
  const time = entry.end ? `${start}–${formatIsoTimeInTimeZone(entry.end)} Uhr` : `${start} Uhr`;
  return range ? `${range} · ${time}` : time;
}

export function EventPlanningClient({
  events: initialEvents,
  absences,
  memberCount,
}: {
  events: CalendarEntry[];
  absences: EventAbsence[];
  memberCount: number;
}) {
  const [events, setEvents] = useState(initialEvents);
  const [dialog, setDialog] = useState<EventDialogState>(null);
  const [kind, setKind] = useState<KindFilter>("all");
  const [showPast, setShowPast] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const todayKey = toDayKey(new Date());

  const absencesByDay = useMemo(() => {
    const map = new Map<string, EventAbsence[]>();
    for (const absence of absences) {
      const list = map.get(absence.date) ?? [];
      list.push(absence);
      map.set(absence.date, list);
    }
    return map;
  }, [absences]);

  const groups = useMemo(() => {
    const visible = events.filter(
      (event) =>
        (kind === "all" || event.kind === kind) &&
        (showPast || (expandEntryDayKeys(event).at(-1) ?? event.dayKey) >= todayKey),
    );
    const byMonth = new Map<string, CalendarEntry[]>();
    for (const event of visible) {
      const label = MONTH.format(new Date(event.start));
      const list = byMonth.get(label) ?? [];
      list.push(event);
      byMonth.set(label, list);
    }
    return [...byMonth.entries()];
  }, [events, kind, showPast, todayKey]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <SegmentedControl
          aria-label="Nach Art filtern"
          value={kind}
          onValueChange={setKind}
          className="max-w-full overflow-x-auto"
          options={[
            { value: "all", label: "Alle" },
            ...CALENDAR_EVENT_KINDS.map((value) => ({
              value,
              label: CALENDAR_EVENT_KIND_LABELS[value],
            })),
          ]}
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setShowPast((value) => !value)}
        >
          {showPast ? "Vergangene ausblenden" : "Vergangene zeigen"}
        </Button>
        <Button
          type="button"
          size="sm"
          className="ml-auto"
          onClick={() => setDialog({ mode: "create", date: todayKey })}
        >
          <CalendarPlusIcon className="h-4 w-4" aria-hidden />
          Termin anlegen
        </Button>
      </div>

      {groups.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-sm text-muted-foreground">Keine anstehenden Termine.</p>
        </div>
      ) : (
        groups.map(([month, list]) => (
          <section key={month} className="space-y-2">
            <h2 className="text-sm font-semibold text-muted-foreground">{month}</h2>
            <Card variant="plain" size="flush" className="divide-y divide-border border-border">
              {list.map((event) => {
                const days = expandEntryDayKeys(event);
                const missing = days.flatMap((key) => absencesByDay.get(key) ?? []);
                const blocked = new Set(
                  missing.filter((entry) => entry.status === "blocked").map((e) => e.name),
                );
                const limited = new Set(
                  missing
                    .filter((entry) => entry.status === "limited" && !blocked.has(entry.name))
                    .map((entry) => entry.name),
                );
                const isOpen = expanded === event.id;
                const past = (days.at(-1) ?? event.dayKey) < todayKey;
                return (
                  <div key={event.id} className={cn("p-3 sm:p-4", past && "opacity-60")}>
                    <div className="flex items-start gap-3">
                      <DateBadge date={new Date(event.start)} tone="primary" />
                      <div className="min-w-0 flex-1 space-y-1">
                        <button
                          type="button"
                          onClick={() => setDialog({ mode: "edit", entry: event })}
                          className="block max-w-full truncate text-left text-sm font-semibold hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          {event.title}
                        </button>
                        <p className="truncate text-xs text-muted-foreground">
                          {[
                            getCalendarEntryKindLabel(event.kind),
                            formatWhen(event),
                            event.location,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setExpanded(isOpen ? null : event.id)}
                        aria-expanded={isOpen}
                        className="w-28 shrink-0 space-y-1 rounded-md p-1 text-left hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-40"
                      >
                        <AvailabilityBar
                          total={memberCount}
                          blocked={blocked.size}
                          limited={limited.size}
                        />
                        <span className="block text-xs text-muted-foreground">
                          {blocked.size || limited.size
                            ? `${blocked.size + limited.size} mit Einschränkung`
                            : "Alle verfügbar"}
                        </span>
                      </button>
                    </div>
                    {isOpen && missing.length ? (
                      <ul className="mt-3 space-y-1 border-t border-border pt-3 sm:pl-14">
                        {missing.map((entry) => (
                          <li
                            key={`${entry.date}-${entry.name}`}
                            className="flex items-center gap-2 text-sm"
                          >
                            <StatusDot status={entry.status} />
                            <span className="font-medium">{entry.name}</span>
                            {days.length > 1 ? (
                              <span className="text-xs text-muted-foreground">{entry.date}</span>
                            ) : null}
                            {entry.reason ? (
                              <span className="truncate text-muted-foreground">
                                – {entry.reason}
                              </span>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                );
              })}
            </Card>
          </section>
        ))
      )}

      <EventDialog
        state={dialog}
        onClose={() => setDialog(null)}
        onSaved={(entry, previousId) =>
          setEvents((current) =>
            [...current.filter((item) => item.id !== (previousId ?? entry.id)), entry].sort(
              (a, b) => a.start.localeCompare(b.start),
            ),
          )
        }
        onDeleted={(id) => setEvents((current) => current.filter((item) => item.id !== id))}
      />
    </div>
  );
}
