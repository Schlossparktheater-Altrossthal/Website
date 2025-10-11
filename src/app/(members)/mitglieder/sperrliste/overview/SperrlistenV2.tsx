import React, { useCallback, useEffect, useMemo, useState } from "react";

import "./sperrliste-styles.css";
import { DesktopCalendar } from "./DesktopCalendar";
import { DesktopTable } from "./desktop-table";
import { MobileByDay } from "./MobileByDay";
import { TimelineView } from "./TimelineView";
import { WeekStrip } from "./WeekStrip";
import { ClockIcon } from "./icons";
import { IconButton, Note } from "./ui-components";
import type {
  DayColumn,
  HolidayIndicator,
  OverviewPerson,
  PersonGroup,
} from "./types";

type PersonFilter = PersonGroup | "all";

type SperrlistenV2Props = {
  onExportPdf: () => void;
  people: OverviewPerson[];
  dayCols: DayColumn[];
  holidays: HolidayIndicator[];
  onPreviousMonth?: () => void;
  onNextMonth?: () => void;
  month?: { label: string; year: number; month: number };
};

export default function SperrlistenV2({ 
  onExportPdf, 
  people, 
  dayCols, 
  holidays,
  onPreviousMonth,
  onNextMonth,
  month
}: SperrlistenV2Props) {
  const [personFilter, setPersonFilter] = useState<PersonFilter>("all");
  const [view, setView] = useState<"table" | "calendar" | "timeline">("table");
  const [highlightedDay, setHighlightedDay] = useState<number | null>(null);

  const groupedCounts = useMemo(() => {
    return people.reduce(
      (acc, person) => {
        acc.total += 1;
        if (person.group === "actors") acc.actors += 1;
        else if (person.group === "crew") acc.crew += 1;
        else if (person.group === "both") acc.both += 1;
        else acc.other += 1;
        return acc;
      },
      { total: 0, actors: 0, crew: 0, both: 0, other: 0 },
    );
  }, [people]);

  const filteredPeople = useMemo(() => {
    if (personFilter === "all") return people;
    return people.filter((person) => person.group === personFilter);
  }, [people, personFilter]);

  // "Heute"-Button Handler mit useCallback
  const handleJumpToToday = useCallback(() => {
    const todayDay = dayCols.find(d => d.accent === true);
    if (todayDay) {
      setHighlightedDay(todayDay.n);
      const element = document.getElementById(`day-${todayDay.n}`);
      element?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
    }
  }, [dayCols]);

  // Keyboard-Navigation für View-Switching (Strg+1/2/3) mit useCallback
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // Nur wenn Strg/Cmd gedrückt ist
    if (!event.ctrlKey && !event.metaKey) return;
    
    if (event.key === '1') {
      event.preventDefault();
      setView('calendar');
    } else if (event.key === '2') {
      event.preventDefault();
      setView('table');
    } else if (event.key === '3') {
      event.preventDefault();
      setView('timeline');
    }
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <main className="mx-auto space-y-4 p-4 sm:p-6" role="main" aria-label="Sperrlistenübersicht">
        <header className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-1">
            <h1 className="text-lg font-semibold sm:text-xl" id="page-title">Sperrlistenübersicht</h1>
            <div className="flex flex-wrap gap-2 text-xs" role="status" aria-live="polite">
              {month && <span className="rounded px-2 py-1 text-blue-800 bg-blue-100">{month.label}</span>}
              <span className="rounded px-2 py-1 text-sky-800 bg-sky-100">Zeitraum</span>
              <span className="rounded px-2 py-1 text-gray-800 bg-gray-100">{dayCols.length} Tage</span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/* Monatswechsel-Handler (nur wenn verfügbar) */}
            {(onPreviousMonth || onNextMonth) && (
              <div className="flex items-center gap-1 rounded-xl border border-slate-200/70 bg-white/80 p-1 shadow-sm" role="group" aria-label="Monatsnavigation">
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
                <button
                  type="button"
                  className="ml-1 inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white/70 px-2.5 py-1 text-sm font-medium hover:bg-white transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                  aria-label="Zu heute springen"
                  onClick={handleJumpToToday}
                >
                  <ClockIcon className="h-4 w-4" aria-hidden="true" /> Heute
                </button>
              </div>
            )}
            
            <div className="flex overflow-hidden rounded-xl border border-slate-200 bg-white" role="group" aria-label="Personenfilter">
              <button
                type="button"
                className={`px-3 py-1.5 text-sm font-medium focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 ${personFilter === "all" ? "bg-slate-50 text-slate-900" : "text-slate-600 hover:bg-slate-50"}`}
                onClick={() => setPersonFilter("all")}
                aria-pressed={personFilter === "all"}
                aria-label={`Alle Personen anzeigen (${groupedCounts.total})`}
              >
                Alle ({groupedCounts.total})
              </button>
              <button
                type="button"
                className={`border-l border-slate-200 px-3 py-1.5 text-sm font-medium focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 ${personFilter === "actors" ? "bg-slate-50 text-slate-900" : "text-slate-600 hover:bg-slate-50"}`}
                onClick={() => setPersonFilter("actors")}
                aria-pressed={personFilter === "actors"}
                aria-label={`Schauspieler anzeigen (${groupedCounts.actors})`}
              >
                Schauspieler ({groupedCounts.actors})
              </button>
              <button
                type="button"
                className={`border-l border-slate-200 px-3 py-1.5 text-sm font-medium focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 ${personFilter === "crew" ? "bg-slate-50 text-slate-900" : "text-slate-600 hover:bg-slate-50"}`}
                onClick={() => setPersonFilter("crew")}
                aria-pressed={personFilter === "crew"}
                aria-label={`Gewerke anzeigen (${groupedCounts.crew})`}
              >
                Gewerke ({groupedCounts.crew})
              </button>
              <button
                type="button"
                className={`border-l border-slate-200 px-3 py-1.5 text-sm font-medium focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 ${personFilter === "both" ? "bg-slate-50 text-slate-900" : "text-slate-600 hover:bg-slate-50"}`}
                onClick={() => setPersonFilter("both")}
                aria-pressed={personFilter === "both"}
                aria-label={`Beides anzeigen (${groupedCounts.both})`}
              >
                Beides ({groupedCounts.both})
              </button>
              <button
                type="button"
                className={`border-l border-slate-200 px-3 py-1.5 text-sm font-medium focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 ${personFilter === "other" ? "bg-slate-50 text-slate-900" : "text-slate-600 hover:bg-slate-50"}`}
                onClick={() => setPersonFilter("other")}
                aria-pressed={personFilter === "other"}
                aria-label={`Sonstige anzeigen (${groupedCounts.other})`}
              >
                Sonstige ({groupedCounts.other})
              </button>
            </div>
            <div className="hidden overflow-hidden rounded-xl border border-slate-200 bg-white sm:flex" role="group" aria-label="Ansichtsauswahl">
              <button
                type="button"
                className={`px-3 py-1.5 text-sm font-medium focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 ${view === "calendar" ? "bg-slate-50 text-slate-900" : "text-slate-600 hover:bg-slate-50"}`}
                onClick={() => setView("calendar")}
                aria-pressed={view === "calendar"}
                aria-label="Kalenderansicht (Tastenkombination: Strg+1)"
              >
                Kalender
              </button>
              <button
                type="button"
                className={`border-l border-slate-200 px-3 py-1.5 text-sm font-medium focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 ${view === "table" ? "bg-slate-50 text-slate-900" : "text-slate-600 hover:bg-slate-50"}`}
                onClick={() => setView("table")}
                aria-pressed={view === "table"}
                aria-label="Tabellenansicht (Tastenkombination: Strg+2)"
              >
                Tabelle
              </button>
              <button
                type="button"
                className={`border-l border-slate-200 px-3 py-1.5 text-sm font-medium focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 ${view === "timeline" ? "bg-slate-50 text-slate-900" : "text-slate-600 hover:bg-slate-50"}`}
                onClick={() => setView("timeline")}
                aria-pressed={view === "timeline"}
                aria-label="Timeline-Ansicht (Tastenkombination: Strg+3)"
              >
                Timeline
              </button>
            </div>
          </div>
        </header>

        {/* Bevorzugte Tage und Ausnahmen (analog Spielplatz) */}
        <section className="grid gap-3 lg:grid-cols-2">
          <Note title="Bevorzugte Tage">Mo & Do</Note>
          <Note title="Ausnahmen">Mi (Sonderproben möglich)</Note>
        </section>

        {/* Note-Komponenten für wichtige Hinweise */}
        <div className="space-y-2 sm:hidden">
          <Note title="Tipp" className="bg-blue-50/80 border-blue-200/70">
            Nutze die Wochenübersicht zum schnellen Navigieren zu einem bestimmten Tag.
          </Note>
        </div>

        {/* Kompakte Mobile-Legende (nur sm:hidden) */}
        <div className="sm:hidden">
          <details className="rounded-lg border border-slate-200/70 bg-slate-50/50">
            <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-slate-700 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2">
              Legende anzeigen
            </summary>
            <div className="space-y-2 border-t border-slate-200/70 p-3 text-xs" role="list">
              <div className="flex items-center gap-2" role="listitem">
                <div className="h-4 w-4 rounded bg-green-100 border border-green-200" aria-hidden="true"></div>
                <span>Frei / Bevorzugt</span>
              </div>
              <div className="flex items-center gap-2" role="listitem">
                <div className="h-4 w-4 rounded bg-orange-100 border border-orange-200" aria-hidden="true"></div>
                <span>Eingeschränkt</span>
              </div>
              <div className="flex items-center gap-2" role="listitem">
                <div className="h-4 w-4 rounded bg-red-100 border border-red-200" aria-hidden="true"></div>
                <span>Gesperrt</span>
              </div>
            </div>
          </details>
        </div>

        {/* WeekStrip nur für mobile Ansicht */}
        <div className="sm:hidden">
          <WeekStrip
            people={filteredPeople}
            dayCols={dayCols}
            holidays={holidays}
            onJump={(day) => {
              setHighlightedDay(day);
              const element = document.getElementById(`day-${day}`);
              element?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
            }}
          />
        </div>

        {/* MobileByDay wird immer auf Mobile angezeigt */}
        <div className="sm:hidden">
          <MobileByDay 
            people={filteredPeople} 
            dayCols={dayCols} 
            holidays={holidays}
            personFilter={personFilter}
          />
        </div>

        {/* View-spezifische Komponenten für Desktop */}
        {view === "calendar" ? (
          <DesktopCalendar 
            people={filteredPeople} 
            dayCols={dayCols} 
            holidays={holidays} 
          />
        ) : view === "timeline" ? (
          <TimelineView
            people={filteredPeople}
            dayCols={dayCols}
            holidays={holidays}
            highlightedDay={highlightedDay}
            setHighlightedDay={(day) => setHighlightedDay(day)}
            personFilter={personFilter}
          />
        ) : (
          <DesktopTable 
            people={filteredPeople} 
            dayCols={dayCols} 
            holidays={holidays}
            personFilter={personFilter}
          />
        )}

        <button
          type="button"
          className="self-end rounded bg-primary px-4 py-2 text-white shadow hover:bg-primary/80 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          onClick={onExportPdf}
          aria-label="Sperrlistenübersicht als PDF exportieren"
        >
          PDF exportieren
        </button>
      </main>
    </div>
  );
}
