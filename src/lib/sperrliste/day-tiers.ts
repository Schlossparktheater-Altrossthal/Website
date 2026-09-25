import { addDays, differenceInCalendarDays, eachDayOfInterval, format, startOfDay } from "date-fns";

import type { HolidayRange } from "@/types/holidays";

export const DAY_KEY_FORMAT = "yyyy-MM-dd";

/**
 * Wie wichtig ein Tag für die Planung ist:
 * - `core`: Kerntag, an dem üblicherweise geprobt wird (derzeit Fr–So) oder Endprobenwoche
 * - `possible`: nur in Ausnahmefällen – Ausnahme-Wochentage, Ferien, Feiertage, Tage mit Termin
 * - `off`: übrige Wochentage
 */
export type DayTier = "core" | "possible" | "off";

export type DayInfo = {
  key: string;
  date: Date;
  weekday: number;
  tier: DayTier;
  isFinalWeek: boolean;
  isSchoolHoliday: boolean;
  isPublicHoliday: boolean;
  holidays: HolidayRange[];
  hasEvent: boolean;
  isToday: boolean;
  isPast: boolean;
  /** Liegt innerhalb der Sperrfrist; neue Einträge sind nicht mehr möglich. */
  isFrozen: boolean;
};

export type FinalWeekRange = { start: string; end: string | null } | null;

export type DayTierOptions = {
  preferredWeekdays: readonly number[];
  exceptionWeekdays: readonly number[];
  holidays: readonly HolidayRange[];
  finalWeek?: FinalWeekRange;
  /** Tage (yyyy-MM-dd), an denen ein Termin oder eine Probe liegt. */
  eventDayKeys?: ReadonlySet<string>;
  freezeDays?: number;
  today?: Date;
};

export function toDayKey(date: Date) {
  return format(date, DAY_KEY_FORMAT);
}

/** Ordnet jedem Tag (yyyy-MM-dd) die Ferien/Feiertage zu, die ihn abdecken. */
export function buildHolidayMap(holidays: readonly HolidayRange[]) {
  const map = new Map<string, HolidayRange[]>();
  for (const holiday of holidays) {
    let cursor = holiday.startDate;
    // ISO-Datumsstrings lassen sich lexikografisch vergleichen.
    for (let guard = 0; cursor <= holiday.endDate && guard < 400; guard += 1) {
      const list = map.get(cursor) ?? [];
      list.push(holiday);
      map.set(cursor, list);
      cursor = toDayKey(addDays(parseDayKey(cursor), 1));
    }
  }
  return map;
}

export function parseDayKey(key: string) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function isInFinalWeek(key: string, finalWeek: FinalWeekRange | undefined) {
  if (!finalWeek) return false;
  const end = finalWeek.end ?? toDayKey(addDays(parseDayKey(finalWeek.start), 6));
  return key >= finalWeek.start && key <= end;
}

export function buildDayInfos(range: { start: Date; end: Date }, options: DayTierOptions) {
  const today = startOfDay(options.today ?? new Date());
  const preferred = new Set(options.preferredWeekdays);
  const exceptions = new Set(options.exceptionWeekdays);
  const holidayMap = buildHolidayMap(options.holidays);
  const freezeDays = Math.max(0, Math.floor(options.freezeDays ?? 0));

  return eachDayOfInterval(range).map<DayInfo>((date) => {
    const key = toDayKey(date);
    const weekday = date.getDay();
    const holidays = holidayMap.get(key) ?? [];
    const isSchoolHoliday = holidays.some((entry) => entry.category === "schoolHoliday");
    const isPublicHoliday = holidays.some((entry) => entry.category === "publicHoliday");
    const isFinalWeek = isInFinalWeek(key, options.finalWeek);
    const hasEvent = options.eventDayKeys?.has(key) ?? false;
    const offset = differenceInCalendarDays(date, today);

    let tier: DayTier = "off";
    if (isFinalWeek || preferred.has(weekday)) {
      tier = "core";
    } else if (exceptions.has(weekday) || isSchoolHoliday || isPublicHoliday || hasEvent) {
      tier = "possible";
    }

    return {
      key,
      date,
      weekday,
      tier,
      isFinalWeek,
      isSchoolHoliday,
      isPublicHoliday,
      holidays,
      hasEvent,
      isToday: offset === 0,
      isPast: offset < 0,
      isFrozen: offset >= 0 && offset < freezeDays,
    };
  });
}

export const DAY_TIER_LABELS: Record<DayTier, string> = {
  core: "Kerntag",
  possible: "Ausnahmetag",
  off: "Randtag",
};
