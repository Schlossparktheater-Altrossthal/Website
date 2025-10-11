/**
 * Desktop-Tabellen-Ansicht für Sperrlistenübersicht
 * Sticky Header & Name-Spalte, Ferien/Feiertags-Zeilen, Gruppierungs-Spalte
 */

import React, { useMemo, useRef, useState, useEffect } from "react";

import { CalendarStarIcon, ClockIcon, UmbrellaIcon } from "./icons";
import { Cell } from "./table-cell";
import { IconButton } from "./ui-components";
import { getHolidaySpans, selectDayBuckets, groupPeopleByType } from "./data-helpers";
import type { DayColumn, HolidayIndicator, OverviewPerson, PersonGroup } from "./types";

type DesktopTableProps = {
  people: OverviewPerson[];
  dayCols: DayColumn[];
  holidays: HolidayIndicator[];
  personFilter?: PersonGroup | "all";
  compact?: boolean;
  month?: { label: string; year: number; month: number };
  onPreviousMonth?: () => void;
  onNextMonth?: () => void;
  onJumpToToday?: () => void;
};

export function DesktopTable({ 
  people, 
  dayCols, 
  holidays, 
  personFilter = "all",
  compact = false,
  month,
  onPreviousMonth,
  onNextMonth,
  onJumpToToday
}: DesktopTableProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showHint, setShowHint] = useState(false);

  const dayBuckets = useMemo(() => selectDayBuckets(people, dayCols, holidays), [people, dayCols, holidays]);
  const holidaySpans = useMemo(() => getHolidaySpans(dayCols, dayBuckets), [dayCols, dayBuckets]);
  
  // Gruppierung nur wenn "all" ausgewählt ist
  const groupedPeople = useMemo(() => {
    if (personFilter === "all") {
      return groupPeopleByType(people);
    }
    return null;
  }, [people, personFilter]);

  const filteredPeople = useMemo(() => {
    if (personFilter === "all") return people;
    return people.filter(p => p.group === personFilter);
  }, [people, personFilter]);

  // Show scrolling hint for 3s on mount
  useEffect(() => {
    setShowHint(true);
    const timer = setTimeout(() => setShowHint(false), 3000);
    return () => clearTimeout(timer);
  }, []);

  const hasFerien = holidaySpans.length > 0;
  const hasFeiertage = dayBuckets.some(d => d.holidayType === 'holiday' || d.isPublicHoliday);
  const showGroupColumn = personFilter === "all";

  return (
    <section className="hidden sm:block">
      {/* Monatsnavigation analog Spielplatz */}
      {(month || onPreviousMonth || onNextMonth || onJumpToToday) && (
        <div className="mb-2 flex items-center justify-between gap-2">
          {month && <div className="text-sm font-semibold text-slate-700">{month.label}</div>}
          <div className="flex items-center gap-1 rounded-xl border border-slate-200/70 bg-white/80 p-1 shadow-sm">
            {onPreviousMonth && (
              <IconButton aria-label="Vorheriger Monat" onClick={onPreviousMonth}>
                &larr;
              </IconButton>
            )}
            {onNextMonth && (
              <IconButton aria-label="Nächster Monat" onClick={onNextMonth}>
                &rarr;
              </IconButton>
            )}
            {onJumpToToday && (
              <button
                type="button"
                className="ml-1 inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white/70 px-2.5 py-1 text-sm font-medium hover:bg-white transition-colors"
                aria-label="Zu heute springen"
                onClick={onJumpToToday}
              >
                <ClockIcon className="h-4 w-4" /> Heute
              </button>
            )}
          </div>
        </div>
      )}
      
      {/* Tabelle mit sticky Header und Namen - lokaler Scroll-Container */}
      <div 
        className="relative max-h-[calc(100vh-16rem)] overflow-auto overscroll-y-auto rounded-2xl border border-slate-200/70 bg-white shadow-sm" 
        ref={scrollRef}
      >
        {showHint && (
          <div className="pointer-events-none absolute inset-x-0 top-0 z-30 bg-gradient-to-b from-white/75 to-transparent px-3 py-2 text-[11px] text-slate-500">
            <span className="rounded-md border border-slate-200 bg-white/80 px-2 py-0.5">
              Tipp: horizontal wischen/scrollen →
            </span>
          </div>
        )}
        
        <table className={`w-full ${compact ? "text-[12px]" : "text-sm"} table-fixed border-collapse [--th:theme(colors.slate.200/.7)]`}>
          <thead className="sticky top-0 z-20 bg-white backdrop-blur shadow-sm">
            {/* Ferien-Zeile über den Tagen */}
            {(hasFerien || hasFeiertage) && (
              <>
                {/* Ferien-Zeile */}
                {hasFerien && (
                  <tr>
                    {showGroupColumn && (
                      <th className="sticky left-0 z-20 w-3 border-b border-r border-[color:var(--th)] bg-white"></th>
                    )}
                    <th className={`sticky ${showGroupColumn ? 'left-3' : 'left-0'} z-20 w-[280px] sm:w-[340px] min-w-[280px] border-b border-r border-[color:var(--th)] bg-white px-3 py-2 text-right`}>
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-sky-600">Ferien</span>
                    </th>
                    {dayCols.map((_, idx) => {
                      const span = holidaySpans.find((s) => s.start === idx);
                      const isInSpan = holidaySpans.some((s) => idx >= s.start && idx <= s.end);
                      
                      if (span) {
                        const colSpan = span.end - span.start + 1;
                        return (
                          <th
                            key={idx}
                            colSpan={colSpan}
                            className="border-b border-[color:var(--th)] bg-gradient-to-r from-sky-400 to-sky-500 px-2 py-2"
                          >
                            <div className="flex items-center justify-center gap-2 text-white">
                              <UmbrellaIcon className="h-4 w-4" />
                              <span className="text-sm font-bold">{span.label || 'Ferien'}</span>
                            </div>
                          </th>
                        );
                      }
                      
                      if (isInSpan) {
                        return null; // Wird vom colSpan abgedeckt
                      }
                      
                      return <th key={idx} className="border-b border-[color:var(--th)] bg-white"></th>;
                    })}
                  </tr>
                )}
                
                {/* Feiertags-Zeile */}
                {hasFeiertage && (
                  <tr>
                    {showGroupColumn && (
                      <th className="sticky left-0 z-20 w-3 border-b border-r border-[color:var(--th)] bg-white"></th>
                    )}
                    <th className={`sticky ${showGroupColumn ? 'left-3' : 'left-0'} z-20 w-[280px] sm:w-[340px] min-w-[280px] border-b border-r border-[color:var(--th)] bg-white px-3 py-2 text-right`}>
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-600">Feiertage</span>
                    </th>
                    {dayCols.map((_, idx) => {
                      const day = dayBuckets[idx];
                      if (day?.holidayType === 'holiday' || day?.isPublicHoliday) {
                        return (
                          <th 
                            key={idx} 
                            className="border-b border-[color:var(--th)] bg-gradient-to-r from-amber-400 to-amber-500 px-2 py-2"
                          >
                            <div className="flex items-center justify-center gap-1 text-white">
                              <CalendarStarIcon className="h-4 w-4" />
                              <span className="text-xs font-bold truncate">{day.holidayLabel || 'Feiertag'}</span>
                            </div>
                          </th>
                        );
                      }
                      
                      return <th key={idx} className="border-b border-[color:var(--th)] bg-white"></th>;
                    })}
                  </tr>
                )}
              </>
            )}
            
            {/* Haupt-Header mit Tag-Nummern */}
            <tr>
              {showGroupColumn && (
                <th scope="col" className="sticky left-0 z-20 w-3 min-w-[12px] border-b border-r border-[color:var(--th)] bg-white"></th>
              )}
              <th 
                scope="col" 
                className={`sticky ${showGroupColumn ? 'left-3' : 'left-0'} z-20 w-[280px] sm:w-[340px] min-w-[280px] border-b border-r border-[color:var(--th)] bg-white px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500`}
              >
                Mitglied
              </th>
              {dayCols.map((d, idx) => (
                <th 
                  key={d.key} 
                  scope="col" 
                  className={`border-b border-[color:var(--th)] px-2 py-2 text-center align-bottom min-w-[110px] w-[110px] ${
                    d.accent ? 'bg-blue-50/80' : 'bg-white'
                  } ${idx === dayCols.length - 1 ? 'rounded-tr-2xl' : ''}`}
                >
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-[10px] uppercase tracking-[0.2em] text-slate-500">{d.label}</span>
                    <span className={`flex h-7 w-7 items-center justify-center rounded-full border text-[13px] font-semibold ${
                      d.accent 
                        ? 'border-blue-500 bg-blue-500 text-white shadow-md'
                        : 'border-slate-200 bg-slate-50 text-slate-900'
                    }`}>
                      {d.n}
                    </span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          
          <tbody>
            {groupedPeople ? (
              <>
                {/* Schauspieler Gruppe */}
                {groupedPeople.actors.map((p, idx) => (
                  <PersonRow 
                    key={p.id}
                    person={p}
                    compact={compact}
                    isFirstInGroup={idx === 0}
                    groupSize={groupedPeople.actors.length}
                    groupLabel="Schauspieler"
                    groupColor="blue"
                  />
                ))}
                
                {/* Beides Gruppe (Schauspieler & Gewerke) */}
                {groupedPeople.both.map((p, idx) => (
                  <PersonRow 
                    key={p.id}
                    person={p}
                    compact={compact}
                    isFirstInGroup={idx === 0}
                    groupSize={groupedPeople.both.length}
                    groupLabel="Beides"
                    groupColor="purple"
                  />
                ))}
                
                {/* Gewerke Gruppe */}
                {groupedPeople.crew.map((p, idx) => (
                  <PersonRow 
                    key={p.id}
                    person={p}
                    compact={compact}
                    isFirstInGroup={idx === 0}
                    groupSize={groupedPeople.crew.length}
                    groupLabel="Gewerke"
                    groupColor="green"
                    isLastGroup={true}
                  />
                ))}
              </>
            ) : (
              /* Gefilterte Liste ohne Gruppierungs-Header */
              filteredPeople.map((p) => (
                <tr key={p.id} className="border-b border-slate-200/60">
                  <th 
                    scope="row" 
                    className="sticky left-0 z-10 w-[280px] sm:w-[340px] min-w-[280px] border-r border-slate-200/70 bg-white backdrop-blur shadow-sm px-3 py-2 text-left"
                  >
                    <PersonInfo person={p} />
                  </th>
                  {p.days.map((cell) => (
                    <td key={`${p.id}-${cell.dayKey}`} className="h-20 px-1.5 py-1.5 align-top whitespace-normal break-words">
                      <Cell cell={cell} compact={compact} />
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ============================================================================
// PersonRow Sub-Component (with group column)
// ============================================================================

type PersonRowProps = {
  person: OverviewPerson;
  compact: boolean;
  isFirstInGroup: boolean;
  groupSize: number;
  groupLabel: string;
  groupColor: 'blue' | 'green' | 'purple';
  isLastGroup?: boolean;
};

function PersonRow({ 
  person, 
  compact, 
  isFirstInGroup, 
  groupSize, 
  groupLabel, 
  groupColor,
  isLastGroup = false
}: PersonRowProps) {
  const colorMap = {
    blue: 'from-blue-400 to-blue-500',
    green: 'from-green-400 to-green-500',
    purple: 'from-purple-400 to-pink-500',
  };

  return (
    <tr className="border-b border-slate-200/60 group">
      {isFirstInGroup && (
        <th 
          rowSpan={groupSize}
          scope="rowgroup"
          aria-label={`${groupLabel} Gruppe`}
          className={`sticky left-0 z-10 w-3 border-r border-slate-200/70 bg-gradient-to-b ${colorMap[groupColor]} p-0 ${isLastGroup ? 'rounded-bl-2xl' : ''}`}
        >
          <div className="flex h-full items-center justify-center">
            <span 
              className="text-[9px] font-bold uppercase tracking-widest text-white whitespace-nowrap"
              style={{ 
                writingMode: 'vertical-rl', 
                transform: 'rotate(180deg)',
                letterSpacing: '0.15em'
              }}
            >
              {groupLabel}
            </span>
          </div>
        </th>
      )}
      <th 
        scope="row" 
        className="sticky left-3 z-10 w-[280px] sm:w-[340px] min-w-[280px] border-r border-slate-200/70 bg-white backdrop-blur shadow-sm px-3 py-2 text-left"
      >
        <PersonInfo person={person} groupColor={groupColor} />
      </th>
      {person.days.map((cell) => (
        <td key={`${person.id}-${cell.dayKey}`} className="h-20 px-1.5 py-1.5 align-top whitespace-normal break-words">
          <Cell cell={cell} compact={compact} />
        </td>
      ))}
    </tr>
  );
}

// ============================================================================
// PersonInfo Sub-Component
// ============================================================================

type PersonInfoProps = {
  person: OverviewPerson;
  groupColor?: 'blue' | 'green' | 'purple';
};

function PersonInfo({ person, groupColor }: PersonInfoProps) {
  // Initialen generieren
  const initials = person.name
    .split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const avatarColor = groupColor 
    ? {
        blue: 'bg-primary/15 text-primary-foreground',
        green: 'bg-success/15 text-success-foreground',
        purple: 'bg-accent/15 text-accent-foreground',
      }[groupColor]
    : person.group === 'actors'
      ? 'bg-primary/15 text-primary-foreground'
      : person.group === 'crew'
        ? 'bg-success/15 text-success-foreground'
        : person.group === 'both'
          ? 'bg-accent/15 text-accent-foreground'
          : 'bg-muted/50 text-muted-foreground';

  return (
    <div className="flex items-center gap-2">
      <span className={`flex h-8 w-8 items-center justify-center rounded-full ${avatarColor} text-xs font-semibold`}>
        {initials}
      </span>
      <div className="min-w-[10ch] whitespace-normal">
        <p className="font-semibold leading-5">{person.name}</p>
      </div>
    </div>
  );
}
