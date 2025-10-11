
import React, { useMemo, useState, useEffect, useRef } from "react";
import { useBlockOverviewData } from "./useBlockOverviewData";

// Typen aus Hauptwebsite
// import { PreparedMember, VisibleDayInfo, HolidayRange } from "...";

type HolidayType = { dayIndex: number; label?: string; type?: "holiday" | "vacation"; isHoliday?: boolean };

function selectDayBuckets(people: any[], dayCols: { label: string; n: number; accent?: boolean }[], holidays: HolidayType[]) {
  return dayCols.map((dc, idx) => {
    const entries = people.map((p) => ({ person: p, cell: p.days[idx] as { type: string; label?: string } }));
    const can = entries.filter((e) => e.cell.type === "preferred" || e.cell.type === "free");
    can.sort((a, b) => (a.cell.type === b.cell.type ? a.person.name.localeCompare(b.person.name) : a.cell.type === "preferred" ? -1 : 1));
    const limited = entries.filter((e) => e.cell.type === "limited").sort((a, b) => a.person.name.localeCompare(b.person.name));
    const blocked = entries.filter((e) => e.cell.type === "block").sort((a, b) => a.person.name.localeCompare(b.person.name));
    const holidayInfo = holidays.find((h) => h.dayIndex === idx);
    const holiday = !!holidayInfo;
    const holidayLabel = holidayInfo?.label;
    const holidayType = holidayInfo?.type || "vacation";
    const isPublicHoliday = holidayInfo?.type === "holiday" || holidayInfo?.isHoliday;
    return { dc, can, limited, blocked, holiday, holidayLabel, holidayType, isPublicHoliday };
  });
}

export default function SperrlistenV2({ onExportPdf }: { onExportPdf: () => void }) {
  // Daten aus Hauptwebsite holen (hier als Beispiel)
  // const { members, holidays, dayCols } = useBlockOverviewData();
  // Für Demo: Dummy-Daten wie im Spielplatz
  const dayCols = [
    { label: "Mo", n: 12 },
    { label: "Di", n: 13 },
    { label: "Mi", n: 14, accent: true },
    { label: "Do", n: 15 },
    { label: "Fr", n: 16 },
    { label: "Sa", n: 17 },
    { label: "So", n: 18 },
  ];
  const holidays = [
    { dayIndex: 1, label: "Christi Himmelfahrt", type: "holiday" },
    { dayIndex: 2, label: "Brückentag", type: "vacation" },
    { dayIndex: 4, label: "Pfingstferien", type: "vacation" },
    { dayIndex: 5, label: "Pfingstferien (Pfingstmontag)", type: "vacation", isHoliday: true },
    { dayIndex: 6, label: "Pfingstferien", type: "vacation" },
  ];
  // Dummy-Personen wie im Spielplatz
  const people = useMemo(() => ([
    { initials: "LH", name: "Lena Hoffmann", group: "actors", stats: "6 Termine · 3 anstehend", days: [
      { type: "block", label: "Ganztägig · Gastspiel in Leipzig" }, { type: "free" }, { type: "limited", label: "Verfügbar ab 20:00" }, { type: "preferred", label: "Ensemblearbeit" }, { type: "free" }, { type: "free" }, { type: "free" },
    ] },
    // ...weitere Personen analog...
  ]), []);

  // Filter und Ansicht
  const [personFilter, setPersonFilter] = useState<'all' | 'actors' | 'crew' | 'both'>('all');
  const [view, setView] = useState<'table' | 'calendar' | 'timeline'>('table');

  // Gruppierung
  const groupedPeople = useMemo(() => {
    const actors = people.filter(p => p.group === 'actors');
    const crew = people.filter(p => p.group === 'crew');
    const both = people.filter(p => p.group === 'both');
    return { actors, crew, both };
  }, [people]);

  // Gefilterte Personen
  const filteredPeople = useMemo(() => {
    if (personFilter === 'all') return people;
    return people.filter(p => p.group === personFilter);
  }, [people, personFilter]);

  // Layout
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <main className="mx-auto max-w-6xl p-4 sm:p-6 space-y-4">
        <header className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-1">
            <h1 className="text-lg font-semibold sm:text-xl">Sperrlistenübersicht</h1>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="bg-blue-100 text-blue-800 rounded px-2 py-1">Mai 2025</span>
              <span className="bg-sky-100 text-sky-800 rounded px-2 py-1">Zeitraum 12.–18.05.</span>
              <span className="bg-gray-100 text-gray-800 rounded px-2 py-1">7 Tage · Fokus Mo/Mi/Do</span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/* Personen-Filter */}
            <div className="flex overflow-hidden rounded-xl border border-slate-200 bg-white">
              <button className={`px-3 py-1.5 text-sm font-medium ${personFilter==='all' ? 'bg-slate-50 text-slate-900' : 'text-slate-600 hover:bg-slate-50'}`} onClick={() => setPersonFilter('all')}>Alle</button>
              <button className={`px-3 py-1.5 text-sm font-medium border-l border-slate-200 ${personFilter==='actors' ? 'bg-slate-50 text-slate-900' : 'text-slate-600 hover:bg-slate-50'}`} onClick={() => setPersonFilter('actors')}>Schauspieler</button>
              <button className={`px-3 py-1.5 text-sm font-medium border-l border-slate-200 ${personFilter==='crew' ? 'bg-slate-50 text-slate-900' : 'text-slate-600 hover:bg-slate-50'}`} onClick={() => setPersonFilter('crew')}>Gewerke</button>
              <button className={`px-3 py-1.5 text-sm font-medium border-l border-slate-200 ${personFilter==='both' ? 'bg-slate-50 text-slate-900' : 'text-slate-600 hover:bg-slate-50'}`} onClick={() => setPersonFilter('both')}>Beides</button>
            </div>
            {/* Ansicht-Toggle */}
            <div className="hidden sm:flex overflow-hidden rounded-xl border border-slate-200 bg-white">
              <button className={`px-3 py-1.5 text-sm font-medium ${view==='calendar' ? 'bg-slate-50 text-slate-900' : 'text-slate-600 hover:bg-slate-50'}`} onClick={() => setView('calendar')}>Kalender</button>
              <button className={`px-3 py-1.5 text-sm font-medium border-l border-slate-200 ${view==='table' ? 'bg-slate-50 text-slate-900' : 'text-slate-600 hover:bg-slate-50'}`} onClick={() => setView('table')}>Tabelle</button>
              <button className={`px-3 py-1.5 text-sm font-medium border-l border-slate-200 ${view==='timeline' ? 'bg-slate-50 text-slate-900' : 'text-slate-600 hover:bg-slate-50'}`} onClick={() => setView('timeline')}>Timeline</button>
            </div>
          </div>
        </header>
        {/* Hauptbereich: Tabelle, Kalender, Timeline ... */}
        <section className="rounded-lg border bg-white p-4 shadow">
          <p className="mb-2 text-sm text-gray-600">Hier folgt die Übersicht der Sperrliste (Tabelle, Kalender, Timeline etc. – analog Spielplatz).</p>
          {/* ...Hier kann die eigentliche Übersicht eingebunden werden... */}
        </section>
        {/* PDF-Export-Button bleibt erhalten */}
        <button className="self-end px-4 py-2 bg-primary text-white rounded shadow hover:bg-primary/80" onClick={onExportPdf}>PDF exportieren</button>
      </main>
    </div>
  );
}
