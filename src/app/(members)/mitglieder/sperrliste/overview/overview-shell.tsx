"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { format, isSameDay } from "date-fns";
import { de } from "date-fns/locale/de";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Clock,
  Sparkles,
  Sun,
  Umbrella,
  Users2,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Heading, Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import { getNameInitials } from "@/lib/names";
import { formatWeekdayList, type WeekdayValue } from "@/lib/weekdays";
import type { HolidayRange } from "@/types/holidays";

import type { BlockedDay } from "../block-calendar";
import type {
  BlockOverviewSummary,
  PreparedMember,
  VisibleDayInfo,
} from "./useBlockOverviewData";
import type {
  DayBucket,
  DayColumn,
  HolidayIndicator,
  OverviewPerson,
  OverviewPersonDay,
  PersonGroup,
} from "./types";
import SperrlistenV2 from "./SperrlistenV2";

export type OverviewShellProps = {
  monthLabel: string;
  summary: BlockOverviewSummary;
  holidaysInRangeCount: number;
  busiestMember: { name: string; total: number } | null;
  preferredDescription: string;
  exceptionDescription: string;
  preparedMembers: PreparedMember[];
  visibleDayInfo: VisibleDayInfo[];
  holidayMap: Map<string, HolidayRange[]>;
  onPrev: () => void;
  onNext: () => void;
  onReset: () => void;
  onSelectBlockedDay: (payload: {
    member: PreparedMember;
    entry: BlockedDay;
    date: Date;
    holidayEntries: HolidayRange[];
  }) => void;
};

function focusToGroup(focus: PreparedMember["onboardingFocus"]): PersonGroup {
  if (focus === "acting") return "actors";
  if (focus === "tech") return "crew";
  if (focus === "both") return "both";
  return "other";
}

function normaliseReason(value: string | null | undefined) {
  if (!value) return null;
  const trimmed = value.replace(/\s+/g, " ").trim();
  return trimmed || null;
}

function selectDayBuckets(
  people: OverviewPerson[],
  dayCols: DayColumn[],
  holidays: HolidayIndicator[],
): DayBucket[] {
  return dayCols.map((column, index) => {
    const entries = people.map((person) => ({ person, cell: person.days[index] }));
    const available = entries.filter((entry) => entry.cell.type === "free" || entry.cell.type === "preferred");
    const limited = entries.filter((entry) => entry.cell.type === "limited");
    const blocked = entries.filter((entry) => entry.cell.type === "block");
    const holiday = holidays.find((indicator) => indicator.dayIndex === index) ?? null;
    return { column, available, limited, blocked, holiday } satisfies DayBucket;
  });
}

