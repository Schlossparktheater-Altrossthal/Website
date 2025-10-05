'use client';

import { format, isToday } from 'date-fns';
import { de } from 'date-fns/locale/de';
import {
  ArrowRightLeft,
  ChevronLeft,
  ChevronRight,
  Info,
} from 'lucide-react';
import * as React from 'react';

import { UserAvatar } from '@/components/user-avatar';
import { Badge } from '@/components/ui/badge';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { HolidayRange } from '@/types/holidays';

import type { BlockedDay } from '../block-calendar';
import {
  timelineStatusStyles,
  type TimelineStatus,
} from './desktop-timeline';
import {
  timelineToneStyles,
  type TimelineTone,
} from './timeline-legend';
import type {
  BlockOverviewSummary,
  DaySummary,
  PreparedMember,
  VisibleDayInfo,
} from './useBlockOverviewData';

type ReasonPreviewProps = {
  reason: string;
  label: string;
  tone: TimelineTone;
};

function ReasonPreview({ reason, label, tone }: ReasonPreviewProps) {
  const [open, setOpen] = React.useState(false);
  const toneClasses = timelineToneStyles({ tone });

  const handleOpen = React.useCallback(
    (event: React.MouseEvent | React.KeyboardEvent) => {
      event.stopPropagation();
      if ('key' in event) {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
        } else {
          return;
        }
      }
      setOpen(true);
    },
    [],
  );

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            role="button"
            tabIndex={0}
            onClick={handleOpen}
            onKeyDown={handleOpen}
              className={cn(
                'group flex w-full cursor-pointer items-start gap-2 rounded-md px-1 py-0.5 text-left text-[11px] leading-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                toneClasses.text(),
              )}
            >
              <span
                aria-hidden
                className={cn(
                  'mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full transition-colors',
                  toneClasses.bullet(),
                )}
              />
              <span className="line-clamp-2 flex-1 text-[11px] leading-4">
                {reason}
              </span>
            <Info
              aria-hidden
              className={cn(
                'mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground/70 transition-colors group-hover:text-foreground',
                toneClasses.text(),
              )}
            />
          </span>
        </TooltipTrigger>
        <TooltipContent side="bottom" align="start" className="max-w-xs text-sm leading-5">
          {reason}
        </TooltipContent>
      </Tooltip>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="max-h-[80vh] overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>{label}</SheetTitle>
            <SheetDescription>Vollständige Begründung</SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            <p className="text-sm leading-6 text-muted-foreground">{reason}</p>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

type MobileTimelineProps = {
  preparedMembers: PreparedMember[];
  visibleDayInfo: VisibleDayInfo[];
  holidayMap: Map<string, HolidayRange[]>;
  summary: BlockOverviewSummary;
  daySummaries: Map<string, DaySummary>;
  onSelectBlockedDay: (selection: {
    member: PreparedMember;
    entry: BlockedDay;
    date: Date;
    holidayEntries: HolidayRange[];
  }) => void;
  formatCreatedAtLabel: (createdAt?: string | null) => string | null;
};

