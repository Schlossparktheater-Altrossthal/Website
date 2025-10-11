"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { format, isSameDay } from "date-fns";
import { de } from "date-fns/locale/de";
import {
  ArrowLeft,
  ArrowRight,
  Clock,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Heading, Text } from "@/components/ui/typography";
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

export function OverviewShell({
  monthLabel,
  summary,
  holidaysInRangeCount: _holidaysInRangeCount,
  busiestMember: _busiestMember,
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
  void _holidaysInRangeCount;
  void _busiestMember;

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

  const groupedPeople = useMemo(() => {
    const actors = people.filter((person) => person.group === "actors");
    const crew = people.filter((person) => person.group === "crew");
    const both = people.filter((person) => person.group === "both" || person.group === "other");
    return { actors, crew, both };
  }, [people]);

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

  return (
    <div className="space-y-6">
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
          <Note title="Bevorzugte Tage">{preferredDescription}</Note>
          <Note title="Ausnahmen">{exceptionDescription}</Note>
        </section>

        {/* Neue Hauptübersicht: SperrlistenV2 */}
        <SperrlistenV2
          onExportPdf={() => undefined}
          people={people}
          dayCols={dayCols}
          holidays={holidayIndicators}
        />
    </div>
  );
}

// ============================================================================
// Helper Components
// ============================================================================

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