export function OverviewShell({
  monthLabel,
  summary,
  holidaysInRangeCount,
  busiestMember,
  preferredDescription,
  exceptionDescription,
  preparedMembers,
  visibleDayInfo,
  holidayMap,
  onPrev,
  onNext,
  onReset,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onSelectBlockedDay,
}: OverviewShellProps) {
  const numberFormatter = useMemo(() => new Intl.NumberFormat("de-DE"), []);

  const dayCols = useMemo<DayColumn[]>(() => {
    return visibleDayInfo.map((info) => {
      const label = format(info.day, "EE", { locale: de }).replace(".", "");
      return {
        key: info.key,
        label,
        n: info.day.getDate(),
        date: info.day,
        accent: isSameDay(info.day, new Date()),
        weekday: info.weekday as WeekdayValue,
      } satisfies DayColumn;
    });
  }, [visibleDayInfo]);

  const holidayIndicators = useMemo<HolidayIndicator[]>(() => {
    const result: HolidayIndicator[] = [];
    dayCols.forEach((day, index) => {
      const entries = holidayMap.get(day.key) ?? [];
      if (!entries.length) return;
      const label = entries.map((entry) => entry.title).filter(Boolean).join(", ") || undefined;
      const isPublicHoliday = entries.some((entry) => entry.category === "publicHoliday");
      result.push({ dayIndex: index, label, type: isPublicHoliday ? "holiday" : "vacation", isPublicHoliday });
    });
    return result;
  }, [dayCols, holidayMap]);

  const people = useMemo<OverviewPerson[]>(() => {
    return preparedMembers.map((member) => {
      const stats = summary.totals.get(member.id) ?? { total: 0, upcoming: 0 };
      const statsLabel = `${numberFormatter.format(stats.total)} Sperrtermine · ${numberFormatter.format(stats.upcoming)} anstehend`;
      const initials = getNameInitials({
        firstName: member.firstName,
        lastName: member.lastName,
        name: member.name,
        email: member.email,
      });
      const group = focusToGroup(member.onboardingFocus);
      const days = dayCols.map((day) => {
        const entry = member.blockedMap.get(day.key) ?? null;
        let type: OverviewPersonDay["type"] = "free";
        let label: string | null = null;
        if (entry) {
          if (entry.kind === "BLOCKED") type = "block";
          else if (entry.kind === "LIMITED") type = "limited";
          else if (entry.kind === "PREFERRED") type = "preferred";
          label = normaliseReason(entry.reason);
        }
        return {
          type,
          label,
          entry,
          date: day.date,
          dayKey: day.key,
          holidayEntries: holidayMap.get(day.key) ?? [],
        } satisfies OverviewPersonDay;
      });
      return {
        id: member.id,
        name: member.displayName,
        initials,
        group,
        stats: { total: stats.total, upcoming: stats.upcoming, label: statsLabel },
        member,
        days,
      } satisfies OverviewPerson;
    });
  }, [dayCols, holidayMap, numberFormatter, preparedMembers, summary.totals]);

  const [personFilter, setPersonFilter] = useState<"all" | PersonGroup>("all");
  const [view, setView] = useState<"table" | "timeline" | "calendar">("table");
  const [highlightedDay, setHighlightedDay] = useState<number | null>(() =>
    dayCols.find((day) => day.accent)?.n ?? dayCols[0]?.n ?? null,
  );

  useEffect(() => {
    setHighlightedDay((current) => {
      if (current !== null && dayCols.some((day) => day.n === current)) {
        return current;
      }
      return dayCols.find((day) => day.accent)?.n ?? dayCols[0]?.n ?? null;
    });
  }, [dayCols]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (view !== "timeline" || !dayCols.length) return;
      const currentIndex =
        highlightedDay === null ? -1 : dayCols.findIndex((day) => day.n === highlightedDay);
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        if (currentIndex > 0) setHighlightedDay(dayCols[currentIndex - 1]?.n ?? null);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        if (currentIndex >= 0 && currentIndex < dayCols.length - 1)
          setHighlightedDay(dayCols[currentIndex + 1]?.n ?? null);
      } else if (event.key === "Home") {
        event.preventDefault();
        setHighlightedDay(dayCols[0]?.n ?? null);
      } else if (event.key === "End") {
        event.preventDefault();
        setHighlightedDay(dayCols[dayCols.length - 1]?.n ?? null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [dayCols, highlightedDay, view]);

  const filteredPeople = useMemo(() => {
    if (personFilter === "all") return people;
    return people.filter((person) => person.group === personFilter);
  }, [people, personFilter]);

  const groupedPeople = useMemo(() => {
    const actors = people.filter((person) => person.group === "actors");
    const crew = people.filter((person) => person.group === "crew");
    const both = people.filter((person) => person.group === "both" || person.group === "other");
    return { actors, crew, both };
  }, [people]);

  const activePeople = personFilter === "all" ? people : filteredPeople;
  const dayBuckets = useMemo(
    () => selectDayBuckets(activePeople, dayCols, holidayIndicators),
    [activePeople, dayCols, holidayIndicators],
  );

  const membersCount = people.length;
  const totalBlockedDays = summary.total;
  const upcomingBlockedDays = summary.upcoming;

  const monthRangeLabel = useMemo(() => {
    if (!dayCols.length) return null;
    const first = dayCols[0]?.date;
    const last = dayCols[dayCols.length - 1]?.date;
    if (!first || !last) return null;
    if (isSameDay(first, last)) {
      return format(first, "d. MMMM yyyy", { locale: de });
    }
    const sameMonth =
      first.getMonth() === last.getMonth() && first.getFullYear() === last.getFullYear();
    const sameYear = first.getFullYear() === last.getFullYear();
    if (sameMonth) {
      return `${format(first, "d.", { locale: de })} – ${format(last, "d. MMMM yyyy", { locale: de })}`;
    }
    if (sameYear) {
      return `${format(first, "d. MMMM", { locale: de })} – ${format(last, "d. MMMM yyyy", { locale: de })}`;
    }
    return `${format(first, "d. MMMM yyyy", { locale: de })} – ${format(last, "d. MMMM yyyy", { locale: de })}`;
  }, [dayCols]);

  const focusSummary = useMemo(() => {
    const uniqueWeekdays = Array.from(new Set(dayCols.map((day) => day.weekday))) as WeekdayValue[];
    if (!uniqueWeekdays.length) return "–";
    return formatWeekdayList(uniqueWeekdays, { style: "short" });
  }, [dayCols]);

  const stats = useMemo(
    () => [
      {
        title: "Mitglieder im Überblick",
        value: numberFormatter.format(membersCount),
        hint:
          membersCount === 1
            ? "Eine Person in der Übersicht"
            : `${numberFormatter.format(membersCount)} Personen in der Übersicht`,
        icon: <Users2 className="h-5 w-5" aria-hidden />,
      },
      {
        title: "Sperrtermine gesamt",
        value: numberFormatter.format(totalBlockedDays),
        hint:
          totalBlockedDays === 1
            ? "Ein Sperrtermin im Zeitraum"
            : `${numberFormatter.format(totalBlockedDays)} Sperrtermine im Zeitraum`,
        icon: <CalendarDays className="h-5 w-5" aria-hidden />,
      },
      {
        title: "Anstehende Sperrtermine",
        value: numberFormatter.format(upcomingBlockedDays),
        hint:
          upcomingBlockedDays === 1
            ? "Ein Termin ab heute"
            : `${numberFormatter.format(upcomingBlockedDays)} Termine ab heute`,
        icon: <Clock className="h-5 w-5" aria-hidden />,
      },
      {
        title: "Ferien & Feiertage",
        value: numberFormatter.format(holidaysInRangeCount),
        hint: holidaysInRangeCount === 1 ? "Ein relevanter Tag" : `${holidaysInRangeCount} relevante Tage`,
        icon: <Umbrella className="h-5 w-5" aria-hidden />,
      },
    ],
    [
      holidaysInRangeCount,
      membersCount,
      numberFormatter,
      totalBlockedDays,
      upcomingBlockedDays,
    ],
  );

  const busiestHint = useMemo(() => {
    if (!busiestMember) {
      return "Sobald Sperrtermine vorliegen, erscheint hier der Spitzenreiter.";
    }
    const totalLabel = numberFormatter.format(busiestMember.total);
    return `${busiestMember.name} · ${totalLabel} Sperrtermin${busiestMember.total === 1 ? "" : "e"}`;
  }, [busiestMember, numberFormatter]);

  return (
    <div className="min-h-dvh bg-muted/20 text-foreground">
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <Heading level="h3" className="text-h3">
              Wichtige Probentage
            </Heading>
            <div className="flex flex-wrap gap-2">
              <Badge
                variant="muted"
                size="sm"
                className="uppercase tracking-[0.18em] text-muted-foreground"
              >
                {monthLabel}
              </Badge>
              <Badge
                variant="info"
                size="sm"
                className="uppercase tracking-[0.18em] text-info"
              >
                Zeitraum {monthRangeLabel ?? "–"}
              </Badge>
              <Badge
                variant="muted"
                size="sm"
                className="uppercase tracking-[0.18em] text-muted-foreground"
              >
                {dayCols.length} Tage · Fokus {focusSummary}
              </Badge>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Tabs
              value={personFilter}
              onValueChange={(value) => setPersonFilter(value as "all" | PersonGroup)}
            >
              <TabsList className="flex w-full overflow-hidden rounded-2xl border border-border/60 bg-background/80 p-1 shadow-sm ring-1 ring-border/50 backdrop-blur sm:w-auto">
                <TabsTrigger
                  value="all"
                  className="flex-1 justify-center whitespace-nowrap rounded-xl px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] sm:text-sm"
                >
                  Alle ({people.length})
                </TabsTrigger>
                <TabsTrigger
                  value="actors"
                  className="flex-1 justify-center whitespace-nowrap rounded-xl px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] sm:text-sm"
                >
                  Schauspieler ({groupedPeople.actors.length})
                </TabsTrigger>
                <TabsTrigger
                  value="crew"
                  className="flex-1 justify-center whitespace-nowrap rounded-xl px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] sm:text-sm"
                >
                  Gewerke ({groupedPeople.crew.length})
                </TabsTrigger>
                <TabsTrigger
                  value="both"
                  className="flex-1 justify-center whitespace-nowrap rounded-xl px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] sm:text-sm"
                >
                  Beides ({groupedPeople.both.length})
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <Tabs value={view} onValueChange={(value) => setView(value as "table" | "timeline" | "calendar")} className="hidden sm:flex">
              <TabsList className="flex overflow-hidden rounded-2xl border border-border/60 bg-background/80 p-1 shadow-sm ring-1 ring-border/50 backdrop-blur">
                <TabsTrigger
                  value="calendar"
                  className="rounded-xl px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em]"
                >
                  Kalender
                </TabsTrigger>
                <TabsTrigger
                  value="table"
                  className="rounded-xl px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em]"
                >
                  Tabelle
                </TabsTrigger>
                <TabsTrigger
                  value="timeline"
                  className="rounded-xl px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em]"
                >
                  Timeline
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="hidden items-center gap-1 rounded-2xl border border-border/60 bg-background/80 p-1 shadow-sm ring-1 ring-border/50 backdrop-blur sm:flex">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Vorheriger Zeitraum"
                onClick={onPrev}
              >
                <ArrowLeft className="h-4 w-4" aria-hidden />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Nächster Zeitraum"
                onClick={onNext}
              >
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Button>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2 rounded-xl border-border/60 bg-background/80 shadow-sm"
              onClick={() => {
                onReset();
                const today = dayCols.find((day) => day.accent);
                if (today) {
                  setHighlightedDay(today.n);
                }
              }}
            >
              <Clock className="h-4 w-4" aria-hidden />
              Heute
            </Button>
          </div>
        </header>

        <section className="grid gap-3 lg:grid-cols-2">
          {stats.map((item) => (
            <Kpi key={item.title} title={item.title} value={item.value} hint={item.hint} icon={item.icon} />
          ))}
          <Kpi
            title="Aktivste Person"
            value={busiestMember ? busiestMember.name : "Noch offen"}
            hint={busiestHint}
            icon={<Sparkles className="h-5 w-5" aria-hidden />}
          />
        </section>

        <section className="grid gap-3 lg:grid-cols-2">
          <Note title="Bevorzugte Tage">{preferredDescription}</Note>
          <Note title="Ausnahmen">{exceptionDescription}</Note>
        </section>

        <WeekStrip dayBuckets={dayBuckets} onJump={setHighlightedDay} />

        {/* Neue Hauptübersicht: SperrlistenV2 */}
        <SperrlistenV2
          onExportPdf={() => undefined}
          people={people}
          dayCols={dayCols}
          holidays={holidayIndicators}
        />
      </main>
    </div>
  );
}

/* eslint-disable @typescript-eslint/no-unused-vars */

function TableSection({
  people,
  groupedPeople,
  dayCols,
  onSelect,
  compact,
}: {
  people: OverviewPerson[];
  groupedPeople: { actors: OverviewPerson[]; crew: OverviewPerson[]; both: OverviewPerson[] };
  dayCols: DayColumn[];
  onSelect: (person: OverviewPerson, cell: OverviewPersonDay) => void;
  compact: boolean;
}) {
  return (
    <section className="hidden sm:block">
      <div className="mb-2 flex items-center justify-between text-sm font-semibold text-muted-foreground">
        <span>Zeitraum</span>
        <span className="text-xs text-muted-foreground/80">{dayCols.length} ausgewählte Tage</span>
      </div>
      <div className="max-h-[calc(100vh-16rem)] overflow-auto rounded-2xl border border-border/60 bg-card/80 shadow-sm ring-1 ring-border/40 backdrop-blur-sm">
        <table className={cn("w-full border-collapse", compact ? "text-[12px]" : "text-sm")}>
          <thead className="sticky top-0 z-10 bg-card shadow-sm">
            <tr>
              <th className="sticky left-0 z-10 w-64 border-b border-border/60 bg-card px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Mitglied
              </th>
              {dayCols.map((day) => (
                <th
                  key={day.key}
                  className={cn(
                    "border-b border-border/60 px-2 py-2 text-center align-bottom text-[11px] uppercase tracking-[0.16em]",
                    day.accent ? "bg-primary/10" : "bg-card",
                  )}
                >
                  <div className="flex flex-col items-center gap-1">
                    <span>{day.label}</span>
                    <span
                      className={cn(
                        "flex h-7 w-7 items-center justify-center rounded-full border text-sm font-semibold",
                        day.accent
                          ? "border-primary bg-primary text-primary-foreground shadow-sm"
                          : "border-border/60 bg-muted/40 text-foreground",
                      )}
                    >
                      {day.n}
                    </span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {renderGroupRows(groupedPeople.actors, "Schauspieler", "primary", dayCols, onSelect, compact)}
            {renderGroupRows(groupedPeople.both, "Schauspieler & Gewerke", "accent", dayCols, onSelect, compact)}
            {renderGroupRows(groupedPeople.crew, "Gewerke", "info", dayCols, onSelect, compact)}
            {people.length === 0 && (
              <tr>
                <td
                  colSpan={dayCols.length + 1}
                  className="px-4 py-6 text-center text-sm text-muted-foreground"
                >
                  Keine Mitglieder im ausgewählten Filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function renderGroupRows(
  group: OverviewPerson[],
  label: string,
  tone: "primary" | "accent" | "info",
  dayCols: DayColumn[],
  onSelect: (person: OverviewPerson, cell: OverviewPersonDay) => void,
  compact: boolean,
) {
  if (!group.length) return null;
  const gradientMap: Record<typeof tone, string> = {
    primary: "from-primary/80 to-primary",
    accent: "from-accent/75 to-accent",
    info: "from-info/80 to-info",
  } as const;
  const avatarMap: Record<typeof tone, string> = {
    primary: "bg-primary/15 text-primary",
    accent: "bg-accent/15 text-accent",
    info: "bg-info/15 text-info",
  } as const;
  return group.map((person, rowIndex) => (
    <tr key={person.id} className="border-b border-border/50">
      {rowIndex === 0 && (
        <th
          rowSpan={group.length}
          scope="rowgroup"
          className={cn(
            "sticky left-0 z-10 w-4 bg-gradient-to-b",
            gradientMap[tone],
          )}
        >
          <span className="sr-only">{label}</span>
        </th>
      )}
      <th
        scope="row"
        className="sticky left-4 z-10 w-64 border-r border-border/60 bg-card px-3 py-2 text-left"
      >
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold",
              avatarMap[tone],
            )}
          >
            {person.initials}
          </span>
          <div>
            <p className="font-semibold leading-5 text-foreground">{person.name}</p>
            <p className="text-[11px] text-muted-foreground">{person.stats.label}</p>
          </div>
        </div>
      </th>
      {dayCols.map((day, index) => (
        <td key={day.key} className="px-1.5 py-1.5 align-top">
          <Cell
            cell={person.days[index]}
            compact={compact}
            onClick={() => handleCellClick(onSelect, person, person.days[index])}
          />
        </td>
      ))}
    </tr>
  ));
}

function handleCellClick(
  onSelect: (person: OverviewPerson, cell: OverviewPersonDay) => void,
  person: OverviewPerson,
  cell: OverviewPersonDay,
) {
  if (!cell.entry) return;
  onSelect(person, cell);
}

function TimelineSection({
  people,
  dayCols,
  highlightedDay,
  onHighlight,
  onSelect,
}: {
  people: OverviewPerson[];
  dayCols: DayColumn[];
  highlightedDay: number | null;
  onHighlight: (value: number | null) => void;
  onSelect: (person: OverviewPerson, cell: OverviewPersonDay) => void;
}) {
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between rounded-xl border border-border/60 bg-card/80 p-3 shadow-sm ring-1 ring-border/40 backdrop-blur-sm">
        <div className="flex items-center gap-2 text-sm">
          {dayCols.map((day) => (
            <button
              key={day.key}
              type="button"
              onClick={() => onHighlight(day.n)}
              data-day={day.n}
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-full border text-sm font-semibold transition-colors",
                highlightedDay === day.n
                  ? "border-primary bg-primary text-primary-foreground shadow-sm"
                  : day.accent
                    ? "border-primary/50 bg-primary/10 text-primary"
                    : "border-border/60 bg-background text-muted-foreground hover:bg-muted/40",
              )}
            >
              {day.n}
            </button>
          ))}
        </div>
        <div className="text-xs text-muted-foreground">{dayCols.length} ausgewählte Tage</div>
      </div>

      <div className="space-y-3">
        {people.map((person) => (
          <div key={person.id} className="rounded-2xl border border-border/60 bg-card/80 shadow-sm">
            <div className="flex items-center gap-3 border-b border-border/60 px-4 py-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-muted/50 text-sm font-semibold text-foreground">
                {person.initials}
              </span>
              <div className="min-w-0">
                <p className="font-semibold leading-5 text-foreground">{person.name}</p>
                <p className="text-[11px] text-muted-foreground">{person.stats.label}</p>
              </div>
            </div>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(100px,1fr))] gap-px bg-muted/50">
              {person.days.map((cell, index) => (
                <div
                  key={`${person.id}-${person.days[index].dayKey}`}
                  className={cn(
                    "relative bg-card p-3",
                    highlightedDay === dayCols[index]?.n ? "bg-primary/10" : undefined,
                  )}
                >
                  <TimelineCell cell={cell} onClick={() => handleCellClick(onSelect, person, cell)} />
                </div>
              ))}
            </div>
          </div>
        ))}
        {people.length === 0 && (
          <div className="rounded-xl border border-dashed border-border/60 bg-muted/40 p-6 text-center text-sm text-muted-foreground">
            Keine Mitglieder im ausgewählten Filter.
          </div>
        )}
      </div>
    </section>
  );
}

function CalendarCards({ dayBuckets }: { dayBuckets: DayBucket[] }) {
  return (
    <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {dayBuckets.map((bucket) => (
        <article
          key={bucket.column.key}
          className="rounded-2xl border border-border/60 bg-card/80 p-4 shadow-sm ring-1 ring-border/40 backdrop-blur-sm"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {bucket.column.label}
              </p>
              <p className="text-2xl font-semibold text-foreground">{bucket.column.n}</p>
            </div>
            {bucket.holiday && (
              <div className="flex items-center gap-2 rounded-full border border-border/60 bg-muted/40 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                {bucket.holiday.type === "holiday" ? (
                  <Sun className="h-4 w-4" aria-hidden />
                ) : (
                  <Umbrella className="h-4 w-4" aria-hidden />
                )}
                <span>{bucket.holiday.label ?? (bucket.holiday.type === "holiday" ? "Feiertag" : "Ferien")}</span>
              </div>
            )}
          </div>
          <div className="mt-3 space-y-2 text-sm">
            <CalendarRow tone="ok" label="Verfügbar" entries={bucket.available} />
            <CalendarRow tone="warn" label="Eingeschränkt" entries={bucket.limited} />
            <CalendarRow tone="danger" label="Gesperrt" entries={bucket.blocked} />
          </div>
        </article>
      ))}
    </section>
  );
}

