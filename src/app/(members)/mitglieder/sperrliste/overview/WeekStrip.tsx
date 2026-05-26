import React, { useMemo } from "react";

import { CalendarStarIcon, UmbrellaIcon } from "./icons";
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
  
  const handleJump = (day: number) => {
    const el = document.getElementById(`day-${day}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    onJump(day);
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-b from-card to-muted/30 shadow-sm">
      {/* Responsive Grid: 3 cols auf xs, 7 cols auf sm+ */}
      <div className="grid grid-cols-3 gap-px bg-border/40 sm:grid-cols-7">
        {buckets.map((bucket) => {
          const isToday = bucket.column.accent === true;
          const totalCount = bucket.available.length + bucket.limited.length + bucket.blocked.length;
          const availablePercent = totalCount > 0 ? Math.round((bucket.available.length / totalCount) * 100) : 0;
          
          // Holiday type detection
          const isVacation = bucket.holiday?.type === "vacation";
          const isPublicHoliday = bucket.holiday?.type === "holiday";
          const holidayType = isVacation || isPublicHoliday ? (isVacation ? 'vacation' : 'holiday') : null;
          
          return (
            <button
              key={bucket.column.key}
              className={`group relative flex flex-col items-center justify-center gap-1.5 bg-card p-2 transition-all active:scale-95 sm:p-2.5 ${
                isToday ? 'bg-primary/10 ring-2 ring-inset ring-primary/30' : 'active:bg-muted/50'
              }`}
              onClick={() => handleJump(bucket.column.n)}
              aria-label={`${bucket.column.label} ${bucket.column.n}. öffnen`}
              type="button"
            >
              {/* Tag-Nummer und Wochentag */}
              <div className="flex flex-col items-center gap-0.5">
                <span className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground sm:text-[10px]">
                  {bucket.column.label}
                </span>
                <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold transition-colors sm:h-7 sm:w-7 sm:text-sm ${
                  isToday 
                    ? 'bg-primary text-primary-foreground shadow-sm' 
                    : holidayType
                      ? 'bg-primary/20 border border-primary/30 text-primary'
                      : 'text-foreground group-active:text-primary'
                }`}>
                  {bucket.column.n}
                </span>
              </div>

              {/* Kompakte Status-Badges (farbige bubbles mit counts) */}
              {totalCount > 0 && (
                <div className="flex items-center gap-0.5">
                  {bucket.available.length > 0 && (
                    <div className="flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-success/20 px-0.5 text-[9px] font-semibold text-success-foreground sm:h-4 sm:min-w-[16px] sm:px-1 sm:text-[10px]">
                      {bucket.available.length}
                    </div>
                  )}
                  {bucket.limited.length > 0 && (
                    <div className="flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-warning/20 px-0.5 text-[9px] font-semibold text-warning-foreground sm:h-4 sm:min-w-[16px] sm:px-1 sm:text-[10px]">
                      {bucket.limited.length}
                    </div>
                  )}
                  {bucket.blocked.length > 0 && (
                    <div className="flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-destructive/20 px-0.5 text-[9px] font-semibold text-destructive-foreground sm:h-4 sm:min-w-[16px] sm:px-1 sm:text-[10px]">
                      {bucket.blocked.length}
                    </div>
                  )}
                </div>
              )}

              {/* Verfügbarkeits-Fortschrittsbalken (absolut bottom) */}
              {totalCount > 0 && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5">
                  <div 
                    className={`h-full transition-all ${
                      availablePercent >= 75 ? 'bg-success' :
                      availablePercent >= 50 ? 'bg-warning' :
                      'bg-destructive'
                    }`}
                    style={{ width: `${availablePercent}%` }}
                  />
                </div>
              )}

              {/* Feiertag/Ferien-Icons (absolut corner) */}
              {holidayType === 'holiday' && !isVacation && (
                <div className="absolute right-1 top-1">
                  <CalendarStarIcon className="h-3 w-3 text-amber-500" />
                </div>
              )}
              {holidayType === 'vacation' && !isPublicHoliday && (
                <div className="absolute right-1 top-1">
                  <UmbrellaIcon className="h-3 w-3 text-primary500" />
                </div>
              )}
              {holidayType === 'vacation' && isPublicHoliday && (
                <div className="absolute right-0.5 top-0.5 flex gap-0.5">
                  <UmbrellaIcon className="h-2.5 w-2.5 text-primary500" />
                  <CalendarStarIcon className="h-2.5 w-2.5 text-amber-500" />
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
