"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { CalendarEventKind } from "@prisma/client";

import { CalendarCheckIcon, ListIcon, SearchIcon } from "@/components/ui/action-icons";
import { AvailabilityBar } from "@/components/ui/availability-bar";
import { StatusDot, StatusLegend } from "@/components/ui/availability-status";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DateBadge } from "@/components/ui/date-badge";
import { ListRow, ListRowGroup } from "@/components/ui/list-row";
import { MonthGrid } from "@/components/ui/month-grid";
import { MonthSwitcher } from "@/components/ui/month-switcher";
import { SectionHeader } from "@/components/ui/section-header";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import {
  expandEntryDayKeys,
  getCalendarEntryKindLabel,
  type CalendarEntry,
} from "@/lib/calendar/event-kinds";
import { formatIsoTimeInTimeZone } from "@/lib/date-time";
import type { FinalWeekRange } from "@/lib/sperrliste/day-tiers";
import { toDayKey } from "@/lib/sperrliste/day-tiers";
import { cn } from "@/lib/utils";
import type { HolidayRange } from "@/types/holidays";

import { CalendarLegend, DayCellDetails, DayChips, formatLongDate } from "../sperrliste/day-parts";
import type { TeamEntry } from "../sperrliste/types";
import { getBaseDayState, useCalendarModel } from "../sperrliste/use-calendar-model";
import { NewEventButton, NewEventButtons } from "./new-event";

export type PlanningMember = { id: string; name: string };

export type PlanningAvailability = {
  userId: string;
  date: string;
  status: "blocked" | "limited" | "preferred";
  reason: string | null;
};

export type PlanningEvent = CalendarEntry & {
  status: "TENTATIVE" | "SCHEDULED";
  /** Eingeladene; null = Termin für alle. */
  invitedIds: string[] | null;
  declinedIds: string[];
};

export type PlanningDraft = {
  id: string;
  title: string;
  kind: CalendarEventKind;
  start: string;
  allDay: boolean;
};

type Filter = "all" | "rehearsals" | "events";
type View = "calendar" | "list";
type Answer = "blocked" | "limited" | "available";

