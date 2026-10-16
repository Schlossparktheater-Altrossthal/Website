"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import type { CalendarEventKind } from "@prisma/client";

import {
  CalendarCheckIcon,
  DramaIcon,
  UsersIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ListIcon,
  PrinterIcon,
  SearchIcon,
} from "@/components/ui/action-icons";
import { AvailabilityBar } from "@/components/ui/availability-bar";
import { StatusDot } from "@/components/ui/availability-status";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { AsyncButton } from "@/components/ui/async-button";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MonthGrid } from "@/components/ui/month-grid";
import { PLANNING_PATH, rememberPlanningHref } from "./return-href";
import { MonthSwitcher } from "@/components/ui/month-switcher";
import { SectionHeader } from "@/components/ui/section-header";
import { NameSortToggle } from "@/components/members/name-sort-toggle";
import { SegmentedControl } from "@/components/ui/segmented-control";
import type { NameSortOrder } from "@/lib/names";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import {
  expandEntryDayKeys,
  getCalendarEntryKindLabel,
  type CalendarEntry,
} from "@/lib/calendar/event-kinds";
import { DEFAULT_TIME_ZONE, formatIsoTimeInTimeZone } from "@/lib/date-time";
import type { FinalWeekRange } from "@/lib/sperrliste/day-tiers";
import { toDayKey } from "@/lib/sperrliste/day-tiers";
import { buildScheduleMonths } from "@/lib/calendar/schedule-pdf";
import { downloadPdf } from "@/lib/pdf/download";
import { cn } from "@/lib/utils";
import type { HolidayRange } from "@/types/holidays";

import { CalendarLegend, DayCellDetails, DayChips, formatLongDate } from "../sperrliste/day-parts";
import type { TeamEntry } from "../sperrliste/types";
import { getBaseDayState, useCalendarModel } from "../sperrliste/use-calendar-model";
import { NewEventButton, NewEventButtons, useCreateDraft } from "./new-event";
import { PeopleWeekView } from "./people-week-view";
import { ScenePlanView, type ScenePlanData } from "./scene-plan-view";
import { ReadinessSummary, SceneReadinessList } from "@/components/calendar/scene-readiness-list";
import type { AudienceContext } from "@/lib/calendar/audience";
import { computeSceneReadiness, type Absence } from "@/lib/calendar/scene-readiness";
import { groupMembers } from "@/lib/calendar/member-groups";
import { computeWeekLoad, HEAVY_WEEK_COUNT, type PersonLoad } from "@/lib/calendar/week-load";

export type PlanningSceneContext = Pick<
  AudienceContext,
  "scenes" | "castings" | "characters" | "members" | "departments"
>;

/** `roles`: Schauspielrollen in der aktiven Produktion (leer ohne Besetzung). */
export type PlanningMember = { id: string; name: string; roles: string[] };

export type PlanningAvailability = {
  userId: string;
  date: string;
  status: "blocked" | "limited" | "preferred";
  reason: string | null;
};

export type PlanningEvent = CalendarEntry & {
  /** Abgesagte bleiben durchgestrichen sichtbar, zählen aber nirgends mit. */
  status: "TENTATIVE" | "SCHEDULED" | "CANCELLED";
  /** Eingeladene; null = Termin für alle. */
  invitedIds: string[] | null;
  declinedIds: string[];
  /** Kurzfassung der Beteiligten, z. B. „Ensemble · Kostüm“ (für Liste/PDF). */
  who?: string | null;
  /** Geplante Szenen, z. B. „1.2, 1.4“. */
  scenes?: string | null;
};

export type PlanningDraft = {
  id: string;
  title: string;
  kind: CalendarEventKind;
  start: string;
  allDay: boolean;
};

type Filter = "all" | "rehearsals" | "events";
type View = "calendar" | "list" | "scenes" | "people";
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
  nameSort: NameSortOrder;
  availability: PlanningAvailability[];
  holidays: HolidayRange[];
  finalWeek: FinalWeekRange;
  preferredWeekdays: number[];
  exceptionWeekdays: number[];
  initialFilter: Filter;
  initialView: View;
  /** Gewählter Tag (YYYY-MM-DD) aus der URL, sonst heute. */
  initialDay: string | null;
  /** Szenen-Plan der Produktion; null ohne Szenen. */
  scenePlan: ScenePlanData | null;
  /** Szenen und Besetzung der Produktion; null ohne Szenen. */
  sceneContext: PlanningSceneContext | null;
  /** Titel der Produktion für den Kopf der Druckansicht. */
  productionTitle: string | null;
};

