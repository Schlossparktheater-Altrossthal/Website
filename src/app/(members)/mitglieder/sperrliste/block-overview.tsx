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

type PdfMemberZone = "acting" | "crew" | "both" | "unknown";

function toPdfZone(focus: PreparedMember["onboardingFocus"]): PdfMemberZone {
  switch (focus) {
    case "acting":
      return "acting";
    case "both":
      return "both";
    case "tech":
      return "crew";
    default:
      return "unknown";
  }
}

export type { OverviewMember } from './overview/useBlockOverviewData';

function normaliseReason(value: string | null | undefined) {
  if (!value) {
    return '';
  }
  return value.replace(/\s+/g, ' ').trim();
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
  const [isExportingPdf, setIsExportingPdf] = useState(false);

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

    return data.preparedMembers.map((member) => ({
      member,
      entries: exportWindow.days.map((day) => {
        const entry = member.blockedMap.get(day.key);
        if (!entry) {
          return null;
        }
        if (entry.kind === 'BLOCKED' || entry.kind === 'LIMITED' || entry.kind === 'PREFERRED') {
          return entry;
        }
        return null;
      }),
    }));
  }, [data.preparedMembers, exportWindow]);

  const membersWithEntries = useMemo(
    () => exportRows.filter((row) => row.entries.some((entry) => entry !== null)).length,
    [exportRows],
  );

  const membersWithAvailability = useMemo(
    () =>
      exportRows.filter((row) =>
        row.entries.some((entry) => {
          if (!entry) {
            return true;
          }
          return entry.kind === 'LIMITED' || entry.kind === 'PREFERRED';
        }),
      ).length,
    [exportRows],
  );

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

  const extractFilenameFromDisposition = (disposition: string | null) => {
    if (!disposition) return null;
    const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
    if (utf8Match?.[1]) {
      try {
        return decodeURIComponent(utf8Match[1]);
      } catch {
        return utf8Match[1];
      }
    }
    const quotedMatch = disposition.match(/filename="([^"\\]*(?:\\.[^"\\]*)*)"/i);
    if (quotedMatch?.[1]) {
      return quotedMatch[1].replace(/\\"/g, "").replace(/\\/g, "").trim();
    }
    const simpleMatch = disposition.match(/filename=([^;]+)/i);
    if (simpleMatch?.[1]) {
      return simpleMatch[1].replace(/"/g, "").trim();
    }
    return null;
  };

  const handleExportPdf = async () => {
    if (!exportWindow || exportRows.length === 0) {
      toast.warning('Keine Sperrtermine auf wichtigen Tagen im ausgewählten Zeitraum gefunden.');
      return;
    }

    setIsExportingPdf(true);
    try {
      const pdfPayload = {
        generatedAt: new Date().toISOString(),
        range: {
          start: exportWindow.start.toISOString(),
          end: exportWindow.end.toISOString(),
          label: exportRangeLabel,
        },
        summary: {
          memberCount: membersWithAvailability,
          importantWeekdays: importantWeekdaySummary,
        },
        days: exportWindow.days.map((day) => ({
          key: day.key,
          label: day.header,
          title: day.title,
        })),
        members: exportRows.map(({ member, entries }) => ({
          zone: toPdfZone(member.onboardingFocus),
          name: member.displayName,
          email: member.email ?? null,
          entries: exportWindow.days.map((day, index) => {
            const entry = entries[index];
            if (!entry) {
              return { dayKey: day.key, status: 'none', value: null };
            }
            const reason = normaliseReason(entry.reason);
            const status =
              entry.kind === 'BLOCKED'
                ? 'blocked'
                : entry.kind === 'LIMITED'
                  ? 'limited'
                  : entry.kind === 'PREFERRED'
                    ? 'preferred'
                    : 'none';
            if (status === 'none') {
              return { dayKey: day.key, status: 'none', value: reason || null };
            }
            const fallbackLabels: Record<'blocked' | 'limited' | 'preferred', string> = {
              blocked: 'gesperrt',
              limited: 'eingeschränkt',
              preferred: 'bevorzugt',
            };
            return {
              dayKey: day.key,
              status,
              value: reason || fallbackLabels[status],
            };
          }),
        })),
      };

      const response = await fetch('/api/pdfs/sperrliste-wichtige-tage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pdfPayload),
      });

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => null);
        throw new Error(errorPayload?.error ?? 'PDF konnte nicht erstellt werden.');
      }

      const blob = await response.blob();
      const disposition = response.headers.get('content-disposition');
      const filenameFromHeader = extractFilenameFromDisposition(disposition);
      let filename =
        filenameFromHeader?.trim() ||
        `sperrliste-wichtige-tage-${format(exportWindow.start, 'yyyyMMdd')}-${format(exportWindow.end, 'yyyyMMdd')}.pdf`;
      filename = filename.replace(/[\\/]/g, '_').replace(/[\r\n]/g, '').trim();
      if (!filename.toLowerCase().endsWith('.pdf')) {
        filename = `${filename}.pdf`;
      }

      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      link.rel = 'noopener';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(downloadUrl);
      toast.success('PDF wurde heruntergeladen.');
    } catch (error) {
      console.error(error);
      const message = error instanceof Error ? error.message : 'PDF konnte nicht erstellt werden.';
      toast.error(message);
    } finally {
      setIsExportingPdf(false);
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
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1 text-sm text-muted-foreground">
              {exportWindow ? (
                <>
                  <p>
                    Zeitraum: {exportRangeLabel ?? '–'}. Berücksichtigte Tage:{' '}
                    {importantWeekdaySummary ?? '–'}.
                  </p>
                  {membersWithEntries === 0 ? (
                    <p>Aktuell liegen keine Sperrtermine auf diesen Tagen in den nächsten zwei Wochen vor.</p>
                  ) : (
                    <p>
                      Mitglieder mit Sperrterminen: {membersWithEntries}{' '}
                      {membersWithEntries === 1 ? 'Person' : 'Personen'}.
                    </p>
                  )}
                </>
              ) : (
                <p>
                  Lege wichtige Probentage in den Sperrlisten-Einstellungen fest, um einen Export zu ermöglichen.
                </p>
              )}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                onClick={handleExportPdf}
                disabled={exportDisabled || isExportingPdf}
                aria-busy={isExportingPdf}
                className="sm:w-auto"
              >
                PDF exportieren
              </Button>
            </div>
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

