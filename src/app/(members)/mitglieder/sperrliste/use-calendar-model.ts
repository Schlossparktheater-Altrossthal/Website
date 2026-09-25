"use client";

import { useMemo } from "react";
import { addMonths, endOfMonth, endOfWeek, startOfMonth, startOfWeek } from "date-fns";

import type { MonthGridDayState } from "@/components/ui/month-grid";
import { expandEntryDayKeys, type CalendarEntry } from "@/lib/calendar/event-kinds";
import { buildDayInfos, type DayInfo, type FinalWeekRange } from "@/lib/sperrliste/day-tiers";
import type { HolidayRange } from "@/types/holidays";

import type { TeamEntry } from "./types";

type CalendarModelInput = {
  month: Date;
  holidays: HolidayRange[];
  calendarEntries: CalendarEntry[];
  teamEntries: TeamEntry[];
  finalWeek: FinalWeekRange;
  preferredWeekdays: number[];
  exceptionWeekdays: number[];
  freezeDays: number;
};

export type DayCounts = { blocked: number; limited: number; preferred: number };

export type CalendarModel = {
  /** Alle Tage des sichtbaren Rasters (inkl. Rand-Wochen). */
  days: DayInfo[];
  dayMap: Map<string, DayInfo>;
  /** Nur Tage des Monats. */
  monthDays: DayInfo[];
  entriesByDay: Map<string, CalendarEntry[]>;
  teamByDay: Map<string, TeamEntry[]>;
  countsByDay: Map<string, DayCounts>;
  preferredWeekdaySet: Set<number>;
};

export function useCalendarModel({
  month,
  holidays,
  calendarEntries,
  teamEntries,
  finalWeek,
  preferredWeekdays,
  exceptionWeekdays,
  freezeDays,
}: CalendarModelInput): CalendarModel {
  const entriesByDay = useMemo(() => {
    const map = new Map<string, CalendarEntry[]>();
    for (const entry of calendarEntries) {
      for (const key of expandEntryDayKeys(entry)) {
        const list = map.get(key) ?? [];
        list.push(entry);
        map.set(key, list);
      }
    }
    return map;
  }, [calendarEntries]);

  const { teamByDay, countsByDay } = useMemo(() => {
    const byDay = new Map<string, TeamEntry[]>();
    const counts = new Map<string, DayCounts>();
    for (const entry of teamEntries) {
      const list = byDay.get(entry.date) ?? [];
      list.push(entry);
      byDay.set(entry.date, list);
      const count = counts.get(entry.date) ?? { blocked: 0, limited: 0, preferred: 0 };
      count[entry.status] += 1;
      counts.set(entry.date, count);
    }
    return { teamByDay: byDay, countsByDay: counts };
  }, [teamEntries]);

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
    return buildDayInfos(
      { start, end },
      {
        preferredWeekdays,
        exceptionWeekdays,
        holidays,
        finalWeek,
        eventDayKeys: new Set(entriesByDay.keys()),
        freezeDays,
      },
    );
  }, [entriesByDay, exceptionWeekdays, finalWeek, freezeDays, holidays, month, preferredWeekdays]);

  return useMemo(() => {
    const monthStart = startOfMonth(month);
    const nextMonth = addMonths(monthStart, 1);
    return {
      days,
      dayMap: new Map(days.map((day) => [day.key, day])),
      monthDays: days.filter((day) => day.date >= monthStart && day.date < nextMonth),
      entriesByDay,
      teamByDay,
      countsByDay,
      preferredWeekdaySet: new Set(preferredWeekdays),
    };
  }, [countsByDay, days, entriesByDay, month, preferredWeekdays, teamByDay]);
}

/** Gemeinsame Grundgestaltung eines Tages im Monatsraster (Stufe, Termine, Bänder). */
export function getBaseDayState(
  day: DayInfo | undefined,
  entries: CalendarEntry[] | undefined,
): MonthGridDayState {
  if (!day) return {};
  const markers = (entries ?? []).map((entry) =>
    entry.source === "rehearsal" ? ("rehearsal" as const) : ("event" as const),
  );
  const descriptionParts = [
    day.isFinalWeek ? "Endprobenwoche" : null,
    ...day.holidays.map((holiday) => holiday.title),
    ...(entries ?? []).map((entry) => entry.title),
  ].filter(Boolean);
  return {
    emphasis: day.tier === "core" ? "strong" : day.tier === "off" ? "faint" : "normal",
    markers,
    band: day.isFinalWeek ? "final" : day.isSchoolHoliday ? "holiday" : undefined,
    isToday: day.isToday,
    description: descriptionParts.join(", ") || undefined,
  };
}