type Attendance = {
  memberId: string;
  name: string;
  answer: Answer;
  preferred: boolean;
  declined: boolean;
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
const MONTH = new Intl.DateTimeFormat("de-DE", {
  month: "long",
  year: "numeric",
  timeZone: "Europe/Berlin",
});

function weekdayOf(key: string) {
  return WEEKDAY.format(new Date(`${key}T12:00:00Z`)).replace(".", "");
}

function formatWhen(entry: Pick<CalendarEntry, "allDay" | "start" | "end" | "dayKey">) {
  const days = expandEntryDayKeys(entry);
  const range = days.length > 1 ? `${days.length} Tage` : null;
  if (entry.allDay) return range ?? "ganztägig";
  const start = formatIsoTimeInTimeZone(entry.start);
  const time = entry.end ? `${start}–${formatIsoTimeInTimeZone(entry.end)}` : start;
  return range ? `${range} · ${time}` : time;
}

function matchesFilter(kind: CalendarEventKind, filter: Filter) {
  if (filter === "all") return true;
  return filter === "rehearsals" ? kind === "REHEARSAL" : kind !== "REHEARSAL";
}

function lastDayOf(event: CalendarEntry) {
  return expandEntryDayKeys(event).at(-1) ?? event.dayKey;
}

type EventPlanningProps = {
  events: PlanningEvent[];
  drafts: PlanningDraft[];
  members: PlanningMember[];
  availability: PlanningAvailability[];
  holidays: HolidayRange[];
  finalWeek: FinalWeekRange;
  preferredWeekdays: number[];
  exceptionWeekdays: number[];
  initialFilter: Filter;
  /** Szenen-Stand der Produktion (Server-Komponente). */
  sceneOverview: React.ReactNode;
};

export function EventPlanningClient({
  events,
  drafts,
  members,
  availability,
  holidays,
  finalWeek,
  preferredWeekdays,
  exceptionWeekdays,
  initialFilter,
  sceneOverview,
}: EventPlanningProps) {
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const todayKey = toDayKey(new Date());
  const [view, setView] = useState<View>("calendar");
  const [filter, setFilter] = useState<Filter>(initialFilter);
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedKey, setSelectedKey] = useState(todayKey);
  const [sheetOpen, setSheetOpen] = useState(false);

  const visibleEvents = useMemo(
    () => events.filter((event) => matchesFilter(event.kind, filter)),
    [events, filter],
  );
  const teamEntries: TeamEntry[] = useMemo(
    () => availability.map((entry) => ({ ...entry })),
    [availability],
  );
  const model = useCalendarModel({
    month,
    holidays,
    calendarEntries: visibleEvents,
    teamEntries,
    finalWeek,
    preferredWeekdays,
    exceptionWeekdays,
    freezeDays: 0,
  });

  const byMemberDay = useMemo(
    () => new Map(availability.map((entry) => [`${entry.userId}:${entry.date}`, entry])),
    [availability],
  );
  const memberById = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);

  const attendanceFor = (event: PlanningEvent): Attendance[] => {
    const days = expandEntryDayKeys(event);
    const declined = new Set(event.declinedIds);
    const people = event.invitedIds
      ? event.invitedIds.flatMap((id) => memberById.get(id) ?? [])
      : members;
    return people.map((member) => {
      const entries = days.flatMap((key) => byMemberDay.get(`${member.id}:${key}`) ?? []);
      const worst = entries.reduce<PlanningAvailability | null>(
        (current, entry) =>
          !current || RANK[entry.status] > RANK[current.status] ? entry : current,
        null,
      );
      const isDeclined = declined.has(member.id);
      const answer: Answer = isDeclined
        ? "blocked"
        : worst?.status === "blocked" || worst?.status === "limited"
          ? worst.status
          : "available";
      const restricted = entries.filter((entry) => entry.status !== "preferred");
      return {
        memberId: member.id,
        name: member.name,
        answer,
        declined: isDeclined,
        preferred: entries.length > 0 && entries.every((entry) => entry.status === "preferred"),
        days: days.length > 1 ? restricted.map((entry) => entry.date) : [],
        reasons: [
          ...(isDeclined ? ["abgesagt"] : []),
          ...new Set(restricted.flatMap((entry) => (entry.reason ? [entry.reason] : []))),
        ],
      };
    });
  };

  const now = new Date();
  const isCurrentMonth =
    month.getFullYear() === now.getFullYear() && month.getMonth() === now.getMonth();
  const selectedDay = model.dayMap.get(selectedKey);

  // Beim Monatswechsel einen Tag des neuen Monats wählen (heute oder den 1.).
  const changeMonth = (next: Date) => {
    setMonth(next);
    const today = new Date();
    setSelectedKey(
      next.getFullYear() === today.getFullYear() && next.getMonth() === today.getMonth()
        ? todayKey
        : toDayKey(next),
    );
  };

  const openDay = (key: string) => {
    setSelectedKey(key);
    // Mobil öffnet ein Tipp sofort das Blatt – wie in der Sperrliste.
    if (!isDesktop) setSheetOpen(true);
  };

  const dayPanel = selectedDay ? (
    <DayPanel
      dayKey={selectedKey}
      model={model}
      events={(model.entriesByDay.get(selectedKey) ?? []) as PlanningEvent[]}
      total={members.length}
      memberById={memberById}
      attendanceFor={attendanceFor}
      showHeader={isDesktop}
    />
  ) : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <SegmentedControl
          aria-label="Ansicht"
          size="md"
          value={view}
          onValueChange={setView}
          options={[
            {
              value: "calendar",
              label: (
                <>
                  <CalendarCheckIcon className="h-4 w-4" aria-hidden />
                  <span className="hidden sm:inline">Kalender</span>
                </>
              ),
              ariaLabel: "Kalender",
            },
            {
              value: "list",
              label: (
                <>
                  <ListIcon className="h-4 w-4" aria-hidden />
                  <span className="hidden sm:inline">Liste</span>
                </>
              ),
              ariaLabel: "Liste",
            },
          ]}
        />
        <SegmentedControl
          aria-label="Art"
          size="md"
          value={filter}
          onValueChange={setFilter}
          options={[
            { value: "all", label: "Alle" },
            { value: "rehearsals", label: "Proben" },
            { value: "events", label: "Termine" },
          ]}
        />
        <div className="ml-auto flex items-center gap-2">
          <Button asChild variant="outline" size="sm" className="h-10">
            <Link href="/mitglieder/terminplanung/terminfinder" aria-label="Terminfinder">
              <SearchIcon className="h-4 w-4" aria-hidden />
              <span className="hidden md:inline">Terminfinder</span>
            </Link>
          </Button>
          <NewEventButton date={selectedKey >= todayKey ? selectedKey : todayKey} />
        </div>
      </div>

      {drafts.length ? <DraftList drafts={drafts} /> : null}

      {view === "calendar" ? (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start lg:gap-6">
          <Card variant="plain" size="flush" className="space-y-3 border-border p-3 sm:p-4">
            <MonthSwitcher
              month={month}
              isCurrentMonth={isCurrentMonth}
              onPrevious={() => changeMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
              onNext={() => changeMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
              onToday={() => changeMonth(new Date(now.getFullYear(), now.getMonth(), 1))}
            />
            <MonthGrid
              month={month}
              showWeekNumbers
              selectedKey={isDesktop || sheetOpen ? selectedKey : null}
              emphasizedWeekdays={model.preferredWeekdaySet}
              onSelect={openDay}
              getDayState={(key) =>
                getBaseDayState(model.dayMap.get(key), model.entriesByDay.get(key))
              }
              renderDetails={(key) => (
                <>
                  <DayCellDetails
                    day={model.dayMap.get(key)}
                    entries={model.entriesByDay.get(key)}
                  />
                  <DayCellCounts counts={model.countsByDay.get(key)} />
                </>
              )}
            />
            <p className="text-center text-xs text-muted-foreground lg:hidden">
              Tippe auf einen Tag: Termine, wer kann, neu anlegen.
            </p>
            <div className="flex flex-col gap-1.5 border-t border-border pt-3 sm:flex-row sm:flex-wrap sm:gap-x-4">
              <CalendarLegend />
            </div>
          </Card>

          {isDesktop ? (
            <Card
              variant="plain"
              size="flush"
              className="border-border p-4 lg:sticky lg:top-4"
              aria-live="polite"
            >
              {dayPanel}
            </Card>
          ) : null}
        </div>
      ) : (
        <EventList events={visibleEvents} todayKey={todayKey} attendanceFor={attendanceFor} />
      )}

      {sceneOverview}

      {!isDesktop ? (
        <BottomSheet
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          title={selectedDay ? formatLongDate(selectedDay.date) : ""}
          description="Termine und Verfügbarkeit an diesem Tag"
          footer={<NewEventButtons date={selectedKey} />}
        >
          {dayPanel}
        </BottomSheet>
      ) : null}
    </div>
  );
}

