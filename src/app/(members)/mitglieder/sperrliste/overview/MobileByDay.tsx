import React, { useMemo } from "react";

import { CalendarStarIcon, UmbrellaIcon } from "./icons";
import { selectDayBuckets, type DayBucket } from "./data-helpers";
import type {
  DayColumn,
  HolidayIndicator,
  OverviewPerson,
} from "./types";

type MobileByDayProps = {
  people: OverviewPerson[];
  dayCols: DayColumn[];
  holidays: HolidayIndicator[];
  groupedPeople?: { actors: OverviewPerson[]; crew: OverviewPerson[]; both: OverviewPerson[] } | null;
};

export function MobileByDay({ people, dayCols, holidays, groupedPeople = null }: MobileByDayProps) {
  const dtf = useMemo(() => new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit" }), []);
  const dayList = useMemo(() => selectDayBuckets(people, dayCols, holidays), [people, dayCols, holidays]);

  // Gruppierung nur wenn groupedPeople vorhanden
  const showGrouping = groupedPeople !== null;

  return (
    <div className="space-y-3 sm:hidden">
      {dayList.map((bucket: DayBucket) => {
        const regionId = `day-${bucket.column.n}`;
        // TODO: Dynamisches Jahr/Monat aus dayCols ableiten
        const dateObj = new Date(2025, 4, bucket.column.n);
        const label = dtf.format(dateObj);
        
        return (
          <article 
            key={bucket.column.key} 
            className="rounded-2xl border border-slate-200/70 bg-white shadow-sm" 
            role="region" 
            aria-labelledby={regionId} 
            id={regionId}
          >
            <header className="sticky top-0 z-10 bg-white/90 backdrop-blur supports-[backdrop-filter]:backdrop-blur-sm border-b border-slate-100">
              <div className="flex items-center justify-between px-3 py-2">
                <div className="flex items-baseline gap-2">
                  <h3 id={regionId} className="text-sm font-semibold">
                    {bucket.column.label} <span className="text-slate-500">{label}</span>
                  </h3>
                  {bucket.holidayType === 'holiday' && (
                    <span className="flex items-center gap-1 rounded-full border border-amber-200 bg-amber-500 px-2 py-0.5 text-[11px] font-semibold text-white">
                      <CalendarStarIcon className="h-3 w-3" />
                      {bucket.holidayLabel || 'Feiertag'}
                    </span>
                  )}
                  {bucket.holidayType === 'vacation' && (
                    <span className="flex items-center gap-1 rounded-full border border-sky-200 bg-sky-500 px-2 py-0.5 text-[11px] font-semibold text-white">
                      <UmbrellaIcon className="h-3 w-3" />
                      {bucket.holidayLabel || 'Ferien'}
                      {bucket.isPublicHoliday && <CalendarStarIcon className="h-3 w-3" />}
                    </span>
                  )}
                </div>
                <small className="text-[11px] text-slate-500">
                  {bucket.available.length} können · {bucket.limited.length} eingeschränkt · {bucket.blocked.length} gesperrt
                </small>
              </div>
            </header>

            <div className="p-2 pt-2 space-y-2">
              {/* Gruppierte Darstellung */}
              {showGrouping ? (
                <>
                  {/* Verfügbar - nach Gruppen */}
                  {bucket.available.length > 0 && (
                    <div className="space-y-2">
                      {/* Schauspieler */}
                      {(() => {
                        const actorsAvailable = bucket.available.filter(({ person }) => person.group === 'actors');
                        if (actorsAvailable.length === 0) return null;
                        return (
                          <div key="actors-available">
                            <div className="flex items-center gap-2 px-2 py-1">
                              <div className="h-0.5 w-1 rounded-full bg-gradient-to-b from-blue-400 to-blue-500" />
                              <span className="text-[10px] font-semibold uppercase tracking-wider text-blue-600">Schauspieler</span>
                            </div>
                            <ul className="divide-y divide-slate-100 rounded-lg border border-green-200/60 bg-[color:var(--spl-ok-bg)]">
                              {actorsAvailable.map(({ person, cell }, i) => (
                                <PersonListItem 
                                  key={person.id + i} 
                                  person={person} 
                                  cell={cell} 
                                  tone="ok"
                                  groupColor="blue"
                                />
                              ))}
                            </ul>
                          </div>
                        );
                      })()}
                      
                      {/* Beides */}
                      {(() => {
                        const bothAvailable = bucket.available.filter(({ person }) => person.group === 'both');
                        if (bothAvailable.length === 0) return null;
                        return (
                          <div key="both-available">
                            <div className="flex items-center gap-2 px-2 py-1">
                              <div className="h-0.5 w-1 rounded-full bg-gradient-to-b from-purple-400 to-pink-500" />
                              <span className="text-[10px] font-semibold uppercase tracking-wider text-purple-600">Beides</span>
                            </div>
                            <ul className="divide-y divide-slate-100 rounded-lg border border-green-200/60 bg-[color:var(--spl-ok-bg)]">
                              {bothAvailable.map(({ person, cell }, i) => (
                                <PersonListItem 
                                  key={person.id + i} 
                                  person={person} 
                                  cell={cell} 
                                  tone="ok"
                                  groupColor="purple"
                                />
                              ))}
                            </ul>
                          </div>
                        );
                      })()}
                      
                      {/* Gewerke */}
                      {(() => {
                        const crewAvailable = bucket.available.filter(({ person }) => person.group === 'crew');
                        if (crewAvailable.length === 0) return null;
                        return (
                          <div key="crew-available">
                            <div className="flex items-center gap-2 px-2 py-1">
                              <div className="h-0.5 w-1 rounded-full bg-gradient-to-b from-green-400 to-green-500" />
                              <span className="text-[10px] font-semibold uppercase tracking-wider text-green-600">Gewerke</span>
                            </div>
                            <ul className="divide-y divide-slate-100 rounded-lg border border-green-200/60 bg-[color:var(--spl-ok-bg)]">
                              {crewAvailable.map(({ person, cell }, i) => (
                                <PersonListItem 
                                  key={person.id + i} 
                                  person={person} 
                                  cell={cell} 
                                  tone="ok"
                                  groupColor="green"
                                />
                              ))}
                            </ul>
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {/* Eingeschränkt - nach Gruppen */}
                  {bucket.limited.length > 0 && (
                    <div className="space-y-2">
                      {[
                        { group: 'actors' as const, label: 'Schauspieler', color: 'blue' as const },
                        { group: 'both' as const, label: 'Beides', color: 'purple' as const },
                        { group: 'crew' as const, label: 'Gewerke', color: 'green' as const }
                      ].map(({ group, label, color }) => {
                        const filtered = bucket.limited.filter(({ person }) => person.group === group);
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
                            <ul className="divide-y divide-orange-100 rounded-lg border border-orange-200/70 bg-[color:var(--spl-warn-bg)]">
                              {filtered.map(({ person, cell }, i) => (
                                <PersonListItem 
                                  key={person.id + i} 
                                  person={person} 
                                  cell={cell} 
                                  tone="warn"
                                  groupColor={color}
                                />
                              ))}
                            </ul>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Gesperrt - nach Gruppen */}
                  {bucket.blocked.length > 0 && (
                    <div className="space-y-2">
                      {[
                        { group: 'actors' as const, label: 'Schauspieler', color: 'blue' as const },
                        { group: 'both' as const, label: 'Beides', color: 'purple' as const },
                        { group: 'crew' as const, label: 'Gewerke', color: 'green' as const }
                      ].map(({ group, label, color }) => {
                        const filtered = bucket.blocked.filter(({ person }) => person.group === group);
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
                            <ul className="divide-y divide-red-100 rounded-lg border border-red-200/70 bg-[color:var(--spl-danger-bg)]">
                              {filtered.map(({ person, cell }, i) => (
                                <PersonListItem 
                                  key={person.id + i} 
                                  person={person} 
                                  cell={cell} 
                                  tone="danger"
                                  groupColor={color}
                                />
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
                  {bucket.available.length > 0 && (
                    <ul className="divide-y divide-slate-100 rounded-lg border border-green-200/60 bg-[color:var(--spl-ok-bg)]">
                      {bucket.available.map(({ person, cell }, i) => (
                        <PersonListItem 
                          key={person.id + i} 
                          person={person} 
                          cell={cell} 
                          tone="ok"
                        />
                      ))}
                    </ul>
                  )}

                  {bucket.limited.length > 0 && (
                    <ul className="mt-2 divide-y divide-orange-100 rounded-lg border border-orange-200/70 bg-[color:var(--spl-warn-bg)]">
                      {bucket.limited.map(({ person, cell }, i) => (
                        <PersonListItem 
                          key={person.id + i} 
                          person={person} 
                          cell={cell} 
                          tone="warn"
                        />
                      ))}
                    </ul>
                  )}

                  {bucket.blocked.length > 0 && (
                    <ul className="mt-2 divide-y divide-red-100 rounded-lg border border-red-200/70 bg-[color:var(--spl-danger-bg)]">
                      {bucket.blocked.map(({ person, cell }, i) => (
                        <PersonListItem 
                          key={person.id + i} 
                          person={person} 
                          cell={cell} 
                          tone="danger"
                        />
                      ))}
                    </ul>
                  )}
                </>
              )}

              {bucket.available.length + bucket.limited.length + bucket.blocked.length === 0 && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[13px] text-slate-600">
                  Keine Einträge
                </div>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}

// ============================================================================
// PersonListItem Sub-Component
// ============================================================================

type PersonListItemProps = {
  person: OverviewPerson;
  cell: { type: string; label?: string | null };
  tone: 'ok' | 'warn' | 'danger';
  groupColor?: 'blue' | 'green' | 'purple';
};

function PersonListItem({ person, cell, tone, groupColor }: PersonListItemProps) {
  // Initialen generieren
  const initials = person.name
    .split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const toneColors = {
    ok: 'text-[color:var(--spl-ok)]',
    warn: 'text-[color:var(--spl-warn)]',
    danger: 'text-[color:var(--spl-danger)]',
  };

  const groupColors = groupColor ? {
    blue: 'bg-blue-500/20 text-blue-700',
    green: 'bg-green-500/20 text-green-700',
    purple: 'bg-purple-500/20 text-purple-700',
  }[groupColor] : 'bg-white/80 text-[var(--primary)]';

  const statusLabel = 
    cell.type === 'preferred' ? 'Bevorzugt' :
    cell.type === 'free' ? 'Frei' :
    cell.type === 'limited' ? 'Eingeschränkt' :
    'Sperrtermin';

  const statusColor = 
    tone === 'ok' ? 'text-green-700/80' :
    tone === 'warn' ? 'text-orange-700' :
    'text-red-700';

  return (
    <li className={`flex items-start gap-2 px-3 py-2 text-[13px] ${toneColors[tone]}`}>
      <span className={`mt-1 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${groupColors} text-xs font-semibold`}>
        {initials}
      </span>
      <div className="min-w-0">
        <p className="font-medium text-slate-800">
          {person.name} <span className={`ml-1 text-[11px] uppercase tracking-[0.16em] ${statusColor}`}>{statusLabel}</span>
        </p>
        {cell.label && <p className={`text-[12px] ${statusColor}/90`}>{cell.label}</p>}
      </div>
    </li>
  );
}
