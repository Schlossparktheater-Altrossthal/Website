'use client';

import { useMemo } from 'react';
import {
  addDays,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  getISOWeek,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfToday,
  startOfWeek,
} from 'date-fns';
import { de } from 'date-fns/locale/de';

import { combineNameParts } from '@/lib/names';
import { formatWeekdayList, sortWeekdays } from '@/lib/weekdays';
import type { HolidayRange } from '@/types/holidays';

import type { BlockedDay } from '../block-calendar';

type MemberStats = {
  total: number;
  upcoming: number;
};

export type OverviewMember = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  name: string | null;
  email: string | null;
  avatarSource: string | null;
  avatarUpdatedAt: string | null;
  blockedDays: BlockedDay[];
  onboardingFocus: "acting" | "tech" | "both" | null;
};

export type PreparedMember = OverviewMember & {
  displayName: string;
  blockedMap: Map<string, BlockedDay>;
};

export type VisibleDayInfo = {
  day: Date;
  key: string;
  weekday: number;
  isoWeek: number;
  isWeekend: boolean;
  isCurrentMonth: boolean;
};

export type DaySummary = {
  blocked: number;
  limited: number;
  preferred: number;
  holidayCount: number;
};

export type HolidaySegment = {
  key: string;
  titles: string[];
  isHoliday: boolean;
  span: number;
  showDivider: boolean;
};

export type BlockOverviewSummary = {
  totals: Map<string, MemberStats>;
  total: number;
  upcoming: number;
};

export const DATE_FORMAT = 'yyyy-MM-dd';

type UseBlockOverviewDataParams = {
  members: OverviewMember[];
  holidays?: HolidayRange[];
  preferredWeekdays?: number[];
  exceptionWeekdays?: number[];
  currentMonth: Date;
};

function prepareMembers(members: OverviewMember[]): PreparedMember[] {
  return members.map((member) => {
    const blockedMap = new Map<string, BlockedDay>();
    for (const entry of member.blockedDays) {
      blockedMap.set(entry.date, entry);
    }
    const displayName =
      combineNameParts(member.firstName, member.lastName) ??
      member.name ??
      member.email ??
      'Unbekannt';

    return {
      ...member,
      displayName,
      blockedMap,
    };
  });
}

function createHolidayMap(holidays: HolidayRange[]): Map<string, HolidayRange[]> {
  const map = new Map<string, HolidayRange[]>();

  for (const holiday of holidays) {
    const start = parseISO(`${holiday.startDate}`);
    const parsedEnd = parseISO(`${holiday.endDate}`);
    const validStart = Number.isFinite(start.getTime()) ? start : null;
    if (!validStart) continue;
    const end = Number.isFinite(parsedEnd.getTime()) && parsedEnd >= validStart ? parsedEnd : validStart;

    for (let cursor = validStart; cursor <= end; cursor = addDays(cursor, 1)) {
      const key = format(cursor, DATE_FORMAT);
      const entries = map.get(key);
      if (entries) {
        entries.push(holiday);
      } else {
        map.set(key, [holiday]);
      }
    }
  }

  return map;
}

function summarizeMembers(members: PreparedMember[], dayKeys: string[]): BlockOverviewSummary {
  const totals = new Map<string, MemberStats>();
  const keySet = new Set(dayKeys);
  const todayKey = format(startOfToday(), DATE_FORMAT);
  let total = 0;
  let upcoming = 0;

  for (const member of members) {
    let memberTotal = 0;
    let memberUpcoming = 0;

    for (const entry of member.blockedDays) {
      if (entry.kind !== 'BLOCKED') continue;
      if (!keySet.has(entry.date)) continue;
      memberTotal += 1;
      total += 1;
      if (entry.date >= todayKey) {
        memberUpcoming += 1;
        upcoming += 1;
      }
    }

    totals.set(member.id, { total: memberTotal, upcoming: memberUpcoming });
  }

  return { totals, total, upcoming };
}

export function formatCreatedAtLabel(createdAt?: string | null) {
  if (!createdAt) return null;
  const parsed = parseISO(createdAt);
  if (Number.isNaN(parsed.getTime())) return null;
  return format(parsed, "d. MMMM yyyy 'um' HH:mm 'Uhr'", { locale: de });
}