/** Kurzform am Desktop: wie viele an dem Tag nicht bzw. eingeschränkt können. */
function DayCellCounts({ counts }: { counts: { blocked: number; limited: number } | undefined }) {
  if (!counts || (!counts.blocked && !counts.limited)) return null;
  return (
    <span className="flex gap-1.5 px-1 text-[0.6875rem] tabular-nums text-muted-foreground">
      {counts.blocked ? (
        <span className="inline-flex items-center gap-0.5">
          <StatusDot status="blocked" /> {counts.blocked}
        </span>
      ) : null}
      {counts.limited ? (
        <span className="inline-flex items-center gap-0.5">
          <StatusDot status="limited" /> {counts.limited}
        </span>
      ) : null}
    </span>
  );
}

function DraftList({ drafts }: { drafts: PlanningDraft[] }) {
  return (
    <Card variant="plain" size="flush" className="border-border">
      <div className="p-4 pb-1">
        <SectionHeader
          title="Entwürfe"
          size="sm"
          description="Nur für die Planung sichtbar – vormerken oder ansetzen im Editor."
        />
      </div>
      <ListRowGroup className="px-1 pb-2">
        {drafts.map((draft) => (
          <ListRow
            key={draft.id}
            density="compact"
            leading={<DateBadge date={new Date(draft.start)} />}
            title={draft.title || "Unbenannter Entwurf"}
            description={[
              getCalendarEntryKindLabel(draft.kind),
              draft.allDay ? "ganztägig" : formatIsoTimeInTimeZone(draft.start),
            ].join(" · ")}
            href={`/mitglieder/terminplanung/${draft.id}`}
          />
        ))}
      </ListRowGroup>
    </Card>
  );
}

