

import React, { useMemo, useState } from "react";
import { useBlockOverviewData } from "./useBlockOverviewData";
import { WeekStrip } from "./WeekStrip";
import { TimelineView } from "./TimelineView";
import { DesktopCalendar } from "./DesktopCalendar";
import { MobileByDay } from "./MobileByDay";

export default function SperrlistenV2({ onExportPdf, members, holidays, currentMonth }: { onExportPdf: () => void; members: any[]; holidays: any[]; currentMonth: Date }) {
  // Echte Daten aus Hauptwebsite
  const { preparedMembers, visibleDayInfo, holidayMap } = useBlockOverviewData({ members, holidays, currentMonth });
  // dayCols und holidays wie in overview-shell generieren
  const dayCols = useMemo(() => visibleDayInfo.map((info) => ({ label: info.day.toLocaleDateString("de-DE", { weekday: "short" }), n: info.day.getDate(), accent: info.isCurrentMonth && info.isWeekend })), [visibleDayInfo]);
  // holidays kommt jetzt direkt aus den Props und ist bereits passend
  // Personen
  const people = useMemo(() => preparedMembers.map((member) => ({
    initials: member.displayName?.split(" ").map((n) => n[0]).join("") ?? "?",
    name: member.displayName,
    group: member.onboardingFocus ?? "other",
    stats: "-", // Kann angepasst werden
    days: dayCols.map((dc, idx) => {
      const entry = member.blockedMap.get(visibleDayInfo[idx].key) ?? null;
      let type = "free";
      let label = null;
      if (entry) {
        if (entry.kind === "BLOCKED") type = "block";
        else if (entry.kind === "LIMITED") type = "limited";
        else if (entry.kind === "PREFERRED") type = "preferred";
        label = entry.reason;
      }
      return { type, label };
    })
  })), [preparedMembers, dayCols, visibleDayInfo]);

  // Filter und Ansicht
  const [personFilter, setPersonFilter] = useState<'all' | 'actors' | 'crew' | 'both' | 'other'>('all');
  const [view, setView] = useState<'table' | 'calendar' | 'timeline'>('table');

  // Gruppierung
  const groupedPeople = useMemo(() => {
    const actors = people.filter(p => p.group === 'actors');
    const crew = people.filter(p => p.group === 'crew');
    const both = people.filter(p => p.group === 'both');
    const other = people.filter(p => p.group === 'other');
    return { actors, crew, both, other };
  }, [people]);

  // Gefilterte Personen
  const filteredPeople = useMemo(() => {
    if (personFilter === 'all') return people;
    return people.filter(p => p.group === personFilter);
  }, [people, personFilter]);

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <main className="mx-auto max-w-6xl p-4 sm:p-6 space-y-4">
        <header className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-1">
            <h1 className="text-lg font-semibold sm:text-xl">Sperrlistenübersicht</h1>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="bg-blue-100 text-blue-800 rounded px-2 py-1">Monat</span>
              <span className="bg-sky-100 text-sky-800 rounded px-2 py-1">Zeitraum</span>
              <span className="bg-gray-100 text-gray-800 rounded px-2 py-1">{dayCols.length} Tage</span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/* Personen-Filter */}
            <div className="flex overflow-hidden rounded-xl border border-slate-200 bg-white">
              <button className={`px-3 py-1.5 text-sm font-medium ${personFilter==='all' ? 'bg-slate-50 text-slate-900' : 'text-slate-600 hover:bg-slate-50'}`} onClick={() => setPersonFilter('all')}>Alle</button>
              <button className={`px-3 py-1.5 text-sm font-medium border-l border-slate-200 ${personFilter==='actors' ? 'bg-slate-50 text-slate-900' : 'text-slate-600 hover:bg-slate-50'}`} onClick={() => setPersonFilter('actors')}>Schauspieler</button>
              <button className={`px-3 py-1.5 text-sm font-medium border-l border-slate-200 ${personFilter==='crew' ? 'bg-slate-50 text-slate-900' : 'text-slate-600 hover:bg-slate-50'}`} onClick={() => setPersonFilter('crew')}>Gewerke</button>
              <button className={`px-3 py-1.5 text-sm font-medium border-l border-slate-200 ${personFilter==='both' ? 'bg-slate-50 text-slate-900' : 'text-slate-600 hover:bg-slate-50'}`} onClick={() => setPersonFilter('both')}>Beides</button>
              <button className={`px-3 py-1.5 text-sm font-medium border-l border-slate-200 ${personFilter==='other' ? 'bg-slate-50 text-slate-900' : 'text-slate-600 hover:bg-slate-50'}`} onClick={() => setPersonFilter('other')}>Sonstige</button>
            </div>
            {/* Ansicht-Toggle */}
            <div className="hidden sm:flex overflow-hidden rounded-xl border border-slate-200 bg-white">
              <button className={`px-3 py-1.5 text-sm font-medium ${view==='calendar' ? 'bg-slate-50 text-slate-900' : 'text-slate-600 hover:bg-slate-50'}`} onClick={() => setView('calendar')}>Kalender</button>
              <button className={`px-3 py-1.5 text-sm font-medium border-l border-slate-200 ${view==='table' ? 'bg-slate-50 text-slate-900' : 'text-slate-600 hover:bg-slate-50'}`} onClick={() => setView('table')}>Tabelle</button>
              <button className={`px-3 py-1.5 text-sm font-medium border-l border-slate-200 ${view==='timeline' ? 'bg-slate-50 text-slate-900' : 'text-slate-600 hover:bg-slate-50'}`} onClick={() => setView('timeline')}>Timeline</button>
            </div>
          </div>
        </header>
        {/* WeekStrip immer oben */}
        <WeekStrip people={filteredPeople} dayCols={dayCols} holidays={holidays} onJump={() => {}} />
        {/* Hauptbereich: Umschaltung der Ansichten */}
        {view === 'calendar' ? (
          <DesktopCalendar people={filteredPeople} dayCols={dayCols} holidays={holidays} />
        ) : view === 'timeline' ? (
          <TimelineView people={filteredPeople} dayCols={dayCols} holidays={holidays} highlightedDay={null} setHighlightedDay={() => {}} />
        ) : (
          <MobileByDay people={filteredPeople} dayCols={dayCols} holidays={holidays} />
        )}
        {/* PDF-Export-Button bleibt erhalten */}
        <button className="self-end px-4 py-2 bg-primary text-white rounded shadow hover:bg-primary/80" onClick={onExportPdf}>PDF exportieren</button>
      </main>
    </div>
  );
}
