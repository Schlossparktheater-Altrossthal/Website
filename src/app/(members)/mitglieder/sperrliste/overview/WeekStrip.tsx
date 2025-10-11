import React, { useMemo } from "react";

import type {
  DayColumn,
  HolidayIndicator,
  OverviewPerson,
  OverviewPersonDay,
} from "./types";

type WeekStripEntry = {
  person: OverviewPerson;
  cell: OverviewPersonDay;
};

type WeekStripBucket = {
  column: DayColumn;
  available: WeekStripEntry[];
  limited: WeekStripEntry[];
  blocked: WeekStripEntry[];
  holiday: HolidayIndicator | null;
};

type WeekStripProps = {
  people: OverviewPerson[];
  dayCols: DayColumn[];
  holidays: HolidayIndicator[];
  onJump: (day: number) => void;
};

function selectDayBuckets(people: OverviewPerson[], dayCols: DayColumn[], holidays: HolidayIndicator[]): WeekStripBucket[] {
  return dayCols.map((column, index) => {
    const entries: WeekStripEntry[] = people.map((person) => ({ person, cell: person.days[index] }));
    const available = entries.filter((entry) => entry.cell.type === "preferred" || entry.cell.type === "free");
    const limited = entries.filter((entry) => entry.cell.type === "limited");
    const blocked = entries.filter((entry) => entry.cell.type === "block");
    const holiday = holidays.find((indicator) => indicator.dayIndex === index) ?? null;
    return { column, available, limited, blocked, holiday } satisfies WeekStripBucket;
  });
}

export function WeekStrip({ people, dayCols, holidays, onJump }: WeekStripProps) {
  const buckets = useMemo(() => selectDayBuckets(people, dayCols, holidays), [people, dayCols, holidays]);
  return (
    <div className="overflow-x-auto">
      <div className="flex gap-2">
        {buckets.map((bucket) => (
          <button key={bucket.column.key} onClick={() => onJump(bucket.column.n)} className="rounded-lg border px-3 py-2">
            <div>{bucket.column.label} {bucket.column.n}</div>
            <div className="flex gap-1 text-xs">
              <span className="text-green-600">{bucket.available.length} frei</span>
              <span className="text-orange-600">{bucket.limited.length} begrenzt</span>
              <span className="text-red-600">{bucket.blocked.length} gesperrt</span>
            </div>
            {bucket.holiday && (
              <div className="text-blue-600 text-xs">{bucket.holiday.label ?? bucket.holiday.type}</div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
