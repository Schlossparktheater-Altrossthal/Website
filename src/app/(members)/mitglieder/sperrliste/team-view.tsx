"use client";

import { Fragment, useCallback, useMemo, useState } from "react";

import { CalendarPlusIcon, SearchIcon } from "@/components/ui/action-icons";
import { AvailabilityBar } from "@/components/ui/availability-bar";
import {
  AVAILABILITY_STATUS,
  StatusDot,
  StatusLegend,
  type AvailabilityStatus,
} from "@/components/ui/availability-status";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DateBadge } from "@/components/ui/date-badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { MonthSwitcher } from "@/components/ui/month-switcher";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Switch } from "@/components/ui/switch";
import type { CalendarEntry } from "@/lib/calendar/event-kinds";
import { DAY_TIER_LABELS, type DayInfo } from "@/lib/sperrliste/day-tiers";
import { cn } from "@/lib/utils";

import { CalendarEntryList, CalendarLegend, DayChips, formatLongDate } from "./day-parts";
import { MEMBER_GROUP_LABELS, type MemberGroup, type TeamEntry, type TeamMember } from "./types";
import type { CalendarModel } from "./use-calendar-model";

type GroupFilter = "all" | "actors" | "crew";

const GROUP_ORDER: MemberGroup[] = ["actors", "both", "crew", "other"];
const WEEKDAY_SHORT = new Intl.DateTimeFormat("de-DE", { weekday: "short" });

type TeamViewProps = {
  month: Date;
  onMonthChange: (month: Date) => void;
  model: CalendarModel;
  members: TeamMember[];
  canPlan: boolean;
  readOnly: boolean;
  onCreateEvent: (date: string) => void;
  onEditEvent: (entry: CalendarEntry) => void;
};

function matchesGroup(member: TeamMember, filter: GroupFilter) {
  if (filter === "all") return true;
  if (filter === "actors") return member.group === "actors" || member.group === "both";
  return member.group === "crew" || member.group === "both";
}

function shortName(name: string) {
  const parts = name.split(/\s+/);
  if (parts.length < 2) return name;
  return `${parts[0]} ${parts[parts.length - 1]?.[0] ?? ""}.`;
}

