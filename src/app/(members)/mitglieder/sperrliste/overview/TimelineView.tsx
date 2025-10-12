import React, { useMemo, useEffect, useCallback } from "react";

import { 
  CalendarStarIcon, 
  CheckIcon, 
  ClockAlertIcon, 
  StarIcon, 
  UmbrellaIcon, 
  XCircleIcon 
} from "./icons";
import { TimelineCell } from "./timeline-cell";
import { getHolidaySpans, selectDayBuckets, groupPeopleByType } from "./data-helpers";
import type { DayColumn, HolidayIndicator, OverviewPerson, PersonGroup } from "./types";

type TimelineViewProps = {
  people: OverviewPerson[];
  dayCols: DayColumn[];
  holidays: HolidayIndicator[];
  highlightedDay: number | null;
  setHighlightedDay: (day: number | null) => void;
  personFilter?: PersonGroup | "all";
};

export function TimelineView({ 
  people, 
  dayCols, 
  holidays,
  highlightedDay, 
  setHighlightedDay,
  personFilter = "all"
}: TimelineViewProps) {
  const days = useMemo(() => selectDayBuckets(people, dayCols, holidays), [people, dayCols, holidays]);
  const holidaySpans = useMemo(() => getHolidaySpans(dayCols, days), [dayCols, days]);
  
  // Gruppierung nur wenn gefiltert
  const groupedPeople = useMemo(() => {
    if (personFilter === "all") return null;
    return groupPeopleByType(people);
  }, [people, personFilter]);

  // Keyboard Navigation (Arrow Keys)
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "ArrowLeft" && highlightedDay !== null) {
      const currentIndex = dayCols.findIndex(d => d.n === highlightedDay);
      if (currentIndex > 0) {
        const prevDay = dayCols[currentIndex - 1];
        setHighlightedDay(prevDay.n);
        document.querySelector(`[data-day="${prevDay.n}"]`)?.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'center', 
          inline: 'center' 
        });
      }
    } else if (e.key === "ArrowRight" && highlightedDay !== null) {
      const currentIndex = dayCols.findIndex(d => d.n === highlightedDay);
      if (currentIndex < dayCols.length - 1) {
        const nextDay = dayCols[currentIndex + 1];
        setHighlightedDay(nextDay.n);
        document.querySelector(`[data-day="${nextDay.n}"]`)?.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'center', 
          inline: 'center' 
        });
      }
    } else if (e.key === "Escape") {
      setHighlightedDay(null);
    }
  }, [highlightedDay, dayCols, setHighlightedDay]);

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);
  
  return (
    <section className="hidden sm:block">
      {/* Kompakte Symbollegende */}
      <div className="mb-3 flex items-center gap-4 rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-[11px]">
        <span className="font-semibold uppercase tracking-wide text-muted-foreground">Legende:</span>
        <div className="flex items-center gap-1">
          <div className="flex h-5 w-5 items-center justify-center rounded border border-success/40 bg-gradient-to-br from-success/15 to-success/25">
            <StarIcon className="h-3 w-3 text-success-foreground" />
          </div>
          <span className="text-foreground">Bevorzugt</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="flex h-5 w-5 items-center justify-center rounded border border-border/60 bg-muted/30">
            <CheckIcon className="h-3 w-3 text-muted-foreground" />
          </div>
          <span className="text-foreground">Frei</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="flex h-5 w-5 items-center justify-center rounded border border-warning/40 bg-gradient-to-br from-warning/15 to-warning/25">
            <ClockAlertIcon className="h-3 w-3 text-warning-foreground" />
          </div>
          <span className="text-foreground">Eingeschränkt</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="flex h-5 w-5 items-center justify-center rounded border border-destructive/40 bg-gradient-to-br from-destructive/15 to-destructive/25">
            <XCircleIcon className="h-3 w-3 text-destructive-foreground" />
          </div>
          <span className="text-foreground">Gesperrt</span>
        </div>
        <div className="ml-2 h-3 w-px bg-border" />
        <div className="flex items-center gap-1">
          <div className="flex h-5 w-5 items-center justify-center rounded bg-warning border border-warning">
            <CalendarStarIcon className="h-3 w-3 text-warning-foreground" />
          </div>
          <span className="text-foreground">Feiertag</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="flex h-5 w-5 items-center justify-center rounded bg-primary border border-primary">
            <UmbrellaIcon className="h-3 w-3 text-primary-foreground" />
          </div>
          <span className="text-foreground">Ferien</span>
        </div>
      </div>

      {/* Timeline mit sticky Header */}
      <div className="overflow-x-auto rounded-2xl border border-border/60 bg-muted/20 p-3">
        {/* Holiday Spans Bar */}
        {(holidaySpans.length > 0 || holidays.some(h => h.type === 'holiday')) && (
          <div className="mb-3 space-y-1.5 min-w-[900px]">
            {/* Ferien-Balken */}
            {holidaySpans.length > 0 && (
              <div className="relative h-10">
                <div className="grid grid-cols-[200px_1fr] gap-0">
                  <div className="flex items-center justify-end border-r border-border/60 px-3">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-primary">Ferien</span>
                  </div>
                  <div className="grid grid-cols-7 gap-0 relative min-w-0">
                    {holidaySpans.map((span, idx) => {
                      const colSpan = span.end - span.start + 1;
                      return (
                        <div
                          key={`span-${idx}`}
                          className="absolute top-0 h-10 flex items-center justify-center rounded-lg bg-primary/90 border border-primary px-3 text-primary-foreground shadow-md whitespace-nowrap"
                          style={{
                            left: `${(span.start / 7) * 100}%`,
                            width: `${(colSpan / 7) * 100}%`,
                          }}
                        >
                          <UmbrellaIcon className="h-4 w-4" />
                          <span className="ml-2 text-sm font-bold truncate">{span.label || 'Ferien'}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
            
            {/* Feiertags-Balken (separat) */}
            {holidays.some(h => h.type === 'holiday') && (
              <div className="relative h-10">
                <div className="grid grid-cols-[200px_1fr] gap-0">
                  <div className="flex items-center justify-end border-r border-border/60 px-3">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-warning">Feiertage</span>
                  </div>
                  <div className="grid grid-cols-7 gap-0 relative min-w-0">
                    {days.map((day, idx) => {
                      if (day.holidayType === 'holiday' || day.isPublicHoliday) {
                        return (
                          <div
                            key={`holiday-${idx}`}
                            className="absolute top-0 h-10 flex items-center justify-center rounded-lg bg-warning/90 border border-warning px-2 text-warning-foreground shadow-md whitespace-nowrap"
                            style={{
                              left: `${(idx / 7) * 100}%`,
                              width: `${(1 / 7) * 100}%`,
                            }}
                          >
                            <CalendarStarIcon className="h-4 w-4" />
                            <span className="ml-1 text-xs font-bold truncate">{day.holidayLabel || 'Feiertag'}</span>
                          </div>
                        );
                      }
                      return null;
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="space-y-3 min-w-[900px]">
          {/* Tage-Header */}
          <div className="sticky top-0 z-20 rounded-2xl border border-border/60 bg-card/95 shadow-sm backdrop-blur">
            <div className="grid grid-cols-[200px_1fr] gap-0">
              <div className="border-r border-border/60 px-4 py-3">
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Mitglied</span>
              </div>
              <div className="grid grid-cols-7 gap-0 min-w-0">
                {dayCols.map((d) => (
                  <button
                    key={d.key}
                    data-day={d.n}
                    onClick={() => setHighlightedDay(highlightedDay === d.n ? null : d.n)}
                    className={`group flex flex-col items-center gap-1 border-l border-border/50 px-2 py-2 transition-colors hover:bg-muted/50 min-w-[90px] ${
                      highlightedDay === d.n ? 'bg-primary/10' : ''
                    }`}
                    aria-label={`Tag ${d.n} ${highlightedDay === d.n ? 'hervorgehoben' : 'hervorheben'}`}
                  >
                    <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{d.label}</span>
                    <span className={`flex h-7 w-7 items-center justify-center rounded-full border text-[13px] font-semibold transition-all ${
                      highlightedDay === d.n 
                        ? 'border-primary bg-primary text-primary-foreground shadow-md' 
                        : 'border-border bg-muted text-foreground group-hover:border-primary/60'
                    }`}>{d.n}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Personen-Lanes mit Gruppierung */}
          {groupedPeople ? (
            <>
              {/* Schauspieler Gruppe */}
              {groupedPeople.actors.length > 0 && (
                <>
                  <div className="sticky top-0 z-10 -mx-1 mb-2 mt-4 rounded-lg border-l-4 border-primary bg-gradient-to-r from-primary/10 to-primary/15 px-4 py-2.5 backdrop-blur-sm shadow-sm">
                    <h3 className="text-sm font-bold uppercase tracking-wide text-foreground">
                      Schauspieler <span className="ml-2 text-xs font-normal text-muted-foreground">({groupedPeople.actors.length})</span>
                    </h3>
                  </div>
                  {groupedPeople.actors.map((p) => (
                    <PersonLane 
                      key={p.id} 
                      person={p} 
                      dayCols={dayCols} 
                      highlightedDay={highlightedDay} 
                      groupColor="blue"
                    />
                  ))}
                </>
              )}
              
              {/* Beides Gruppe (Schauspieler & Gewerke) */}
              {groupedPeople.both.length > 0 && (
                <>
                  <div className="sticky top-0 z-10 -mx-1 mb-2 mt-4 rounded-lg border-l-4 border-accent bg-gradient-to-r from-accent/10 to-accent/15 px-4 py-2.5 backdrop-blur-sm shadow-sm">
                    <h3 className="text-sm font-bold uppercase tracking-wide text-foreground">
                      Schauspieler & Gewerke <span className="ml-2 text-xs font-normal text-accent-foreground">({groupedPeople.both.length})</span>
                    </h3>
                  </div>
                  {groupedPeople.both.map((p) => (
                    <PersonLane 
                      key={p.id} 
                      person={p} 
                      dayCols={dayCols} 
                      highlightedDay={highlightedDay} 
                      groupColor="purple"
                    />
                  ))}
                </>
              )}

              {/* Gewerke Gruppe */}
              {groupedPeople.crew.length > 0 && (
                <>
                  <div className="sticky top-0 z-10 -mx-1 mb-2 mt-4 rounded-lg border-l-4 border-success bg-gradient-to-r from-success/10 to-success/15 px-4 py-2.5 backdrop-blur-sm shadow-sm">
                    <h3 className="text-sm font-bold uppercase tracking-wide text-foreground">
                      Gewerke <span className="ml-2 text-xs font-normal text-success-foreground">({groupedPeople.crew.length})</span>
                    </h3>
                  </div>
                  {groupedPeople.crew.map((p) => (
                    <PersonLane 
                      key={p.id} 
                      person={p} 
                      dayCols={dayCols} 
                      highlightedDay={highlightedDay} 
                      groupColor="green"
                    />
                  ))}
                </>
              )}
            </>
          ) : (
            /* Ungefilterte Liste ohne Gruppierung */
            people.map((p) => (
              <PersonLane 
                key={p.id} 
                person={p} 
                dayCols={dayCols} 
                highlightedDay={highlightedDay} 
                groupColor={
                  p.group === 'actors' ? 'blue' :
                  p.group === 'crew' ? 'green' :
                  p.group === 'both' ? 'purple' :
                  'slate'
                }
              />
            ))
          )}
        </div>
      </div>

      <p className="mt-3 text-[11px] text-muted-foreground">
        <strong>Tipp:</strong> Klicke auf einen Tag im Header, um alle Einträge für diesen Tag hervorzuheben. Nutze ← → für Navigation, ESC zum Abbrechen.
      </p>
    </section>
  );
}

// ============================================================================
// PersonLane Sub-Component
// ============================================================================

type PersonLaneProps = {
  person: OverviewPerson;
  dayCols: DayColumn[];
  highlightedDay: number | null;
  groupColor: 'blue' | 'green' | 'purple' | 'slate';
};

function PersonLane({ person, dayCols, highlightedDay, groupColor }: PersonLaneProps) {
  const colorMap = {
    blue: 'from-primary to-primary',
    green: 'from-success to-success',
    purple: 'from-accent to-accent',
    slate: 'from-muted-foreground to-muted-foreground',
  };

  // Initialen generieren
  const initials = person.name
    .split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  // Stats berechnen
  const stats = `${person.days.filter(d => d.type === 'free' || d.type === 'preferred').length}/${person.days.length} frei`;

  return (
    <div className="rounded-2xl border border-border/60 bg-card shadow-sm transition-shadow hover:shadow-md mb-3">
      <div className="grid grid-cols-[200px_1fr] gap-0">
        {/* Person Info */}
        <div className="flex items-center gap-3 border-r border-border/60 px-4 py-3">
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${colorMap[groupColor]} text-sm font-semibold text-white shadow-sm`}>
            {initials}
          </span>
          <div className="min-w-0">
            <p className="truncate font-semibold leading-5 text-foreground">{person.name}</p>
            <p className="text-[11px] text-muted-foreground">{stats}</p>
          </div>
        </div>

        {/* Timeline Cells */}
        <div className="grid grid-cols-7 gap-0 min-w-0">
          {person.days.map((cell, i) => (
            <div
              key={`${person.id}-${cell.dayKey}`}
              className={`relative border-l border-border/50 px-2.5 py-3 transition-all min-w-[90px] ${
                highlightedDay === dayCols[i].n ? 'bg-primary/10 ring-2 ring-inset ring-primary/30' : ''
              }`}
            >
              <TimelineCell cell={cell} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