type DayPanelProps = {
  dayKey: string;
  model: ReturnType<typeof useCalendarModel>;
  events: PlanningEvent[];
  total: number;
  memberById: Map<string, PlanningMember>;
  attendanceFor: (event: PlanningEvent) => Attendance[];
  showHeader: boolean;
};

/** Ein Tag: Termine mit Zusagelage und wer laut Sperrliste fehlt – rechts bzw. im Blatt. */
function DayPanel({
  dayKey,
  model,
  events,
  total,
  memberById,
  attendanceFor,
  showHeader,
}: DayPanelProps) {
  const day = model.dayMap.get(dayKey);
  if (!day) return null;
  const counts = model.countsByDay.get(dayKey) ?? { blocked: 0, limited: 0, preferred: 0 };
  const team = model.teamByDay.get(dayKey) ?? [];
  const blocked = team.filter((entry) => entry.status === "blocked");
  const limited = team.filter((entry) => entry.status === "limited");
  const nameOf = (id: string) => memberById.get(id)?.name ?? "Unbekannt";

  return (
    <div className="space-y-4">
      {showHeader ? (
        <SectionHeader
          title={formatLongDate(day.date)}
          action={<NewEventButtons date={dayKey} />}
          className="flex-col"
        />
      ) : null}
      <DayChips day={day} />

      <section className="space-y-2">
        <h3 className="text-xs font-medium text-muted-foreground">Termine</h3>
        {events.length ? (
          <div className="-mx-1 space-y-1">
            {events.map((event) => (
              <EventSummary key={event.id} event={event} attendance={attendanceFor(event)} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Noch nichts geplant.</p>
        )}
      </section>

      <section className="space-y-2 border-t border-border pt-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-xs font-medium text-muted-foreground">Wer kann?</h3>
          <AvailabilityBar
            total={total}
            blocked={counts.blocked}
            limited={counts.limited}
            className="w-32"
          />
        </div>
        {blocked.length || limited.length ? (
          <div className="space-y-2">
            <NameGroup
              status="blocked"
              title="Können nicht"
              entries={blocked.map((entry) => ({
                id: entry.userId,
                name: nameOf(entry.userId),
                note: entry.reason,
              }))}
            />
            <NameGroup
              status="limited"
              title="Eingeschränkt"
              entries={limited.map((entry) => ({
                id: entry.userId,
                name: nameOf(entry.userId),
                note: entry.reason,
              }))}
            />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Laut Sperrliste können alle.</p>
        )}
        <StatusLegend statuses={["preferred", "limited", "blocked"]} />
      </section>
    </div>
  );
}

function NameGroup({
  status,
  title,
  entries,
}: {
  status: "blocked" | "limited";
  title: string;
  entries: { id: string; name: string; note: string | null }[];
}) {
  if (!entries.length) return null;
  return (
    <div className="flex flex-wrap items-start gap-1.5">
      <span className="inline-flex w-full items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <StatusDot status={status} /> {title} · {entries.length}
      </span>
      {entries.map((entry) => (
        <span
          key={entry.id}
          className={cn(
            "rounded-md px-2 py-0.5 text-xs",
            status === "blocked"
              ? "bg-destructive/15 text-destructive"
              : "bg-warning/20 text-warning",
          )}
        >
          <span className="font-medium">{entry.name}</span>
          {entry.note ? <span className="text-foreground/70"> – {entry.note}</span> : null}
        </span>
      ))}
    </div>
  );
}

function StatusChip({ event }: { event: PlanningEvent }) {
  if (event.status !== "TENTATIVE") return null;
  return (
    <span className="shrink-0 rounded-full bg-warning/20 px-1.5 py-0.5 text-[0.625rem] font-medium text-warning">
      vorgemerkt
    </span>
  );
}

/** Kompakte Terminzeile im Tagesblatt: Titel, Zeit, wie viele können. */
function EventSummary({ event, attendance }: { event: PlanningEvent; attendance: Attendance[] }) {
  const blocked = attendance.filter((entry) => entry.answer === "blocked").length;
  const limited = attendance.filter((entry) => entry.answer === "limited").length;
  return (
    <Link
      href={event.href ?? "#"}
      className="flex items-center gap-3 rounded-md px-1 py-2 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span
        aria-hidden
        className={cn(
          "h-9 w-1 shrink-0 rounded-full",
          event.kind === "REHEARSAL" ? "bg-info" : "bg-primary",
        )}
      />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-sm font-medium">{event.title}</span>
          <StatusChip event={event} />
        </span>
        <span className="block truncate text-xs text-muted-foreground">
          {[getCalendarEntryKindLabel(event.kind), formatWhen(event), event.location]
            .filter(Boolean)
            .join(" · ")}
        </span>
      </span>
      <span className="w-20 shrink-0">
        <AvailabilityBar total={attendance.length} blocked={blocked} limited={limited} />
      </span>
    </Link>
  );
}

function EventList({
  events,
  todayKey,
  attendanceFor,
}: {
  events: PlanningEvent[];
  todayKey: string;
  attendanceFor: (event: PlanningEvent) => Attendance[];
}) {
  const [showPast, setShowPast] = useState(false);
  const groups = useMemo(() => {
    const byMonth = new Map<string, PlanningEvent[]>();
    for (const event of events) {
      if (!showPast && lastDayOf(event) < todayKey) continue;
      const label = MONTH.format(new Date(event.start));
      const list = byMonth.get(label) ?? [];
      list.push(event);
      byMonth.set(label, list);
    }
    return [...byMonth.entries()];
  }, [events, showPast, todayKey]);

  return (
    <div className="space-y-4">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="-ml-2"
        onClick={() => setShowPast((value) => !value)}
      >
        {showPast ? "Vergangene ausblenden" : "Vergangene zeigen"}
      </Button>
      {groups.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          Keine anstehenden Termine.
        </p>
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
                  past={lastDayOf(event) < todayKey}
                />
              ))}
            </Card>
          </section>
        ))
      )}
    </div>
  );
}

