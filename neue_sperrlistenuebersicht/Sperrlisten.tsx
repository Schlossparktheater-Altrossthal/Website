import React, { useMemo, useState, useEffect, useRef } from "react";

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

function getHolidaySpans(dayCols: { label: string; n: number; accent?: boolean }[], days: ReturnType<typeof selectDayBuckets>) {
  const spans: { start: number; end: number; label?: string; hasPublicHoliday?: boolean }[] = [];
  let currentSpan: { start: number; end: number; label?: string; hasPublicHoliday?: boolean } | null = null;

  days.forEach((d, idx) => {
    if (d.holiday && d.holidayType === "vacation") {
      if (!currentSpan) {
        currentSpan = { start: idx, end: idx, label: d.holidayLabel, hasPublicHoliday: d.isPublicHoliday };
      } else {
        currentSpan.end = idx;
        if (d.isPublicHoliday) currentSpan.hasPublicHoliday = true;
      }
    } else {
      if (currentSpan) {
        spans.push(currentSpan);
        currentSpan = null;
      }
    }
  });

  if (currentSpan) {
    spans.push(currentSpan);
  }

  return spans;
}

export default function Sperrlisten() {
  const compact = true;
  const [view, setView] = useState<'table' | 'calendar' | 'timeline'>('table');
  const [month, setMonth] = useState({ label: "Mai 2025", range: "12.–18.05." });
  const [personFilter, setPersonFilter] = useState<'all' | 'actors' | 'crew' | 'both'>('all');
  
  const dayCols = [
    { label: "Mo", n: 12 },
    { label: "Di", n: 13 },
    { label: "Mi", n: 14, accent: true },
    { label: "Do", n: 15 },
    { label: "Fr", n: 16 },
    { label: "Sa", n: 17 },
    { label: "So", n: 18 },
  ];
  
  const [highlightedDay, setHighlightedDay] = useState<number | null>(
    dayCols.find(d => d.accent)?.n ?? null
  );
  
  // Keyboard Navigation für Timeline
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (view !== 'timeline') return;
      
      const currentIndex = dayCols.findIndex(d => d.n === highlightedDay);
      
      switch(e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          if (currentIndex > 0) {
            setHighlightedDay(dayCols[currentIndex - 1].n);
          }
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (currentIndex < dayCols.length - 1) {
            setHighlightedDay(dayCols[currentIndex + 1].n);
          }
          break;
        case 'Home':
          e.preventDefault();
          setHighlightedDay(dayCols[0].n);
          break;
        case 'End':
          e.preventDefault();
          setHighlightedDay(dayCols[dayCols.length - 1].n);
          break;
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [view, highlightedDay, dayCols]);
  
  // Monatswechsel-Funktionen
  const handlePreviousMonth = () => {
    // Hier könnte eine echte Logik für Monatswechsel stehen
    // Für jetzt zeigen wir nur eine Info
    alert('Vorheriger Monat würde geladen werden');
  };
  
  const handleNextMonth = () => {
    // Hier könnte eine echte Logik für Monatswechsel stehen
    alert('Nächster Monat würde geladen werden');
  };

  // Ferien und Feiertage werden separat definiert (Tag-Index: 0=Mo, 1=Di, 2=Mi, 3=Do, 4=Fr, 5=Sa, 6=So)
  // type: "holiday" = Feiertag (einzelner Tag), "vacation" = Ferien (kann mehrere Tage sein)
  const holidays = useMemo(() => [
    { dayIndex: 1, label: "Christi Himmelfahrt", type: "holiday" as const },
    { dayIndex: 2, label: "Brückentag", type: "vacation" as const },
    { dayIndex: 4, label: "Pfingstferien", type: "vacation" as const },
    { dayIndex: 5, label: "Pfingstferien (Pfingstmontag)", type: "vacation" as const, isHoliday: true }, // Ferien + Feiertag
    { dayIndex: 6, label: "Pfingstferien", type: "vacation" as const },
  ], []);

  const people = useMemo(() => ([
    // Schauspieler
    {
      initials: "LH",
      name: "Lena Hoffmann",
      group: "actors" as const,
      stats: "6 Termine · 3 anstehend",
      days: [
        { type: "block", label: "Ganztägig · Gastspiel in Leipzig" },
        { type: "free" },
        { type: "limited", label: "Verfügbar ab 20:00" },
        { type: "preferred", label: "Ensemblearbeit" },
        { type: "free" },
        { type: "free" },
        { type: "free" },
      ],
    },
    {
      initials: "MK",
      name: "Malik Küster",
      group: "actors" as const,
      stats: "4 Termine · 2 anstehend",
      days: [
        { type: "free" },
        { type: "block", label: "Abendunterricht" },
        { type: "free" },
        { type: "free" },
        { type: "block", label: "Dreharbeiten Berlin" },
        { type: "limited", label: "Anreise ab 19:30" },
        { type: "free" },
      ],
    },
    {
      initials: "TB",
      name: "Tom Becker",
      group: "actors" as const,
      stats: "5 Termine · 2 anstehend",
      days: [
        { type: "preferred" },
        { type: "free" },
        { type: "free" },
        { type: "block", label: "Synchronaufnahme" },
        { type: "free" },
        { type: "limited", label: "Nur vormittags" },
        { type: "block", label: "Familienurlaub" },
      ],
    },
    {
      initials: "NW",
      name: "Nina Weber",
      group: "actors" as const,
      stats: "7 Termine · 4 anstehend",
      days: [
        { type: "free" },
        { type: "preferred", label: "Präferierter Probentag" },
        { type: "free" },
        { type: "preferred" },
        { type: "block", label: "Tournee Hamburg" },
        { type: "block", label: "Tournee Hamburg" },
        { type: "free" },
      ],
    },
    {
      initials: "FS",
      name: "Felix Schmidt",
      group: "actors" as const,
      stats: "3 Termine · 1 anstehend",
      days: [
        { type: "limited", label: "Ab 18:00" },
        { type: "free" },
        { type: "block", label: "Dreharbeiten" },
        { type: "free" },
        { type: "free" },
        { type: "preferred" },
        { type: "free" },
      ],
    },
    {
      initials: "AM",
      name: "Anna Müller",
      group: "actors" as const,
      stats: "5 Termine · 3 anstehend",
      days: [
        { type: "free" },
        { type: "limited", label: "Kinderbetreuung bis 19:00" },
        { type: "preferred" },
        { type: "free" },
        { type: "free" },
        { type: "block", label: "Arzttermin" },
        { type: "free" },
      ],
    },
    {
      initials: "JK",
      name: "Jonas Klein",
      group: "actors" as const,
      stats: "4 Termine · 2 anstehend",
      days: [
        { type: "free" },
        { type: "free" },
        { type: "block", label: "Sprachtraining" },
        { type: "preferred" },
        { type: "free" },
        { type: "free" },
        { type: "limited", label: "Nur bis 20:00" },
      ],
    },
    
    // Gewerke
    {
      initials: "SR",
      name: "Sara Riedl",
      group: "crew" as const,
      stats: "2 Termine · 1 anstehend",
      days: [
        { type: "preferred" },
        { type: "free" },
        { type: "free" },
        { type: "limited", label: "Kinderbetreuung bis 18:30" },
        { type: "free" },
        { type: "free" },
        { type: "block", label: "Familienfeier" },
      ],
    },
    {
      initials: "DG",
      name: "David Graf",
      group: "crew" as const,
      stats: "4 Termine · 2 anstehend",
      days: [
        { type: "free" },
        { type: "block", label: "Bühnenbau Oper" },
        { type: "free" },
        { type: "preferred" },
        { type: "free" },
        { type: "limited", label: "Material-Lieferung ab 17:00" },
        { type: "free" },
      ],
    },
    {
      initials: "EP",
      name: "Emma Peters",
      group: "crew" as const,
      stats: "6 Termine · 3 anstehend",
      days: [
        { type: "preferred" },
        { type: "free" },
        { type: "limited", label: "Lichtprobe bis 19:00" },
        { type: "free" },
        { type: "free" },
        { type: "block", label: "Weiterbildung" },
        { type: "preferred" },
      ],
    },
    {
      initials: "ML",
      name: "Max Lang",
      group: "crew" as const,
      stats: "3 Termine · 1 anstehend",
      days: [
        { type: "free" },
        { type: "free" },
        { type: "preferred" },
        { type: "block", label: "Wartung Tontechnik" },
        { type: "free" },
        { type: "free" },
        { type: "limited", label: "Verfügbar ab 16:00" },
      ],
    },
    {
      initials: "SK",
      name: "Sophie Koch",
      group: "crew" as const,
      stats: "5 Termine · 2 anstehend",
      days: [
        { type: "free" },
        { type: "preferred" },
        { type: "free" },
        { type: "free" },
        { type: "block", label: "Kostüm-Anprobe anderes Projekt" },
        { type: "free" },
        { type: "preferred" },
      ],
    },
    {
      initials: "LB",
      name: "Lukas Braun",
      group: "crew" as const,
      stats: "4 Termine · 2 anstehend",
      days: [
        { type: "limited", label: "Nur vormittags" },
        { type: "free" },
        { type: "block", label: "Requisiten-Beschaffung" },
        { type: "free" },
        { type: "preferred" },
        { type: "free" },
        { type: "free" },
      ],
    },
    
    // Beides (Schauspieler & Gewerke)
    {
      initials: "JM",
      name: "Julia Meyer",
      group: "both" as const,
      stats: "4 Termine · 2 anstehend",
      days: [
        { type: "free" },
        { type: "block", label: "Proben + Bühnenbau" },
        { type: "block", label: "Proben + Bühnenbau" },
        { type: "limited", label: "Vormittags frei" },
        { type: "free" },
        { type: "free" },
        { type: "free" },
      ],
    },
    {
      initials: "PH",
      name: "Paul Huber",
      group: "both" as const,
      stats: "5 Termine · 2 anstehend",
      days: [
        { type: "free" },
        { type: "free" },
        { type: "block", label: "Schauspiel & Regie-Assistenz" },
        { type: "limited", label: "Nur Nachmittag" },
        { type: "free" },
        { type: "free" },
        { type: "free" },
      ],
    },
  ]), []);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [showHint, setShowHint] = useState(false);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const needsScroll = el.scrollWidth > el.clientWidth + 8;
    setShowHint(needsScroll);
  }, []);

  // Gefilterte Personen basierend auf dem aktiven Filter
  const filteredPeople = useMemo(() => {
    if (personFilter === 'all') return people;
    return people.filter(p => p.group === personFilter);
  }, [people, personFilter]);

  // Gruppierte Personen für die Darstellung
  const groupedPeople = useMemo(() => {
    const actors = people.filter(p => p.group === 'actors');
    const crew = people.filter(p => p.group === 'crew');
    const both = people.filter(p => p.group === 'both');
    return { actors, crew, both };
  }, [people]);

  return (
    <div className="min-h-dvh bg-[var(--background)] text-[var(--foreground)]">
      <style>{`:root{--background:#f8fafc;--foreground:#0f172a;--card:#ffffff;--card-rgb:255,255,255;--muted: #e2e8f0;--muted-rgb:226,232,240;--muted-foreground:#475569;--primary:#2563eb;--primary-rgba:37,99,235,.15;--danger: #dc2626;--danger-rgba:220,38,38,.12;--warn:#f97316;--warn-rgba:249,115,22,.18;--ok:#16a34a;--ok-rgba:22,163,74,.14;--info:#0ea5e9;--info-rgba:14,165,233,.18}`}</style>

      <main className="mx-auto max-w-6xl p-4 sm:p-6 space-y-4">
        <header className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-1">
            <h1 className="text-lg font-semibold sm:text-xl">Wichtige Probentage</h1>
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge>{month.label}</Badge>
              <Badge tone="info">Zeitraum {month.range}</Badge>
              <Badge>7 Tage · Fokus Mo/Mi/Do</Badge>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Personen-Filter */}
            <div className="flex overflow-hidden rounded-xl border border-slate-200 bg-white">
              <button
                className={`px-3 py-1.5 text-sm font-medium ${personFilter==='all' ? 'bg-slate-50 text-slate-900' : 'text-slate-600 hover:bg-slate-50'}`}
                onClick={() => setPersonFilter('all')}
                aria-pressed={personFilter==='all'}
              >
                Alle <span className="ml-1 text-xs opacity-60">({people.length})</span>
              </button>
              <button
                className={`px-3 py-1.5 text-sm font-medium border-l border-slate-200 ${personFilter==='actors' ? 'bg-slate-50 text-slate-900' : 'text-slate-600 hover:bg-slate-50'}`}
                onClick={() => setPersonFilter('actors')}
                aria-pressed={personFilter==='actors'}
              >
                Schauspieler <span className="ml-1 text-xs opacity-60">({groupedPeople.actors.length})</span>
              </button>
              <button
                className={`px-3 py-1.5 text-sm font-medium border-l border-slate-200 ${personFilter==='crew' ? 'bg-slate-50 text-slate-900' : 'text-slate-600 hover:bg-slate-50'}`}
                onClick={() => setPersonFilter('crew')}
                aria-pressed={personFilter==='crew'}
              >
                Gewerke <span className="ml-1 text-xs opacity-60">({groupedPeople.crew.length})</span>
              </button>
              <button
                className={`px-3 py-1.5 text-sm font-medium border-l border-slate-200 ${personFilter==='both' ? 'bg-slate-50 text-slate-900' : 'text-slate-600 hover:bg-slate-50'}`}
                onClick={() => setPersonFilter('both')}
                aria-pressed={personFilter==='both'}
              >
                Beides <span className="ml-1 text-xs opacity-60">({groupedPeople.both.length})</span>
              </button>
            </div>

            {/* Ansichten-Toggle */}
            <div className="hidden sm:flex overflow-hidden rounded-xl border border-slate-200 bg-white">
              <button
                className={`px-3 py-1.5 text-sm font-medium ${view==='calendar' ? 'bg-slate-50 text-slate-900' : 'text-slate-600 hover:bg-slate-50'}`}
                onClick={() => setView('calendar')}
                aria-pressed={view==='calendar'}
              >Kalender</button>
              <button
                className={`px-3 py-1.5 text-sm font-medium border-l border-slate-200 ${view==='table' ? 'bg-slate-50 text-slate-900' : 'text-slate-600 hover:bg-slate-50'}`}
                onClick={() => setView('table')}
                aria-pressed={view==='table'}
              >Tabelle</button>
              <button
                className={`px-3 py-1.5 text-sm font-medium border-l border-slate-200 ${view==='timeline' ? 'bg-slate-50 text-slate-900' : 'text-slate-600 hover:bg-slate-50'}`}
                onClick={() => setView('timeline')}
                aria-pressed={view==='timeline'}
              >Timeline</button>
            </div>

            {/* Heute-Button - scrollt zum aktuellen Tag und hebt ihn hervor */}
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200/70 bg-white/70 px-3 py-1.5 text-sm font-medium hover:bg-white transition-colors"
              aria-label="Zu heute springen"
              onClick={() => {
                const todayDay = dayCols.find(d => d.accent);
                if (todayDay) {
                  setHighlightedDay(todayDay.n);
                  // In Timeline-Ansicht zum Tag scrollen
                  if (view === 'timeline') {
                    const element = document.querySelector(`[data-day="${todayDay.n}"]`);
                    element?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
                  }
                }
              }}
            >
              <ClockIcon /> Heute
            </button>
          </div>
        </header>

        <section className="grid gap-3 lg:grid-cols-2">
          <Note title="Bevorzugte Tage">Mo & Do</Note>
          <Note title="Ausnahmen">Mi (Sonderproben möglich)</Note>
        </section>

        <section className="grid gap-2 sm:hidden">
          {/* Kompakte Legende für Mobile */}
          <div className="rounded-xl border border-slate-200/70 bg-gradient-to-r from-slate-50 to-white px-3 py-2 shadow-sm">
            <div className="flex items-center justify-between gap-3 text-[10px]">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1">
                  <div className="h-3 w-3 rounded-full bg-green-100 border border-green-200" />
                  <span className="text-slate-600">Frei</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="h-3 w-3 rounded-full bg-orange-100 border border-orange-200" />
                  <span className="text-slate-600">Begrenzt</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="h-3 w-3 rounded-full bg-red-100 border border-red-200" />
                  <span className="text-slate-600">Gesperrt</span>
                </div>
              </div>
              <div className="flex items-center gap-2 border-l border-slate-300 pl-3">
                <div className="flex items-center gap-0.5">
                  <CalendarStarIcon className="h-3 w-3 text-amber-500" />
                  <span className="text-slate-600">Feiertag</span>
                </div>
                <div className="flex items-center gap-0.5">
                  <UmbrellaIcon className="h-3 w-3 text-sky-500" />
                  <span className="text-slate-600">Ferien</span>
                </div>
              </div>
            </div>
          </div>
          
          <WeekStrip people={filteredPeople} dayCols={dayCols} holidays={holidays} />
          <MobileByDay 
            people={personFilter === 'all' ? people : filteredPeople} 
            groupedPeople={personFilter === 'all' ? groupedPeople : null}
            dayCols={dayCols} 
            holidays={holidays} 
          />
        </section>

        {view==='calendar' ? (
          <DesktopCalendar people={filteredPeople} dayCols={dayCols} holidays={holidays} />
        ) : view==='timeline' ? (
          <TimelineView 
            people={personFilter === 'all' ? people : filteredPeople} 
            groupedPeople={personFilter === 'all' ? groupedPeople : null}
            dayCols={dayCols} 
            holidays={holidays} 
            highlightedDay={highlightedDay} 
            setHighlightedDay={setHighlightedDay}
            onPreviousMonth={handlePreviousMonth}
            onNextMonth={handleNextMonth}
          />
        ) : (
          <section className="hidden sm:block">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="text-sm font-semibold text-slate-700">{month.label}</div>
              <div className="flex items-center gap-1 rounded-xl border border-slate-200/70 bg-white/80 p-1 shadow-sm">
                <IconButton aria-label="Vorheriger Monat" onClick={handlePreviousMonth}>&larr;</IconButton>
                <IconButton aria-label="Nächster Monat" onClick={handleNextMonth}>&rarr;</IconButton>
                <button
                  type="button"
                  className="ml-1 inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white/70 px-2.5 py-1 text-sm font-medium hover:bg-white transition-colors"
                  aria-label="Zu heute springen"
                  onClick={() => {
                    const todayDay = dayCols.find(d => d.accent);
                    if (todayDay) {
                      setHighlightedDay(todayDay.n);
                    }
                  }}
                >
                  <ClockIcon /> Heute
                </button>
              </div>
            </div>

            {/* Tabelle mit sticky Header und Namen - lokaler Scroll-Container */}
            <div className="max-h-[calc(100vh-16rem)] overflow-auto overscroll-y-auto rounded-2xl border border-slate-200/70 bg-white shadow-sm" ref={scrollRef}>
              {showHint && (
                <div className="pointer-events-none absolute inset-x-0 top-0 z-30 bg-gradient-to-b from-white/75 to-transparent px-3 py-2 text-[11px] text-slate-500">
                  <span className="rounded-md border border-slate-200 bg-white/80 px-2 py-0.5">Tipp: horizontal wischen/scrollen →</span>
                </div>
              )}
              <table className={`w-full ${compact ? "text-[12px]" : "text-sm"} table-fixed border-collapse [--th:theme(colors.slate.200/.7)]`}>
                <thead className="sticky top-0 z-20 bg-white backdrop-blur shadow-sm">
                  {/* Ferien-Zeile über den Tagen */}
                  {(() => {
                    const holidaySpans = getHolidaySpans(dayCols, selectDayBuckets(people, dayCols, holidays));
                    const dayBuckets = selectDayBuckets(people, dayCols, holidays);
                    const hasFerien = holidaySpans.length > 0;
                    const hasFeiertage = dayBuckets.some(d => d.holidayType === 'holiday' || d.isPublicHoliday);
                    
                    if (!hasFerien && !hasFeiertage) return null;
                    
                    return (
                      <>
                        {/* Ferien-Zeile */}
                        {hasFerien && (
                          <tr>
                            {personFilter === 'all' && (
                              <th className="sticky left-0 z-20 w-3 border-b border-r border-[color:var(--th)] bg-white"></th>
                            )}
                            <th className={`sticky ${personFilter === 'all' ? 'left-3' : 'left-0'} z-20 border-b border-r border-[color:var(--th)] bg-white px-3 py-2 text-right`}>
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
                                      <UmbrellaIcon />
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
                            {personFilter === 'all' && (
                              <th className="sticky left-0 z-20 w-3 border-b border-r border-[color:var(--th)] bg-white"></th>
                            )}
                            <th className={`sticky ${personFilter === 'all' ? 'left-3' : 'left-0'} z-20 border-b border-r border-[color:var(--th)] bg-white px-3 py-2 text-right`}>
                              <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-600">Feiertage</span>
                            </th>
                            {dayCols.map((_, idx) => {
                              const day = dayBuckets[idx];
                              // Zeige Feiertag wenn: expliziter Feiertag ODER in Ferien mit Feiertag
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
                    );
                  })()}
                  <tr>
                    {personFilter === 'all' && (
                      <th scope="col" className="sticky left-0 z-20 w-3 min-w-[12px] border-b border-r border-[color:var(--th)] bg-white"></th>
                    )}
                    <th scope="col" className={`sticky ${personFilter === 'all' ? 'left-3' : 'left-0'} z-20 w-[220px] sm:w-[260px] min-w-[220px] border-b border-r border-[color:var(--th)] bg-white px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500`}>Mitglied</th>
                    {dayCols.map((d, idx) => (
                      <th key={d.n} scope="col" className={`border-b border-[color:var(--th)] px-2 py-2 text-center align-bottom min-w-[110px] w-[110px] ${
                        d.accent ? 'bg-blue-50/80' : 'bg-white'
                      } ${idx === dayCols.length - 1 ? 'rounded-tr-2xl' : ''}`}>
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-[10px] uppercase tracking-[0.2em] text-slate-500">{d.label}</span>
                          <span className={`flex h-7 w-7 items-center justify-center rounded-full border text-[13px] font-semibold ${
                            d.accent 
                              ? 'border-blue-500 bg-blue-500 text-white shadow-md'
                              : 'border-slate-200 bg-slate-50 text-slate-900'
                          }`}>{d.n}</span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {personFilter === 'all' ? (
                    <>
                      {/* Schauspieler Gruppe */}
                      {groupedPeople.actors.map((p, idx) => (
                        <tr key={p.name} className="border-b border-slate-200/60 group">
                          {idx === 0 && (
                            <th 
                              rowSpan={groupedPeople.actors.length}
                              scope="rowgroup"
                              aria-label="Schauspieler Gruppe"
                              className="sticky left-0 z-10 w-3 border-r border-slate-200/70 bg-gradient-to-b from-blue-400 to-blue-500 p-0"
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
                                  Schauspieler
                                </span>
                              </div>
                            </th>
                          )}
                          <th scope="row" className="sticky left-3 z-10 w-[220px] sm:w-[260px] min-w-[220px] border-r border-slate-200/70 bg-white backdrop-blur shadow-sm px-3 py-2 text-left">
                            <div className="flex items-center gap-2">
                              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500/15 text-xs font-semibold text-blue-700">
                                {p.initials}
                              </span>
                              <div className="min-w-[10ch] whitespace-normal">
                                <p className="font-semibold leading-5">{p.name}</p>
                              </div>
                            </div>
                          </th>
                          {p.days.map((cell, i) => (
                            <td key={i} className="h-20 px-1.5 py-1.5 align-top whitespace-normal break-words">
                              <Cell cell={cell} compact={compact} inTable={true} />
                            </td>
                          ))}
                        </tr>
                      ))}
                      
                      {/* Beides Gruppe (Schauspieler & Gewerke) - IN DER MITTE! */}
                      {groupedPeople.both.map((p, idx) => (
                        <tr key={p.name} className="border-b border-slate-200/60 group">
                          {idx === 0 && (
                            <th 
                              rowSpan={groupedPeople.both.length}
                              scope="rowgroup"
                              aria-label="Beides Gruppe - Schauspieler und Gewerke"
                              className="sticky left-0 z-10 w-3 border-r border-slate-200/70 bg-gradient-to-b from-purple-400 to-pink-500 p-0"
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
                                  Beides
                                </span>
                              </div>
                            </th>
                          )}
                          <th scope="row" className="sticky left-3 z-10 w-[220px] sm:w-[260px] min-w-[220px] border-r border-slate-200/70 bg-white backdrop-blur shadow-sm px-3 py-2 text-left">
                            <div className="flex items-center gap-2">
                              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-500/15 text-xs font-semibold text-purple-700">
                                {p.initials}
                              </span>
                              <div className="min-w-[10ch] whitespace-normal">
                                <p className="font-semibold leading-5">{p.name}</p>
                              </div>
                            </div>
                          </th>
                          {p.days.map((cell, i) => (
                            <td key={i} className="h-20 px-1.5 py-1.5 align-top whitespace-normal break-words">
                              <Cell cell={cell} compact={compact} inTable={true} />
                            </td>
                          ))}
                        </tr>
                      ))}
                      
                      {/* Gewerke Gruppe */}
                      {groupedPeople.crew.map((p, idx) => (
                        <tr key={p.name} className="border-b border-slate-200/60 group">
                          {idx === 0 && (
                            <th 
                              rowSpan={groupedPeople.crew.length}
                              scope="rowgroup"
                              aria-label="Gewerke Gruppe"
                              className="sticky left-0 z-10 w-3 border-r border-slate-200/70 bg-gradient-to-b from-green-400 to-green-500 p-0 rounded-bl-2xl"
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
                                  Gewerke
                                </span>
                              </div>
                            </th>
                          )}
                          <th scope="row" className="sticky left-3 z-10 w-[220px] sm:w-[260px] min-w-[220px] border-r border-slate-200/70 bg-white backdrop-blur shadow-sm px-3 py-2 text-left">
                            <div className="flex items-center gap-2">
                              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-green-500/15 text-xs font-semibold text-green-700">
                                {p.initials}
                              </span>
                              <div className="min-w-[10ch] whitespace-normal">
                                <p className="font-semibold leading-5">{p.name}</p>
                              </div>
                            </div>
                          </th>
                          {p.days.map((cell, i) => (
                            <td key={i} className="h-20 px-1.5 py-1.5 align-top whitespace-normal break-words">
                              <Cell cell={cell} compact={compact} inTable={true} />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </>
                  ) : (
                    /* Gefilterte Liste ohne Gruppierungs-Header */
                    filteredPeople.map((p) => (
                      <tr key={p.name} className="border-b border-slate-200/60">
                        <th scope="row" className="sticky left-0 z-10 w-[220px] sm:w-[260px] min-w-[220px] border-r border-slate-200/70 bg-white backdrop-blur shadow-sm px-3 py-2 text-left">
                          <div className="flex items-center gap-2">
                            <span className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold ${
                              p.group === 'actors' 
                                ? 'bg-blue-500/15 text-blue-700' 
                                : p.group === 'crew'
                                ? 'bg-green-500/15 text-green-700'
                                : 'bg-purple-500/15 text-purple-700'
                            }`}>
                              {p.initials}
                            </span>
                            <div className="min-w-[10ch] whitespace-normal">
                              <p className="font-semibold leading-5">{p.name}</p>
                            </div>
                          </div>
                        </th>
                        {p.days.map((cell, i) => (
                          <td key={i} className="h-20 px-1.5 py-1.5 align-top whitespace-normal break-words">
                            <Cell cell={cell} compact={compact} inTable={true} />
                          </td>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            
            <p className="mt-2 text-[12px] text-slate-600">
              Tipp: 
              <span className="mx-1 rounded-md border border-slate-200 bg-white px-1.5 py-0.5">Bevorzugt</span>
              und
              <span className="mx-1 rounded-md border border-slate-200 bg-white px-1.5 py-0.5">Frei</span>
              sind sofort planbar. Einträge mit Text enthalten Details.
            </p>
          </section>
        )}

        <div className="rounded-2xl border border-dashed border-slate-200/80 bg-slate-100 p-5 text-center text-sm text-slate-600">
          Keine weiteren wichtigen Probentage. Lege bevorzugte/ausnahmsweise erlaubte Tage in den Einstellungen fest.
        </div>
      </main>
    </div>
  );
}

function DesktopCalendar({ people, dayCols, holidays }: { people: any[]; dayCols: { label: string; n: number; accent?: boolean }[]; holidays: { dayIndex: number; label?: string }[] }) {
  const days = useMemo(() => selectDayBuckets(people, dayCols, holidays), [people, dayCols, holidays]);
  const [hoveredDay, setHoveredDay] = useState<number | null>(null);
  const holidaySpans = useMemo(() => getHolidaySpans(dayCols, days), [dayCols, days]);
  
  // Determine if we need compact mode based on people count
  const totalPeople = people.length;
  const isCompactMode = totalPeople > 5;
  
  return (
    <section className="hidden sm:block">
      {/* Horizontal Scrolling Container für Ferien-Balken UND Karten */}
      <div className="overflow-x-auto pb-2">
        <div className="min-w-max">
          {/* Holiday Spans Bar - scrollt MIT den Karten */}
          {(holidaySpans.length > 0 || days.some(d => d.holidayType === 'holiday' || d.isPublicHoliday)) && (
            <div className="mb-3 space-y-1.5">
              {/* Ferien-Balken */}
              {holidaySpans.length > 0 && (
                <div className="flex gap-3">
                  {dayCols.map((_, idx) => {
                    const span = holidaySpans.find((s) => s.start === idx);
                    const isInSpan = holidaySpans.some((s) => idx >= s.start && idx <= s.end);
                    const isStart = span !== undefined;
                    
                    if (isStart && span) {
                      const colSpan = span.end - span.start + 1;
                      return (
                        <div
                          key={idx}
                          className="flex items-center justify-center rounded-lg bg-gradient-to-r from-sky-400 to-sky-500 px-3 py-2 text-white shadow-md shrink-0 w-72"
                          style={colSpan > 1 ? {
                            width: `calc(${colSpan} * 288px + ${(colSpan - 1) * 12}px)`
                          } : undefined}
                        >
                          <UmbrellaIcon />
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
              {days.some(d => d.holidayType === 'holiday' || d.isPublicHoliday) && (
                <div className="flex gap-3">
                  {dayCols.map((_, idx) => {
                  const day = days[idx];
                  // Zeige Feiertags-Balken wenn: expliziter Feiertag ODER Feiertag in Ferien
                  if (day?.holidayType === 'holiday' || day?.isPublicHoliday) {
                    return (
                      <div
                        key={idx}
                        className="flex items-center justify-center rounded-lg bg-gradient-to-r from-amber-400 to-amber-500 px-3 py-2 text-white shadow-md shrink-0 w-72"
                      >
                        <CalendarStarIcon className="h-4 w-4" />
                        <span className="ml-2 text-sm font-bold truncate">{day.holidayLabel || 'Feiertag'}</span>
                      </div>
                    );
                  }
                  
                  return <div key={idx} className="w-72 shrink-0" />;
                })}
              </div>
            )}
            </div>
          )}
          
          {/* Einzelne Feiertage ohne Ferien-Span (alte separate Logik entfernen) */}
          {days.some(d => d.holidayType === 'holiday') && holidaySpans.length === 0 && (
            <div className="mb-3">
              <div className="flex gap-3">
                {dayCols.map((_, idx) => {
                  const day = days[idx];
                  if (day?.holidayType === 'holiday') {
                    return (
                      <div
                        key={idx}
                        className="flex items-center justify-center rounded-lg bg-gradient-to-r from-amber-400 to-amber-500 px-3 py-2 text-white shadow-md shrink-0 w-[calc((100vw-6rem)/3)] sm:w-[calc((100vw-8rem)/4)] md:w-[calc((100vw-10rem)/5)] lg:w-[calc((100vw-12rem)/7)] xl:w-48"
                      >
                        <CalendarStarIcon className="h-4 w-4" />
                        <span className="ml-2 text-sm font-bold truncate">{day.holidayLabel || 'Feiertag'}</span>
                      </div>
                    );
                  }
                  return <div key={idx} className="w-[calc((100vw-6rem)/3)] sm:w-[calc((100vw-8rem)/4)] md:w-[calc((100vw-10rem)/5)] lg:w-[calc((100vw-12rem)/7)] xl:w-48 shrink-0" />;
                })}
              </div>
            </div>
          )}
          
          {/* Karten-Grid */}
          <div className="flex gap-3">
          {days.map((d) => {
            const isHovered = hoveredDay === d.dc.n;
            const isToday = d.dc.accent === true;
            const totalCount = d.can.length + d.limited.length + d.blocked.length;
            const availablePercent = totalCount > 0 ? Math.round((d.can.length / totalCount) * 100) : 0;
            
            return (
              <div 
                key={d.dc.n} 
                className={`group flex flex-col rounded-2xl border bg-gradient-to-br shadow-md transition-all duration-300 w-72 shrink-0 ${
                  isToday
                    ? 'border-blue-500 shadow-xl ring-2 ring-blue-500/30'
                    : isHovered 
                      ? 'border-blue-300 shadow-xl scale-[1.02] ring-2 ring-blue-200/50' 
                      : 'border-slate-200/70 hover:border-slate-300 hover:shadow-lg'
                } ${
                  d.holiday 
                    ? 'from-sky-50 to-white' 
                    : availablePercent >= 75 
                      ? 'from-green-50/30 to-white'
                      : availablePercent <= 25
                        ? 'from-red-50/30 to-white'
                        : 'from-white to-slate-50/30'
                } ${isCompactMode ? 'min-h-[16rem] max-h-[24rem]' : 'min-h-[20rem] max-h-[32rem]'}`}
                onMouseEnter={() => setHoveredDay(d.dc.n)}
                onMouseLeave={() => setHoveredDay(null)}
              >
                {/* Header mit Glassmorphism und verbessertem Layout */}
                <div className="relative overflow-hidden border-b border-slate-200/50 backdrop-blur-sm shrink-0">
                  <div className="absolute inset-0 bg-gradient-to-b from-white/80 to-white/40" />
                  <div className="relative px-2.5 py-2">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex flex-col min-w-0">
                        <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-slate-500">{d.dc.label}</span>
                        <span className="text-lg font-bold text-slate-900">{d.dc.n}</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-end gap-0.5">
                      <StatusBadge icon={<StarIcon className="h-3 w-3" />} count={d.can.length} tone="ok" compact={isCompactMode} />
                      <StatusBadge icon={<ClockAlertIcon className="h-3 w-3" />} count={d.limited.length} tone="warn" compact={isCompactMode} />
                      <StatusBadge icon={<XCircleIcon className="h-3 w-3" />} count={d.blocked.length} tone="danger" compact={isCompactMode} />
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
                {d.can.length > 0 && (
                  <div className="space-y-1">
                    <h4 className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-green-700 sticky top-0 bg-gradient-to-b from-white via-white to-transparent pb-1 z-10">
                      <StarIcon className="h-3 w-3 fill-green-600" />
                      <span className="hidden lg:inline">Verfügbar</span>
                    </h4>
                    <ul className="space-y-1">
                      {d.can.map(({ person, cell }, i) => (
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

                {d.limited.length > 0 && (
                  <div className="space-y-1">
                    <h4 className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-orange-700 sticky top-0 bg-gradient-to-b from-white via-white to-transparent pb-1 z-10">
                      <ClockAlertIcon className="h-3 w-3" />
                      <span className="hidden lg:inline">Eingeschränkt</span>
                    </h4>
                    <ul className="space-y-1">
                      {d.limited.map(({ person, cell }, i) => (
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

                {d.blocked.length > 0 && (
                  <div className="space-y-1">
                    <h4 className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-red-700 sticky top-0 bg-gradient-to-b from-white via-white to-transparent pb-1 z-10">
                      <XCircleIcon className="h-3 w-3" />
                      <span className="hidden lg:inline">Gesperrt</span>
                    </h4>
                    <ul className="space-y-1">
                      {d.blocked.map(({ person, cell }, i) => (
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
                    <div className="rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/50 px-3 py-4 text-center">
                      <CheckIcon />
                      <p className="mt-1 text-[11px] font-medium text-slate-500">Keine Einträge</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer mit Stats - kompakter */}
              <div className="relative overflow-hidden border-t border-slate-200/50 backdrop-blur-sm shrink-0">
                <div className="absolute inset-0 bg-gradient-to-t from-white/80 to-white/40" />
                <div className="relative flex items-center justify-between px-2.5 py-1.5 text-[10px] font-medium">
                  <span className="flex items-center gap-1 text-green-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                    {d.can.length}
                  </span>
                  <span className="flex items-center gap-1 text-orange-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />
                    {d.limited.length}
                  </span>
                  <span className="flex items-center gap-1 text-red-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                    {d.blocked.length}
                  </span>
                  <span className="hidden lg:inline text-slate-500">
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

function PersonCard({ person, cell, tone, compact }: { 
  person: any; 
  cell: any; 
  tone: 'ok' | 'warn' | 'danger';
  compact: boolean;
}) {
  const colors = {
    ok: {
      border: 'border-green-200/80',
      bg: 'from-green-50/80 to-white',
      avatar: 'from-green-500 to-green-600',
      text: 'text-green-700/90',
      badge: 'bg-green-600'
    },
    warn: {
      border: 'border-orange-200/80',
      bg: 'from-orange-50/80 to-white',
      avatar: 'from-orange-500 to-orange-600',
      text: 'text-orange-700/90',
      badge: 'bg-orange-600'
    },
    danger: {
      border: 'border-red-200/80',
      bg: 'from-red-50/80 to-white',
      avatar: 'from-red-500 to-red-600',
      text: 'text-red-700/90',
      badge: 'bg-red-600'
    }
  };
  
  const style = colors[tone];
  
  return (
    <li className={`group/item flex items-start gap-1.5 rounded-xl border ${style.border} bg-gradient-to-br ${style.bg} px-2 py-1.5 text-[11px] shadow-sm transition-all hover:scale-[1.02] hover:shadow-md`}>
      <span className={`mt-0.5 inline-flex ${compact ? 'h-5 w-5' : 'h-6 w-6'} shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${style.avatar} text-[9px] font-bold text-white shadow-sm`}>
        {person.initials}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1">
          <p className="truncate font-semibold text-slate-900 text-[11px]">{person.name}</p>
          {cell.type === 'preferred' && !compact && (
            <span className={`rounded-full ${style.badge} px-1 py-0.5 text-[8px] font-bold uppercase tracking-wide text-white`}>Top</span>
          )}
        </div>
        {cell.label && !compact && (
          <p className={`mt-0.5 text-[10px] leading-tight ${style.text} line-clamp-2`}>{cell.label}</p>
        )}
        {cell.label && compact && (
          <p className={`text-[9px] ${style.text} truncate`} title={cell.label}>
            {cell.label}
          </p>
        )}
      </div>
    </li>
  );
}

function StatusBadge({ icon, count, tone, compact }: { icon: React.ReactNode; count: number; tone: 'ok' | 'warn' | 'danger'; compact?: boolean }) {
  const colors = {
    ok: 'bg-green-100 text-green-700 border-green-300',
    warn: 'bg-orange-100 text-orange-700 border-orange-300',
    danger: 'bg-red-100 text-red-700 border-red-300'
  };
  
  if (compact) {
    return (
      <div className={`flex items-center justify-center rounded-md border px-1 py-0.5 text-[10px] font-bold ${colors[tone]}`}>
        <span>{count}</span>
      </div>
    );
  }
  
  return (
    <div className={`flex items-center gap-1 rounded-lg border px-1.5 py-0.5 text-[10px] font-bold shadow-sm ${colors[tone]}`}>
      {icon}
      <span>{count}</span>
    </div>
  );
}

function TimelineView({ people, groupedPeople, dayCols, holidays, highlightedDay, setHighlightedDay, onPreviousMonth, onNextMonth }: { 
  people: any[]; 
  groupedPeople: { actors: any[]; crew: any[]; both: any[] } | null;
  dayCols: { label: string; n: number }[];
  holidays: { dayIndex: number; label?: string }[];
  highlightedDay: number | null;
  setHighlightedDay: (day: number | null) => void;
  onPreviousMonth: () => void;
  onNextMonth: () => void;
}) {
  const days = useMemo(() => selectDayBuckets(people, dayCols, holidays), [people, dayCols, holidays]);
  const holidaySpans = useMemo(() => getHolidaySpans(dayCols, days), [dayCols, days]);
  
  return (
    <section className="hidden sm:block">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="text-sm font-semibold text-slate-700">Timeline-Ansicht · {people.length} Personen</div>
        <div className="flex items-center gap-1 rounded-xl border border-slate-200/70 bg-white/80 p-1 shadow-sm">
          <IconButton aria-label="Vorheriger Monat" onClick={onPreviousMonth}>&larr;</IconButton>
          <IconButton aria-label="Nächster Monat" onClick={onNextMonth}>&rarr;</IconButton>
          <button
            type="button"
            className="ml-1 inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white/70 px-2.5 py-1 text-sm font-medium hover:bg-white transition-colors"
            aria-label="Zu heute springen"
            onClick={() => {
              const todayDay = dayCols.find(d => d.n === 14); // Mittwoch ist der "heute" Tag
              if (todayDay) {
                setHighlightedDay(todayDay.n);
                const element = document.querySelector(`[data-day="${todayDay.n}"]`);
                element?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
              }
            }}
          >
            <ClockIcon /> Heute
          </button>
        </div>
      </div>

      {/* Kompakte Symbollegende */}
      <div className="mb-3 flex items-center gap-4 rounded-lg border border-slate-200/70 bg-slate-50/50 px-3 py-2 text-[11px]">
        <span className="font-semibold uppercase tracking-wide text-slate-500">Legende:</span>
        <div className="flex items-center gap-1">
          <div className="flex h-5 w-5 items-center justify-center rounded border border-green-200 bg-gradient-to-br from-green-50 to-green-100/50">
            <StarIcon className="h-3 w-3 text-green-600" />
          </div>
          <span className="text-slate-700">Bevorzugt</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="flex h-5 w-5 items-center justify-center rounded border border-slate-200 bg-slate-50/50">
            <CheckIcon />
          </div>
          <span className="text-slate-700">Frei</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="flex h-5 w-5 items-center justify-center rounded border border-orange-200 bg-gradient-to-br from-orange-50 to-orange-100/50">
            <ClockAlertIcon className="h-3 w-3 text-orange-600" />
          </div>
          <span className="text-slate-700">Eingeschränkt</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="flex h-5 w-5 items-center justify-center rounded border border-red-200 bg-gradient-to-br from-red-50 to-red-100/50">
            <XCircleIcon className="h-3 w-3 text-red-600" />
          </div>
          <span className="text-slate-700">Gesperrt</span>
        </div>
        <div className="ml-2 h-3 w-px bg-slate-300" />
        <div className="flex items-center gap-1">
          <div className="flex h-5 w-5 items-center justify-center rounded bg-gradient-to-r from-amber-400 to-amber-500">
            <CalendarStarIcon className="h-3 w-3 text-white" />
          </div>
          <span className="text-slate-700">Feiertag</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="flex h-5 w-5 items-center justify-center rounded bg-gradient-to-r from-sky-400 to-sky-500">
            <UmbrellaIcon />
          </div>
          <span className="text-slate-700">Ferien</span>
        </div>
      </div>

      {/* Timeline mit sticky Header - global scrollbar */}
      <div className="rounded-2xl border border-slate-200/70 bg-slate-50/30 p-3">
        {/* Holiday Spans Bar */}
        {(holidaySpans.length > 0 || days.some(d => d.holidayType === 'holiday' || d.isPublicHoliday)) && (
        <div className="mb-3 space-y-1.5">
          {/* Ferien-Balken */}
          {holidaySpans.length > 0 && (
            <div className="relative h-10">
              <div className="grid grid-cols-[200px_1fr] gap-0">
                <div className="flex items-center justify-end border-r border-slate-200/70 px-3">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-sky-600">Ferien</span>
                </div>
                <div className="grid grid-cols-7 gap-0 relative">
                  {holidaySpans.map((span, idx) => {
                    const colSpan = span.end - span.start + 1;
                    return (
                      <div
                        key={`span-${idx}`}
                        className="absolute top-0 h-10 flex items-center justify-center rounded-lg bg-gradient-to-r from-sky-400 to-sky-500 px-3 text-white shadow-md"
                        style={{
                          left: `${(span.start / 7) * 100}%`,
                          width: `${(colSpan / 7) * 100}%`,
                        }}
                      >
                        <UmbrellaIcon />
                        <span className="ml-2 text-sm font-bold truncate">{span.label || 'Ferien'}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
          
          {/* Feiertags-Balken (separat) */}
          {days.some(d => d.holidayType === 'holiday' || d.isPublicHoliday) && (
            <div className="relative h-10">
              <div className="grid grid-cols-[200px_1fr] gap-0">
                <div className="flex items-center justify-end border-r border-slate-200/70 px-3">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-600">Feiertage</span>
                </div>
                <div className="grid grid-cols-7 gap-0 relative">
                  {days.map((d, idx) => {
                    // Zeige Feiertag wenn: expliziter Feiertag ODER in Ferien mit Feiertag
                    if (d.holidayType === 'holiday' || d.isPublicHoliday) {
                      return (
                        <div
                          key={`holiday-${idx}`}
                          className="absolute top-0 h-10 flex items-center justify-center rounded-lg bg-gradient-to-r from-amber-400 to-amber-500 px-2 text-white shadow-md"
                          style={{
                            left: `${(idx / 7) * 100}%`,
                            width: `${(1 / 7) * 100}%`,
                          }}
                        >
                          <CalendarStarIcon className="h-4 w-4" />
                          <span className="ml-1 text-xs font-bold truncate">{d.holidayLabel}</span>
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

      <div className="space-y-3">
        {/* Tage-Header */}
        <div className="sticky top-0 z-20 rounded-2xl border border-slate-200/70 bg-white/95 shadow-sm backdrop-blur">
          <div className="grid grid-cols-[200px_1fr] gap-0">
            <div className="border-r border-slate-200/70 px-4 py-3">
              <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Mitglied</span>
            </div>
            <div className="grid grid-cols-7 gap-0">
              {dayCols.map((d) => (
                <button
                  key={d.n}
                  data-day={d.n}
                  onClick={() => setHighlightedDay(highlightedDay === d.n ? null : d.n)}
                  className={`group flex flex-col items-center gap-1 border-l border-slate-200/50 px-2 py-2 transition-colors hover:bg-slate-50 ${
                    highlightedDay === d.n ? 'bg-blue-50/80' : ''
                  }`}
                  aria-label={`Tag ${d.n} ${highlightedDay === d.n ? 'hervorgehoben' : 'hervorheben'}`}
                >
                  <span className="text-[10px] uppercase tracking-[0.2em] text-slate-500">{d.label}</span>
                  <span className={`flex h-7 w-7 items-center justify-center rounded-full border text-[13px] font-semibold transition-all ${
                    highlightedDay === d.n 
                      ? 'border-blue-500 bg-blue-500 text-white shadow-md' 
                      : 'border-slate-200 bg-slate-50 text-slate-900 group-hover:border-blue-300'
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
                <div className="sticky top-0 z-10 -mx-1 mb-2 mt-4 rounded-lg bg-gradient-to-r from-blue-50 to-blue-100/50 px-4 py-2.5 backdrop-blur-sm">
                  <h3 className="text-sm font-bold uppercase tracking-wide text-blue-900">
                    Schauspieler <span className="ml-2 text-xs font-normal text-blue-700">({groupedPeople.actors.length})</span>
                  </h3>
                </div>
                {groupedPeople.actors.map((p) => (
                  <div key={p.name} className="rounded-2xl border border-slate-200/70 bg-white shadow-sm transition-shadow hover:shadow-md mb-3">
                    <div className="grid grid-cols-[200px_1fr] gap-0">
                      {/* Person Info */}
                      <div className="flex items-center gap-3 border-r border-slate-200/70 px-4 py-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-blue-600 text-sm font-semibold text-white shadow-sm">
                          {p.initials}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-semibold leading-5 text-slate-900">{p.name}</p>
                          <p className="text-[11px] text-slate-500">{p.stats}</p>
                        </div>
                      </div>

                      {/* Timeline Cells */}
                      <div className="grid grid-cols-7 gap-0">
                        {p.days.map((cell: any, i: number) => (
                          <div
                            key={i}
                            className={`relative border-l border-slate-200/50 px-2.5 py-3 transition-all ${
                              highlightedDay === dayCols[i].n ? 'bg-blue-50/40 ring-2 ring-inset ring-blue-200' : ''
                            }`}
                          >
                            <TimelineCell cell={cell} />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </>
            )}
            
            {/* Beides Gruppe (Schauspieler & Gewerke) - IN DER MITTE! */}
            {groupedPeople.both.length > 0 && (
              <>
                <div className="sticky top-0 z-10 -mx-1 mb-2 mt-4 rounded-lg bg-gradient-to-r from-purple-50 to-pink-100/50 px-4 py-2.5 backdrop-blur-sm">
                  <h3 className="text-sm font-bold uppercase tracking-wide text-purple-900">
                    Schauspieler & Gewerke <span className="ml-2 text-xs font-normal text-purple-700">({groupedPeople.both.length})</span>
                  </h3>
                </div>
                {groupedPeople.both.map((p) => (
                  <div key={p.name} className="rounded-2xl border border-slate-200/70 bg-white shadow-sm transition-shadow hover:shadow-md mb-3">
                    <div className="grid grid-cols-[200px_1fr] gap-0">
                      {/* Person Info */}
                      <div className="flex items-center gap-3 border-r border-slate-200/70 px-4 py-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-pink-500 text-sm font-semibold text-white shadow-sm">
                          {p.initials}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-semibold leading-5 text-slate-900">{p.name}</p>
                          <p className="text-[11px] text-slate-500">{p.stats}</p>
                        </div>
                      </div>

                      {/* Timeline Cells */}
                      <div className="grid grid-cols-7 gap-0">
                        {p.days.map((cell: any, i: number) => (
                          <div
                            key={i}
                            className={`relative border-l border-slate-200/50 px-2.5 py-3 transition-all ${
                              highlightedDay === dayCols[i].n ? 'bg-blue-50/40 ring-2 ring-inset ring-blue-200' : ''
                            }`}
                          >
                            <TimelineCell cell={cell} />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </>
            )}

            {/* Gewerke Gruppe */}
            {groupedPeople.crew.length > 0 && (
              <>
                <div className="sticky top-0 z-10 -mx-1 mb-2 mt-4 rounded-lg bg-gradient-to-r from-green-50 to-green-100/50 px-4 py-2.5 backdrop-blur-sm">
                  <h3 className="text-sm font-bold uppercase tracking-wide text-green-900">
                    Gewerke <span className="ml-2 text-xs font-normal text-green-700">({groupedPeople.crew.length})</span>
                  </h3>
                </div>
                {groupedPeople.crew.map((p) => (
                  <div key={p.name} className="rounded-2xl border border-slate-200/70 bg-white shadow-sm transition-shadow hover:shadow-md mb-3">
                    <div className="grid grid-cols-[200px_1fr] gap-0">
                      {/* Person Info */}
                      <div className="flex items-center gap-3 border-r border-slate-200/70 px-4 py-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-green-500 to-green-600 text-sm font-semibold text-white shadow-sm">
                          {p.initials}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-semibold leading-5 text-slate-900">{p.name}</p>
                          <p className="text-[11px] text-slate-500">{p.stats}</p>
                        </div>
                      </div>

                      {/* Timeline Cells */}
                      <div className="grid grid-cols-7 gap-0">
                        {p.days.map((cell: any, i: number) => (
                          <div
                            key={i}
                            className={`relative border-l border-slate-200/50 px-2.5 py-3 transition-all ${
                              highlightedDay === dayCols[i].n ? 'bg-blue-50/40 ring-2 ring-inset ring-blue-200' : ''
                            }`}
                          >
                            <TimelineCell cell={cell} />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </>
            )}
          </>
        ) : (
          /* Ungefilterte Liste ohne Gruppierung */
          people.map((p) => (
            <div key={p.name} className="rounded-2xl border border-slate-200/70 bg-white shadow-sm transition-shadow hover:shadow-md mb-3">
              <div className="grid grid-cols-[200px_1fr] gap-0">
                {/* Person Info */}
                <div className="flex items-center gap-3 border-r border-slate-200/70 px-4 py-3">
                  <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white shadow-sm ${
                    p.group === 'actors'
                      ? 'bg-gradient-to-br from-blue-500 to-blue-600'
                      : p.group === 'crew'
                      ? 'bg-gradient-to-br from-green-500 to-green-600'
                      : 'bg-gradient-to-br from-purple-500 to-pink-500'
                  }`}>
                    {p.initials}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-semibold leading-5 text-slate-900">{p.name}</p>
                    <p className="text-[11px] text-slate-500">{p.stats}</p>
                  </div>
                </div>

                {/* Timeline Cells */}
                <div className="grid grid-cols-7 gap-0">
                  {p.days.map((cell: any, i: number) => (
                    <div
                      key={i}
                      className={`relative border-l border-slate-200/50 px-2.5 py-3 transition-all ${
                        highlightedDay === dayCols[i].n ? 'bg-blue-50/40 ring-2 ring-inset ring-blue-200' : ''
                      }`}
                    >
                      <TimelineCell cell={cell} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
      </div>

      <p className="mt-3 text-[11px] text-slate-500">
        <strong>Tipp:</strong> Klicke auf einen Tag im Header, um alle Einträge für diesen Tag hervorzuheben.
      </p>
    </section>
  );
}

function TimelineCell({ cell }: { cell: { type: string; label?: string } }) {
  const [showTooltip, setShowTooltip] = useState(false);

  if (cell.type === "free") {
    return (
      <div className="group relative flex h-10 items-center justify-center">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-slate-50/50 text-slate-400 transition-all group-hover:border-slate-300 group-hover:bg-slate-100">
          <CheckIcon />
        </div>
        <span className="pointer-events-none absolute -top-8 left-1/2 z-30 -translate-x-1/2 whitespace-nowrap rounded-lg bg-slate-900 px-2 py-1 text-xs text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
          Frei verfügbar
        </span>
      </div>
    );
  }

  if (cell.type === "holiday") {
    // Ferien werden jetzt zentral angezeigt, zeige nur leere Zelle
    return (
      <div className="flex h-10 items-center justify-center">
        <div className="h-1 w-full rounded-full bg-sky-200/50" />
      </div>
    );
  }

  if (cell.type === "block") {
    return (
      <div
        className="group relative flex h-10 items-center justify-center"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-red-200 bg-gradient-to-br from-red-50 to-red-100/50 shadow-sm transition-all group-hover:shadow-md">
          <XCircleIcon className="h-5 w-5 text-red-600" />
        </div>
        {cell.label && showTooltip && (
          <div className="absolute -top-2 left-1/2 z-30 w-48 -translate-x-1/2 -translate-y-full rounded-lg border border-red-200 bg-white p-2 shadow-xl">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-red-700">Sperrtermin</p>
            <p className="mt-0.5 text-xs leading-snug text-slate-700">{cell.label}</p>
          </div>
        )}
      </div>
    );
  }

  if (cell.type === "limited") {
    return (
      <div
        className="group relative flex h-10 items-center justify-center"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-orange-200 bg-gradient-to-br from-orange-50 to-orange-100/50 shadow-sm transition-all group-hover:shadow-md">
          <ClockAlertIcon className="h-5 w-5 text-orange-600" />
        </div>
        {cell.label && showTooltip && (
          <div className="absolute -top-2 left-1/2 z-30 w-48 -translate-x-1/2 -translate-y-full rounded-lg border border-orange-200 bg-white p-2 shadow-xl">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-orange-700">Eingeschränkt</p>
            <p className="mt-0.5 text-xs leading-snug text-slate-700">{cell.label}</p>
          </div>
        )}
      </div>
    );
  }

  if (cell.type === "preferred") {
    return (
      <div
        className="group relative flex h-10 items-center justify-center"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-green-200 bg-gradient-to-br from-green-50 to-green-100/50 shadow-sm transition-all group-hover:shadow-md">
          <StarIcon className="h-5 w-5 text-green-600" />
        </div>
        {cell.label && showTooltip && (
          <div className="absolute -top-2 left-1/2 z-30 w-48 -translate-x-1/2 -translate-y-full rounded-lg border border-green-200 bg-white p-2 shadow-xl">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-green-700">Bevorzugt</p>
            <p className="mt-0.5 text-xs leading-snug text-slate-700">{cell.label}</p>
          </div>
        )}
      </div>
    );
  }

  return null;
}

function MiniChip({ tone, count }: { tone: 'ok' | 'warn' | 'danger'; count: number }) {
  const map: Record<string, string> = {
    ok: 'bg-[color:var(--ok-rgba)] text-[color:var(--ok)] border-green-200',
    warn: 'bg-[color:var(--warn-rgba)] text-[color:var(--warn)] border-orange-200',
    danger: 'bg-[color:var(--danger-rgba)] text-[color:var(--danger)] border-red-200',
  };
  return <span className={`inline-flex min-w-5 items-center justify-center rounded-md border px-1 text-[10px] ${map[tone]}`}>{count}</span>;
}

function Badge({ children, tone }: { children: React.ReactNode; tone?: "info" | "danger" | "ok" }) {
  const palettes: Record<string, string> = {
    info: "border-sky-200 bg-[color:var(--info-rgba)] text-[color:var(--info)]",
    danger: "border-red-200 bg-[color:var(--danger-rgba)] text-[color:var(--danger)]",
    ok: "border-green-200 bg-[color:var(--ok-rgba)] text-[color:var(--ok)]",
    default: "border-slate-200 bg-white/80 text-slate-600",
  };
  return (
    <span className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${palettes[tone ?? "default"]}`}>
      {children}
    </span>
  );
}

function IconButton({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className="inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-500 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50"
    >
      {children}
    </button>
  );
}

function Kpi({ icon, title, value, hint, tone }: { icon: React.ReactNode; title: string; value: string; hint?: string; tone?: "info" | "danger" }) {
  const bg = tone === "danger" ? "bg-[color:var(--danger-rgba)] text-[color:var(--danger)]" : tone === "info" ? "bg-[color:var(--info-rgba)] text-[color:var(--info)]" : "bg-[color:var(--primary-rgba)] text-[var(--primary)]";
  return (
    <article className="flex items-start gap-3 rounded-2xl border border-slate-200/70 bg-white/80 p-4 shadow-sm">
      <span className={`flex h-11 w-11 items-center justify-center rounded-full ${bg}`}>{icon}</span>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{title}</p>
        <p className="truncate text-lg font-semibold sm:text-xl">{value}</p>
        {hint && <p className="text-xs leading-5 text-slate-600">{hint}</p>}
      </div>
    </article>
  );
}

function Note({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <article className="rounded-2xl border border-slate-200/70 bg-white/80 p-4 shadow-sm">
      <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{title}</h3>
      <p className="mt-1 text-sm leading-6 text-slate-700">{children}</p>
    </article>
  );
}

function Cell({ cell, compact, inTable }: { cell: { type: string; label?: string }; compact: boolean; inTable?: boolean }) {
  if (cell.type === "free") {
    return (
      <div className="flex h-16 items-center justify-center rounded-lg border border-slate-200/70 bg-slate-50 text-[11px] font-medium text-slate-500">
        frei
      </div>
    );
  }
  if (cell.type === "holiday") {
    // Ferien werden zentral angezeigt, zeige nur leere/dezente Zelle
    return (
      <div className="flex h-16 items-center justify-center rounded-lg border border-sky-200/30 bg-sky-50/30">
        <span className="h-1.5 w-full rounded-full bg-sky-300/50" />
      </div>
    );
  }
  const base = "flex flex-col justify-center h-16 w-full rounded-lg px-2.5 text-left text-[12px] font-medium overflow-hidden" + (compact ? " leading-4" : "");
  if (cell.type === "block") {
    return (
      <button className={`${base} bg-[color:var(--danger-rgba)] text-[color:var(--danger)] border border-red-200`}>
        <span className="block truncate text-[10px] uppercase tracking-[0.14em]">Sperrtermin</span>
        {cell.label && <span className="block mt-0.5 text-[11px] text-[color:var(--danger)] truncate">{cell.label}</span>}
      </button>
    );
  }
  if (cell.type === "limited") {
    return (
      <button className={`${base} border border-orange-200 bg-[color:var(--warn-rgba)] text-[color:var(--warn)]`}>
        <span className="block truncate text-[10px] uppercase tracking-[0.14em]">Eingeschränkt</span>
        {cell.label && <span className="block mt-0.5 text-[11px] text-[color:var(--warn)] truncate">{cell.label}</span>}
      </button>
    );
  }
  if (cell.type === "preferred") {
    return (
      <button className={`${base} border border-green-200 bg-[color:var(--ok-rgba)] text-[color:var(--ok)]`}>
        <span className="block truncate text-[10px] uppercase tracking-[0.14em]">Bevorzugt</span>
        {cell.label && <span className="block mt-0.5 text-[11px] text-[color:var(--ok)] truncate">{cell.label}</span>}
      </button>
    );
  }
  return null;
}

function WeekStrip({ people, dayCols, holidays }: { people: any[]; dayCols: { label: string; n: number }[]; holidays: { dayIndex: number; label?: string }[] }) {
  const buckets = useMemo(() => selectDayBuckets(people, dayCols, holidays), [people, dayCols, holidays]);
  const onJump = (n: number) => {
    const el = document.getElementById(`day-${n}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-gradient-to-b from-white to-slate-50/30 shadow-sm">
      <div className="grid grid-cols-7 gap-px bg-slate-200/50">
        {buckets.map((d) => {
          const isToday = d.dc.accent === true;
          const totalCount = d.can.length + d.limited.length + d.blocked.length;
          const availablePercent = totalCount > 0 ? Math.round((d.can.length / totalCount) * 100) : 0;
          
          return (
            <button
              key={d.dc.n}
              className={`group relative flex flex-col items-center justify-center gap-1.5 bg-white p-2.5 transition-all active:scale-95 ${
                isToday ? 'bg-blue-50' : 'active:bg-slate-50'
              }`}
              onClick={() => onJump(d.dc.n)}
              aria-label={`${d.dc.label} ${d.dc.n}.05. öffnen`}
            >
              {/* Tag-Nummer und Wochentag */}
              <div className="flex flex-col items-center gap-0.5">
                <span className="text-[9px] font-medium uppercase tracking-wider text-slate-400">{d.dc.label}</span>
                <span className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold transition-colors ${
                  isToday 
                    ? 'bg-blue-500 text-white shadow-sm' 
                    : d.holidayType
                      ? 'bg-gradient-to-br from-sky-100 to-sky-200 text-sky-700'
                      : 'text-slate-800 group-active:text-blue-600'
                }`}>
                  {d.dc.n}
                </span>
              </div>

              {/* Kompakte Status-Indikatoren */}
              {totalCount > 0 && (
                <div className="flex items-center gap-0.5">
                  {d.can.length > 0 && (
                    <div className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-green-100 px-1 text-[10px] font-semibold text-green-700">
                      {d.can.length}
                    </div>
                  )}
                  {d.limited.length > 0 && (
                    <div className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-orange-100 px-1 text-[10px] font-semibold text-orange-700">
                      {d.limited.length}
                    </div>
                  )}
                  {d.blocked.length > 0 && (
                    <div className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-100 px-1 text-[10px] font-semibold text-red-700">
                      {d.blocked.length}
                    </div>
                  )}
                </div>
              )}

              {/* Verfügbarkeits-Fortschrittsbalken */}
              {totalCount > 0 && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5">
                  <div 
                    className={`h-full transition-all ${
                      availablePercent >= 75 ? 'bg-green-500' :
                      availablePercent >= 50 ? 'bg-orange-400' :
                      'bg-red-500'
                    }`}
                    style={{ width: `${availablePercent}%` }}
                  />
                </div>
              )}

              {/* Feiertag/Ferien Icon */}
              {d.holidayType === 'holiday' && (
                <div className="absolute right-1 top-1">
                  <CalendarStarIcon className="h-3 w-3 text-amber-500" />
                </div>
              )}
              {d.holidayType === 'vacation' && !d.isPublicHoliday && (
                <div className="absolute right-1 top-1">
                  <UmbrellaIcon className="h-3 w-3 text-sky-500" />
                </div>
              )}
              {d.holidayType === 'vacation' && d.isPublicHoliday && (
                <div className="absolute right-0.5 top-0.5 flex gap-0.5">
                  <UmbrellaIcon className="h-2.5 w-2.5 text-sky-500" />
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

function Dot({ count, tone }: { count: number; tone: 'ok' | 'warn' | 'danger' }) {
  const map: Record<string, string> = {
    ok: 'bg-[color:var(--ok-rgba)] text-[color:var(--ok)] border-green-200',
    warn: 'bg-[color:var(--warn-rgba)] text-[color:var(--warn)] border-orange-200',
    danger: 'bg-[color:var(--danger-rgba)] text-[color:var(--danger)] border-red-200',
  };
  return (
    <span className={`inline-flex min-w-5 items-center justify-center rounded-md border px-1 text-[10px] ${map[tone]}`}>{count}</span>
  );
}

function MobileByDay({ people, groupedPeople, dayCols, holidays }: { 
  people: any[]; 
  groupedPeople: { actors: any[]; crew: any[]; both: any[] } | null;
  dayCols: { label: string; n: number }[]; 
  holidays: { dayIndex: number; label?: string }[] 
}) {
  const dtf = useMemo(() => new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit" }), []);
  const dayList = useMemo(() => selectDayBuckets(people, dayCols, holidays), [people, dayCols, holidays]);

  return (
    <div className="space-y-3">
      {dayList.map((d) => {
        const regionId = `day-${d.dc.n}`;
        const dateObj = new Date(2025, 4, d.dc.n);
        const label = dtf.format(dateObj);
        return (
          <article key={d.dc.n} className="rounded-2xl border border-slate-200/70 bg-white shadow-sm" role="region" aria-labelledby={regionId} id={regionId}>
            <header className="sticky top-0 z-10 -mx-3 px-3 bg-white/90 backdrop-blur supports-[backdrop-filter]:backdrop-blur-sm border-b border-slate-100">
              <div className="flex items-center justify-between py-2">
                <div className="flex items-baseline gap-2">
                  <h3 id={regionId} className="text-sm font-semibold">
                    {d.dc.label} <span className="text-slate-500">{label}</span>
                  </h3>
                  {d.holidayType === 'holiday' && (
                    <span className="flex items-center gap-1 rounded-full border border-amber-200 bg-amber-500 px-2 py-0.5 text-[11px] font-semibold text-white">
                      <CalendarStarIcon className="h-3 w-3" />
                      {d.holidayLabel || 'Feiertag'}
                    </span>
                  )}
                  {d.holidayType === 'vacation' && (
                    <span className="flex items-center gap-1 rounded-full border border-sky-200 bg-sky-500 px-2 py-0.5 text-[11px] font-semibold text-white">
                      <UmbrellaIcon />
                      {d.holidayLabel || 'Ferien'}
                      {d.isPublicHoliday && <CalendarStarIcon className="h-3 w-3" />}
                    </span>
                  )}
                </div>
                <small className="text-[11px] text-slate-500">
                  {d.can.length} können · {d.limited.length} eingeschränkt · {d.blocked.length} gesperrt
                </small>
              </div>
            </header>

            <div className="p-2 pt-2 space-y-2">
              {/* Gruppierte Darstellung wenn groupedPeople vorhanden */}
              {groupedPeople ? (
                <>
                  {/* Frei/Bevorzugt - nach Gruppen sortiert */}
                  {d.can.length > 0 && (
                    <div className="space-y-2">
                      {/* Schauspieler */}
                      {(() => {
                        const actorsCan = d.can.filter(({ person }) => person.group === 'actors');
                        if (actorsCan.length === 0) return null;
                        return (
                          <>
                            <div className="flex items-center gap-2 px-2 py-1">
                              <div className="h-0.5 w-1 rounded-full bg-gradient-to-b from-blue-400 to-blue-500" />
                              <span className="text-[10px] font-semibold uppercase tracking-wider text-blue-600">Schauspieler</span>
                            </div>
                            <ul className="divide-y divide-slate-100 rounded-lg border border-green-200/60 bg-[color:var(--ok-rgba)]">
                              {actorsCan.map(({ person, cell }, i) => (
                                <li key={person.name + i} className="flex items-start gap-2 px-3 py-2 text-[13px] text-[color:var(--ok)]">
                                  <span className="mt-1 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-500/20 text-xs font-semibold text-blue-700">
                                    {person.initials}
                                  </span>
                                  <div className="min-w-0">
                                    <p className="font-medium text-slate-800">
                                      {person.name} <span className="ml-1 text-[11px] uppercase tracking-[0.16em] text-green-700/80">{cell.type === "preferred" ? "Bevorzugt" : "Frei"}</span>
                                    </p>
                                    {cell.label && <p className="text-[12px] text-green-700/90">{cell.label}</p>}
                                  </div>
                                </li>
                              ))}
                            </ul>
                          </>
                        );
                      })()}
                      
                      {/* Beides */}
                      {(() => {
                        const bothCan = d.can.filter(({ person }) => person.group === 'both');
                        if (bothCan.length === 0) return null;
                        return (
                          <>
                            <div className="flex items-center gap-2 px-2 py-1">
                              <div className="h-0.5 w-1 rounded-full bg-gradient-to-b from-purple-400 to-pink-500" />
                              <span className="text-[10px] font-semibold uppercase tracking-wider text-purple-600">Beides</span>
                            </div>
                            <ul className="divide-y divide-slate-100 rounded-lg border border-green-200/60 bg-[color:var(--ok-rgba)]">
                              {bothCan.map(({ person, cell }, i) => (
                                <li key={person.name + i} className="flex items-start gap-2 px-3 py-2 text-[13px] text-[color:var(--ok)]">
                                  <span className="mt-1 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-purple-500/20 text-xs font-semibold text-purple-700">
                                    {person.initials}
                                  </span>
                                  <div className="min-w-0">
                                    <p className="font-medium text-slate-800">
                                      {person.name} <span className="ml-1 text-[11px] uppercase tracking-[0.16em] text-green-700/80">{cell.type === "preferred" ? "Bevorzugt" : "Frei"}</span>
                                    </p>
                                    {cell.label && <p className="text-[12px] text-green-700/90">{cell.label}</p>}
                                  </div>
                                </li>
                              ))}
                            </ul>
                          </>
                        );
                      })()}
                      
                      {/* Gewerke */}
                      {(() => {
                        const crewCan = d.can.filter(({ person }) => person.group === 'crew');
                        if (crewCan.length === 0) return null;
                        return (
                          <>
                            <div className="flex items-center gap-2 px-2 py-1">
                              <div className="h-0.5 w-1 rounded-full bg-gradient-to-b from-green-400 to-green-500" />
                              <span className="text-[10px] font-semibold uppercase tracking-wider text-green-600">Gewerke</span>
                            </div>
                            <ul className="divide-y divide-slate-100 rounded-lg border border-green-200/60 bg-[color:var(--ok-rgba)]">
                              {crewCan.map(({ person, cell }, i) => (
                                <li key={person.name + i} className="flex items-start gap-2 px-3 py-2 text-[13px] text-[color:var(--ok)]">
                                  <span className="mt-1 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green-500/20 text-xs font-semibold text-green-700">
                                    {person.initials}
                                  </span>
                                  <div className="min-w-0">
                                    <p className="font-medium text-slate-800">
                                      {person.name} <span className="ml-1 text-[11px] uppercase tracking-[0.16em] text-green-700/80">{cell.type === "preferred" ? "Bevorzugt" : "Frei"}</span>
                                    </p>
                                    {cell.label && <p className="text-[12px] text-green-700/90">{cell.label}</p>}
                                  </div>
                                </li>
                              ))}
                            </ul>
                          </>
                        );
                      })()}
                    </div>
                  )}

                  {/* Eingeschränkt - nach Gruppen */}
                  {d.limited.length > 0 && (
                    <div className="space-y-2">
                      {[
                        { group: 'actors', label: 'Schauspieler', color: 'blue' },
                        { group: 'both', label: 'Beides', color: 'purple' },
                        { group: 'crew', label: 'Gewerke', color: 'green' }
                      ].map(({ group, label, color }) => {
                        const filtered = d.limited.filter(({ person }) => person.group === group);
                        if (filtered.length === 0) return null;
                        return (
                          <div key={group}>
                            <div className="flex items-center gap-2 px-2 py-1">
                              <div className={`h-0.5 w-1 rounded-full bg-gradient-to-b ${
                                color === 'blue' ? 'from-blue-400 to-blue-500' :
                                color === 'purple' ? 'from-purple-400 to-pink-500' :
                                'from-green-400 to-green-500'
                              }`} />
                              <span className={`text-[10px] font-semibold uppercase tracking-wider ${
                                color === 'blue' ? 'text-blue-600' :
                                color === 'purple' ? 'text-purple-600' :
                                'text-green-600'
                              }`}>{label}</span>
                            </div>
                            <ul className="divide-y divide-orange-100 rounded-lg border border-orange-200/70 bg-[color:var(--warn-rgba)]">
                              {filtered.map(({ person, cell }, i) => (
                                <li key={person.name + i} className="flex items-start gap-2 px-3 py-2 text-[13px] text-[color:var(--warn)]">
                                  <span className={`mt-1 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                                    color === 'blue' ? 'bg-blue-500/20 text-blue-700' :
                                    color === 'purple' ? 'bg-purple-500/20 text-purple-700' :
                                    'bg-green-500/20 text-green-700'
                                  } text-xs font-semibold`}>
                                    {person.initials}
                                  </span>
                                  <div className="min-w-0">
                                    <p className="font-medium text-slate-800">
                                      {person.name} <span className="ml-1 text-[11px] uppercase tracking-[0.16em]">Eingeschränkt</span>
                                    </p>
                                    {cell.label && <p className="text-[12px] text-orange-700/90">{cell.label}</p>}
                                  </div>
                                </li>
                              ))}
                            </ul>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Gesperrt - nach Gruppen */}
                  {d.blocked.length > 0 && (
                    <div className="space-y-2">
                      {[
                        { group: 'actors', label: 'Schauspieler', color: 'blue' },
                        { group: 'both', label: 'Beides', color: 'purple' },
                        { group: 'crew', label: 'Gewerke', color: 'green' }
                      ].map(({ group, label, color }) => {
                        const filtered = d.blocked.filter(({ person }) => person.group === group);
                        if (filtered.length === 0) return null;
                        return (
                          <div key={group}>
                            <div className="flex items-center gap-2 px-2 py-1">
                              <div className={`h-0.5 w-1 rounded-full bg-gradient-to-b ${
                                color === 'blue' ? 'from-blue-400 to-blue-500' :
                                color === 'purple' ? 'from-purple-400 to-pink-500' :
                                'from-green-400 to-green-500'
                              }`} />
                              <span className={`text-[10px] font-semibold uppercase tracking-wider ${
                                color === 'blue' ? 'text-blue-600' :
                                color === 'purple' ? 'text-purple-600' :
                                'text-green-600'
                              }`}>{label}</span>
                            </div>
                            <ul className="divide-y divide-red-100 rounded-lg border border-red-200/70 bg-[color:var(--danger-rgba)]">
                              {filtered.map(({ person, cell }, i) => (
                                <li key={person.name + i} className="flex items-start gap-2 px-3 py-2 text-[13px] text-[color:var(--danger)]">
                                  <span className={`mt-1 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                                    color === 'blue' ? 'bg-blue-500/20 text-blue-700' :
                                    color === 'purple' ? 'bg-purple-500/20 text-purple-700' :
                                    'bg-green-500/20 text-green-700'
                                  } text-xs font-semibold`}>
                                    {person.initials}
                                  </span>
                                  <div className="min-w-0">
                                    <p className="font-medium text-slate-800">
                                      {person.name} <span className="ml-1 text-[11px] uppercase tracking-[0.16em]">Sperrtermin</span>
                                    </p>
                                    {cell.label && <p className="text-[12px] text-red-700/90">{cell.label}</p>}
                                  </div>
                                </li>
                              ))}
                            </ul>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              ) : (
                /* Ungefilterte Darstellung ohne Gruppen */
                <>
                  {d.can.length > 0 && (
                    <ul className="divide-y divide-slate-100 rounded-lg border border-green-200/60 bg-[color:var(--ok-rgba)]">
                      {d.can.map(({ person, cell }, i) => (
                        <li key={person.name + i} className="flex items-start gap-2 px-3 py-2 text-[13px] text-[color:var(--ok)]">
                          <span className="mt-1 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/80 text-xs font-semibold text-[var(--primary)]">
                            {person.initials}
                          </span>
                          <div className="min-w-0">
                            <p className="font-medium text-slate-800">
                              {person.name} <span className="ml-1 text-[11px] uppercase tracking-[0.16em] text-green-700/80">{cell.type === "preferred" ? "Bevorzugt" : "Frei"}</span>
                            </p>
                            {cell.label && <p className="text-[12px] text-green-700/90">{cell.label}</p>}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}

                  {d.limited.length > 0 && (
                <ul className="mt-2 divide-y divide-orange-100 rounded-lg border border-orange-200/70 bg-[color:var(--warn-rgba)]">
                  {d.limited.map(({ person, cell }, i) => (
                    <li key={person.name + i} className="flex items-start gap-2 px-3 py-2 text-[13px] text-[color:var(--warn)]">
                      <span className="mt-1 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/80 text-xs font-semibold text-[var(--primary)]">
                        {person.initials}
                      </span>
                      <div className="min-w-0">
                        <p className="font-medium text-slate-800">
                          {person.name} <span className="ml-1 text-[11px] uppercase tracking-[0.16em]">Eingeschränkt</span>
                        </p>
                        {cell.label && <p className="text-[12px] text-orange-700/90">{cell.label}</p>}
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              {d.blocked.length > 0 && (
                <ul className="mt-2 divide-y divide-red-100 rounded-lg border border-red-200/70 bg-[color:var(--danger-rgba)]">
                  {d.blocked.map(({ person, cell }, i) => (
                    <li key={person.name + i} className="flex items-start gap-2 px-3 py-2 text-[13px] text-[color:var(--danger)]">
                      <span className="mt-1 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/80 text-xs font-semibold text-[var(--primary)]">
                        {person.initials}
                      </span>
                      <div className="min-w-0">
                        <p className="font-medium text-slate-800">
                          {person.name} <span className="ml-1 text-[11px] uppercase tracking-[0.16em]">Sperrtermin</span>
                        </p>
                        {cell.label && <p className="text-[12px] text-red-700/90">{cell.label}</p>}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
                </>
              )}

              {d.can.length + d.limited.length + d.blocked.length === 0 && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[13px] text-slate-600">Keine Einträge</div>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}

function CalendarIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3M4 11h16M4 19h16M5 7h14M5 15h14" />
    </svg>
  );
}
function AlertIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.34 3.94a2 2 0 0 1 3.32 0l7.1 11.33A2 2 0 0 1 19.1 19H4.9a2 2 0 0 1-1.66-3.73z" />
    </svg>
  );
}
function ClockIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}
function SparkIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1.5m0 15V21m9-9h-1.5m-15 0H3m15.364 6.364l-1.06-1.06M6.696 6.696l-1.06-1.06m12.728 0l-1.06 1.06M6.696 17.304l-1.06 1.06" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

function UmbrellaIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className={className || "h-4 w-4"} fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m0-1a2 2 0 002 2 2 2 0 002-2M6.5 7C8 4.5 10 3 12 3s4 1.5 5.5 4M3 12h18a9 9 0 00-18 0z" />
    </svg>
  );
}

function CalendarStarIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className={className || "h-4 w-4"} fill="none" stroke="currentColor" strokeWidth={2}>
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l1.5 3 3 .5-2.5 2 .5 3-2.5-1.5-2.5 1.5.5-3-2.5-2 3-.5z" fill="currentColor" />
    </svg>
  );
}

function XCircleIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="12" r="10" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 9l-6 6m0-6l6 6" />
    </svg>
  );
}

function ClockAlertIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="12" r="10" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 7v5l3 3" />
    </svg>
  );
}

function StarIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className={className} fill="currentColor" stroke="none">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.27 5.82 22 7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  );
}