function CalendarRow({
  tone,
  label,
  entries,
}: {
  tone: "ok" | "warn" | "danger";
  label: string;
  entries: { person: OverviewPerson; cell: OverviewPersonDay }[];
}) {
  if (!entries.length) {
    return null;
  }
  const palette: Record<typeof tone, string> = {
    ok: "border-success/40 bg-success/10 text-success",
    warn: "border-warning/40 bg-warning/10 text-warning",
    danger: "border-destructive/40 bg-destructive/10 text-destructive",
  };
  return (
    <div className={cn("rounded-xl border p-2", palette[tone])}>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <ul className="mt-1 space-y-1 text-[13px] text-foreground">
        {entries.slice(0, 4).map(({ person, cell }) => (
          <li key={person.id} className="truncate">
            <span className="font-medium">{person.name}</span>
            {cell.label ? <span className="text-muted-foreground"> · {cell.label}</span> : null}
          </li>
        ))}
        {entries.length > 4 && (
          <li className="text-xs text-muted-foreground">+ {entries.length - 4} weitere Einträge</li>
        )}
      </ul>
    </div>
  );
}

/* eslint-enable @typescript-eslint/no-unused-vars */

function WeekStrip({ dayBuckets, onJump }: { dayBuckets: DayBucket[]; onJump: (day: number) => void }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-b from-card to-muted/40 shadow-sm ring-1 ring-border/40 backdrop-blur-sm">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(120px,1fr))]">
        {dayBuckets.map((bucket) => {
          const total = bucket.available.length + bucket.limited.length + bucket.blocked.length;
          const availablePercent = total === 0 ? 0 : Math.round((bucket.available.length / total) * 100);
          return (
            <button
              key={bucket.column.key}
              type="button"
              onClick={() => onJump(bucket.column.n)}
              className="group relative flex flex-col gap-2 border-r border-border/40 p-3 text-left transition-colors hover:bg-primary/5"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{bucket.column.label}</p>
                  <p className="text-xl font-semibold text-foreground">{bucket.column.n}</p>
                </div>
                {bucket.holiday && (
                  <span className="rounded-full border border-border/60 bg-muted/40 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                    {bucket.holiday.type === "holiday" ? "Feiertag" : "Ferien"}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1 text-[11px]">
                <MiniChip tone="ok" count={bucket.available.length} />
                <MiniChip tone="warn" count={bucket.limited.length} />
                <MiniChip tone="danger" count={bucket.blocked.length} />
                <span className="ml-auto text-muted-foreground">{availablePercent}% frei</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Cell({
  cell,
  compact,
  onClick,
}: {
  cell: OverviewPersonDay;
  compact: boolean;
  onClick: () => void;
}) {
  const baseClass = cn(
    "flex h-16 flex-col justify-center rounded-lg px-2.5 text-left transition",
    compact ? "text-[12px]" : "text-sm",
  );
  if (cell.type === "free") {
    return (
      <div className="flex h-16 items-center justify-center rounded-lg border border-border/60 text-[11px] text-muted-foreground">
        frei
      </div>
    );
  }
  const map: Record<Exclude<OverviewPersonDay["type"], "free">, { label: string; className: string; labelClass: string }> = {
    block: {
      label: "Sperrtermin",
      className: "border-destructive/50 bg-destructive/10 text-destructive",
      labelClass: "text-destructive",
    },
    limited: {
      label: "Eingeschränkt",
      className: "border-warning/50 bg-warning/10 text-warning",
      labelClass: "text-warning",
    },
    preferred: {
      label: "Bevorzugt",
      className: "border-success/50 bg-success/10 text-success",
      labelClass: "text-success",
    },
  };
  const meta = map[cell.type];
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!cell.entry}
      className={cn(
        baseClass,
        "border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
        meta.className,
        cell.entry ? "cursor-pointer" : "cursor-not-allowed opacity-60",
      )}
    >
      <span className={cn("text-[10px] uppercase tracking-[0.16em]", meta.labelClass)}>{meta.label}</span>
      {cell.label ? <span className="mt-1 line-clamp-2 text-[11px] text-foreground/90">{cell.label}</span> : null}
    </button>
  );
}

function TimelineCell({
  cell,
  onClick,
}: {
  cell: OverviewPersonDay;
  onClick: () => void;
}) {
  if (cell.type === "free") {
    return (
      <div className="flex h-16 items-center justify-center rounded-lg border border-border/60 text-[11px] text-muted-foreground">
        frei
      </div>
    );
  }
  const map: Record<Exclude<OverviewPersonDay["type"], "free">, { label: string; className: string; labelClass: string }> = {
    block: {
      label: "Sperrtermin",
      className: "border-destructive/50 bg-destructive/10 text-destructive",
      labelClass: "text-destructive",
    },
    limited: {
      label: "Eingeschränkt",
      className: "border-warning/50 bg-warning/10 text-warning",
      labelClass: "text-warning",
    },
    preferred: {
      label: "Bevorzugt",
      className: "border-success/50 bg-success/10 text-success",
      labelClass: "text-success",
    },
  };
  const meta = map[cell.type];
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!cell.entry}
      className={cn(
        "flex h-16 flex-col justify-center rounded-lg border bg-card px-2 text-left text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
        meta.className,
        cell.entry ? "cursor-pointer" : "cursor-not-allowed opacity-60",
      )}
    >
      <span className={cn("text-[10px] uppercase tracking-[0.16em]", meta.labelClass)}>{meta.label}</span>
      {cell.label ? <span className="mt-1 text-[12px] text-foreground/90">{cell.label}</span> : null}
    </button>
  );
}

function Note({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card className="rounded-2xl p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{title}</p>
      <Text variant="body" className="mt-1 text-sm leading-6 text-muted-foreground">
        {children}
      </Text>
    </Card>
  );
}

function Kpi({ title, value, hint, icon }: { title: string; value: string; hint: string; icon?: ReactNode }) {
  return (
    <Card className="flex items-start gap-3 rounded-2xl p-5">
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/15 text-primary">
        {icon ?? <Sparkles className="h-5 w-5" aria-hidden />}
      </span>
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{title}</p>
        <p className="text-lg font-semibold text-foreground">{value}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
    </Card>
  );
}

function MiniChip({ tone, count }: { tone: "ok" | "warn" | "danger"; count: number }) {
  const palette: Record<typeof tone, string> = {
    ok: "bg-success/15 text-success",
    warn: "bg-warning/15 text-warning",
    danger: "bg-destructive/15 text-destructive",
  };
  return (
    <span
      className={cn(
        "inline-flex min-w-[24px] items-center justify-center rounded-full px-2 py-0.5 text-[10px] font-semibold",
        palette[tone],
      )}
    >
      {count}
    </span>
  );
}
