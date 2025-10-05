"use client";
import {
  differenceInCalendarDays,
  format as formatDate,
  parseISO,
  startOfToday,
} from "date-fns";
import { de } from "date-fns/locale/de";
import {
  BellRing,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Sun,
  Users,
  type LucideIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { HolidayRange } from "@/types/holidays";

import type { BlockedDay } from '../block-calendar';
import {
  type BlockOverviewSummary,
  type DaySummary,
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

type StatHighlight = {
  label: string;
  value: string;
  sublabel?: string | null;
  icon: LucideIcon;
};

type OverviewShellProps = {
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

const DATE_FORMAT = "yyyy-MM-dd";

function LegendItem({ label, description, tone }: LegendItemProps) {
  const styles = timelineToneStyles({ tone });

  return (
    <div
      className={cn(
        styles.legendContainer(),
        "w-full border-border/60 bg-background/80 text-foreground",
      )}
    >
      <span aria-hidden className={styles.legendSwatch()} />
      <div className="flex flex-col">
        <span className={styles.legendLabel()}>{label}</span>
        <span className={styles.legendDescription()}>{description}</span>
      </div>
    </div>
  );
}

export function OverviewShell({
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
  const today = startOfToday();
  const todayKey = formatDate(today, DATE_FORMAT);
  const memberSummaries = preparedMembers.map((member) => {
    const stats = summary.totals.get(member.id) ?? { total: 0, upcoming: 0 };
    const upcomingBlocked = member.blockedDays
      .filter((entry) => entry.kind === "BLOCKED" && entry.date >= todayKey)
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      member,
      stats,
      nextUpcomingDate: upcomingBlocked[0]?.date ?? null,
    };
  });

  const membersWithBlocks = memberSummaries.filter((item) => item.stats.total > 0).length;
  const membersWithUpcoming = memberSummaries.filter((item) => item.stats.upcoming > 0).length;
  const averageBlocksPerMember = membersCount > 0 ? summary.total / membersCount : 0;
  const averageUpcomingPerMember = membersCount > 0 ? summary.upcoming / membersCount : 0;
  const numberFormatter = new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });

  const formattedAverageBlocks = numberFormatter.format(averageBlocksPerMember);
  const formattedAverageUpcoming = numberFormatter.format(averageUpcomingPerMember);

  const topUpcomingMembers = memberSummaries
    .filter((item) => item.stats.upcoming > 0)
    .sort((a, b) => {
      if (b.stats.upcoming === a.stats.upcoming) {
        if (a.nextUpcomingDate && b.nextUpcomingDate) {
          return a.nextUpcomingDate.localeCompare(b.nextUpcomingDate);
        }
        if (a.nextUpcomingDate) return -1;
        if (b.nextUpcomingDate) return 1;
        return a.member.displayName.localeCompare(b.member.displayName);
      }
      return b.stats.upcoming - a.stats.upcoming;
    })
    .slice(0, 3);

  const daySummaries = new Map<string, DaySummary>();
  let busiestDay: { key: string; date: Date; blocked: number; limited: number } | null = null;

  for (const dayInfo of visibleDayInfo) {
    let blockedCount = 0;
    let limitedCount = 0;
    let preferredCount = 0;

    for (const member of preparedMembers) {
      const entry = member.blockedMap.get(dayInfo.key);
      if (!entry) continue;
      if (entry.kind === "BLOCKED") {
        blockedCount += 1;
      } else if (entry.kind === "LIMITED") {
        limitedCount += 1;
      } else if (entry.kind === "PREFERRED") {
        preferredCount += 1;
      }
    }

    const summary: DaySummary = {
      blocked: blockedCount,
      limited: limitedCount,
      preferred: preferredCount,
      holidayCount: holidayMap.get(dayInfo.key)?.length ?? 0,
    };

    daySummaries.set(dayInfo.key, summary);

    if (blockedCount === 0 && limitedCount === 0) continue;

    if (
      !busiestDay ||
      blockedCount > busiestDay.blocked ||
      (blockedCount === busiestDay.blocked && limitedCount > busiestDay.limited) ||
      (blockedCount === busiestDay.blocked &&
        limitedCount === busiestDay.limited &&
        dayInfo.key < busiestDay.key)
    ) {
      busiestDay = {
        key: dayInfo.key,
        date: dayInfo.day,
        blocked: blockedCount,
        limited: limitedCount,
      };
    }
  }

  const busiestDayLabel = busiestDay
    ? formatDate(busiestDay.date, "EEEE, d. MMMM", { locale: de })
    : null;
  const busiestDaySummary = busiestDay
    ? [
        `${busiestDay.blocked} ${busiestDay.blocked === 1 ? "Sperre" : "Sperren"}`,
        busiestDay.limited
          ? `${busiestDay.limited} Einschränkung${busiestDay.limited === 1 ? "" : "en"}`
          : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : "Keine Konflikte im Fokuszeitraum.";
  const busiestDayIsUpcoming = busiestDay ? busiestDay.key >= todayKey : false;

  const uniqueHolidayEntries = new Map<string, HolidayRange>();
  holidayMap.forEach((entries) => {
    for (const entry of entries) {
      if (!uniqueHolidayEntries.has(entry.id)) {
        uniqueHolidayEntries.set(entry.id, entry);
      }
    }
  });

  const sortedHolidays = Array.from(uniqueHolidayEntries.values()).sort((a, b) =>
    a.startDate.localeCompare(b.startDate),
  );
  const nextHoliday =
    sortedHolidays.find((entry) => entry.endDate >= todayKey) ?? null;
  const nextHolidayStart = nextHoliday ? parseISO(nextHoliday.startDate) : null;
  const nextHolidayEnd = nextHoliday ? parseISO(nextHoliday.endDate) : null;
  const holidayCountdown =
    nextHolidayStart && Number.isFinite(nextHolidayStart.getTime())
      ? differenceInCalendarDays(nextHolidayStart, today)
      : null;
  const holidayTimingLabel =
    nextHoliday && nextHolidayStart && nextHolidayEnd
      ? holidayCountdown !== null && holidayCountdown > 0
        ? `in ${holidayCountdown} ${holidayCountdown === 1 ? "Tag" : "Tagen"}`
        : differenceInCalendarDays(nextHolidayEnd, today) >= 0
          ? "läuft aktuell"
          : null
      : null;
  const nextHolidayLabel =
    nextHolidayStart && Number.isFinite(nextHolidayStart.getTime())
      ? formatDate(nextHolidayStart, "d. MMMM yyyy", { locale: de })
      : null;

  const overviewNarrative: string[] = [];

  if (membersWithBlocks) {
    overviewNarrative.push(
      `${membersWithBlocks} von ${membersCount} Mitgliedern haben aktuell ${summary.total} gesperrte Tage eingetragen.`,
    );
  } else {
    overviewNarrative.push("Noch keine Sperrtermine im ausgewählten Zeitraum.");
  }

  if (busiestMember) {
    overviewNarrative.push(
      `Die meisten Sperrtermine meldet ${busiestMember.name} (${busiestMember.total}).`,
    );
  }

  if (busiestDayLabel) {
    overviewNarrative.push(
      `${busiestDayIsUpcoming ? "Der nächste Engpass" : "Der größte Engpass"} ${
        busiestDayIsUpcoming ? "steht" : "lag"
      } am ${busiestDayLabel} (${busiestDaySummary}).`,
    );
  }

  if (nextHoliday && nextHolidayLabel) {
    overviewNarrative.push(
      `Nächste Ferienphase: ${nextHoliday.title} ab ${nextHolidayLabel}${
        holidayTimingLabel ? ` (${holidayTimingLabel})` : ""
      }.`,
    );
  } else if (!holidaysInRangeCount) {
    overviewNarrative.push("Im Fokuszeitraum liegen keine Ferien oder Feiertage.");
  }

  const nextHolidayDescription =
    nextHoliday && nextHolidayLabel
      ? `${nextHoliday.title} ab ${nextHolidayLabel}${
          holidayTimingLabel ? ` · ${holidayTimingLabel}` : ""
        }`
      : null;

  const statHighlights: StatHighlight[] = [
    {
      label: "Teammitglieder",
      value: membersCount.toString(),
      sublabel:
        membersWithBlocks > 0
          ? `${membersWithBlocks} mit Sperrterminen`
          : "Noch keine Sperren eingetragen",
      icon: Users,
    },
    {
      label: "Sperrtermine im Fokus",
      value: totalBlockedDays.toString(),
      sublabel:
        upcomingBlockedDays > 0
          ? `${upcomingBlockedDays} bevorstehend`
          : "Keine kommenden Sperrtermine",
      icon: CalendarClock,
    },
    {
      label: "Mitglieder mit kommenden Sperren",
      value: membersWithUpcoming.toString(),
      sublabel:
        membersWithUpcoming > 0
          ? `Ø ${formattedAverageUpcoming} Sperren pro Mitglied`
          : "Aktuell keine Meldungen",
      icon: BellRing,
    },
    {
      label: "Ferien & Feiertage",
      value: holidaysInRangeCount.toString(),
      sublabel:
        nextHolidayDescription ??
        (averageBlocksPerMember > 0
          ? `Ø ${formattedAverageBlocks} Sperren gesamt`
          : "Keine Quellen aktiv"),
      icon: Sun,
    },
  ];

  return (
    <div className="space-y-6">
      <Card className="relative overflow-hidden border-border/70 bg-background/95 p-6 shadow-lg">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 -top-28 h-56 bg-gradient-to-b from-primary/25 via-primary/10 to-transparent opacity-70 blur-3xl"
        />
        <div className="relative flex flex-col gap-6">
          <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div className="flex-1 space-y-3">
              <Badge
                variant="outline"
                size="sm"
                className="w-fit border-primary/40 bg-primary/10 text-primary"
              >
                <Sparkles className="mr-1 h-3.5 w-3.5" aria-hidden /> Übersicht
              </Badge>
              <div className="space-y-2">
                <h2 className="text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">
                  {monthLabel}
                </h2>
                <p className="max-w-3xl text-sm text-muted-foreground">
                  {overviewNarrative.join(" ")}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 self-start md:self-end">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-10 w-10"
                onClick={onPrev}
                aria-label="Vorheriger Monat"
              >
                <ChevronLeft className="h-5 w-5" aria-hidden />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-10 w-10"
                onClick={onNext}
                aria-label="Nächster Monat"
              >
                <ChevronRight className="h-5 w-5" aria-hidden />
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={onReset}>
                Heute
              </Button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {statHighlights.map((stat) => {
              const Icon = stat.icon;

              return (
                <div
                  key={stat.label}
                  className="flex items-start gap-3 rounded-xl border border-border/60 bg-muted/30 p-4"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
                    <Icon className="h-4 w-4" aria-hidden />
                  </span>
                  <div className="space-y-1">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-muted-foreground">
                      {stat.label}
                    </p>
                    <p className="text-lg font-semibold text-foreground sm:text-xl">{stat.value}</p>
                    {stat.sublabel ? (
                      <p className="text-xs text-muted-foreground/80">{stat.sublabel}</p>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-border/60 bg-muted/30 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-muted-foreground">
                Engpass-Analyse
              </p>
              {busiestDay ? (
                <div className="mt-3 space-y-1">
                  <p className="text-base font-semibold text-foreground">
                    {busiestDayIsUpcoming ? "Nächster Engpass" : "Größter Engpass"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {busiestDayLabel} · {busiestDaySummary}
                  </p>
                </div>
              ) : (
                <p className="mt-3 text-sm text-muted-foreground">
                  Bisher wurden keine Sperrtermine im Fokuszeitraum hinterlegt.
                </p>
              )}
              {nextHolidayDescription ? (
                <div className="mt-4 space-y-1 text-xs text-muted-foreground">
                  <span className="font-semibold uppercase tracking-wide text-foreground/80">
                    Ferien &amp; Feiertage
                  </span>
                  <p>{nextHolidayDescription}</p>
                </div>
              ) : null}
            </div>
            <div className="rounded-xl border border-border/60 bg-muted/30 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-muted-foreground">
                Top-betroffene Mitglieder
              </p>
              {topUpcomingMembers.length ? (
                <ul className="mt-3 space-y-2">
                  {topUpcomingMembers.map((item) => {
                    const nextDate = item.nextUpcomingDate
                      ? parseISO(item.nextUpcomingDate)
                      : null;
                    const nextDateLabel =
                      nextDate && Number.isFinite(nextDate.getTime())
                        ? formatDate(nextDate, "d. MMM yyyy", { locale: de })
                        : null;

                    return (
                      <li
                        key={item.member.id}
                        className="rounded-lg border border-border/60 bg-background/95 px-3 py-2 text-sm leading-6"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium text-foreground">{item.member.displayName}</span>
                          <span className="text-xs font-semibold uppercase tracking-wide text-primary">
                            {item.stats.upcoming} bevorstehend
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {nextDateLabel
                            ? `Nächster Sperrtermin am ${nextDateLabel}`
                            : "Keine konkreten Termine im Fokuszeitraum."}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-muted-foreground">
                  Es stehen aktuell keine kommenden Sperrtermine an.
                </p>
              )}
            </div>
          </div>
        </div>
      </Card>

      <Card className="space-y-4 border-border/60 bg-background/95 p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <p className="text-sm text-muted-foreground lg:max-w-xl">
            Klicke oder tippe auf rot markierte Sperrtage, um Hintergründe sowie Ferien- und Feiertagsinfos zu lesen. Gesperrte
            Tage erscheinen kompakt in Rot, eingeschränkte Slots schimmern in bernsteinfarbenen Tönen, bevorzugte Slots erscheinen
            in frischem Grün, freie bleiben dezent – so erkennst du Engpässe auf einen Blick. {preferredDescription}{" "}
            {exceptionDescription} Weitere Tage blenden wir nur ein, wenn Mitglieder sie ausdrücklich als bevorzugt markieren.
          </p>
          <div className="grid w-full gap-3 sm:grid-cols-2 lg:w-auto lg:min-w-[420px] lg:grid-cols-2 xl:grid-cols-4">
            {timelineLegendItems.map((item) => (
              <LegendItem key={item.id} {...item} />
            ))}
          </div>
        </div>
      </Card>

      <div className="hidden sm:block">
        <DesktopTimeline
          preparedMembers={preparedMembers}
          visibleDayInfo={visibleDayInfo}
          holidaySegments={holidaySegments}
          summary={summary}
          preferredWeekdaySet={preferredWeekdaySet}
          exceptionWeekdaySet={exceptionWeekdaySet}
          sortedPreferredWeekdays={sortedPreferredWeekdays}
          preferredDayKeys={preferredDayKeys}
          holidayMap={holidayMap}
          daySummaries={daySummaries}
          onSelectBlockedDay={onSelectBlockedDay}
          formatCreatedAtLabel={formatCreatedAtLabel}
        />
      </div>

      <div className="sm:hidden">
        <MobileTimeline
          preparedMembers={preparedMembers}
          visibleDayInfo={visibleDayInfo}
          holidayMap={holidayMap}
          summary={summary}
          daySummaries={daySummaries}
          onSelectBlockedDay={onSelectBlockedDay}
          formatCreatedAtLabel={formatCreatedAtLabel}
        />
      </div>
    </div>
  );
}

