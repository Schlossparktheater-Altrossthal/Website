import React, { useMemo } from "react";

import type {
  DayColumn,
  HolidayIndicator,
  OverviewPerson,
  OverviewPersonDay,
} from "./types";

type CalendarEntry = {
  person: OverviewPerson;
  cell: OverviewPersonDay;
};

type CalendarBucket = {
  column: DayColumn;
  available: CalendarEntry[];
  limited: CalendarEntry[];
  blocked: CalendarEntry[];
  holiday: HolidayIndicator | null;
};

type DesktopCalendarProps = {
  people: OverviewPerson[];
  dayCols: DayColumn[];
  holidays: HolidayIndicator[];
};

function selectDayBuckets(people: OverviewPerson[], dayCols: DayColumn[], holidays: HolidayIndicator[]): CalendarBucket[] {
  return dayCols.map((column, index) => {
    const entries: CalendarEntry[] = people.map((person) => ({ person, cell: person.days[index] }));
    const available = entries.filter((entry) => entry.cell.type === "preferred" || entry.cell.type === "free");
    const limited = entries.filter((entry) => entry.cell.type === "limited");
    const blocked = entries.filter((entry) => entry.cell.type === "block");
    const holiday = holidays.find((indicator) => indicator.dayIndex === index) ?? null;
    return { column, available, limited, blocked, holiday } satisfies CalendarBucket;
  });
}

export function DesktopCalendar({ people, dayCols, holidays }: DesktopCalendarProps) {
  const buckets = useMemo(() => selectDayBuckets(people, dayCols, holidays), [people, dayCols, holidays]);
  return (
    <div className="grid gap-2 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
      {buckets.map((bucket) => (
        <div key={bucket.column.key} className="border rounded-lg p-3">
          <div className="font-bold mb-1">{bucket.column.label} {bucket.column.n}</div>
          <div className="text-xs mb-2">
            {bucket.holiday ? bucket.holiday.label ?? bucket.holiday.type : null}
          </div>
          <div className="mb-1 text-green-700">{bucket.available.length} frei</div>
          <div className="mb-1 text-orange-700">{bucket.limited.length} begrenzt</div>
          <div className="mb-1 text-red-700">{bucket.blocked.length} gesperrt</div>
        </div>
      ))}
    </div>
  );
}
