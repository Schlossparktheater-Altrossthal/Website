'use client';

import { useMemo, useState } from 'react';
import { addDays, addMonths, eachDayOfInterval, format, startOfMonth, startOfToday } from 'date-fns';
import { de } from 'date-fns/locale/de';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { formatWeekdayList, getWeekdayLabel, sortWeekdays, type WeekdayValue } from '@/lib/weekdays';
import { toast } from 'sonner';

import type { HolidayRange } from '@/types/holidays';

import type { BlockedDay } from './block-calendar';
import { OverviewShell } from './overview/overview-shell';
import {
  DATE_FORMAT,
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

type ExportDay = {
  date: Date;
  key: string;
  header: string;
  title: string;
};

type ExportRow = {
  member: PreparedMember;
  entries: (BlockedDay | null)[];
};

export type { OverviewMember } from './overview/useBlockOverviewData';

function normaliseReason(value: string | null | undefined) {
  if (!value) {
    return '';
  }
  return value.replace(/\s+/g, ' ').trim();
}

function escapeCsvValue(value: string) {
  const needsQuotes = value.includes(';') || value.includes('"') || value.includes('\n');
  const escaped = value.replace(/"/g, '""');
  return needsQuotes ? `"${escaped}"` : escaped;
}

export function BlockOverview({
  members,
  holidays = [],
  preferredWeekdays = [],
  exceptionWeekdays = [],
  canExport = false,
}: {
  members: OverviewMember[];
  holidays?: HolidayRange[];
  preferredWeekdays?: number[];
  exceptionWeekdays?: number[];
  canExport?: boolean;
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

  const importantWeekdays = useMemo(
    () => sortWeekdays([...preferredWeekdays, ...exceptionWeekdays]),
    [preferredWeekdays, exceptionWeekdays],
  );

  const importantWeekdaySummary = useMemo(
    () => (importantWeekdays.length ? formatWeekdayList(importantWeekdays) : null),
    [importantWeekdays],
  );

  const exportWindow = useMemo(() => {
    if (!importantWeekdays.length) {
      return null;
    }
    const start = startOfToday();
    const end = addDays(start, 13);
    const weekdaySet = new Set(importantWeekdays);
    const days: ExportDay[] = eachDayOfInterval({ start, end })
      .filter((day) => weekdaySet.has(day.getDay() as WeekdayValue))
      .map((day) => {
        const weekday = day.getDay() as WeekdayValue;
        return {
          date: day,
          key: format(day, DATE_FORMAT),
          header: `${getWeekdayLabel(weekday, 'short')} ${format(day, 'dd.MM.', { locale: de })}`,
          title: format(day, 'EEEE, d. MMMM yyyy', { locale: de }),
        };
      });

    if (!days.length) {
      return null;
    }

    return { start, end, days };
  }, [importantWeekdays]);

  const exportRows = useMemo<ExportRow[]>(() => {
    if (!exportWindow) {
      return [];
    }

    return data.preparedMembers
      .map<ExportRow | null>((member) => {
        const entries = exportWindow.days.map((day) => {
          const entry = member.blockedMap.get(day.key);
          if (!entry || entry.kind !== 'BLOCKED') {
            return null;
          }
          return entry;
        });

        if (entries.every((entry) => entry === null)) {
          return null;
        }

        return { member, entries };
      })
      .filter((row): row is ExportRow => row !== null);
  }, [data.preparedMembers, exportWindow]);

  const exportRangeLabel = useMemo(() => {
    if (!exportWindow) {
      return null;
    }
    return `${format(exportWindow.start, 'dd.MM.yyyy')} – ${format(exportWindow.end, 'dd.MM.yyyy')}`;
  }, [exportWindow]);

  const exportDisabled = !exportWindow || exportRows.length === 0;

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

  const handleExportTable = () => {
    if (!exportWindow || exportRows.length === 0) {
      toast.warning('Keine Sperrtermine auf wichtigen Tagen im ausgewählten Zeitraum gefunden.');
      return;
    }

    try {
      const header = ['Mitglied', 'E-Mail', ...exportWindow.days.map((day) => day.header)];
      const csvRows = [
        header,
        ...exportRows.map(({ member, entries }) => {
          const cells = entries.map((entry) => {
            if (!entry) {
              return '';
            }
            const reason = normaliseReason(entry.reason);
            return reason || 'gesperrt';
          });
          return [member.displayName, member.email ?? '', ...cells];
        }),
      ];

      const csvContent = csvRows.map((row) => row.map((value) => escapeCsvValue(value)).join(';')).join('\n');
      const blob = new Blob([`\uFEFF${csvContent}`], {
        type: 'text/csv;charset=utf-8;',
      });
      const url = URL.createObjectURL(blob);
      const fileName = `sperrliste-wichtige-tage-${format(exportWindow.start, 'yyyyMMdd')}-${format(exportWindow.end, 'yyyyMMdd')}.csv`;
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.rel = 'noopener';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success('Export wurde gestartet.');
    } catch (error) {
      console.error(error);
      toast.error('Export konnte nicht erstellt werden.');
    }
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
      {canExport ? (
        <div className="rounded-lg border border-border/60 bg-muted/40 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1 text-sm text-muted-foreground">
              {exportWindow ? (
                <>
                  <p>
                    Zeitraum: {exportRangeLabel ?? '–'}. Berücksichtigte Tage:{' '}
                    {importantWeekdaySummary ?? '–'}.
                  </p>
                  {exportRows.length === 0 ? (
                    <p>Aktuell liegen keine Sperrtermine auf diesen Tagen in den nächsten zwei Wochen vor.</p>
                  ) : (
                    <p>
                      Mitglieder mit Sperrterminen: {exportRows.length}{' '}
                      {exportRows.length === 1 ? 'Person' : 'Personen'}.
                    </p>
                  )}
                </>
              ) : (
                <p>
                  Lege wichtige Probentage in den Sperrlisten-Einstellungen fest, um einen Export zu ermöglichen.
                </p>
              )}
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={handleExportTable}
              disabled={exportDisabled}
              className="sm:w-auto"
            >
              CSV exportieren
            </Button>
          </div>
        </div>
      ) : null}
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

