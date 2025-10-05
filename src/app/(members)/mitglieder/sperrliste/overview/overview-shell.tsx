"use client";
import {
  differenceInCalendarDays,
  format as formatDate,
  parseISO,
  startOfToday,
} from "date-fns";
import { de } from "date-fns/locale/de";
import { ChevronLeft, ChevronRight, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { HolidayRange } from "@/types/holidays";

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

const DATE_FORMAT = "yyyy-MM-dd";

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

  let busiestDay: { key: string; date: Date; blocked: number; limited: number } | null = null;

  for (const dayInfo of visibleDayInfo) {
    let blockedCount = 0;
    let limitedCount = 0;

    for (const member of preparedMembers) {
      const entry = member.blockedMap.get(dayInfo.key);
      if (!entry) continue;
      if (entry.kind === "BLOCKED") {
        blockedCount += 1;
      } else if (entry.kind === "LIMITED") {
        limitedCount += 1;
      }
    }

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

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 p-6 text-slate-100 shadow-xl dark:border-primary/30">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.4em] text-primary/80">
              <Sparkles className="h-4 w-4" aria-hidden />
              Übersicht
            </div>
            <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-2xl font-semibold leading-tight sm:text-3xl">{monthLabel}</h2>
                <p className="mt-2 max-w-3xl text-sm text-slate-300">
                  {overviewNarrative.join(" ")}
                </p>
              </div>
              <div className="flex items-center gap-2 self-start sm:self-end">
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

            <dl className="mt-5 grid gap-3 text-[13px] leading-5 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-xl border border-white/10 bg-white/5 p-3 shadow-inner">
                <dt className="text-[10px] font-semibold uppercase tracking-[0.3em] text-slate-300/80">
                  Teammitglieder
                </dt>
                <dd className="mt-1 text-lg font-semibold sm:text-xl">{membersCount}</dd>
                <dd className="text-[11px] font-medium text-slate-300/80 line-clamp-2">
                  {membersWithBlocks} mit Sperrterminen
                </dd>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-3 shadow-inner">
                <dt className="text-[10px] font-semibold uppercase tracking-[0.3em] text-slate-300/80">
                  Sperrtermine im Fokus
                </dt>
                <dd className="mt-1 flex flex-col gap-1 text-lg font-semibold sm:text-xl">
                  <span>{totalBlockedDays}</span>
                  <span className="text-[11px] font-medium text-slate-300/80 line-clamp-1">
                    {upcomingBlockedDays} bevorstehend
                  </span>
                </dd>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-3 shadow-inner">
                <dt className="text-[10px] font-semibold uppercase tracking-[0.3em] text-slate-300/80">
                  Mitglieder mit kommenden Sperren
                </dt>
                <dd className="mt-1 flex flex-col gap-1 text-lg font-semibold sm:text-xl">
                  <span>{membersWithUpcoming}</span>
                  <span className="text-[11px] font-medium text-slate-300/80 line-clamp-1">
                    Ø {formattedAverageUpcoming} Sperren pro Mitglied
                  </span>
                </dd>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-3 shadow-inner">
                <dt className="text-[10px] font-semibold uppercase tracking-[0.3em] text-slate-300/80">
                  Ferien &amp; Feiertage
                </dt>
                <dd className="mt-1 flex flex-col gap-1 text-lg font-semibold sm:text-xl">
                  <span>{holidaysInRangeCount}</span>
                  <span className="text-[11px] font-medium text-slate-300/80 line-clamp-2">
                    {nextHoliday && nextHolidayLabel
                      ? `Nächste Phase: ${nextHoliday.title}`
                      : averageBlocksPerMember > 0
                        ? `Ø ${formattedAverageBlocks} Sperren gesamt`
                        : "Keine Quellen aktiv"}
                  </span>
                </dd>
              </div>
            </dl>

            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              <div className="rounded-xl border border-white/10 bg-white/5 p-4 shadow-inner">
                <div className="text-[10px] font-semibold uppercase tracking-[0.3em] text-slate-300/80">
                  Engpass-Analyse
                </div>
                {busiestDay ? (
                  <div className="mt-3 space-y-2 text-slate-200">
                    <p className="text-base font-semibold">
                      {busiestDayIsUpcoming ? "Nächster Engpass" : "Größter Engpass"}
                    </p>
                    <p className="text-sm text-slate-300">
                      {busiestDayLabel} · {busiestDaySummary}
                    </p>
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-slate-300">
                    Bisher wurden keine Sperrtermine im Fokuszeitraum hinterlegt.
                  </p>
                )}
                {nextHoliday && nextHolidayLabel ? (
                  <div className="mt-4 space-y-1 text-xs text-slate-300/90">
                    <span className="font-semibold uppercase tracking-wide text-slate-200">
                      Ferien &amp; Feiertage
                    </span>
                    <p>
                      {nextHoliday.title} ab {nextHolidayLabel}
                      {holidayTimingLabel ? ` · ${holidayTimingLabel}` : ""}
                    </p>
                  </div>
                ) : null}
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-4 shadow-inner">
                <div className="text-[10px] font-semibold uppercase tracking-[0.3em] text-slate-300/80">
                  Top-betroffene Mitglieder
                </div>
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
                          className="rounded-lg border border-white/10 bg-white/10 px-3 py-2 text-sm leading-6 text-slate-200"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium">{item.member.displayName}</span>
                            <span className="text-xs font-semibold uppercase tracking-wide text-primary/80">
                              {item.stats.upcoming} bevorstehend
                            </span>
                          </div>
                          <div className="text-xs text-slate-300">
                            {nextDateLabel
                              ? `Nächster Sperrtermin am ${nextDateLabel}`
                              : "Keine konkreten Termine im Fokuszeitraum."}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="mt-3 text-sm text-slate-300">
                    Es stehen aktuell keine kommenden Sperrtermine an.
                  </p>
                )}
              </div>
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

