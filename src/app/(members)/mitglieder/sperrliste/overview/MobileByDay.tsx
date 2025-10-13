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
            className="rounded-2xl border border-border/60 bg-card shadow-sm overflow-hidden" 
            role="region" 
            aria-labelledby={regionId} 
            id={regionId}
          >
            <header className="sticky top-0 z-10 bg-card backdrop-blur-md border-b border-border/40 shadow-sm">
              <div className="flex items-center justify-between px-3 py-2">
                <div className="flex items-baseline gap-2">
                  <h3 id={regionId} className="text-sm font-semibold">
                    {bucket.column.label} <span className="text-muted-foreground">{label}</span>
                  </h3>
                  {bucket.holidayType === 'holiday' && (
                    <span className="flex items-center gap-1 rounded-full border border-warning bg-warning/90 px-2 py-0.5 text-[11px] font-semibold text-warning-foreground">
                      <CalendarStarIcon className="h-3 w-3" />
                      {bucket.holidayLabel || 'Feiertag'}
                    </span>
                  )}
                  {bucket.holidayType === 'vacation' && (
                    <span className="flex items-center gap-1 rounded-full border border-primary bg-primary/90 px-2 py-0.5 text-[11px] font-semibold text-primary-foreground">
                      <UmbrellaIcon className="h-3 w-3" />
                      {bucket.holidayLabel || 'Ferien'}
                      {bucket.isPublicHoliday && <CalendarStarIcon className="h-3 w-3" />}
                    </span>
                  )}
                </div>
                <small className="text-[11px] text-muted-foreground">
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
                              <div className="h-0.5 w-1 rounded-full bg-gradient-to-b from-primary to-primary" />
                              <span className="text-[10px] font-semibold uppercase tracking-wider text-foreground">Schauspieler</span>
                            </div>
                            <ul className="divide-y divide-border/30 rounded-lg border border-success/40 bg-[color:var(--spl-ok-bg)]">
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
                              <div className="h-0.5 w-1 rounded-full bg-gradient-to-b from-accent to-accent" />
                              <span className="text-[10px] font-semibold uppercase tracking-wider text-accent-foreground">Beides</span>
                            </div>
                            <ul className="divide-y divide-border/30 rounded-lg border border-success/40 bg-[color:var(--spl-ok-bg)]">
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
                              <div className="h-0.5 w-1 rounded-full bg-gradient-to-b from-success to-success" />
                              <span className="text-[10px] font-semibold uppercase tracking-wider text-success-foreground">Gewerke</span>
                            </div>
                            <ul className="divide-y divide-border/40 rounded-lg border border-success/40 bg-[color:var(--spl-ok-bg)]">
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
                                color === 'blue' ? 'from-primary to-primary' :
                                color === 'purple' ? 'from-accent to-accent' :
                                'from-success to-success'
                              }`} />
                              <span className={`text-[10px] font-semibold uppercase tracking-wider ${
                                color === 'blue' ? 'text-foreground' :
                                color === 'purple' ? 'text-accent-foreground' :
                                'text-success-foreground'
                              }`}>{label}</span>
                            </div>
                            <ul className="divide-y divide-warning/20 rounded-lg border border-warning/40 bg-[color:var(--spl-warn-bg)]">
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
                                color === 'blue' ? 'from-primary to-primary' :
                                color === 'purple' ? 'from-accent to-accent' :
                                'from-success to-success'
                              }`} />
                              <span className={`text-[10px] font-semibold uppercase tracking-wider ${
                                color === 'blue' ? 'text-foreground' :
                                color === 'purple' ? 'text-accent-foreground' :
                                'text-success-foreground'
                              }`}>{label}</span>
                            </div>
                            <ul className="divide-y divide-destructive/20 rounded-lg border border-destructive/40 bg-[color:var(--spl-danger-bg)]">
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
                    <ul className="divide-y divide-border/30 rounded-lg border border-success/40 bg-[color:var(--spl-ok-bg)]">
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
                    <ul className="mt-2 divide-y divide-warning/20 rounded-lg border border-warning/40 bg-[color:var(--spl-warn-bg)]">
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
                    <ul className="mt-2 divide-y divide-destructive/20 rounded-lg border border-destructive/40 bg-[color:var(--spl-danger-bg)]">
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
                <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-[13px] text-muted-foreground">
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

  const groupColors = groupColor ? {
    blue: 'bg-primary/20 text-foreground',
    green: 'bg-success/20 text-success-foreground',
    purple: 'bg-accent/20 text-accent-foreground',
  }[groupColor] : 'bg-card/80 text-primary';

  const statusLabel = 
    cell.type === 'preferred' ? 'Bevorzugt' :
    cell.type === 'free' ? 'Frei' :
    cell.type === 'limited' ? 'Eingeschränkt' :
    'Gesperrt';

  const statusIcon = 
    cell.type === 'preferred' ? '★' :
    cell.type === 'free' ? '✓' :
    cell.type === 'limited' ? '⏰' :
    '✕';

  const statusBadgeColor = 
    tone === 'ok' ? 'bg-success/90 text-success-foreground border-success' :
    tone === 'warn' ? 'bg-warning/90 text-warning-foreground border-warning' :
    'bg-destructive/90 text-destructive-foreground border-destructive';

  return (
    <li className="flex items-center justify-between gap-3 px-3 py-2.5">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <span className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${groupColors} text-xs font-semibold`}>
          {initials}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-foreground truncate">
            {person.name}
          </p>
          {cell.label && <p className="text-[11px] text-muted-foreground truncate">{cell.label}</p>}
        </div>
      </div>
      <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap ${statusBadgeColor}`}>
        <span aria-hidden="true">{statusIcon}</span>
        {statusLabel}
      </span>
    </li>
  );
}
