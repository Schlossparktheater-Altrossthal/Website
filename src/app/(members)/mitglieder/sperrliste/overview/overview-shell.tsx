'use client';
import { ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';

import { Button } from '@/components/ui/button';
import type { HolidayRange } from '@/types/holidays';

import type { BlockedDay } from '../block-calendar';
import {
  type BlockOverviewSummary,
  type HolidaySegment,
  type PreparedMember,
  type VisibleDayInfo,
} from './useBlockOverviewData';
import { DesktopTimeline } from './desktop-timeline';
import { MobileTimeline } from './mobile-timeline';
import {
  timelineLegendItems,
  timelineToneStyles,
  type TimelineTone,
} from './timeline-legend';

type LegendItemProps = {
  label: string;
  description: string;
  tone: TimelineTone;
};

type OverviewShellProps = {
  currentMonth: Date;
  monthLabel: string;
  membersCount: number;
  totalBlockedDays: number;
  upcomingBlockedDays: number;
  holidaysInRangeCount: number;
  busiestMember: { name: string; total: number } | null;
  preferredDescription: string;
  exceptionDescription: string;
  preparedMembers: PreparedMember[];
  visibleDayInfo: VisibleDayInfo[];
  holidaySegments: HolidaySegment[];
  preferredWeekdaySet: Set<number>;
  exceptionWeekdaySet: Set<number>;
  sortedPreferredWeekdays: number[];
  preferredDayKeys: Set<string>;
  holidayMap: Map<string, HolidayRange[]>;
  summary: BlockOverviewSummary;
  onPrev: () => void;
  onNext: () => void;
  onReset: () => void;
  onSelectBlockedDay: (selection: {
    member: PreparedMember;
    entry: BlockedDay;
    date: Date;
    holidayEntries: HolidayRange[];
  }) => void;
  formatCreatedAtLabel: (createdAt?: string | null) => string | null;
};

function LegendItem({ label, description, tone }: LegendItemProps) {
  const styles = timelineToneStyles({ tone });

  return (
    <div className={styles.legendContainer()}>
      <span aria-hidden className={styles.legendSwatch()} />
      <div className="flex flex-col">
        <span className={styles.legendLabel()}>{label}</span>
        <span className={styles.legendDescription()}>{description}</span>
      </div>
    </div>
  );
}

export function OverviewShell({
  currentMonth,
  monthLabel,
  membersCount,
  totalBlockedDays,
  upcomingBlockedDays,
  holidaysInRangeCount,
  busiestMember,
  preferredDescription,
  exceptionDescription,
  preparedMembers,
  visibleDayInfo,
  holidaySegments,
  preferredWeekdaySet,
  exceptionWeekdaySet,
  sortedPreferredWeekdays,
  preferredDayKeys,
  holidayMap,
  summary,
  onPrev,
  onNext,
  onReset,
  onSelectBlockedDay,
  formatCreatedAtLabel,
}: OverviewShellProps) {
  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 p-6 text-slate-100 shadow-xl dark:border-primary/30">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.4em] text-primary/80">
              <Sparkles className="h-4 w-4" aria-hidden />
              Übersicht
            </div>
            <h2 className="mt-2 text-2xl font-semibold leading-tight sm:text-3xl">{monthLabel}</h2>
            <p className="mt-2 max-w-xl text-sm text-slate-300">
              Alle Sperrtermine des Teams in einer kompakten Zeitachse – ideal, um Engpässe früh zu erkennen.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:items-end">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-10 w-10 rounded-full border-slate-600/50 bg-slate-900/60 text-slate-100 hover:border-primary/60 hover:text-primary"
                onClick={onPrev}
                aria-label="Vorheriger Monat"
              >
                <ChevronLeft className="h-5 w-5" aria-hidden />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-10 w-10 rounded-full border-slate-600/50 bg-slate-900/60 text-slate-100 hover:border-primary/60 hover:text-primary"
                onClick={onNext}
                aria-label="Nächster Monat"
              >
                <ChevronRight className="h-5 w-5" aria-hidden />
              </Button>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="rounded-full bg-white/10 text-xs font-medium text-slate-200 hover:bg-white/20"
              onClick={onReset}
            >
              Heute
            </Button>
          </div>
        </div>

        <div className="mt-5 grid gap-2 text-[13px] leading-5 sm:grid-cols-3">
          <div className="rounded-xl border border-white/10 bg-white/5 p-3 shadow-inner">
            <div className="text-[10px] font-semibold uppercase tracking-[0.3em] text-slate-300/80">Teammitglieder</div>
            <div className="mt-1 text-lg font-semibold sm:text-xl">{membersCount}</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-3 shadow-inner">
            <div className="text-[10px] font-semibold uppercase tracking-[0.3em] text-slate-300/80">Gesperrte Tage</div>
            <div className="mt-1 flex flex-col gap-1 text-lg font-semibold sm:text-xl">
              <span>{totalBlockedDays}</span>
              <span className="text-[11px] font-medium text-slate-300/80 line-clamp-1">
                {upcomingBlockedDays} bevorstehend
              </span>
            </div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-3 shadow-inner">
            <div className="text-[10px] font-semibold uppercase tracking-[0.3em] text-slate-300/80">Ferien &amp; Feiertage in der Ansicht</div>
            <div className="mt-1 flex flex-col gap-1 text-lg font-semibold sm:text-xl">
              <span>{holidaysInRangeCount}</span>
              <span className="text-[11px] font-medium text-slate-300/80 line-clamp-2">
                {busiestMember ? `Top-Sperren: ${busiestMember.name} (${busiestMember.total})` : 'Keine Häufungen'}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border/60 bg-background/80 p-4 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <p className="text-sm text-muted-foreground lg:max-w-xl">
            Klicke oder tippe auf rot markierte Sperrtage, um Hintergründe sowie Ferien- und Feiertagsinfos zu lesen. Gesperrte Tage erscheinen kompakt in Rot, eingeschränkte Slots schimmern in bernsteinfarbenen Tönen, bevorzugte Slots erscheinen in frischem Grün, freie bleiben dezent – so erkennst du Engpässe auf einen Blick. {preferredDescription} {exceptionDescription} Weitere Tage blenden wir nur ein, wenn Mitglieder sie ausdrücklich als bevorzugt markieren.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            {timelineLegendItems.map((item) => (
              <LegendItem key={item.id} {...item} />
            ))}
          </div>
        </div>
      </div>

      <div className="hidden sm:block">
        <DesktopTimeline
          currentMonth={currentMonth}
          preparedMembers={preparedMembers}
          visibleDayInfo={visibleDayInfo}
          holidaySegments={holidaySegments}
          summary={summary}
          preferredWeekdaySet={preferredWeekdaySet}
          exceptionWeekdaySet={exceptionWeekdaySet}
          sortedPreferredWeekdays={sortedPreferredWeekdays}
          preferredDayKeys={preferredDayKeys}
          holidayMap={holidayMap}
          onSelectBlockedDay={onSelectBlockedDay}
          formatCreatedAtLabel={formatCreatedAtLabel}
        />
      </div>

      <MobileTimeline
        preparedMembers={preparedMembers}
        visibleDayInfo={visibleDayInfo}
        holidayMap={holidayMap}
        summary={summary}
        onSelectBlockedDay={onSelectBlockedDay}
        formatCreatedAtLabel={formatCreatedAtLabel}
      />
    </div>
  );
}

