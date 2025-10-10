"use client";

import { useMemo } from "react";
import { format, isSameDay } from "date-fns";
import { de } from "date-fns/locale/de";
import {
  Award,
  CalendarClock,
  CalendarDays,
  CalendarX2,
  ChevronLeft,
  ChevronRight,
  RefreshCcw,
  Sun,
  Users,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatWeekdayList } from "@/lib/weekdays";
import type { HolidayRange } from "@/types/holidays";

import type { BlockedDay } from "../block-calendar";
import { DesktopTimeline } from "./desktop-timeline";
import { MobileTimeline } from "./mobile-timeline";
import { timelineLegendItems, timelineToneStyles } from "./timeline-legend";
import type {
  BlockOverviewSummary,
  DaySummary,
  HolidaySegment,
  PreparedMember,
  VisibleDayInfo,
} from "./useBlockOverviewData";

export type OverviewShellProps = {
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
  const numberFormatter = useMemo(() => new Intl.NumberFormat("de-DE"), []);

  const daySummaries = useMemo(() => {
    const map = new Map<string, DaySummary>();

    visibleDayInfo.forEach(({ key }) => {
      map.set(key, {
        blocked: 0,
        limited: 0,
        preferred: 0,
        holidayCount: (holidayMap.get(key) ?? []).length,
      });
    });

    preparedMembers.forEach((member) => {
      member.blockedDays.forEach((entry) => {
        const summaryForDay = map.get(entry.date);
        if (!summaryForDay) {
          return;
        }

        if (entry.kind === "BLOCKED") {
          summaryForDay.blocked += 1;
          return;
        }

        if (entry.kind === "LIMITED") {
          summaryForDay.limited += 1;
          return;
        }

        if (entry.kind === "PREFERRED") {
          summaryForDay.preferred += 1;
        }
      });
    });

    return map;
  }, [holidayMap, preparedMembers, visibleDayInfo]);

  const preferredWeekdaySummary = useMemo(() => {
    if (preferredWeekdaySet.size === 0) {
      return null;
    }
    return formatWeekdayList(preferredWeekdaySet, { style: "short" });
  }, [preferredWeekdaySet]);

  const exceptionWeekdaySummary = useMemo(() => {
    if (exceptionWeekdaySet.size === 0) {
      return null;
    }
    return formatWeekdayList(exceptionWeekdaySet, { style: "short" });
  }, [exceptionWeekdaySet]);

  const importantWeekdaySummary = useMemo(() => {
    const combined = new Set<number>();
    preferredWeekdaySet.forEach((weekday) => combined.add(weekday));
    exceptionWeekdaySet.forEach((weekday) => combined.add(weekday));

    if (combined.size === 0) {
      return null;
    }

    return formatWeekdayList(combined, { style: "short" });
  }, [preferredWeekdaySet, exceptionWeekdaySet]);

  const visibleRangeLabel = useMemo(() => {
    if (visibleDayInfo.length === 0) {
      return null;
    }

    const firstDay = visibleDayInfo[0]?.day;
    const lastDay = visibleDayInfo[visibleDayInfo.length - 1]?.day;

    if (!firstDay || !lastDay) {
      return null;
    }

    if (isSameDay(firstDay, lastDay)) {
      return format(firstDay, "d. MMMM yyyy", { locale: de });
    }

    const sameMonth =
      firstDay.getMonth() === lastDay.getMonth() &&
      firstDay.getFullYear() === lastDay.getFullYear();
    const sameYear = firstDay.getFullYear() === lastDay.getFullYear();

    if (sameMonth) {
      return `${format(firstDay, "d.", { locale: de })} – ${format(lastDay, "d. MMMM yyyy", { locale: de })}`;
    }

    if (sameYear) {
      return `${format(firstDay, "d. MMMM", { locale: de })} – ${format(lastDay, "d. MMMM yyyy", { locale: de })}`;
    }

    return `${format(firstDay, "d. MMMM yyyy", { locale: de })} – ${format(lastDay, "d. MMMM yyyy", { locale: de })}`;
  }, [visibleDayInfo]);

  const stats = useMemo(
    () => [
      {
        id: "members",
        label: "Mitglieder im Überblick",
        value: numberFormatter.format(membersCount),
        description:
          membersCount === 1
            ? "Eine Person in der Übersicht"
            : `${numberFormatter.format(membersCount)} Personen in der Übersicht`,
        icon: Users,
      },
      {
        id: "blockedTotal",
        label: "Sperrtermine gesamt",
        value: numberFormatter.format(totalBlockedDays),
        description:
          totalBlockedDays === 1
            ? "Ein Konflikt auf wichtigen Tagen"
            : `${numberFormatter.format(totalBlockedDays)} Konflikte auf wichtigen Tagen`,
        icon: CalendarX2,
      },
      {
        id: "upcoming",
        label: "Bevorstehende Sperrtermine",
        value: numberFormatter.format(upcomingBlockedDays),
        description:
          upcomingBlockedDays === 1
            ? "Ein Sperrtermin ab heute"
            : upcomingBlockedDays === 0
              ? "Keine neuen Sperrtermine im Zeitfenster"
              : `${numberFormatter.format(upcomingBlockedDays)} Sperrtermine ab heute`,
        icon: CalendarClock,
      },
      {
        id: "holidays",
        label: "Ferien & Highlights",
        value: holidaysInRangeCount > 0 ? numberFormatter.format(holidaysInRangeCount) : "–",
        description:
          holidaysInRangeCount > 0
            ? `${numberFormatter.format(holidaysInRangeCount)} Ferien oder Feiertage im Zeitraum`
            : "Keine Ferien im ausgewählten Fenster",
        icon: Sun,
      },
    ],
    [
      holidaysInRangeCount,
      membersCount,
      numberFormatter,
      totalBlockedDays,
      upcomingBlockedDays,
    ],
  );

  const hasTimelineData = visibleDayInfo.length > 0 && preparedMembers.length > 0;

  return (
    <section aria-labelledby="sperrliste-important-days" className="space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
          <div className="space-y-1">
            <h2
              id="sperrliste-important-days"
              className="text-xl font-semibold text-foreground sm:text-2xl"
            >
              Wichtige Probentage im Blick
            </h2>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
              Die Übersicht spiegelt die exportierte PDF-Auswertung wider und zeigt, welche Mitglieder an den
              festgelegten Probentagen blockiert, eingeschränkt oder bevorzugt verfügbar sind.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="muted" size="sm">
              <CalendarDays className="h-3.5 w-3.5" aria-hidden /> Monat: {monthLabel}
            </Badge>
            {visibleRangeLabel ? (
              <Badge variant="info" size="sm">
                Zeitraum: {visibleRangeLabel}
              </Badge>
            ) : null}
            <Badge variant="ghost" size="sm">
              {visibleDayInfo.length} markierte Tage
            </Badge>
            {importantWeekdaySummary ? (
              <Badge variant="ghost" size="sm">
                Fokus: {importantWeekdaySummary}
              </Badge>
            ) : null}
          </div>
        </div>
        <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
          <div className="flex items-center gap-1 rounded-2xl border border-border/60 bg-background/80 p-1 shadow-sm">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onPrev}
              aria-label="Vorherigen Monat anzeigen"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden />
            </Button>
            <span className="px-3 text-sm font-semibold text-foreground sm:text-base">
              {monthLabel}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onNext}
              aria-label="Nächsten Monat anzeigen"
            >
              <ChevronRight className="h-4 w-4" aria-hidden />
            </Button>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onReset}
            className="self-start"
          >
            <RefreshCcw className="h-4 w-4" aria-hidden /> Heute
          </Button>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.id}
              className="flex items-start gap-3 rounded-2xl border border-border/60 bg-background/80 p-4 shadow-sm"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Icon className="h-5 w-5" aria-hidden />
              </div>
              <div className="min-w-0 space-y-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  {stat.label}
                </p>
                <p className="truncate text-lg font-semibold text-foreground sm:text-xl">{stat.value}</p>
                <p className="text-xs leading-5 text-muted-foreground/90">{stat.description}</p>
              </div>
            </div>
          );
        })}
        <div className="flex items-start gap-3 rounded-2xl border border-border/60 bg-background/80 p-4 shadow-sm">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-accent/15 text-accent-foreground">
            <Award className="h-5 w-5" aria-hidden />
          </div>
          <div className="min-w-0 space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Aktivstes Mitglied
            </p>
            <p className="truncate text-lg font-semibold text-foreground sm:text-xl">
              {busiestMember?.name ?? "Noch keine Sperrtermine"}
            </p>
            <p className="text-xs leading-5 text-muted-foreground/90">
              {busiestMember
                ? `${numberFormatter.format(busiestMember.total)} Sperrtermin${
                    busiestMember.total === 1 ? "" : "e"
                  } auf wichtigen Tagen`
                : "Sobald Sperrtermine vorliegen, erscheint hier der Spitzenreiter."}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-border/60 bg-background/80 p-4 shadow-sm">
          <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Bevorzugte Probentage
          </h3>
          <div className="mt-2 space-y-2 text-sm leading-6 text-muted-foreground">
            <p>{preferredDescription}</p>
            {preferredWeekdaySummary ? (
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground/80">
                Aktuell markiert: {preferredWeekdaySummary}
              </p>
            ) : null}
          </div>
        </div>
        <div className="rounded-2xl border border-border/60 bg-background/80 p-4 shadow-sm">
          <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Ausnahmeproben
          </h3>
          <div className="mt-2 space-y-2 text-sm leading-6 text-muted-foreground">
            <p>{exceptionDescription}</p>
            {exceptionWeekdaySummary ? (
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground/80">
                Betroffene Wochentage: {exceptionWeekdaySummary}
              </p>
            ) : null}
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {timelineLegendItems.map((item) => {
          const tone = timelineToneStyles({ tone: item.tone });
          return (
            <div
              key={item.id}
              className={cn(
                "flex h-full items-center gap-3 rounded-2xl border border-border/60 p-3 shadow-sm",
                tone.legendContainer(),
              )}
            >
              <span className={cn("h-9 w-9 rounded-lg border", tone.legendSwatch())} aria-hidden />
              <div className="space-y-1">
                <p className={cn("text-xs font-semibold uppercase tracking-wide", tone.legendLabel())}>
                  {item.label}
                </p>
                <p className={cn("text-[11px] leading-5", tone.legendDescription())}>{item.description}</p>
              </div>
            </div>
          );
        })}
        <div
          className={cn(
            "flex h-full items-center gap-3 rounded-2xl border border-border/60 p-3 shadow-sm",
            timelineToneStyles({ tone: "preferred" }).legendContainer(),
          )}
        >
          <span
            className={cn(
              "h-9 w-9 rounded-lg border",
              timelineToneStyles({ tone: "preferred" }).legendSwatch(),
            )}
            aria-hidden
          />
          <div className="space-y-1">
            <p
              className={cn(
                "text-xs font-semibold uppercase tracking-wide",
                timelineToneStyles({ tone: "preferred" }).legendLabel(),
              )}
            >
              Bevorzugt
            </p>
            <p
              className={cn(
                "text-[11px] leading-5",
                timelineToneStyles({ tone: "preferred" }).legendDescription(),
              )}
            >
              Wunschtermine heben wir dezent hervor – ideal für spontane Planung.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {hasTimelineData ? (
          <>
            <MobileTimeline
              preparedMembers={preparedMembers}
              visibleDayInfo={visibleDayInfo}
              holidayMap={holidayMap}
              summary={summary}
              daySummaries={daySummaries}
              onSelectBlockedDay={onSelectBlockedDay}
              formatCreatedAtLabel={formatCreatedAtLabel}
            />
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
            <p className="text-xs leading-5 text-muted-foreground sm:text-sm">
              Hinweis: Häkchen markieren freie bzw. bevorzugte Tage. Einträge ohne Symbol gelten als Sperrtermin mit Detailangabe
              und lassen sich per Klick oder Tap öffnen.
            </p>
          </>
        ) : (
          <div className="rounded-2xl border border-dashed border-border/60 bg-muted/30 p-6 text-center text-sm text-muted-foreground">
            Aktuell sind keine wichtigen Probentage hinterlegt. Lege in den Sperrlisten-Einstellungen bevorzugte oder
            ausnahmsweise erlaubte Probentage fest, um hier eine Vorschau zu sehen.
          </div>
        )}
      </div>
    </section>
  );
}