export function EventPlanningClient({
  events,
  drafts,
  members,
  nameSort,
  availability,
  holidays,
  finalWeek,
  preferredWeekdays,
  exceptionWeekdays,
  initialFilter,
  initialView,
  initialDay,
  scenePlan,
  sceneContext,
  productionTitle,
}: EventPlanningProps) {
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const todayKey = toDayKey(new Date());
  const [view, setView] = useState<View>(initialView);
  const [filter, setFilter] = useState<Filter>(initialFilter);
  const [month, setMonth] = useState(() => {
    const [year, monthIndex] = (initialDay ?? todayKey).split("-").map(Number);
    return new Date(year, monthIndex - 1, 1);
  });
  const [selectedKey, setSelectedKey] = useState(initialDay ?? todayKey);

  // Ansicht, Filter und Tag in der Adresse halten, damit Zurück und „Fertig“ im Editor
  // wieder genau hier landen (statt immer im Kalender von heute).
  useEffect(() => {
    const params = new URLSearchParams();
    if (view === "list") params.set("ansicht", "liste");
    if (view === "scenes") params.set("ansicht", "szenen");
    if (view === "people") params.set("ansicht", "personen");
    if (filter !== "all") params.set("art", filter === "rehearsals" ? "proben" : "termine");
    if (selectedKey !== todayKey) params.set("tag", selectedKey);
    const search = params.toString();
    const href = search ? `${PLANNING_PATH}?${search}` : PLANNING_PATH;
    window.history.replaceState(window.history.state, "", href);
    rememberPlanningHref(href);
  }, [view, filter, selectedKey, todayKey]);
  const [sheetOpen, setSheetOpen] = useState(false);

  const activeEvents = useMemo(
    () => events.filter((event) => event.status !== "CANCELLED"),
    [events],
  );
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
    if (event.status === "CANCELLED") return [];
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

  // Ganze Kalenderwoche des gewählten Tags – unabhängig vom Filter Proben/Termine.
  const weekLoad = useMemo(
    () =>
      computeWeekLoad(
        activeEvents.flatMap((event) =>
          event.invitedIds
            ? [
                {
                  id: event.id,
                  dayKey: event.dayKey,
                  start: event.start,
                  end: event.end,
                  userIds: event.invitedIds.filter((id) => !event.declinedIds.includes(id)),
                },
              ]
            : [],
        ),
        selectedKey,
      ),
    [activeEvents, selectedKey],
  );

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

  // Aus dem Szenen-Plan in den Kalender springen.
  const showDayInCalendar = (key: string) => {
    const [year, monthIndex] = key.split("-").map(Number);
    setMonth(new Date(year, monthIndex - 1, 1));
    setView("calendar");
    openDay(key);
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
      sceneContext={sceneContext}
      weekLoad={weekLoad}
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
            ...(scenePlan
              ? [
                  {
                    value: "scenes" as const,
                    label: (
                      <>
                        <DramaIcon className="h-4 w-4" aria-hidden />
                        <span className="hidden sm:inline">Szenen</span>
                      </>
                    ),
                    ariaLabel: "Szenen",
                  },
                ]
              : []),
            {
              value: "people",
              label: (
                <>
                  <UsersIcon className="h-4 w-4" aria-hidden />
                  <span className="hidden sm:inline">Personen</span>
                </>
              ),
              ariaLabel: "Personen",
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
        {view === "calendar" || view === "people" ? <NameSortToggle value={nameSort} /> : null}
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
              onMonthChange={changeMonth}
              getDayState={(key) =>
                getBaseDayState(model.dayMap.get(key), model.entriesByDay.get(key))
              }
              renderDetails={(key) =>
                isDesktop ? (
                  <PlanningCellDetails
                    day={model.dayMap.get(key)}
                    entries={(model.entriesByDay.get(key) ?? []) as PlanningEvent[]}
                  />
                ) : (
                  <DayCellDetails
                    day={model.dayMap.get(key)}
                    entries={model.entriesByDay.get(key)}
                  />
                )
              }
              renderHeaderAside={(key) => <DayCellCounts counts={model.countsByDay.get(key)} />}
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
      ) : view === "people" ? (
        <PeopleWeekView
          members={members}
          availability={availability}
          events={activeEvents}
          initialDay={selectedKey}
          onOpenDay={showDayInCalendar}
        />
      ) : view === "scenes" && scenePlan ? (
        <ScenePlanView data={scenePlan} todayKey={todayKey} onOpenDay={showDayInCalendar} />
      ) : (
        <EventList
          events={visibleEvents}
          todayKey={todayKey}
          attendanceFor={attendanceFor}
          productionTitle={productionTitle}
          holidays={holidays}
        />
      )}

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

/** „Szenenprobe 2.5, 2.6, 2.7“ → „Sz. 2.5, 2.6, 2.7“ – mehr Platz im Tagesfeld. */
function shortTitle(title: string) {
  return title.replace(/^Szenenprobe\s*/i, "Sz. ");
}

/**
 * Tagesfeld am Desktop: Uhrzeit und (gekürzter) Titel zweizeilig statt abgeschnitten, darunter
 * Punkte mit der Zahl, wie viele laut Sperrliste nicht bzw. eingeschränkt können.
 */
function PlanningCellDetails({
  day,
  entries,
}: {
  day: ReturnType<ReturnType<typeof useCalendarModel>["dayMap"]["get"]>;
  entries: PlanningEvent[];
}) {
  const holiday = day?.holidays.find((entry) => entry.category === "publicHoliday");
  return (
    <span className="flex min-w-0 flex-col gap-0.5">
      {entries.slice(0, 2).map((entry) => (
        <span
          key={entry.id}
          className={cn(
            "min-w-0 rounded border-l-2 px-1 py-0.5 text-[0.6875rem] leading-tight",
            entry.source === "rehearsal"
              ? "border-info bg-info/10"
              : "border-primary bg-primary/10",
            entry.status === "TENTATIVE" && "border-dashed",
            entry.status === "CANCELLED" &&
              "border-muted-foreground bg-muted text-muted-foreground line-through",
          )}
        >
          {!entry.allDay ? (
            <span className="block tabular-nums text-muted-foreground">
              {formatIsoTimeInTimeZone(entry.start)}
            </span>
          ) : null}
          <span className="line-clamp-2 break-words font-medium">{shortTitle(entry.title)}</span>
        </span>
      ))}
      {entries.length > 2 ? (
        <span className="px-1 text-[0.6875rem] text-muted-foreground">
          +{entries.length - 2} weitere
        </span>
      ) : null}
      {holiday ? (
        <span className="truncate px-1 text-[0.6875rem] text-warning">{holiday.title}</span>
      ) : null}
    </span>
  );
}

/** Kurzform in der Tageszelle: wie viele an dem Tag nicht bzw. eingeschränkt können. */
function DayCellCounts({ counts }: { counts: { blocked: number; limited: number } | undefined }) {
  if (!counts || (!counts.blocked && !counts.limited)) return null;
  return (
    <span className="flex gap-1.5 text-[0.6875rem] tabular-nums text-muted-foreground">
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

// Wochentagskürzel und Datum getrennt formatieren.
//
// Die Kurzform des Wochentags trägt ihren Punkt je nach ICU-Build: Node liefert „So., 27.09.“,
// WebKit/Safari „So. 27.09.“. Das frühere gemeinsame Format mit `.replace(".,", "")` erzeugte
// auf dem Server „So 27.09.“ und im Browser „So. 27.09.“ – React brach die Hydration ab
// (gemessen 2026-09-29 mit `pnpm ui:check /mitglieder/terminplanung --browser webkit`).
const DRAFT_WEEKDAY = new Intl.DateTimeFormat("de-DE", {
  weekday: "short",
  timeZone: DEFAULT_TIME_ZONE,
});
const DRAFT_DAY_MONTH = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "2-digit",
  timeZone: DEFAULT_TIME_ZONE,
});

/** „So. 27.09.“ – der Punkt wird selbst gesetzt, damit beide Seiten dasselbe ausgeben. */
function formatDraftDate(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value;
  const weekday = DRAFT_WEEKDAY.format(date).replace(/\.$/, "");
  return `${weekday}. ${DRAFT_DAY_MONTH.format(date)}`;
}

/** Ab so vielen Entwürfen startet die Liste eingeklappt. */
const DRAFTS_COLLAPSED_FROM = 4;

/** Entwürfe als dichte, einklappbare Liste; lange Listen scrollen innerhalb der Karte. */
function DraftList({ drafts }: { drafts: PlanningDraft[] }) {
  const [open, setOpen] = useState(drafts.length < DRAFTS_COLLAPSED_FROM);
  return (
    <Card variant="plain" size="flush" className="border-border">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls="draft-list"
        className="flex min-h-11 w-full items-center gap-2 rounded-lg px-4 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="text-sm font-semibold">Entwürfe</span>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs tabular-nums text-muted-foreground">
          {drafts.length}
        </span>
        <span className="hidden truncate text-xs text-muted-foreground sm:inline">
          nur für die Planung sichtbar
        </span>
        <ChevronDownIcon
          className={cn(
            "ml-auto h-4 w-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
          aria-hidden
        />
      </button>
      {open ? (
        <ul
          id="draft-list"
          className="max-h-64 divide-y divide-border overflow-y-auto border-t border-border"
        >
          {drafts.map((draft) => (
            <li key={draft.id}>
              <Link
                href={`/mitglieder/terminplanung/${draft.id}`}
                className="flex min-h-11 items-center gap-3 px-4 py-2 text-sm transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
              >
                <span
                  aria-hidden
                  className={cn(
                    "h-6 w-1 shrink-0 rounded-full",
                    draft.kind === "REHEARSAL" ? "bg-info" : "bg-primary",
                  )}
                />
                <span className="w-24 shrink-0 whitespace-nowrap tabular-nums text-muted-foreground sm:w-36">
                  {formatDraftDate(draft.start)}
                  {draft.allDay ? null : (
                    <span className="block text-xs sm:inline sm:pl-1.5">
                      {formatIsoTimeInTimeZone(draft.start)}
                    </span>
                  )}
                </span>
                <span className="min-w-0 flex-1 truncate font-medium">
                  {draft.title || "Unbenannter Entwurf"}
                </span>
                <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
                  {getCalendarEntryKindLabel(draft.kind)}
                </span>
                <ChevronRightIcon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
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
  sceneContext: PlanningSceneContext | null;
  weekLoad: Record<string, PersonLoad>;
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
  sceneContext,
  weekLoad,
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
          <div className="-mx-1 divide-y divide-border">
            {events.map((event) => (
              <EventSummary key={event.id} event={event} attendance={attendanceFor(event)} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Noch nichts geplant.</p>
        )}
      </section>

      {sceneContext ? (
        <PlayableScenes key={dayKey} dayKey={dayKey} team={team} context={sceneContext} />
      ) : null}

      <section className="space-y-2 border-t border-border pt-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-xs font-medium text-muted-foreground">
            {blocked.length || limited.length
              ? `Fehlt heute (${blocked.length + limited.length})`
              : "Wer kann?"}
          </h3>
          <AvailabilityBar
            total={total}
            blocked={counts.blocked}
            limited={counts.limited}
            className="w-32"
          />
        </div>
        {blocked.length || limited.length ? (
          <AbsentList
            entries={[...blocked, ...limited].map((entry) => ({
              userId: entry.userId,
              name: nameOf(entry.userId),
              status: entry.status as "blocked" | "limited",
              note: entry.reason,
            }))}
            context={sceneContext}
            memberRoles={(id) => memberById.get(id)?.roles ?? []}
          />
        ) : (
          <p className="text-sm text-muted-foreground">Laut Sperrliste können alle.</p>
        )}
      </section>

      <WeekLoadSection weekLoad={weekLoad} memberById={memberById} />
    </div>
  );
}

/** Wer in der Woche schon wie oft eingeladen ist – damit niemand jeden Tag kommen muss. */
function WeekLoadSection({
  weekLoad,
  memberById,
}: {
  weekLoad: Record<string, PersonLoad>;
  memberById: Map<string, PlanningMember>;
}) {
  const rows = Object.entries(weekLoad)
    .flatMap(([userId, load]) => {
      const member = memberById.get(userId);
      return member ? [{ ...load, userId, name: member.name }] : [];
    })
    .sort((a, b) => b.count - a.count || b.minutes - a.minutes || a.name.localeCompare(b.name));
  if (!rows.length) return null;
  const heavy = rows.filter((row) => row.count >= HEAVY_WEEK_COUNT).length;
  return (
    <details className="group border-t border-border pt-3">
      <summary className="cursor-pointer list-none text-xs font-medium text-muted-foreground hover:text-foreground">
        <span className="inline-block transition-transform group-open:rotate-90">▸</span> Diese
        Woche eingeladen ({rows.length})
        {heavy ? <span className="text-warning"> · {heavy} oft</span> : null}
      </summary>
      <ul className="mt-2 flex flex-wrap gap-1.5">
        {rows.map((row) => (
          <li
            key={row.userId}
            className={cn(
              "rounded-full px-2.5 py-1 text-xs tabular-nums",
              row.count >= HEAVY_WEEK_COUNT
                ? "bg-warning/15 text-warning"
                : "bg-muted text-muted-foreground",
            )}
            title={`${row.name}: ${row.count} Termine, ${Math.round(row.minutes / 60)} h`}
          >
            <span className="font-medium text-foreground">{row.name.split(" ")[0]}</span>{" "}
            {row.count}×
          </li>
        ))}
      </ul>
    </details>
  );
}

/** Szenennummer aus dem Label („Sz. 2.5 Titel“ → „2.5“). */
function sceneNumber(label: string) {
  return label.split(" ")[1] ?? label;
}

/** Welche Szenen an dem Tag laut Sperrliste spielbar sind – und daraus direkt eine Probe. */
function PlayableScenes({
  dayKey,
  team,
  context,
}: {
  dayKey: string;
  team: TeamEntry[];
  context: PlanningSceneContext;
}) {
  const { create, pending } = useCreateDraft();
  const [selected, setSelected] = useState<string[]>([]);
  const readiness = useMemo(() => {
    const absences: Partial<Record<string, Absence>> = {};
    for (const entry of team) {
      if (entry.status === "blocked" || entry.status === "limited")
        absences[entry.userId] = { kind: entry.status, reason: entry.reason };
    }
    return computeSceneReadiness(context, absences);
  }, [team, context]);

  const createWithScenes = () => {
    const labels = context.scenes
      .filter((scene) => selected.includes(scene.id))
      .map((scene) => sceneNumber(scene.label));
    create("REHEARSAL", dayKey, {
      title: `Szenenprobe ${labels.join(", ")}`,
      audience: {
        rules: selected.map((id) => ({ type: "SCENE", targetId: id, level: "REQUIRED" })),
        overrides: [],
      },
    });
  };

  const durations = useMemo(
    () => new Map(context.scenes.map((scene) => [scene.id, scene.durationMinutes])),
    [context.scenes],
  );

  return (
    <section className="space-y-2 border-t border-border pt-4">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <h3 className="text-xs font-medium text-muted-foreground">Probbar</h3>
        <p className="text-xs text-muted-foreground">
          <ReadinessSummary entries={readiness} />
        </p>
      </div>
      <SceneReadinessList
        entries={readiness}
        durations={durations}
        selectedIds={selected}
        onAdd={(id) => setSelected((current) => [...current, id])}
        onRemove={(id) => setSelected((current) => current.filter((entry) => entry !== id))}
      />
      {selected.length ? (
        <Button
          type="button"
          className="sticky bottom-2 z-10 h-11 w-full shadow-md"
          disabled={pending}
          onClick={createWithScenes}
        >
          {pending
            ? "Legt an …"
            : `Probe mit ${selected.length} ${selected.length === 1 ? "Szene" : "Szenen"} anlegen`}
        </Button>
      ) : (
        <p className="text-xs text-muted-foreground">
          Szenen antippen, um daraus eine Probe anzulegen.
        </p>
      )}
    </section>
  );
}

/**
 * Wer an dem Tag fehlt oder eingeschränkt ist – gruppiert nach Zugehörigkeit (Besetzung mit
 * Rollen, je Gewerk, Weitere), eine Zeile pro Person.
 */
function AbsentList({
  entries,
  context,
  memberRoles,
}: {
  entries: { userId: string; name: string; status: "blocked" | "limited"; note: string | null }[];
  context: PlanningSceneContext | null;
  /** Funktionen in der Produktion (Regie, Technik …) für Personen ohne Rolle. */
  memberRoles: (userId: string) => string[];
}) {
  const groups = groupMembers(entries, {
    castings: context?.castings ?? [],
    characters: context?.characters ?? [],
    departments: context?.departments ?? [],
  });
  return (
    <div className="space-y-2">
      {groups.map((group) => (
        <section key={group.key}>
          <h4 className="text-[0.6875rem] font-semibold uppercase tracking-wide text-muted-foreground">
            {group.label} · {group.entries.length}
          </h4>
          <ul className="mt-0.5 space-y-0.5">
            {group.entries.map((entry) => {
              const tags = entry.roles.length ? entry.roles : memberRoles(entry.userId);
              return (
                <li key={entry.userId} className="flex items-baseline gap-1.5 text-sm">
                  <StatusDot status={entry.status} className="translate-y-[-1px]" />
                  <span className="min-w-0">
                    <span className="font-medium">{entry.name}</span>
                    {tags.length ? (
                      <span className="text-muted-foreground"> ({tags.join(", ")})</span>
                    ) : null}
                    {entry.note ? (
                      <span className="text-xs text-muted-foreground"> – {entry.note}</span>
                    ) : entry.status === "limited" ? (
                      <span className="text-xs text-warning"> – eingeschränkt</span>
                    ) : null}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

function StatusChip({ event }: { event: PlanningEvent }) {
  if (event.status === "CANCELLED") {
    return (
      <span className="shrink-0 rounded-full bg-destructive/15 px-1.5 py-0.5 text-[0.625rem] font-medium text-destructive">
        abgesagt
      </span>
    );
  }
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
          <span
            className={cn(
              "truncate text-sm font-medium",
              event.status === "CANCELLED" && "text-muted-foreground line-through",
            )}
          >
            {event.title}
          </span>
          <StatusChip event={event} />
        </span>
        <span className="block truncate text-xs text-muted-foreground">
          {[getCalendarEntryKindLabel(event.kind), formatWhen(event), event.location]
            .filter(Boolean)
            .join(" · ")}
        </span>
      </span>
      {event.status !== "CANCELLED" ? (
        <span className="w-20 shrink-0">
          <AvailabilityBar total={attendance.length} blocked={blocked} limited={limited} />
        </span>
      ) : null}
    </Link>
  );
}

const LIST_DAY = new Intl.DateTimeFormat("de-DE", {
  weekday: "short",
  day: "numeric",
  month: "numeric",
  timeZone: "Europe/Berlin",
});

/** Montag der Kalenderwoche als Schlüssel – trennt die Liste nach Wochen wie im Probenplan. */
function weekKeyOf(dayKey: string) {
  const date = new Date(`${dayKey}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return date.toISOString().slice(0, 10);
}

function listDate(event: PlanningEvent) {
  const days = expandEntryDayKeys(event);
  const first = LIST_DAY.format(new Date(`${days[0]}T12:00:00Z`)).replace(".,", ",");
  if (days.length < 2) return first;
  const last = LIST_DAY.format(new Date(`${days.at(-1)}T12:00:00Z`)).replace(".,", ",");
  return `${first} – ${last}`;
}

function listTime(event: PlanningEvent) {
  if (event.allDay) return "";
  const start = formatIsoTimeInTimeZone(event.start).replace(/:00$/, "");
  if (!event.end) return start;
  return `${start}–${formatIsoTimeInTimeZone(event.end).replace(/:00$/, "")}`;
}

/** Erste Zeile der Beschreibung – wie die Zusätze im gedruckten Probenplan. */
function firstLine(text: string | null) {
  return (
    text
      ?.split(/\r?\n/)
      .find((line) => line.trim())
      ?.trim() ?? ""
  );
}

/**
 * Kompakte Terminliste: eine Zeile pro Termin, Wochen durch Abstand getrennt,
 * wer fehlt steht als Namen dahinter. Druckbar als PDF.
 */
function EventList({
  events,
  todayKey,
  attendanceFor,
  productionTitle,
  holidays,
}: {
  events: PlanningEvent[];
  todayKey: string;
  attendanceFor: (event: PlanningEvent) => Attendance[];
  productionTitle: string | null;
  holidays: HolidayRange[];
}) {
  const [showPast, setShowPast] = useState(false);
  const [showAbsences, setShowAbsences] = useState(true);
  const groups = useMemo(() => {
    const byMonth = new Map<string, PlanningEvent[][]>();
    let lastWeek = "";
    for (const event of events) {
      if (!showPast && lastDayOf(event) < todayKey) continue;
      const label = MONTH.format(new Date(event.start));
      const weeks = byMonth.get(label) ?? [];
      const week = weekKeyOf(event.dayKey);
      if (!weeks.length || week !== lastWeek) weeks.push([]);
      weeks.at(-1)!.push(event);
      lastWeek = week;
      byMonth.set(label, weeks);
    }
    return [...byMonth.entries()];
  }, [events, showPast, todayKey]);
  const [exporting, setExporting] = useState(false);

  const exportPdf = async (mode: PdfMode) => {
    setExporting(true);
    try {
      const visible = groups.flatMap(([, weeks]) => weeks.flat());
      await downloadPdf(
        "terminliste",
        {
          mode,
          generatedAt: new Date().toISOString(),
          production: productionTitle,
          months: buildScheduleMonths(
            visible.map((event) => ({
              dayKey: event.dayKey,
              lastDayKey: lastDayOf(event),
              event: pdfEvent(
                event,
                mode === "availability" ? attendanceFor(event) : [],
                showAbsences,
              ),
            })),
            holidays,
          ),
        },
        "termine.pdf",
      );
      toast.success("PDF heruntergeladen", { duration: 3000 });
    } catch (error) {
      console.error("[terminplanung:pdf]", error);
      toast.error("PDF konnte nicht erstellt werden", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <Button type="button" variant="ghost" size="sm" onClick={() => setShowPast((v) => !v)}>
          {showPast ? "Vergangene ausblenden" : "Vergangene zeigen"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-pressed={showAbsences}
          onClick={() => setShowAbsences((v) => !v)}
        >
          {showAbsences ? "Abwesenheiten ausblenden" : "Abwesenheiten zeigen"}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <AsyncButton
              type="button"
              variant="outline"
              size="sm"
              className="ml-auto h-10"
              isLoading={exporting}
              loadingText="PDF wird erstellt…"
              disabled={!groups.length}
            >
              <PrinterIcon className="h-4 w-4" aria-hidden /> PDF
              <ChevronDownIcon className="h-4 w-4" aria-hidden />
            </AsyncButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {PDF_MODES.map((entry) => (
              <DropdownMenuItem key={entry.mode} onSelect={() => exportPdf(entry.mode)}>
                <span className="flex flex-col">
                  <span>{entry.label}</span>
                  <span className="text-xs text-muted-foreground">{entry.hint}</span>
                </span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {groups.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          Keine anstehenden Termine.
        </p>
      ) : (
        <Card
          variant="plain"
          size="flush"
          className="print-area border-border px-3 py-2 sm:px-4 print:rounded-none print:border-0 print:bg-white print:text-black print:shadow-none"
        >
          <header className="hidden pb-3 print:block">
            <p className="text-base font-semibold">
              Termine{productionTitle ? ` – ${productionTitle}` : ""}
            </p>
            <p className="text-xs" suppressHydrationWarning>
              Stand {formatLongDate(new Date())}
            </p>
          </header>
          {groups.map(([month, weeks]) => (
            <section key={month} className="pb-2">
              <h2 className="sticky top-0 z-10 break-after-avoid bg-card py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground print:static print:text-black">
                {month}
              </h2>
              <div className="space-y-2">
                {weeks.map((week) => (
                  <ul key={week[0].id} className="break-inside-avoid">
                    {week.map((event) => (
                      <EventRow
                        key={event.id}
                        event={event}
                        attendance={attendanceFor(event)}
                        past={lastDayOf(event) < todayKey}
                        showAbsences={showAbsences}
                      />
                    ))}
                  </ul>
                ))}
              </div>
            </section>
          ))}
        </Card>
      )}
    </div>
  );
}

function absenceText(entries: Attendance[]) {
  return entries
    .map((entry) =>
      entry.days.length ? `${entry.name} (${entry.days.map(weekdayOf).join(", ")})` : entry.name,
    )
    .join(", ");
}

type PdfMode = "plan" | "notes" | "poster" | "availability";

const PDF_MODES: { mode: PdfMode; label: string; hint: string }[] = [
  { mode: "plan", label: "Ablaufplan", hint: "Szenen, Wer, Ort – ohne Sperrliste" },
  { mode: "notes", label: "Ablaufplan mit Notizspalte", hint: "Platz zum Mitschreiben" },
  { mode: "poster", label: "Aushang", hint: "zweispaltig, viele Monate auf einer Seite" },
  {
    mode: "availability",
    label: "Mit Abwesenheiten",
    hint: "quer, wer fehlt und wie viele können",
  },
];

/** Eine Zeile der Terminliste für die PDF-Vorlage „terminliste“. */
function pdfEvent(event: PlanningEvent, attendance: Attendance[], showAbsences: boolean) {
  const blocked = attendance.filter((entry) => entry.answer === "blocked");
  const limited = attendance.filter((entry) => entry.answer === "limited");
  return {
    type: "event" as const,
    date: listDate(event),
    time: listTime(event) || (event.allDay ? "ganztägig" : null),
    title: event.title,
    note: firstLine(event.description) || null,
    location: event.location || null,
    scenes: event.scenes ?? null,
    who: event.who ?? null,
    rehearsal: event.kind === "REHEARSAL",
    status:
      event.status === "CANCELLED" || event.status === "TENTATIVE" ? event.status : "CONFIRMED",
    blocked: showAbsences && blocked.length ? `fehlen: ${absenceText(blocked)}` : null,
    limited: showAbsences && limited.length ? `eingeschränkt: ${absenceText(limited)}` : null,
    attendance: attendance.length
      ? `${attendance.length - blocked.length}/${attendance.length}`
      : null,
  };
}

function EventRow({
  event,
  attendance,
  past,
  showAbsences,
}: {
  event: PlanningEvent;
  attendance: Attendance[];
  past: boolean;
  showAbsences: boolean;
}) {
  const cancelled = event.status === "CANCELLED";
  const blocked = attendance.filter((entry) => entry.answer === "blocked");
  const limited = attendance.filter((entry) => entry.answer === "limited");
  const available = attendance.length - blocked.length;
  const note = firstLine(event.description);
  const reasons = [...blocked, ...limited]
    .flatMap((entry) => entry.reasons.map((reason) => `${entry.name}: ${reason}`))
    .join("\n");

  return (
    <li className={cn(past && "opacity-60 print:opacity-100")}>
      <Link
        href={event.href ?? "#"}
        className="grid grid-cols-[5.5rem_1fr_auto] items-baseline gap-x-2 rounded px-1 py-0.5 text-sm hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:grid-cols-[6.5rem_4.5rem_1fr_auto] print:grid-cols-[6rem_4.5rem_1fr] print:text-[10pt]"
      >
        <span className="font-semibold tabular-nums">{listDate(event)}</span>
        <span className="col-start-1 row-start-2 text-xs tabular-nums text-muted-foreground sm:col-start-auto sm:row-start-auto sm:text-sm sm:font-semibold sm:text-foreground print:col-start-auto print:row-start-auto print:text-black">
          {listTime(event) || (event.allDay ? "ganztägig" : "")}
        </span>
        <span className="col-start-2 row-span-2 row-start-1 min-w-0 sm:col-start-auto sm:row-span-1 sm:row-start-auto print:col-start-auto print:row-span-1 print:row-start-auto">
          <span className="flex min-w-0 items-baseline gap-1.5">
            <span
              aria-hidden
              className={cn(
                "inline-block h-2 w-2 shrink-0 translate-y-[-1px] rounded-full print:hidden",
                event.kind === "REHEARSAL" ? "bg-info" : "bg-primary",
              )}
            />
            <span
              className={cn(
                "min-w-0",
                event.kind !== "REHEARSAL" && "font-semibold",
                cancelled && "text-muted-foreground line-through",
              )}
            >
              {event.title}
              {note ? (
                <span className="font-normal text-muted-foreground print:text-black">
                  {" "}
                  – {note}
                </span>
              ) : null}
              {event.location ? (
                <span className="font-normal text-muted-foreground print:text-black">
                  {" "}
                  · {event.location}
                </span>
              ) : null}
            </span>
            <StatusChip event={event} />
          </span>
          {showAbsences && !cancelled && (blocked.length || limited.length) ? (
            <span className="block text-xs leading-snug" title={reasons || undefined}>
              {blocked.length ? (
                <span className="text-destructive print:text-black">
                  fehlen: {absenceText(blocked)}
                </span>
              ) : null}
              {blocked.length && limited.length ? (
                <span className="text-muted-foreground"> · </span>
              ) : null}
              {limited.length ? (
                <span className="text-warning print:text-black">
                  eingeschränkt: {absenceText(limited)}
                </span>
              ) : null}
            </span>
          ) : null}
        </span>
        {cancelled ? (
          <span />
        ) : (
          <span
            className={cn(
              "row-span-2 text-right text-xs tabular-nums sm:row-span-1 print:hidden",
              blocked.length ? "text-destructive" : "text-muted-foreground",
            )}
            title={`${available} von ${attendance.length} können`}
          >
            {available}/{attendance.length}
          </span>
        )}
      </Link>
    </li>
  );
}
