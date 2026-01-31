"use client";

import { useMemo, useState } from "react";
import { format, isSameDay } from "date-fns";
import { de } from "date-fns/locale/de";

import { getNameInitials } from "@/lib/names";
import type { WeekdayValue } from "@/lib/weekdays";
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
import OverviewContent from "./overview-content";

export type OverviewShellProps = {
  monthLabel: string;
  summary: BlockOverviewSummary;
  holidaysInRangeCount: number;
  busiestMember: { name: string; total: number } | null;
  preparedMembers: PreparedMember[];
  visibleDayInfo: VisibleDayInfo[];
  preferredWeekdaySet: Set<number>;
  exceptionWeekdaySet: Set<number>;
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
  preparedMembers,
  visibleDayInfo,
  preferredWeekdaySet,
  exceptionWeekdaySet,
  holidayMap,
  onPrev,
  onNext,
  onReset,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onSelectBlockedDay,
}: OverviewShellProps) {
  const numberFormatter = useMemo(() => new Intl.NumberFormat("de-DE"), []);
  const [showWeekendsOnly, setShowWeekendsOnly] = useState(false);
  void _holidaysInRangeCount;
  void _busiestMember;

  const visibleDayInfoForView = useMemo(() => {
    if (!showWeekendsOnly) return visibleDayInfo;
    return visibleDayInfo.filter(
      (info) => info.isWeekend || preferredWeekdaySet.has(info.weekday) || exceptionWeekdaySet.has(info.weekday),
    );
  }, [exceptionWeekdaySet, preferredWeekdaySet, showWeekendsOnly, visibleDayInfo]);

  const dayCols = useMemo<DayColumn[]>(() => {
    return visibleDayInfoForView.map((info) => {
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
  }, [visibleDayInfoForView]);

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

  return (
    <div className="space-y-6">
      {/* Hauptübersicht mit Controls */}
      <OverviewContent
        onExportPdf={() => undefined}
        people={people}
        dayCols={dayCols}
        holidays={holidayIndicators}
        onPreviousMonth={onPrev}
        onNextMonth={onNext}
        onReset={onReset}
        month={{ label: monthLabel, year: dayCols[0]?.date.getFullYear() ?? new Date().getFullYear(), month: dayCols[0]?.date.getMonth() ?? new Date().getMonth() }}
        showWeekendsOnly={showWeekendsOnly}
        onShowWeekendsOnlyChange={setShowWeekendsOnly}
      />
    </div>
  );
}
