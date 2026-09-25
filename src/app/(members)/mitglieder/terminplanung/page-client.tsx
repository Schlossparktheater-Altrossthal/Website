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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

export type PlanningMember = { id: string; name: string };

export type PlanningAvailability = {
  userId: string;
  date: string;
  status: "blocked" | "limited" | "preferred";
  reason: string | null;
};

type Answer = "blocked" | "limited" | "available";

/** Wer kann an einem (ggf. mehrtägigen) Termin? Maßgeblich ist der ungünstigste Tag. */
type Attendance = {
  memberId: string;
  name: string;
  answer: Answer;
  preferred: boolean;
  /** Tage mit Einschränkung, nur bei mehrtägigen Terminen relevant. */
  days: string[];
  reasons: string[];
};

const RANK: Record<PlanningAvailability["status"], number> = {
  preferred: 0,
  limited: 1,
  blocked: 2,
};

const WEEKDAY = new Intl.DateTimeFormat("de-DE", { weekday: "short", timeZone: "UTC" });

function weekdayOf(key: string) {
  return WEEKDAY.format(new Date(`${key}T12:00:00Z`)).replace(".", "");
}

type KindFilter = "all" | (typeof CALENDAR_EVENT_KINDS)[number];

const KIND_FILTERS: { value: KindFilter; label: string }[] = [
  { value: "all", label: "Alle" },
  ...CALENDAR_EVENT_KINDS.map((value) => ({ value, label: CALENDAR_EVENT_KIND_LABELS[value] })),
];

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
  members,
  availability,
}: {
  events: CalendarEntry[];
  members: PlanningMember[];
  availability: PlanningAvailability[];
}) {
  const [events, setEvents] = useState(initialEvents);
  const [dialog, setDialog] = useState<EventDialogState>(null);
  const [kind, setKind] = useState<KindFilter>("all");
  const [showPast, setShowPast] = useState(false);
  const todayKey = toDayKey(new Date());

  const byMemberDay = useMemo(
    () => new Map(availability.map((entry) => [`${entry.userId}:${entry.date}`, entry])),
    [availability],
  );

  const attendanceFor = (event: CalendarEntry): Attendance[] => {
    const days = expandEntryDayKeys(event);
    return members.map((member) => {
      const entries = days.flatMap((key) => byMemberDay.get(`${member.id}:${key}`) ?? []);
      const worst = entries.reduce<PlanningAvailability | null>(
        (current, entry) =>
          !current || RANK[entry.status] > RANK[current.status] ? entry : current,
        null,
      );
      const answer: Answer =
        worst?.status === "blocked" || worst?.status === "limited" ? worst.status : "available";
      const restricted = entries.filter((entry) => entry.status !== "preferred");
      return {
        memberId: member.id,
        name: member.name,
        answer,
        preferred: entries.length > 0 && entries.every((entry) => entry.status === "preferred"),
        days: days.length > 1 ? restricted.map((entry) => entry.date) : [],
        reasons: [...new Set(restricted.flatMap((entry) => (entry.reason ? [entry.reason] : [])))],
      };
    });
  };

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
        {/* Mobil ein Auswahlfeld: fünf Arten passen nicht nebeneinander. */}
        <Select
          value={kind}
          onValueChange={(value) => {
            const next = KIND_FILTERS.find((entry) => entry.value === value);
            if (next) setKind(next.value);
          }}
        >
          <SelectTrigger className="h-9 w-40 sm:hidden" aria-label="Nach Art filtern">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {KIND_FILTERS.map((entry) => (
              <SelectItem key={entry.value} value={entry.value}>
                {entry.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <SegmentedControl
          aria-label="Nach Art filtern"
          value={kind}
          onValueChange={setKind}
          className="hidden sm:inline-flex"
          options={KIND_FILTERS}
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
              {list.map((event) => (
                <EventRow
                  key={event.id}
                  event={event}
                  attendance={attendanceFor(event)}
                  past={(expandEntryDayKeys(event).at(-1) ?? event.dayKey) < todayKey}
                  onEdit={() => setDialog({ mode: "edit", entry: event })}
                />
              ))}
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

const AVAILABLE_PREVIEW = 8;

function EventRow({
  event,
  attendance,
  past,
  onEdit,
}: {
  event: CalendarEntry;
  attendance: Attendance[];
  past: boolean;
  onEdit: () => void;
}) {
  const [showAvailable, setShowAvailable] = useState(false);
  const blocked = attendance.filter((entry) => entry.answer === "blocked");
  const limited = attendance.filter((entry) => entry.answer === "limited");
  const available = attendance
    .filter((entry) => entry.answer === "available")
    .sort((a, b) => Number(b.preferred) - Number(a.preferred));
  const visibleAvailable = showAvailable ? available : available.slice(0, AVAILABLE_PREVIEW);

  return (
    <div className={cn("space-y-3 p-3 sm:p-4", past && "opacity-60")}>
      <div className="flex items-start gap-3">
        <DateBadge date={new Date(event.start)} tone="primary" />
        <div className="min-w-0 flex-1 space-y-0.5">
          <button
            type="button"
            onClick={onEdit}
            className="block max-w-full truncate text-left text-sm font-semibold hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {event.title}
          </button>
          <p className="truncate text-xs text-muted-foreground">
            {[getCalendarEntryKindLabel(event.kind), formatWhen(event), event.location]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <div className="w-24 shrink-0 space-y-1 text-right sm:w-36">
          <p className="text-sm">
            <span className="font-semibold tabular-nums">{available.length}</span>
            <span className="text-muted-foreground"> / {attendance.length} können</span>
          </p>
          <AvailabilityBar
            total={attendance.length}
            blocked={blocked.length}
            limited={limited.length}
          />
        </div>
      </div>

      <div className="space-y-2 sm:pl-14">
        <AttendanceGroup status="blocked" title="Können nicht" entries={blocked} />
        <AttendanceGroup status="limited" title="Eingeschränkt" entries={limited} />
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="inline-flex w-full items-center gap-1.5 text-xs font-medium text-muted-foreground sm:w-auto">
            <StatusDot status="preferred" /> Können · {available.length}
          </span>
          {visibleAvailable.map((entry) => (
            <span
              key={entry.memberId}
              className={cn(
                "rounded-full px-2 py-0.5 text-xs",
                entry.preferred ? "bg-success/15 text-success" : "bg-muted text-foreground/80",
              )}
              title={entry.preferred ? "Kommt besonders gern" : undefined}
            >
              {entry.name}
            </span>
          ))}
          {available.length > AVAILABLE_PREVIEW ? (
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={() => setShowAvailable((value) => !value)}
            >
              {showAvailable ? "weniger" : `+${available.length - AVAILABLE_PREVIEW} weitere`}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function AttendanceGroup({
  status,
  title,
  entries,
}: {
  status: "blocked" | "limited";
  title: string;
  entries: Attendance[];
}) {
  if (!entries.length) return null;
  return (
    <div className="flex flex-wrap items-start gap-1.5">
      <span className="inline-flex w-full items-center gap-1.5 pt-0.5 text-xs font-medium text-muted-foreground sm:w-auto">
        <StatusDot status={status} /> {title} · {entries.length}
      </span>
      {entries.map((entry) => (
        <span
          key={entry.memberId}
          className={cn(
            "rounded-md px-2 py-0.5 text-xs",
            status === "blocked"
              ? "bg-destructive/15 text-destructive"
              : "bg-warning/20 text-warning",
          )}
        >
          <span className="font-medium">{entry.name}</span>
          {entry.days.length ? (
            <span className="opacity-80"> ({entry.days.map(weekdayOf).join(", ")})</span>
          ) : null}
          {entry.reasons.length ? (
            <span className="text-foreground/70"> – {entry.reasons.join("; ")}</span>
          ) : null}
        </span>
      ))}
    </div>
  );
}
