import React, { useCallback, useEffect, useMemo, useState } from "react";

import "./sperrliste-styles.css";
import { Button } from "@/components/ui/button";
import { DownloadIcon } from "@/components/ui/action-icons";

import { DesktopCalendar } from "./DesktopCalendar";
import { DesktopTable } from "./desktop-table";
import { MobileByDay } from "./MobileByDay";
import { TimelineView } from "./TimelineView";
import { WeekStrip } from "./WeekStrip";
import { CalendarStarIcon, ClockIcon, UmbrellaIcon } from "./icons";
import { IconButton } from "./ui-components";
import type { DayColumn, HolidayIndicator, OverviewPerson, PersonGroup } from "./types";

type PersonFilter = PersonGroup | "all";

type OverviewContentProps = {
  onExportPdf: () => void;
  people: OverviewPerson[];
  dayCols: DayColumn[];
  holidays: HolidayIndicator[];
  onPreviousMonth?: () => void;
  onNextMonth?: () => void;
  onReset?: () => void;
  month?: { label: string; year: number; month: number };
  personFilter?: PersonFilter;
  onPersonFilterChange?: (filter: PersonFilter) => void;
  view?: "table" | "calendar" | "timeline";
  onViewChange?: (view: "table" | "calendar" | "timeline") => void;
  highlightedDay?: number | null;
  onHighlightedDayChange?: (day: number | null) => void;
  showWeekendsOnly?: boolean;
  onShowWeekendsOnlyChange?: (showWeekendsOnly: boolean) => void;
};