export function MobileTimeline({
  preparedMembers,
  visibleDayInfo,
  holidayMap,
  summary,
  daySummaries,
  onSelectBlockedDay,
  formatCreatedAtLabel,
}: MobileTimelineProps) {
  const showPaginationDots =
    visibleDayInfo.length > 1 && visibleDayInfo.length <= 14;

  return (
    <TooltipProvider delayDuration={200} disableHoverableContent>
      <div className="space-y-3 sm:hidden">
        {preparedMembers.map((member) => {
          const stats = summary.totals.get(member.id);

          return (
            <section
              key={member.id}
              className="rounded-2xl border border-border/60 bg-background/95 p-4 shadow-sm"
            >
              <div className="flex items-start gap-3">
                <UserAvatar
                  userId={member.id}
                  email={member.email ?? undefined}
                  firstName={member.firstName ?? undefined}
                  lastName={member.lastName ?? undefined}
                  name={member.displayName}
                  avatarSource={member.avatarSource ?? undefined}
                  avatarUpdatedAt={member.avatarUpdatedAt ?? undefined}
                  size={40}
                  className="h-10 w-10"
                />
                <div className="flex-1">
                  <div className="text-sm font-semibold">{member.displayName}</div>
                  <div className="text-xs text-muted-foreground">
                    {stats?.total
                      ? `${stats.total} Sperrtermin${stats.total === 1 ? '' : 'e'}`
                      : 'Keine Sperrtermine'}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    <Badge
                      variant={stats?.total ? 'destructive' : 'muted'}
                      size="sm"
                      className="uppercase tracking-[0.16em]"
                    >
                      {stats?.total ?? 0} gesamt
                    </Badge>
                    <Badge
                      variant={stats?.upcoming ? 'info' : 'muted'}
                      size="sm"
                      className="uppercase tracking-[0.16em]"
                    >
                      {stats?.upcoming ? `${stats.upcoming} bevorstehend` : 'Keine neuen'}
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="relative mt-3">
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-y-3 left-0 flex w-8 items-center justify-start bg-gradient-to-r from-[hsl(var(--background))] via-[hsl(var(--background))] to-transparent"
                >
                  <ChevronLeft className="h-4 w-4 text-muted-foreground/70" />
                </div>
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-y-3 right-0 flex w-8 items-center justify-end bg-gradient-to-l from-[hsl(var(--background))] via-[hsl(var(--background))] to-transparent"
                >
                  <ChevronRight className="h-4 w-4 text-muted-foreground/70" />
                </div>
                <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 pl-1 pr-6 [scrollbar-width:thin]">
                  {visibleDayInfo.map((info) => {
                    const { day, key, isWeekend, isCurrentMonth, weekday } = info;
                    const entry = member.blockedMap.get(key);
                    const holidayEntries = holidayMap.get(key) ?? [];
                    const isHoliday = holidayEntries.length > 0;
                    const isBlocked = entry?.kind === 'BLOCKED';
                    const isLimited = entry?.kind === 'LIMITED';
                    const isPreferred = entry?.kind === 'PREFERRED';
                    const trimmedReason = entry?.reason?.trim();
                    const hasReason = Boolean(trimmedReason);
                    const createdAtLabel = formatCreatedAtLabel(entry?.createdAt);
                    const columnSummary = daySummaries.get(key);
                    const summaryBadges: React.ReactNode[] = [];

                    const holidaySummary = holidayEntries
                      .map((holiday) =>
                        `${holiday.category === 'publicHoliday' ? 'Feiertag' : 'Ferien'}: ${holiday.title}`,
                      )
                      .join(', ');

                    const label = [
                      format(day, 'EEEE, d. MMMM yyyy', { locale: de }),
                      entry
                        ? isPreferred
                          ? trimmedReason ?? 'bevorzugt'
                          : isLimited
                            ? trimmedReason ?? 'eingeschränkt'
                            : trimmedReason ?? 'gesperrt'
                        : isHoliday
                          ? holidaySummary || 'Ferien & Feiertage'
                          : 'frei',
                    ];

                    if (createdAtLabel) {
                      label.push(`Eingetragen am ${createdAtLabel}`);
                    }

                    const baseId = `${member.id}-${key}-mobile`;
                    const createdAtId = createdAtLabel
                      ? `${baseId}-created`
                      : undefined;
                    const describedBy = createdAtId ?? undefined;

                    let status: TimelineStatus = 'freeMuted';
                    if (isBlocked) {
                      status = 'blocked';
                    } else if (isLimited) {
                      status = 'limited';
                    } else if (isPreferred) {
                      status = 'preferred';
                    } else if (isHoliday) {
                      status = 'holiday';
                    }

                    const isInteractive = Boolean(entry && isBlocked);
                    const cardClasses = cn(
                      'grid h-40 min-w-[9.5rem] shrink-0 grid-rows-[auto,1fr,auto] rounded-2xl border border-transparent px-2 py-2 text-center text-xs leading-5 shadow-sm transition-colors',
                      timelineStatusStyles({ status }),
                      isInteractive &&
                        'cursor-pointer transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                      isToday(day) && 'ring-2 ring-primary/70',
                      isWeekend && !isInteractive && !isLimited && !isPreferred && !isHoliday && 'bg-muted/40',
                      !isCurrentMonth && 'opacity-80',
                    );

                    if (columnSummary?.blocked) {
                      summaryBadges.push(
                        <Badge key="blocked" variant="destructive" size="sm" className="uppercase">
                          {columnSummary.blocked} gesperrt
                        </Badge>,
                      );
                    }

                    if (columnSummary?.limited) {
                      summaryBadges.push(
                        <Badge key="limited" variant="warning" size="sm" className="uppercase">
                          {columnSummary.limited} eingeschränkt
                        </Badge>,
                      );
                    }

                    if (columnSummary?.preferred) {
                      summaryBadges.push(
                        <Badge key="preferred" variant="success" size="sm" className="uppercase">
                          {columnSummary.preferred} bevorzugt
                        </Badge>,
                      );
                    }

                    if (columnSummary?.holidayCount) {
                      summaryBadges.push(
                        <Badge key="holiday" variant="info" size="sm" className="uppercase">
                          {columnSummary.holidayCount} Ferien
                        </Badge>,
                      );
                    }

                    const handleSelect = () => {
                      if (isInteractive && entry) {
                        onSelectBlockedDay({
                          member,
                          entry,
                          date: day,
                          holidayEntries,
                        });
                      }
                    };

                    const handleKeyDown = (
                      event: React.KeyboardEvent<HTMLDivElement>,
                    ) => {
                      if (!isInteractive) {
                        return;
                      }
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        handleSelect();
                      }
                    };

                    return (
                      <div key={key} className="min-w-[9.5rem] shrink-0 snap-center">
                        <div
                          className={cardClasses}
                          role={isInteractive ? 'button' : undefined}
                          tabIndex={isInteractive ? 0 : undefined}
                          aria-label={label.join('. ')}
                          aria-describedby={describedBy}
                          onClick={handleSelect}
                          onKeyDown={handleKeyDown}
                        >
                          <div className="flex flex-col items-center gap-1">
                            <div className="flex flex-col items-center gap-0.5">
                              {weekday === 1 ? (
                                <span className="rounded-full bg-muted/70 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/80">
                                  KW {format(day, 'I', { locale: de })}
                                </span>
                              ) : null}
                              <span className="text-xs uppercase tracking-wide text-muted-foreground/80">
                                {format(day, 'EE', { locale: de })}
                              </span>
                              <span className="text-sm font-semibold">
                                {format(day, 'd', { locale: de })}
                              </span>
                            </div>
                            {summaryBadges.length ? (
                              <div className="flex flex-wrap justify-center gap-1">
                                {summaryBadges}
                              </div>
                            ) : (
                              <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground/60">
                                Frei
                              </span>
                            )}
                          </div>
                          <div className="flex flex-1 flex-col items-center justify-center">
                            {isInteractive && hasReason && trimmedReason ? (
                              <ReasonPreview
                                reason={trimmedReason}
                                label={format(day, "d. MMMM yyyy", { locale: de })}
                                tone="blocked"
                              />
                            ) : isLimited && trimmedReason ? (
                              <ReasonPreview
                                reason={trimmedReason}
                                label={format(day, "d. MMMM yyyy", { locale: de })}
                                tone="limited"
                              />
                            ) : isPreferred && trimmedReason ? (
                              <ReasonPreview
                                reason={trimmedReason}
                                label={format(day, "d. MMMM yyyy", { locale: de })}
                                tone="preferred"
                              />
                            ) : isHoliday ? (
                              <div className="flex flex-col gap-1 px-1 text-[11px] leading-4">
                                <span className="line-clamp-2 text-foreground">
                                  {holidayEntries.map((h) => h.title).join(', ')}
                                </span>
                              </div>
                            ) : entry ? (
                              <div className="px-1 text-[11px] leading-4 text-muted-foreground">
                                {isPreferred
                                  ? 'Ohne Angabe'
                                  : isLimited
                                    ? 'Eingeschränkt'
                                    : 'Ohne Details'}
                              </div>
                            ) : (
                              <div className="text-[11px] leading-4 text-muted-foreground">
                                frei
                              </div>
                            )}
                          </div>
                          <div className="flex items-center justify-center gap-1 text-[10px] text-muted-foreground/80">
                            {isInteractive ? (
                              <span>Details öffnen</span>
                            ) : createdAtLabel ? (
                              <span id={createdAtId}>Eingetragen am {createdAtLabel}</span>
                            ) : isHoliday ? (
                              <span>Automatisch hinzugefügt</span>
                            ) : (
                              <span>&nbsp;</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {showPaginationDots ? (
                  <div className="mt-2 flex items-center justify-center gap-1">
                    {visibleDayInfo.map(({ day, key }) => (
                      <span
                        key={`${member.id}-${key}-dot`}
                        className={cn(
                          'h-1.5 w-1.5 rounded-full bg-muted',
                          isToday(day) && 'bg-primary',
                        )}
                        aria-hidden
                      />
                    ))}
                  </div>
                ) : null}
                <div className="mt-2 flex items-center justify-center gap-2 text-xs leading-5 text-muted-foreground/90">
                  <ArrowRightLeft className="h-4 w-4" aria-hidden />
                  <span>Wische für weitere Tage</span>
                </div>
              </div>
            </section>
          );
        })}
      </div>
    </TooltipProvider>
  );
}