const AVAILABLE_PREVIEW = 8;

function EventRow({
  event,
  attendance,
  past,
}: {
  event: PlanningEvent;
  attendance: Attendance[];
  past: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const blocked = attendance.filter((entry) => entry.answer === "blocked");
  const limited = attendance.filter((entry) => entry.answer === "limited");
  const available = attendance
    .filter((entry) => entry.answer === "available")
    .sort((a, b) => Number(b.preferred) - Number(a.preferred));

  return (
    <div className={cn("space-y-2 p-3 sm:p-4", past && "opacity-60")}>
      <div className="flex items-start gap-3">
        <DateBadge date={new Date(event.start)} tone="primary" />
        <div className="min-w-0 flex-1 space-y-0.5">
          <span className="flex items-center gap-1.5">
            <Link
              href={event.href ?? "#"}
              className="truncate text-sm font-semibold hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {event.title}
            </Link>
            <StatusChip event={event} />
          </span>
          <p className="truncate text-xs text-muted-foreground">
            {[
              getCalendarEntryKindLabel(event.kind),
              formatWhen(event),
              event.location,
              event.invitedIds ? `${event.invitedIds.length} eingeladen` : "für alle",
            ]
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
            showCount={false}
          />
        </div>
      </div>

      {blocked.length || limited.length || available.length ? (
        <div className="space-y-2 sm:pl-14">
          <AttendanceGroup status="blocked" title="Können nicht" entries={blocked} />
          <AttendanceGroup status="limited" title="Eingeschränkt" entries={limited} />
          {expanded ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="inline-flex w-full items-center gap-1.5 text-xs font-medium text-muted-foreground sm:w-auto">
                <StatusDot status="preferred" /> Können · {available.length}
              </span>
              {available.map((entry) => (
                <span
                  key={entry.memberId}
                  className={cn(
                    "rounded-full px-2 py-0.5 text-xs",
                    entry.preferred ? "bg-success/15 text-success" : "bg-muted text-foreground/80",
                  )}
                >
                  {entry.name}
                </span>
              ))}
            </div>
          ) : null}
          {available.length ? (
            <Button
              type="button"
              variant="ghost"
              size="xs"
              className="-ml-2"
              onClick={() => setExpanded((value) => !value)}
            >
              {expanded
                ? "Weniger"
                : available.length > AVAILABLE_PREVIEW
                  ? `${available.length} können – anzeigen`
                  : `Wer kann (${available.length})`}
            </Button>
          ) : null}
        </div>
      ) : null}
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