export default function OverviewContent({
  onExportPdf,
  people,
  dayCols,
  holidays,
  onPreviousMonth,
  onNextMonth,
  onReset,
  month,
  personFilter: controlledPersonFilter,
  onPersonFilterChange,
  view: controlledView,
  onViewChange,
  highlightedDay: controlledHighlightedDay,
  onHighlightedDayChange,
  showWeekendsOnly: controlledShowWeekendsOnly,
  onShowWeekendsOnlyChange,
}: OverviewContentProps) {
  const [internalPersonFilter, setInternalPersonFilter] = useState<PersonFilter>("all");
  const [internalView, setInternalView] = useState<"table" | "calendar" | "timeline">("table");
  const [internalHighlightedDay, setInternalHighlightedDay] = useState<number | null>(null);
  const [internalShowWeekendsOnly, setInternalShowWeekendsOnly] = useState(false);

  const personFilter = controlledPersonFilter ?? internalPersonFilter;
  const view = controlledView ?? internalView;
  const highlightedDay = controlledHighlightedDay ?? internalHighlightedDay;
  const showWeekendsOnly = controlledShowWeekendsOnly ?? internalShowWeekendsOnly;

  const setPersonFilter = useCallback(
    (next: PersonFilter) => {
      onPersonFilterChange?.(next);
      if (controlledPersonFilter === undefined) {
        setInternalPersonFilter(next);
      }
    },
    [controlledPersonFilter, onPersonFilterChange],
  );

  const setView = useCallback(
    (next: "table" | "calendar" | "timeline") => {
      onViewChange?.(next);
      if (controlledView === undefined) {
        setInternalView(next);
      }
    },
    [controlledView, onViewChange],
  );

  const setHighlightedDay = useCallback(
    (next: number | null) => {
      onHighlightedDayChange?.(next);
      if (controlledHighlightedDay === undefined) {
        setInternalHighlightedDay(next);
      }
    },
    [controlledHighlightedDay, onHighlightedDayChange],
  );

  const setShowWeekendsOnly = useCallback(
    (next: boolean) => {
      onShowWeekendsOnlyChange?.(next);
      if (controlledShowWeekendsOnly === undefined) {
        setInternalShowWeekendsOnly(next);
      }
    },
    [controlledShowWeekendsOnly, onShowWeekendsOnlyChange],
  );

  const groupedCounts = useMemo(() => {
    return people.reduce(
      (acc, person) => {
        acc.total += 1;
        // Personen mit "both" werden sowohl bei actors als auch crew gezählt
        if (person.group === "actors" || person.group === "both") acc.actors += 1;
        if (person.group === "crew" || person.group === "both") acc.crew += 1;
        return acc;
      },
      { total: 0, actors: 0, crew: 0 },
    );
  }, [people]);

  const filteredPeople = useMemo(() => {
    if (personFilter === "all") return people;
    if (personFilter === "actors") {
      // Schauspieler-Filter zeigt actors + both (da beide Schauspieler sind)
      return people.filter((person) => person.group === "actors" || person.group === "both");
    }
    if (personFilter === "crew") {
      // Gewerke-Filter zeigt crew + both (da beide Gewerke sind)
      return people.filter((person) => person.group === "crew" || person.group === "both");
    }
    return people.filter((person) => person.group === personFilter);
  }, [people, personFilter]);

  const groupedPeople = useMemo(() => {
    if (personFilter !== "all") return null;
    return people.reduce(
      (acc, person) => {
        if (person.group === "actors") acc.actors.push(person);
        else if (person.group === "crew") acc.crew.push(person);
        else if (person.group === "both") acc.both.push(person);
        return acc;
      },
      { actors: [], crew: [], both: [] } as {
        actors: OverviewPerson[];
        crew: OverviewPerson[];
        both: OverviewPerson[];
      },
    );
  }, [people, personFilter]);

  // "Heute"-Button Handler mit useCallback
  const handleJumpToToday = useCallback(() => {
    const highlighted = dayCols.find((d) => d.accent === true)?.n ?? new Date().getDate();

    const scrollToDay = (day: number) => {
      setHighlightedDay(day);
      const element = document.getElementById(`day-${day}`);
      element?.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
    };

    if (onReset) {
      onReset();
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          scrollToDay(highlighted);
        });
      });
      return;
    }

    scrollToDay(highlighted);
  }, [dayCols, onReset, setHighlightedDay]);

  // Keyboard-Navigation für View-Switching (Strg+1/2/3) mit useCallback
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // Nur wenn Strg/Cmd gedrückt ist
      if (!event.ctrlKey && !event.metaKey) return;

      if (event.key === "1") {
        event.preventDefault();
        setView("calendar");
      } else if (event.key === "2") {
        event.preventDefault();
        setView("table");
      } else if (event.key === "3") {
        event.preventDefault();
        setView("timeline");
      }
    },
    [setView],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="sperrlisten-overview space-y-4">
      <header className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-1">
          <h1 className="text-lg font-semibold sm:text-xl" id="page-title">
            Sperrlistenübersicht
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Monatswechsel-Handler (nur wenn verfügbar) */}
          {(onPreviousMonth || onNextMonth) && (
            <div
              className="flex items-center gap-1 rounded-xl border border-border/60 bg-card/80 p-1 backdrop-blur"
              role="group"
              aria-label="Monatsnavigation"
            >
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
              <Button
                type="button"
                className="ml-1 inline-flex items-center gap-2 rounded-lg border border-border/60 bg-card/70 px-2.5 py-1 text-sm font-medium text-muted-foreground transition-colors hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                aria-label="Zu heute springen"
                onClick={handleJumpToToday}
              >
                <ClockIcon className="h-4 w-4" aria-hidden="true" /> Heute
              </Button>
            </div>
          )}

          <div
            className="flex overflow-hidden rounded-xl border border-border/60 bg-card"
            role="group"
            aria-label="Personenfilter"
          >
            <Button
              type="button"
              variant="toggle"
              data-state={personFilter === "all" ? "active" : "inactive"}
              className="px-3 py-1.5 text-sm font-medium"
              onClick={() => setPersonFilter("all")}
              aria-pressed={personFilter === "all"}
              aria-label={`Alle Personen anzeigen (${groupedCounts.total})`}
            >
              Alle ({groupedCounts.total})
            </Button>
            <Button
              type="button"
              variant="toggle"
              data-state={personFilter === "actors" ? "active" : "inactive"}
              className="border-l border-border/60 px-3 py-1.5 text-sm font-medium"
              onClick={() => setPersonFilter("actors")}
              aria-pressed={personFilter === "actors"}
              aria-label={`Schauspieler anzeigen (${groupedCounts.actors})`}
            >
              Schauspieler ({groupedCounts.actors})
            </Button>
            <Button
              type="button"
              variant="toggle"
              data-state={personFilter === "crew" ? "active" : "inactive"}
              className="border-l border-border/60 px-3 py-1.5 text-sm font-medium"
              onClick={() => setPersonFilter("crew")}
              aria-pressed={personFilter === "crew"}
              aria-label={`Gewerke anzeigen (${groupedCounts.crew})`}
            >
              Gewerke ({groupedCounts.crew})
            </Button>
          </div>
          <div
            className="hidden overflow-hidden rounded-xl border border-border/60 bg-card sm:flex"
            role="group"
            aria-label="Ansichtsauswahl"
          >
            <Button
              type="button"
              variant="toggle"
              data-state={view === "calendar" ? "active" : "inactive"}
              className="px-3 py-1.5 text-sm font-medium"
              onClick={() => setView("calendar")}
              aria-pressed={view === "calendar"}
              aria-label="Kalenderansicht (Tastenkombination: Strg+1)"
            >
              Kalender
            </Button>
            <Button
              type="button"
              variant="toggle"
              data-state={view === "table" ? "active" : "inactive"}
              className="border-l border-border/60 px-3 py-1.5 text-sm font-medium"
              onClick={() => setView("table")}
              aria-pressed={view === "table"}
              aria-label="Tabellenansicht (Tastenkombination: Strg+2)"
            >
              Tabelle
            </Button>
            <Button
              type="button"
              variant="toggle"
              data-state={view === "timeline" ? "active" : "inactive"}
              className="border-l border-border/60 px-3 py-1.5 text-sm font-medium"
              onClick={() => setView("timeline")}
              aria-pressed={view === "timeline"}
              aria-label="Timeline-Ansicht (Tastenkombination: Strg+3)"
            >
              Timeline
            </Button>
          </div>
          <div
            className="flex w-full overflow-hidden rounded-xl border border-border/60 bg-card sm:w-auto"
            role="group"
            aria-label="Wochentage filtern"
          >
            <Button
              type="button"
              variant="toggle"
              data-state={!showWeekendsOnly ? "active" : "inactive"}
              className="flex-1 px-3 py-1.5 text-sm font-medium sm:flex-none"
              onClick={() => setShowWeekendsOnly(false)}
              aria-pressed={!showWeekendsOnly}
            >
              Ganze Woche
            </Button>
            <Button
              type="button"
              variant="toggle"
              data-state={showWeekendsOnly ? "active" : "inactive"}
              className="flex-1 border-l border-border/60 px-3 py-1.5 text-sm font-medium sm:flex-none"
              onClick={() => setShowWeekendsOnly(true)}
              aria-pressed={showWeekendsOnly}
            >
              Nur Wochenende
            </Button>
          </div>
        </div>
      </header>

      {/* Kompakte Mobile-Legende (nur sm:hidden) - analog Spielplatz */}
      <section className="sm:hidden">
        <div className="rounded-xl border border-border/60 bg-card/80 px-3 py-2 text-muted-foreground shadow-sm backdrop-blur">
          <div className="flex items-center justify-between gap-3 text-[10px] text-muted-foreground">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <div className="h-3 w-3 rounded-full border border-[hsl(var(--success)/0.35)] bg-[hsl(var(--success)/0.18)]" />
                <span>Frei</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="h-3 w-3 rounded-full border border-[hsl(var(--warning)/0.35)] bg-[hsl(var(--warning)/0.2)]" />
                <span>Begrenzt</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="h-3 w-3 rounded-full border border-[hsl(var(--destructive)/0.35)] bg-[hsl(var(--destructive)/0.2)]" />
                <span>Gesperrt</span>
              </div>
            </div>
            <div className="flex items-center gap-2 border-l border-border/60 pl-3">
              <div className="flex items-center gap-0.5">
                <CalendarStarIcon className="h-3 w-3 text-amber-500" />
                <span>Feiertag</span>
              </div>
              <div className="flex items-center gap-0.5">
                <UmbrellaIcon className="h-3 w-3 text-info" />
                <span>Ferien</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* WeekStrip nur für mobile Ansicht */}
      <div className="sm:hidden">
        <WeekStrip
          people={filteredPeople}
          dayCols={dayCols}
          holidays={holidays}
          onJump={(day) => {
            setHighlightedDay(day);
            const element = document.getElementById(`day-${day}`);
            element?.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
          }}
        />
      </div>

      {/* MobileByDay wird immer auf Mobile angezeigt */}
      <div className="sm:hidden">
        <MobileByDay
          people={personFilter === "all" ? people : filteredPeople}
          groupedPeople={personFilter === "all" ? groupedPeople : null}
          dayCols={dayCols}
          holidays={holidays}
        />
      </div>

      {/* View-spezifische Komponenten für Desktop */}
      {view === "calendar" ? (
        <DesktopCalendar people={filteredPeople} dayCols={dayCols} holidays={holidays} />
      ) : view === "timeline" ? (
        <TimelineView
          people={filteredPeople}
          dayCols={dayCols}
          holidays={holidays}
          highlightedDay={highlightedDay}
          setHighlightedDay={setHighlightedDay}
          personFilter={personFilter}
        />
      ) : (
        <DesktopTable
          people={filteredPeople}
          dayCols={dayCols}
          holidays={holidays}
          personFilter={personFilter}
          month={month}
          onPreviousMonth={onPreviousMonth}
          onNextMonth={onNextMonth}
          onJumpToToday={handleJumpToToday}
        />
      )}

      <Button
        type="button"
        className="self-end gap-2"
        onClick={onExportPdf}
        aria-label="Sperrlistenübersicht als PDF exportieren"
      >
        <DownloadIcon className="h-4 w-4" aria-hidden />
        PDF exportieren
      </Button>
    </div>
  );
}
