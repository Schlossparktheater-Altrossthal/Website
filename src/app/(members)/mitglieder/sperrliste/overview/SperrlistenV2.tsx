import React, { useMemo, useState } from "react";

import { DesktopCalendar } from "./DesktopCalendar";
import { MobileByDay } from "./MobileByDay";
import { TimelineView } from "./TimelineView";
import { WeekStrip } from "./WeekStrip";
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
};

export default function SperrlistenV2({ onExportPdf, people, dayCols, holidays }: SperrlistenV2Props) {
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

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <main className="mx-auto max-w-6xl space-y-4 p-4 sm:p-6">
        <header className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-1">
            <h1 className="text-lg font-semibold sm:text-xl">Sperrlistenübersicht</h1>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="rounded px-2 py-1 text-blue-800 bg-blue-100">Monat</span>
              <span className="rounded px-2 py-1 text-sky-800 bg-sky-100">Zeitraum</span>
              <span className="rounded px-2 py-1 text-gray-800 bg-gray-100">{dayCols.length} Tage</span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex overflow-hidden rounded-xl border border-slate-200 bg-white">
              <button
                type="button"
                className={`px-3 py-1.5 text-sm font-medium ${personFilter === "all" ? "bg-slate-50 text-slate-900" : "text-slate-600 hover:bg-slate-50"}`}
                onClick={() => setPersonFilter("all")}
              >
                Alle ({groupedCounts.total})
              </button>
              <button
                type="button"
                className={`border-l border-slate-200 px-3 py-1.5 text-sm font-medium ${personFilter === "actors" ? "bg-slate-50 text-slate-900" : "text-slate-600 hover:bg-slate-50"}`}
                onClick={() => setPersonFilter("actors")}
              >
                Schauspieler ({groupedCounts.actors})
              </button>
              <button
                type="button"
                className={`border-l border-slate-200 px-3 py-1.5 text-sm font-medium ${personFilter === "crew" ? "bg-slate-50 text-slate-900" : "text-slate-600 hover:bg-slate-50"}`}
                onClick={() => setPersonFilter("crew")}
              >
                Gewerke ({groupedCounts.crew})
              </button>
              <button
                type="button"
                className={`border-l border-slate-200 px-3 py-1.5 text-sm font-medium ${personFilter === "both" ? "bg-slate-50 text-slate-900" : "text-slate-600 hover:bg-slate-50"}`}
                onClick={() => setPersonFilter("both")}
              >
                Beides ({groupedCounts.both})
              </button>
              <button
                type="button"
                className={`border-l border-slate-200 px-3 py-1.5 text-sm font-medium ${personFilter === "other" ? "bg-slate-50 text-slate-900" : "text-slate-600 hover:bg-slate-50"}`}
                onClick={() => setPersonFilter("other")}
              >
                Sonstige ({groupedCounts.other})
              </button>
            </div>
            <div className="hidden overflow-hidden rounded-xl border border-slate-200 bg-white sm:flex">
              <button
                type="button"
                className={`px-3 py-1.5 text-sm font-medium ${view === "calendar" ? "bg-slate-50 text-slate-900" : "text-slate-600 hover:bg-slate-50"}`}
                onClick={() => setView("calendar")}
              >
                Kalender
              </button>
              <button
                type="button"
                className={`border-l border-slate-200 px-3 py-1.5 text-sm font-medium ${view === "table" ? "bg-slate-50 text-slate-900" : "text-slate-600 hover:bg-slate-50"}`}
                onClick={() => setView("table")}
              >
                Tabelle
              </button>
              <button
                type="button"
                className={`border-l border-slate-200 px-3 py-1.5 text-sm font-medium ${view === "timeline" ? "bg-slate-50 text-slate-900" : "text-slate-600 hover:bg-slate-50"}`}
                onClick={() => setView("timeline")}
              >
                Timeline
              </button>
            </div>
          </div>
        </header>

        <WeekStrip
          people={filteredPeople}
          dayCols={dayCols}
          holidays={holidays}
          onJump={(day) => setHighlightedDay(day)}
        />

        {view === "calendar" ? (
          <DesktopCalendar people={filteredPeople} dayCols={dayCols} holidays={holidays} />
        ) : view === "timeline" ? (
          <TimelineView
            people={filteredPeople}
            dayCols={dayCols}
            highlightedDay={highlightedDay}
            setHighlightedDay={(day) => setHighlightedDay(day)}
          />
        ) : (
          <MobileByDay people={filteredPeople} dayCols={dayCols} holidays={holidays} />
        )}

        <button
          type="button"
          className="self-end rounded bg-primary px-4 py-2 text-white shadow hover:bg-primary/80"
          onClick={onExportPdf}
        >
          PDF exportieren
        </button>
      </main>
    </div>
  );
}