export function TeamView({
  month,
  onMonthChange,
  model,
  members,
  canPlan,
  readOnly,
  onCreateEvent,
  onEditEvent,
}: TeamViewProps) {
  const [groupFilter, setGroupFilter] = useState<GroupFilter>("all");
  const [allDays, setAllDays] = useState(false);
  const [mode, setMode] = useState<"days" | "people">("days");
  const [query, setQuery] = useState("");
  const [openDayKey, setOpenDayKey] = useState<string | null>(null);

  const visibleMembers = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("de-DE");
    return members.filter(
      (member) =>
        matchesGroup(member, groupFilter) &&
        (!needle || member.name.toLocaleLowerCase("de-DE").includes(needle)),
    );
  }, [groupFilter, members, query]);
  const visibleIds = useMemo(() => new Set(visibleMembers.map((m) => m.id)), [visibleMembers]);

  const days = useMemo(
    () => model.monthDays.filter((day) => allDays || day.tier !== "off"),
    [allDays, model.monthDays],
  );

  /** Einträge je Tag, gefiltert auf die sichtbaren Personen. */
  const entriesFor = useCallback(
    (key: string) =>
      (model.teamByDay.get(key) ?? []).filter((entry) => visibleIds.has(entry.userId)),
    [model.teamByDay, visibleIds],
  );

  const now = new Date();
  const isCurrentMonth =
    month.getFullYear() === now.getFullYear() && month.getMonth() === now.getMonth();
  const memberById = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);
  const openDay = openDayKey ? model.dayMap.get(openDayKey) : undefined;

  return (
    <Card variant="plain" size="flush" className="space-y-3 border-border p-3 sm:p-4">
      <MonthSwitcher
        month={month}
        isCurrentMonth={isCurrentMonth}
        onPrevious={() => onMonthChange(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
        onNext={() => onMonthChange(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
        onToday={() => onMonthChange(new Date(now.getFullYear(), now.getMonth(), 1))}
      />
      <div className="flex flex-wrap items-center gap-2">
        <SegmentedControl
          aria-label="Darstellung"
          value={mode}
          onValueChange={setMode}
          options={[
            { value: "days", label: "Tage" },
            { value: "people", label: "Personen" },
          ]}
        />
        <SegmentedControl
          aria-label="Personen filtern"
          value={groupFilter}
          onValueChange={setGroupFilter}
          options={[
            { value: "all", label: `Alle` },
            { value: "actors", label: "Schauspiel" },
            { value: "crew", label: "Gewerke" },
          ]}
        />
        <label className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
          Alle Tage
          <Switch checked={allDays} onCheckedChange={setAllDays} aria-label="Alle Tage anzeigen" />
        </label>
        <div className="relative w-full sm:w-48">
          <SearchIcon
            className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Name suchen"
            aria-label="Name suchen"
            className="h-9 pl-8 text-sm"
          />
        </div>
      </div>

      {days.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          In diesem Monat gibt es keine Probentage.
        </p>
      ) : (
        <>
          {mode === "days" ? (
            <TeamDayList
              days={days}
              model={model}
              total={visibleMembers.length}
              entriesFor={entriesFor}
              memberById={memberById}
              onOpenDay={setOpenDayKey}
              canPlan={canPlan}
            />
          ) : (
            <TeamMatrix
              days={days}
              model={model}
              members={visibleMembers}
              entriesFor={entriesFor}
              canPlan={canPlan}
              onOpenDay={setOpenDayKey}
            />
          )}
        </>
      )}

      <div className="flex flex-col gap-1.5 border-t border-border/60 pt-3">
        <StatusLegend statuses={["preferred", "limited", "blocked"]} />
        <CalendarLegend />
      </div>

      <TeamDayDialog
        day={openDay}
        model={model}
        entries={openDay ? entriesFor(openDay.key) : []}
        total={visibleMembers.length}
        memberById={memberById}
        canPlan={canPlan}
        readOnly={readOnly}
        onClose={() => setOpenDayKey(null)}
        onCreateEvent={(date) => {
          setOpenDayKey(null);
          onCreateEvent(date);
        }}
        onEditEvent={(entry) => {
          setOpenDayKey(null);
          onEditEvent(entry);
        }}
      />
    </Card>
  );
}

type DayListProps = {
  days: DayInfo[];
  model: CalendarModel;
  total: number;
  entriesFor: (key: string) => TeamEntry[];
  memberById: Map<string, TeamMember>;
  onOpenDay: (key: string) => void;
  canPlan: boolean;
};

/** Eine Zeile pro relevantem Tag, nur die Ausnahmen werden genannt. */
function TeamDayList({
  days,
  model,
  total,
  entriesFor,
  memberById,
  onOpenDay,
  canPlan,
}: DayListProps) {
  const upcoming = days.filter((day) => !day.isPast);
  const list = upcoming.length ? upcoming : days;
  return (
    <ul className="grid gap-2 lg:grid-cols-2">
      {list.map((day) => {
        const entries = entriesFor(day.key);
        const absent = entries.filter((entry) => entry.status !== "preferred");
        const blocked = absent.filter((entry) => entry.status === "blocked").length;
        const limited = absent.length - blocked;
        const events = model.entriesByDay.get(day.key) ?? [];
        const headline =
          events.map((event) => event.title).join(" · ") ||
          (day.isFinalWeek ? "Endprobenwoche" : DAY_TIER_LABELS[day.tier]);
        const holidayLabel = day.holidays.map((holiday) => holiday.title).join(", ");
        return (
          <li key={day.key}>
            <button
              type="button"
              onClick={() => onOpenDay(day.key)}
              className={cn(
                "flex h-full w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors hover:border-foreground/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                day.tier === "core" ? "border-border bg-muted/50" : "border-border/60 bg-card",
                day.isFinalWeek && "border-l-4 border-l-primary",
              )}
            >
              <DateBadge date={day.date} tone={day.isToday ? "primary" : "muted"} />
              <span className="min-w-0 flex-1 space-y-1.5">
                <span
                  className={cn(
                    "block truncate text-sm font-medium",
                    day.tier === "off" && !events.length && "text-muted-foreground",
                  )}
                >
                  {headline}
                  {holidayLabel ? (
                    <span className="ml-2 rounded-full bg-info/15 px-1.5 py-0.5 text-[0.625rem] font-medium text-info">
                      {holidayLabel}
                    </span>
                  ) : null}
                </span>
                <AvailabilityBar total={total} blocked={blocked} limited={limited} />
                {absent.length ? (
                  <span className="flex flex-wrap gap-x-2.5 gap-y-1">
                    {absent.map((entry) => (
                      <span
                        key={entry.userId}
                        className="inline-flex items-center gap-1 text-xs text-foreground/80"
                      >
                        <StatusDot status={entry.status} />
                        <span className="lg:hidden">
                          {shortName(memberById.get(entry.userId)?.name ?? "Unbekannt")}
                        </span>
                        <span className="hidden lg:inline">
                          {memberById.get(entry.userId)?.name ?? "Unbekannt"}
                          {canPlan && entry.reason ? (
                            <span className="text-muted-foreground"> ({entry.reason})</span>
                          ) : null}
                        </span>
                      </span>
                    ))}
                  </span>
                ) : (
                  <span className="block text-xs text-muted-foreground">Alle verfügbar</span>
                )}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

type MatrixProps = {
  days: DayInfo[];
  model: CalendarModel;
  members: TeamMember[];
  entriesFor: (key: string) => TeamEntry[];
  canPlan: boolean;
  onOpenDay: (key: string) => void;
};

/** Desktop: Personen × Tage. Leere Zellen bedeuten frei – nur Ausnahmen sind eingefärbt. */
function TeamMatrix({ days, model, members, entriesFor, canPlan, onOpenDay }: MatrixProps) {
  const statusByMemberDay = useMemo(() => {
    const map = new Map<string, TeamEntry>();
    for (const day of days) {
      for (const entry of entriesFor(day.key)) {
        map.set(`${entry.userId}:${day.key}`, entry);
      }
    }
    return map;
  }, [days, entriesFor]);

  const groups = GROUP_ORDER.map((group) => ({
    group,
    members: members.filter((member) => member.group === group),
  })).filter((entry) => entry.members.length);

  if (!members.length) {
    return <p className="py-12 text-center text-sm text-muted-foreground">Niemand gefunden.</p>;
  }

  return (
    <div className="max-h-[calc(100vh-10rem)] overflow-auto rounded-lg border border-border">
      <table className="w-full border-separate border-spacing-0 text-sm">
        <thead>
          <tr>
            <th
              scope="col"
              className="sticky left-0 top-0 z-30 min-w-28 sm:min-w-44 border-b border-border/60 bg-card px-3 text-left align-bottom text-xs font-medium text-muted-foreground"
            >
              <span className="block pb-2">{members.length} Personen</span>
            </th>
            {days.map((day) => {
              const entries = entriesFor(day.key);
              const blocked = entries.filter((entry) => entry.status === "blocked").length;
              const limited = entries.filter((entry) => entry.status === "limited").length;
              const events = model.entriesByDay.get(day.key) ?? [];
              return (
                <th
                  key={day.key}
                  scope="col"
                  className={cn(
                    "sticky top-0 z-20 min-w-11 border-b border-border/60 bg-card p-0 align-bottom font-normal",
                    day.tier === "core" && "bg-muted",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => onOpenDay(day.key)}
                    title={[
                      formatLongDate(day.date),
                      ...day.holidays.map((holiday) => holiday.title),
                      ...events.map((event) => event.title),
                    ].join(" · ")}
                    className="relative flex w-full flex-col items-center gap-1 px-1 pb-2 pt-2 transition-colors hover:bg-muted/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                  >
                    {day.isFinalWeek ? (
                      <span className="absolute inset-x-0 top-0 h-1 bg-primary" aria-hidden />
                    ) : day.isSchoolHoliday ? (
                      <span className="absolute inset-x-0 top-0 h-1 bg-info/60" aria-hidden />
                    ) : null}
                    <span className="text-[0.625rem] uppercase text-muted-foreground">
                      {WEEKDAY_SHORT.format(day.date).replace(".", "")}
                    </span>
                    <span
                      className={cn(
                        "flex h-6 min-w-6 items-center justify-center rounded-full text-sm tabular-nums",
                        day.tier === "core" ? "font-semibold" : "text-muted-foreground",
                        day.isToday && "bg-primary text-primary-foreground",
                      )}
                    >
                      {day.date.getDate()}
                    </span>
                    <span className="flex h-1.5 gap-0.5" aria-hidden>
                      {events.slice(0, 3).map((event) => (
                        <span
                          key={event.id}
                          className={cn(
                            "h-1.5 w-1.5 rounded-full",
                            event.source === "rehearsal" ? "bg-info" : "bg-primary",
                          )}
                        />
                      ))}
                    </span>
                    <span
                      className={cn(
                        "text-[0.6875rem] tabular-nums",
                        (members.length - blocked - limited) / Math.max(members.length, 1) < 0.85
                          ? "font-semibold text-destructive"
                          : "text-muted-foreground",
                      )}
                      aria-label={`${members.length - blocked - limited} von ${members.length} verfügbar`}
                    >
                      {members.length - blocked - limited}
                    </span>
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {groups.map(({ group, members: groupMembers }) => (
            <Fragment key={group}>
              <tr>
                <th
                  colSpan={days.length + 1}
                  scope="colgroup"
                  className="sticky left-0 border-b border-border/60 bg-card px-3 pb-1 pt-3 text-left text-[0.6875rem] font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  {MEMBER_GROUP_LABELS[group]} · {groupMembers.length}
                </th>
              </tr>
              {groupMembers.map((member) => (
                <tr key={member.id} className="group/row">
                  <th
                    scope="row"
                    className="sticky left-0 z-10 border-b border-border/70 bg-card px-3 py-1.5 text-left font-normal group-hover/row:bg-muted"
                  >
                    <span className="flex items-center gap-2">
                      <span
                        aria-hidden
                        className="hidden h-6 w-6 sm:flex shrink-0 items-center justify-center rounded-full bg-muted text-[0.625rem] font-semibold text-muted-foreground"
                      >
                        {member.initials}
                      </span>
                      <span className="max-w-24 truncate text-sm sm:max-w-none">{member.name}</span>
                    </span>
                  </th>
                  {days.map((day) => {
                    const entry = statusByMemberDay.get(`${member.id}:${day.key}`);
                    return (
                      <td
                        key={day.key}
                        className={cn(
                          "border-b border-border/70 p-0.5 text-center group-hover/row:bg-muted/60",
                          day.tier === "core" && "bg-muted/40",
                        )}
                      >
                        {entry ? <MatrixCell entry={entry} canPlan={canPlan} /> : null}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MatrixCell({ entry, canPlan }: { entry: TeamEntry; canPlan: boolean }) {
  const style = AVAILABILITY_STATUS[entry.status];
  const label = canPlan && entry.reason ? `${style.label}: ${entry.reason}` : style.label;
  return (
    <span
      title={label}
      className={cn(
        "mx-auto flex h-7 w-full min-w-9 items-center justify-center rounded",
        style.surface,
      )}
    >
      <StatusDot status={entry.status} />
      <span className="sr-only">{label}</span>
    </span>
  );
}

type TeamDayDialogProps = {
  day: DayInfo | undefined;
  model: CalendarModel;
  entries: TeamEntry[];
  total: number;
  memberById: Map<string, TeamMember>;
  canPlan: boolean;
  readOnly: boolean;
  onClose: () => void;
  onCreateEvent: (date: string) => void;
  onEditEvent: (entry: CalendarEntry) => void;
};

const DIALOG_SECTIONS: { status: Exclude<AvailabilityStatus, "free">; title: string }[] = [
  { status: "blocked", title: "Gesperrt" },
  { status: "limited", title: "Eingeschränkt" },
  { status: "preferred", title: "Kommen besonders gern" },
];

/** Tagesdetails: Termine, Verfügbarkeit, Ausnahmen (Gründe nur für Planer). */
function TeamDayDialog({
  day,
  model,
  entries,
  total,
  memberById,
  canPlan,
  readOnly,
  onClose,
  onCreateEvent,
  onEditEvent,
}: TeamDayDialogProps) {
  const events = day ? (model.entriesByDay.get(day.key) ?? []) : [];
  const blocked = entries.filter((entry) => entry.status === "blocked").length;
  const limited = entries.filter((entry) => entry.status === "limited").length;

  return (
    <Dialog open={Boolean(day)} onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        {day ? (
          <>
            <DialogHeader>
              <DialogTitle>{formatLongDate(day.date)}</DialogTitle>
              <DialogDescription>
                {total - blocked - limited} von {total} verfügbar
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <DayChips day={day} />
              <AvailabilityBar total={total} blocked={blocked} limited={limited} />
              {events.length || canPlan ? (
                <section className="space-y-1">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-medium text-muted-foreground">Termine</h3>
                    {canPlan && !readOnly ? (
                      <Button
                        type="button"
                        size="xs"
                        variant="ghost"
                        onClick={() => onCreateEvent(day.key)}
                      >
                        <CalendarPlusIcon className="h-3.5 w-3.5" aria-hidden />
                        Termin anlegen
                      </Button>
                    ) : null}
                  </div>
                  {events.length ? (
                    <CalendarEntryList
                      entries={events}
                      onSelect={canPlan ? onEditEvent : undefined}
                    />
                  ) : (
                    <p className="text-xs text-muted-foreground">Noch kein Termin.</p>
                  )}
                </section>
              ) : null}
              {DIALOG_SECTIONS.map(({ status, title }) => {
                const list = entries.filter((entry) => entry.status === status);
                if (!list.length) return null;
                return (
                  <section key={status} className="space-y-1.5">
                    <h3 className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                      <StatusDot status={status} /> {title} · {list.length}
                    </h3>
                    <ul className="space-y-1">
                      {list.map((entry) => (
                        <li key={entry.userId} className="text-sm">
                          <span className="font-medium">
                            {memberById.get(entry.userId)?.name ?? "Unbekannt"}
                          </span>
                          {canPlan && entry.reason ? (
                            <span className="text-muted-foreground"> – {entry.reason}</span>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </section>
                );
              })}
              {!entries.length ? (
                <p className="text-sm text-muted-foreground">Keine Einträge – alle verfügbar.</p>
              ) : null}
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