export function useBlockOverviewData({
  members,
  holidays = [],
  preferredWeekdays = [],
  exceptionWeekdays = [],
  currentMonth,
}: UseBlockOverviewDataParams) {
  const preparedMembers = useMemo(() => prepareMembers(members), [members]);

  const daysInView = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const rangeStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const rangeEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

    return eachDayOfInterval({ start: rangeStart, end: rangeEnd });
  }, [currentMonth]);

  const preferredWeekdaySet = useMemo(() => new Set(preferredWeekdays), [preferredWeekdays]);
  const exceptionWeekdaySet = useMemo(() => new Set(exceptionWeekdays), [exceptionWeekdays]);
  const sortedPreferredWeekdays = useMemo(() => sortWeekdays(preferredWeekdays), [preferredWeekdays]);
  const preferredSummary = useMemo(
    () => formatWeekdayList(preferredWeekdays, { fallback: 'keine bevorzugten Probentage' }),
    [preferredWeekdays],
  );
  const exceptionSummary = useMemo(
    () => formatWeekdayList(exceptionWeekdays, { fallback: 'keine Ausnahmeproben' }),
    [exceptionWeekdays],
  );

  const preferredDescription = useMemo(
    () =>
      preferredWeekdays.length > 0
        ? `Standardmäßig heben wir ${preferredSummary} leicht hervor.`
        : 'Aktuell sind keine bevorzugten Probentage hinterlegt – zusätzliche Tage erscheinen nur bei ausdrücklich markierten Wunschterminen.',
    [preferredWeekdays.length, preferredSummary],
  );

  const exceptionDescription = useMemo(
    () =>
      exceptionWeekdays.length > 0
        ? `Ausnahmeproben markieren wir dezent für ${exceptionSummary}.`
        : 'Es sind keine Ausnahmeproben hinterlegt.',
    [exceptionWeekdays.length, exceptionSummary],
  );

  const preferredDayKeys = useMemo(() => {
    const set = new Set<string>();

    for (const member of preparedMembers) {
      for (const entry of member.blockedDays) {
        if (entry.kind === 'PREFERRED') {
          set.add(entry.date);
        }
      }
    }

    return set;
  }, [preparedMembers]);

  const visibleDayInfo = useMemo(
    () =>
      daysInView
        .map((day) => {
          const weekday = day.getDay();
          const key = format(day, DATE_FORMAT);

          return {
            day,
            key,
            weekday,
            isoWeek: getISOWeek(day),
            isWeekend: weekday === 0 || weekday === 6,
            isCurrentMonth: isSameMonth(day, currentMonth),
          } satisfies VisibleDayInfo;
        })
        .filter((info) => {
          const isPreferredDay = preferredWeekdaySet.has(info.weekday);
          const isExceptionDay = exceptionWeekdaySet.has(info.weekday);

          return isPreferredDay || isExceptionDay || preferredDayKeys.has(info.key);
        }),
    [
      daysInView,
      preferredDayKeys,
      preferredWeekdaySet,
      exceptionWeekdaySet,
      currentMonth,
    ],
  );

  const dayKeys = useMemo(() => visibleDayInfo.map((item) => item.key), [visibleDayInfo]);
  const holidayMap = useMemo(() => createHolidayMap(holidays), [holidays]);

  const holidaySegments = useMemo(() => {
    if (!visibleDayInfo.length) return [] as HolidaySegment[];

    const segments: HolidaySegment[] = [];
    let currentSignature: string | null = null;
    let currentTitles: string[] = [];
    let currentSpan = 0;
    let currentIsHoliday = false;
    let currentStartIndex = 0;
    let currentStartKey = '';

    const signatureForEntries = (entries: HolidayRange[]) =>
      entries
        .map((entry) => entry.id ?? `${entry.title ?? 'holiday'}:${entry.startDate}:${entry.endDate}`)
        .sort()
        .join('|');

    for (let index = 0; index < visibleDayInfo.length; index += 1) {
      const { key } = visibleDayInfo[index];
      const entries = holidayMap.get(key) ?? [];
      const signature = entries.length ? signatureForEntries(entries) : '';

      if (signature === currentSignature) {
        currentSpan += 1;
        continue;
      }

      if (currentSpan > 0) {
        const startInfo = visibleDayInfo[currentStartIndex];
        const weekday = startInfo?.day.getDay();
        const showDivider =
          !!startInfo && sortedPreferredWeekdays.length > 0 && weekday === sortedPreferredWeekdays[0] && currentStartIndex !== 0;

        segments.push({
          key: `${currentStartKey}:${currentSignature || 'none'}`,
          titles: currentTitles,
          isHoliday: currentIsHoliday,
          span: currentSpan,
          showDivider,
        });
      }

      currentSignature = signature;
      currentTitles = entries.map((entry) => entry.title).filter(Boolean);
      currentSpan = 1;
      currentIsHoliday = entries.length > 0;
      currentStartIndex = index;
      currentStartKey = key;
    }

    if (currentSpan > 0) {
      const startInfo = visibleDayInfo[currentStartIndex];
      const weekday = startInfo?.day.getDay();
      const showDivider =
        !!startInfo && sortedPreferredWeekdays.length > 0 && weekday === sortedPreferredWeekdays[0] && currentStartIndex !== 0;

      segments.push({
        key: `${currentStartKey}:${currentSignature || 'none'}`,
        titles: currentTitles,
        isHoliday: currentIsHoliday,
        span: currentSpan,
        showDivider,
      });
    }

    return segments;
  }, [holidayMap, sortedPreferredWeekdays, visibleDayInfo]);

  const summary = useMemo(() => summarizeMembers(preparedMembers, dayKeys), [preparedMembers, dayKeys]);

  const holidaysInRange = useMemo(() => {
    if (!dayKeys.length) return [] as HolidayRange[];
    const first = dayKeys[0];
    const last = dayKeys[dayKeys.length - 1];

    return holidays.filter((holiday) => holiday.startDate <= last && holiday.endDate >= first);
  }, [holidays, dayKeys]);

  const monthLabel = useMemo(() => format(currentMonth, 'MMMM yyyy', { locale: de }), [currentMonth]);

  const busiestMember = useMemo(() => {
    let leader: { name: string; total: number } | null = null;

    for (const member of preparedMembers) {
      const stats = summary.totals.get(member.id);
      const total = stats?.total ?? 0;

      if (!leader || total > leader.total) {
        leader = total > 0 ? { name: member.displayName, total } : leader;
      }
    }

    return leader;
  }, [preparedMembers, summary]);

  return {
    preparedMembers,
    preferredWeekdaySet,
    exceptionWeekdaySet,
    sortedPreferredWeekdays,
    preferredDescription,
    exceptionDescription,
    preferredDayKeys,
    visibleDayInfo,
    holidaySegments,
    summary,
    holidaysInRange,
    monthLabel,
    holidayMap,
    busiestMember,
  };
}

