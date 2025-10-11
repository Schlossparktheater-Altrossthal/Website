import React, { useMemo, useState } from "react";

import { CalendarStarIcon, CheckIcon, ClockAlertIcon, StarIcon, UmbrellaIcon, XCircleIcon } from "./icons";
import { PersonCard } from "./person-card";
import { StatusBadge } from "./ui-components";
import { getHolidaySpans, type DayBucket, selectDayBuckets } from "./data-helpers";
import type {
  DayColumn,
  HolidayIndicator,
  OverviewPerson,
} from "./types";

type DesktopCalendarProps = {
  people: OverviewPerson[];
  dayCols: DayColumn[];
  holidays: HolidayIndicator[];
};

export function DesktopCalendar({ people, dayCols, holidays }: DesktopCalendarProps) {
  const days = useMemo(() => selectDayBuckets(people, dayCols, holidays), [people, dayCols, holidays]);
  const [hoveredDay, setHoveredDay] = useState<number | null>(null);
  const holidaySpans = useMemo(() => getHolidaySpans(dayCols, days), [dayCols, days]);
  
  // Determine if we need compact mode based on people count
  const totalPeople = people.length;
  const isCompactMode = totalPeople > 5;
  
  return (
    <section className="hidden sm:block">
      {/* Horizontal Scrolling Container mit Touch-Support */}
      <div className="overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent touch-pan-x">
        <div className="min-w-max">
          {/* Holiday Spans Bar - scrollt MIT den Karten */}
          {(holidaySpans.length > 0 || holidays.some(h => h.type === 'holiday')) && (
            <div className="mb-3 space-y-1.5">
              {/* Ferien-Balken mit responsive Breite */}
              {holidaySpans.length > 0 && (
                <div className="flex gap-3">
                  {dayCols.map((_, idx) => {
                    const span = holidaySpans.find((s) => s.start === idx);
                    const isInSpan = holidaySpans.some((s) => idx >= s.start && idx <= s.end);
                    const isStart = span !== undefined;
                    
                    if (isStart && span) {
                      const colSpan = span.end - span.start + 1;
                      // Responsive card width: 240px auf sm, 288px auf md+
                      const cardWidth = 'clamp(240px, 20vw, 288px)';
                      const gapWidth = 12;
                      return (
                        <div
                          key={idx}
                          className="flex items-center justify-center rounded-lg bg-gradient-to-r from-sky-400 to-sky-500 px-3 py-2 text-white shadow-md shrink-0"
                          style={colSpan > 1 ? {
                            width: `calc(${colSpan} * ${cardWidth} + ${(colSpan - 1) * gapWidth}px)`
                          } : {
                            width: cardWidth
                          }}
                        >
                          <UmbrellaIcon className="h-4 w-4" />
                          <span className="ml-2 text-sm font-bold truncate">{span.label || 'Ferien'}</span>
                        </div>
                      );
                    }
                    
                    if (isInSpan && !isStart) {
                      return null; // Wird vom Span abgedeckt
                    }
                    
                    return <div key={idx} className="w-72 shrink-0" />;
                  })}
                </div>
              )}
              
              {/* Feiertags-Balken (separat) */}
              {holidays.some(h => h.type === 'holiday') && (
                <div className="flex gap-3">
                  {dayCols.map((_, idx) => {
                    const holiday = holidays.find(h => h.dayIndex === idx && h.type === 'holiday');
                    if (holiday) {
                      return (
                        <div
                          key={idx}
                          className="flex items-center justify-center rounded-lg bg-gradient-to-r from-amber-400 to-amber-500 px-3 py-2 text-white shadow-md shrink-0 w-72"
                        >
                          <CalendarStarIcon className="h-4 w-4" />
                          <span className="ml-2 text-sm font-bold truncate">{holiday.label || 'Feiertag'}</span>
                        </div>
                      );
                    }
                    
                    return <div key={idx} className="w-72 shrink-0" />;
                  })}
                </div>
              )}
            </div>
          )}
          
          {/* Karten-Grid */}
          <div className="flex gap-3">
            {days.map((bucket: DayBucket) => {
              const isHovered = hoveredDay === bucket.column.n;
              const isToday = bucket.column.accent === true;
              const totalCount = bucket.available.length + bucket.limited.length + bucket.blocked.length;
              const availablePercent = totalCount > 0 ? Math.round((bucket.available.length / totalCount) * 100) : 0;
              
              return (
                <div 
                  key={bucket.column.key} 
                  id={`day-${bucket.column.n}`}
                  className={`group flex flex-col rounded-2xl border bg-gradient-to-br shadow-md transition-all duration-300 w-72 shrink-0 ${
                    isToday
                      ? 'border-blue-500 shadow-xl ring-2 ring-blue-500/30'
                      : isHovered 
                        ? 'border-blue-300 shadow-xl scale-[1.02] ring-2 ring-blue-200/50' 
                        : 'border-slate-200/70 hover:border-slate-300 hover:shadow-lg'
                  } ${
                    bucket.holiday 
                      ? 'from-sky-50 to-white' 
                      : availablePercent >= 75 
                        ? 'from-green-50/30 to-white'
                        : availablePercent <= 25
                          ? 'from-red-50/30 to-white'
                          : 'from-white to-slate-50/30'
                  } ${isCompactMode ? 'min-h-[16rem] max-h-[24rem]' : 'min-h-[20rem] max-h-[32rem]'}`}
                  onMouseEnter={() => setHoveredDay(bucket.column.n)}
                  onMouseLeave={() => setHoveredDay(null)}
                >
                  {/* Header mit Glassmorphism und verbessertem Layout */}
                  <div className="relative overflow-hidden border-b border-slate-200/50 backdrop-blur-sm shrink-0">
                    <div className="absolute inset-0 bg-gradient-to-b from-white/80 to-white/40" />
                    <div className="relative px-2.5 py-2">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex flex-col min-w-0">
                          <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-slate-500">
                            {bucket.column.label}
                          </span>
                          <span className="text-lg font-bold text-slate-900">{bucket.column.n}</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-end gap-0.5">
                        <StatusBadge 
                          icon={<StarIcon className="h-3 w-3" />} 
                          count={bucket.available.length} 
                          tone="ok" 
                          compact={isCompactMode} 
                        />
                        <StatusBadge 
                          icon={<ClockAlertIcon className="h-3 w-3" />} 
                          count={bucket.limited.length} 
                          tone="warn" 
                          compact={isCompactMode} 
                        />
                        <StatusBadge 
                          icon={<XCircleIcon className="h-3 w-3" />} 
                          count={bucket.blocked.length} 
                          tone="danger" 
                          compact={isCompactMode} 
                        />
                      </div>
                    </div>
                  
                    {/* Availability Progress Bar */}
                    {totalCount > 0 && (
                      <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-200/50">
                        <div 
                          className={`h-full transition-all duration-500 ${
                            availablePercent >= 75 ? 'bg-gradient-to-r from-green-400 to-green-500' :
                            availablePercent >= 50 ? 'bg-gradient-to-r from-yellow-400 to-orange-400' :
                            'bg-gradient-to-r from-orange-500 to-red-500'
                          }`}
                          style={{ width: `${availablePercent}%` }}
                        />
                      </div>
                    )}
                  </div>

                  {/* Content with better scrolling */}
                  <div className="flex-1 overflow-auto p-2 space-y-1.5 scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent">
                    {bucket.available.length > 0 && (
                      <div className="space-y-1">
                        <h4 className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-success-foreground sticky top-0 bg-gradient-to-b from-card via-card to-transparent pb-1 z-10">
                          <StarIcon className="h-3 w-3 fill-success-foreground" />
                          <span className="hidden lg:inline">Verfügbar</span>
                        </h4>
                        <ul className="space-y-1">
                          {bucket.available.map(({ person, cell }, i) => (
                            <PersonCard 
                              key={person.name + i}
                              person={person}
                              cell={cell}
                              tone="ok"
                              compact={isCompactMode}
                            />
                          ))}
                        </ul>
                      </div>
                    )}

                    {bucket.limited.length > 0 && (
                      <div className="space-y-1">
                        <h4 className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-warning-foreground sticky top-0 bg-gradient-to-b from-card via-card to-transparent pb-1 z-10">
                          <ClockAlertIcon className="h-3 w-3" />
                          <span className="hidden lg:inline">Eingeschränkt</span>
                        </h4>
                        <ul className="space-y-1">
                          {bucket.limited.map(({ person, cell }, i) => (
                            <PersonCard 
                              key={person.name + i}
                              person={person}
                              cell={cell}
                              tone="warn"
                              compact={isCompactMode}
                            />
                          ))}
                        </ul>
                      </div>
                    )}

                    {bucket.blocked.length > 0 && (
                      <div className="space-y-1">
                        <h4 className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-destructive-foreground sticky top-0 bg-gradient-to-b from-card via-card to-transparent pb-1 z-10">
                          <XCircleIcon className="h-3 w-3" />
                          <span className="hidden lg:inline">Gesperrt</span>
                        </h4>
                        <ul className="space-y-1">
                          {bucket.blocked.map(({ person, cell }, i) => (
                            <PersonCard 
                              key={person.name + i}
                              person={person}
                              cell={cell}
                              tone="danger"
                              compact={isCompactMode}
                            />
                          ))}
                        </ul>
                      </div>
                    )}

                    {totalCount === 0 && (
                      <div className="flex h-full min-h-[8rem] items-center justify-center">
                        <div className="rounded-xl border-2 border-dashed border-border bg-muted/30 px-3 py-4 text-center">
                          <CheckIcon className="h-5 w-5 mx-auto text-muted-foreground" />
                          <p className="mt-1 text-[11px] font-medium text-muted-foreground">Keine Einträge</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Footer mit Stats - kompakter */}
                  <div className="relative overflow-hidden border-t border-border/50 backdrop-blur-sm shrink-0">
                    <div className="absolute inset-0 bg-gradient-to-t from-card/80 to-card/40" />
                    <div className="relative flex items-center justify-between px-2.5 py-1.5 text-[10px] font-medium">
                      <span className="flex items-center gap-1 text-success-foreground">
                        <span className="h-1.5 w-1.5 rounded-full bg-success" />
                        {bucket.available.length}
                      </span>
                      <span className="flex items-center gap-1 text-warning-foreground">
                        <span className="h-1.5 w-1.5 rounded-full bg-warning" />
                        {bucket.limited.length}
                      </span>
                      <span className="flex items-center gap-1 text-destructive-foreground">
                        <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
                        {bucket.blocked.length}
                      </span>
                      <span className="hidden lg:inline text-muted-foreground">
                        {availablePercent}%
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      
      {/* Helper Text */}
      <p className="mt-3 text-[11px] text-slate-500">
        {isCompactMode && (
          <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-blue-700 font-medium mr-2">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
            Kompaktmodus aktiv ({totalPeople} Personen)
          </span>
        )}
        Scroll horizontal für alle Tage · Hover für Details
      </p>
    </section>
  );
}
