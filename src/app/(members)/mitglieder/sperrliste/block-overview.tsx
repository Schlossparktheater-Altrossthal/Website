'use client';

import { useState } from 'react';
import { addMonths, format, startOfMonth } from 'date-fns';
import { de } from 'date-fns/locale/de';

import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

import type { HolidayRange } from '@/types/holidays';

import type { BlockedDay } from './block-calendar';
import { OverviewShell } from './overview/overview-shell';
import {
  formatCreatedAtLabel,
  useBlockOverviewData,
  type OverviewMember,
  type PreparedMember,
} from './overview/useBlockOverviewData';

type SelectedBlockedDay = {
  member: PreparedMember;
  entry: BlockedDay;
  date: Date;
  holidayEntries: HolidayRange[];
};

export type { OverviewMember } from './overview/useBlockOverviewData';

export function BlockOverview({
  members,
  holidays = [],
  preferredWeekdays = [],
  exceptionWeekdays = [],
}: {
  members: OverviewMember[];
  holidays?: HolidayRange[];
  preferredWeekdays?: number[];
  exceptionWeekdays?: number[];
}) {
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(new Date()));
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedBlockedDay, setSelectedBlockedDay] = useState<SelectedBlockedDay | null>(null);

  const data = useBlockOverviewData({
    members,
    holidays,
    preferredWeekdays,
    exceptionWeekdays,
    currentMonth,
  });

  const selectedBlockedCreatedAtLabel = selectedBlockedDay
    ? formatCreatedAtLabel(selectedBlockedDay.entry.createdAt)
    : null;

  const handlePrev = () => setCurrentMonth((prev) => addMonths(prev, -1));
  const handleNext = () => setCurrentMonth((prev) => addMonths(prev, 1));
  const handleReset = () => setCurrentMonth(startOfMonth(new Date()));

  const handleSelectBlockedDay = (selection: SelectedBlockedDay) => {
    setSelectedBlockedDay(selection);
    setDetailsOpen(true);
  };

  if (!data.preparedMembers.length) {
    return (
      <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
        Keine Mitglieder gefunden.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <OverviewShell
        monthLabel={data.monthLabel}
        membersCount={data.preparedMembers.length}
        totalBlockedDays={data.summary.total}
        upcomingBlockedDays={data.summary.upcoming}
        holidaysInRangeCount={data.holidaysInRange.length}
        busiestMember={data.busiestMember}
        preferredDescription={data.preferredDescription}
        exceptionDescription={data.exceptionDescription}
        preparedMembers={data.preparedMembers}
        visibleDayInfo={data.visibleDayInfo}
        holidaySegments={data.holidaySegments}
        preferredWeekdaySet={data.preferredWeekdaySet}
        exceptionWeekdaySet={data.exceptionWeekdaySet}
        sortedPreferredWeekdays={data.sortedPreferredWeekdays}
        preferredDayKeys={data.preferredDayKeys}
        holidayMap={data.holidayMap}
        summary={data.summary}
        onPrev={handlePrev}
        onNext={handleNext}
        onReset={handleReset}
        onSelectBlockedDay={handleSelectBlockedDay}
        formatCreatedAtLabel={formatCreatedAtLabel}
      />
      <Dialog
        open={detailsOpen}
        onOpenChange={(open) => {
          setDetailsOpen(open);
          if (!open) {
            setSelectedBlockedDay(null);
          }
        }}
      >
        <DialogContent aria-describedby="blocked-day-details">
          <DialogHeader>
            <DialogTitle>
              {selectedBlockedDay
                ? format(selectedBlockedDay.date, 'EEEE, d. MMMM yyyy', { locale: de })
                : 'Sperrtermin'}
            </DialogTitle>
            {selectedBlockedDay ? (
              <DialogDescription>
                Sperrtermin von {selectedBlockedDay.member.displayName}
              </DialogDescription>
            ) : null}
          </DialogHeader>
          {selectedBlockedDay ? (
            <div className="space-y-4" id="blocked-day-details">
              <div className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Grund &amp; Zeitpunkt
                </span>
                <div className="rounded-lg border border-border/60 bg-muted/30 px-3 py-3 text-sm leading-6 text-muted-foreground/90">
                  <p>{selectedBlockedDay.entry.reason?.trim() || 'Kein Grund hinterlegt.'}</p>
                  <p className="mt-2 text-xs text-muted-foreground/80">
                    {selectedBlockedCreatedAtLabel
                      ? `Eingetragen am ${selectedBlockedCreatedAtLabel}.`
                      : 'Zeitpunkt konnte nicht ermittelt werden.'}
                  </p>
                </div>
              </div>
              {selectedBlockedDay.holidayEntries.length ? (
                <div className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Ferien &amp; Feiertage am Tag
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {selectedBlockedDay.holidayEntries.map((holiday) => (
                      <Badge
                        key={holiday.id}
                        variant={holiday.category === 'publicHoliday' ? 'warning' : 'info'}
                        className="flex items-center gap-1"
                      >
                        <span className="text-[11px] uppercase tracking-wide">
                          {holiday.category === 'publicHoliday' ? 'Feiertag' : 'Ferien'}
                        </span>
                        <span className="font-medium">{holiday.title}</span>
                      </Badge>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

