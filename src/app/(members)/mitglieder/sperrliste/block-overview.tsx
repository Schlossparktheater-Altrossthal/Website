"use client";

import { useMemo, useState } from "react";
import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  parseISO,
  startOfMonth,
  startOfToday,
  startOfWeek,
} from "date-fns";
import { de } from "date-fns/locale/de";
import { ArrowRightLeft, ChevronLeft, ChevronRight, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { UserAvatar } from "@/components/user-avatar";
import { cn } from "@/lib/utils";
import { combineNameParts } from "@/lib/names";
import { formatWeekdayList, sortWeekdays } from "@/lib/weekdays";
import type { HolidayRange } from "@/types/holidays";

import type { BlockedDay } from "./block-calendar";

const DATE_FORMAT = "yyyy-MM-dd";

type MemberStats = {
  total: number;
  upcoming: number;
};

export type OverviewMember = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  name: string | null;
  email: string | null;
  avatarSource: string | null;
  avatarUpdatedAt: string | null;
  blockedDays: BlockedDay[];
};

type PreparedMember = OverviewMember & {
  displayName: string;
  blockedMap: Map<string, BlockedDay>;
};

type SelectedBlockedDay = {
  member: PreparedMember;
  entry: BlockedDay;
  date: Date;
  holidayEntries: HolidayRange[];
};

type HolidaySegment = {
  key: string;
  titles: string[];
  isHoliday: boolean;
  span: number;
  showDivider: boolean;
};

function formatCreatedAtLabel(createdAt?: string | null) {
  if (!createdAt) return null;
  const parsed = parseISO(createdAt);
  if (Number.isNaN(parsed.getTime())) return null;
  return format(parsed, "d. MMMM yyyy 'um' HH:mm 'Uhr'", { locale: de });
}

function prepareMembers(members: OverviewMember[]): PreparedMember[] {
  return members.map((member) => {
    const blockedMap = new Map<string, BlockedDay>();
    for (const entry of member.blockedDays) {
      blockedMap.set(entry.date, entry);
    }
    const displayName =
      combineNameParts(member.firstName, member.lastName) ??
      member.name ??
      member.email ??
      "Unbekannt";

    return {
      ...member,
      displayName,
      blockedMap,
    };
  });
}

function createHolidayMap(holidays: HolidayRange[]): Map<string, HolidayRange[]> {
  const map = new Map<string, HolidayRange[]>();
  for (const holiday of holidays) {
    const start = parseISO(`${holiday.startDate}`);
    const parsedEnd = parseISO(`${holiday.endDate}`);
    const validStart = Number.isFinite(start.getTime()) ? start : null;
    if (!validStart) continue;
    const end = Number.isFinite(parsedEnd.getTime()) && parsedEnd >= validStart ? parsedEnd : validStart;
    for (let cursor = validStart; cursor <= end; cursor = addDays(cursor, 1)) {
      const key = format(cursor, DATE_FORMAT);
      const entries = map.get(key);
      if (entries) {
        entries.push(holiday);
      } else {
        map.set(key, [holiday]);
      }
    }
  }
  return map;
}

function summarizeMembers(
  members: PreparedMember[],
  dayKeys: string[],
): { totals: Map<string, MemberStats>; total: number; upcoming: number } {
  const totals = new Map<string, MemberStats>();
  const keySet = new Set(dayKeys);
  const todayKey = format(startOfToday(), DATE_FORMAT);
  let total = 0;
  let upcoming = 0;

  for (const member of members) {
    let memberTotal = 0;
    let memberUpcoming = 0;
    for (const entry of member.blockedDays) {
      if (entry.kind !== "BLOCKED") continue;
      if (!keySet.has(entry.date)) continue;
      memberTotal += 1;
      total += 1;
      if (entry.date >= todayKey) {
        memberUpcoming += 1;
        upcoming += 1;
      }
    }
    totals.set(member.id, { total: memberTotal, upcoming: memberUpcoming });
  }

  return { totals, total, upcoming };
}

function LegendItem({
  label,
  description,
  className,
}: {
  label: string;
  description: string;
  className?: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-card/80 px-3 py-2 shadow-sm">
      <span
        aria-hidden
        className={cn(
          "h-8 w-8 shrink-0 rounded-md border border-border/60 bg-muted",
          className,
        )}
      />
      <div className="flex flex-col">
        <span className="text-xs font-semibold uppercase tracking-wide text-foreground/90">
          {label}
        </span>
        <span className="text-[11px] leading-5 text-muted-foreground/80">{description}</span>
      </div>
    </div>
  );
}

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

  const selectedBlockedCreatedAtLabel = useMemo(
    () => formatCreatedAtLabel(selectedBlockedDay?.entry.createdAt),
    [selectedBlockedDay],
  );

  const daysInView = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const rangeStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const rangeEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: rangeStart, end: rangeEnd });
  }, [currentMonth]);

  const preferredWeekdaySet = useMemo(() => new Set(preferredWeekdays), [preferredWeekdays]);
  const exceptionWeekdaySet = useMemo(() => new Set(exceptionWeekdays), [exceptionWeekdays]);
  const sortedPreferredWeekdays = useMemo(() => sortWeekdays(preferredWeekdays), [preferredWeekdays]);
  const preferredSummary = useMemo(
    () => formatWeekdayList(preferredWeekdays, { fallback: "keine bevorzugten Probentage" }),
    [preferredWeekdays],
  );
  const exceptionSummary = useMemo(
    () => formatWeekdayList(exceptionWeekdays, { fallback: "keine Ausnahmeproben" }),
    [exceptionWeekdays],
  );
  const preferredDescription = useMemo(
    () =>
      preferredWeekdays.length > 0
        ? `Standardmäßig heben wir ${preferredSummary} leicht hervor.`
        : "Aktuell sind keine bevorzugten Probentage hinterlegt – zusätzliche Tage erscheinen nur bei ausdrücklich markierten Wunschterminen.",
    [preferredWeekdays.length, preferredSummary],
  );
  const exceptionDescription = useMemo(
    () =>
      exceptionWeekdays.length > 0
        ? `Ausnahmeproben markieren wir dezent für ${exceptionSummary}.`
        : "Es sind keine Ausnahmeproben hinterlegt.",
    [exceptionWeekdays.length, exceptionSummary],
  );

  const preparedMembers = useMemo(() => prepareMembers(members), [members]);
  const preferredDayKeys = useMemo(() => {
    const set = new Set<string>();
    for (const member of preparedMembers) {
      for (const entry of member.blockedDays) {
        if (entry.kind === "PREFERRED") {
          set.add(entry.date);
        }
      }
    }
    return set;
  }, [preparedMembers]);

  const visibleDayInfo = useMemo(
    () =>
      daysInView
        .map((day) => ({ day, key: format(day, DATE_FORMAT) }))
        .filter(({ day, key }) => {
          const weekday = day.getDay();
          const isPreferredDay = preferredWeekdaySet.has(weekday);
          const isExceptionDay = exceptionWeekdaySet.has(weekday);
          return isPreferredDay || isExceptionDay || preferredDayKeys.has(key);
        }),
    [daysInView, preferredDayKeys, preferredWeekdaySet, exceptionWeekdaySet],
  );

  const dayKeys = useMemo(
    () => visibleDayInfo.map((item) => item.key),
    [visibleDayInfo],
  );
  const holidayMap = useMemo(() => createHolidayMap(holidays), [holidays]);
  const holidaySegments = useMemo(() => {
    if (!visibleDayInfo.length) return [] as HolidaySegment[];

    const segments: HolidaySegment[] = [];
    let currentSignature: string | null = null;
    let currentTitles: string[] = [];
    let currentSpan = 0;
    let currentIsHoliday = false;
    let currentStartIndex = 0;
    let currentStartKey = "";

    const signatureForEntries = (entries: HolidayRange[]) =>
      entries
        .map((entry) => entry.id ?? `${entry.title ?? "holiday"}:${entry.startDate}:${entry.endDate}`)
        .sort()
        .join("|");

    for (let index = 0; index < visibleDayInfo.length; index += 1) {
      const { key } = visibleDayInfo[index];
      const entries = holidayMap.get(key) ?? [];
      const signature = entries.length ? signatureForEntries(entries) : "";

      if (signature === currentSignature) {
        currentSpan += 1;
        continue;
      }

      if (currentSpan > 0) {
        const startInfo = visibleDayInfo[currentStartIndex];
        const weekday = startInfo?.day.getDay();
        const showDivider =
          !!startInfo &&
          sortedPreferredWeekdays.length > 0 &&
          weekday === sortedPreferredWeekdays[0] &&
          currentStartIndex !== 0;

        segments.push({
          key: `${currentStartKey}:${currentSignature || "none"}`,
          titles: currentTitles,
          isHoliday: currentIsHoliday,
          span: currentSpan,
          showDivider,
        });
      }

      currentSignature = signature;
      currentTitles = entries.map((entry) => entry.title).filter(Boolean);
      currentSpan = 1;
      currentIsHoliday = entries.length > 0;
      currentStartIndex = index;
      currentStartKey = key;
    }

    if (currentSpan > 0) {
      const startInfo = visibleDayInfo[currentStartIndex];
      const weekday = startInfo?.day.getDay();
      const showDivider =
        !!startInfo &&
        sortedPreferredWeekdays.length > 0 &&
        weekday === sortedPreferredWeekdays[0] &&
        currentStartIndex !== 0;

      segments.push({
        key: `${currentStartKey}:${currentSignature || "none"}`,
        titles: currentTitles,
        isHoliday: currentIsHoliday,
        span: currentSpan,
        showDivider,
      });
    }

    return segments;
  }, [holidayMap, sortedPreferredWeekdays, visibleDayInfo]);
  const summary = useMemo(() => summarizeMembers(preparedMembers, dayKeys), [preparedMembers, dayKeys]);

  const holidaysInRange = useMemo(() => {
    if (!dayKeys.length) return [] as HolidayRange[];
    const first = dayKeys[0];
    const last = dayKeys[dayKeys.length - 1];
    return holidays.filter((holiday) => holiday.startDate <= last && holiday.endDate >= first);
  }, [holidays, dayKeys]);

  const monthLabel = useMemo(
    () => format(currentMonth, "MMMM yyyy", { locale: de }),
    [currentMonth],
  );

  const busiestMember = useMemo(() => {
    let leader: { name: string; total: number } | null = null;
    for (const member of preparedMembers) {
      const stats = summary.totals.get(member.id);
      const total = stats?.total ?? 0;
      if (!leader || total > leader.total) {
        leader = total > 0 ? { name: member.displayName, total } : leader;
      }
    }
    return leader;
  }, [preparedMembers, summary.totals]);

  const handlePrev = () => setCurrentMonth((prev) => addMonths(prev, -1));
  const handleNext = () => setCurrentMonth((prev) => addMonths(prev, 1));
  const handleReset = () => setCurrentMonth(startOfMonth(new Date()));

  if (!preparedMembers.length) {
    return (
      <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
        Keine Mitglieder gefunden.
      </div>
    );
  }

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
                onClick={handlePrev}
                aria-label="Vorheriger Monat"
              >
                <ChevronLeft className="h-5 w-5" aria-hidden />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-10 w-10 rounded-full border-slate-600/50 bg-slate-900/60 text-slate-100 hover:border-primary/60 hover:text-primary"
                onClick={handleNext}
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
              onClick={handleReset}
            >
              Heute
            </Button>
          </div>
        </div>

        <div className="mt-5 grid gap-2 text-[13px] leading-5 sm:grid-cols-3">
          <div className="rounded-xl border border-white/10 bg-white/5 p-3 shadow-inner">
            <div className="text-[10px] font-semibold uppercase tracking-[0.3em] text-slate-300/80">Teammitglieder</div>
            <div className="mt-1 text-lg font-semibold sm:text-xl">{preparedMembers.length}</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-3 shadow-inner">
            <div className="text-[10px] font-semibold uppercase tracking-[0.3em] text-slate-300/80">Gesperrte Tage</div>
            <div className="mt-1 flex items-baseline gap-2 text-lg font-semibold sm:text-xl">
              <span>{summary.total}</span>
              <span className="text-[11px] font-medium text-slate-300/80">({summary.upcoming} bevorstehend)</span>
            </div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-3 shadow-inner">
            <div className="text-[10px] font-semibold uppercase tracking-[0.3em] text-slate-300/80">Ferien in der Ansicht</div>
            <div className="mt-1 flex items-baseline gap-2 text-lg font-semibold sm:text-xl">
              <span>{holidaysInRange.length}</span>
              <span className="text-[11px] font-medium text-slate-300/80">
                {busiestMember
                  ? `Top-Sperren: ${busiestMember.name} (${busiestMember.total})`
                  : "Keine Häufungen"}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border/60 bg-background/80 p-4 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <p className="text-sm text-muted-foreground lg:max-w-xl">
            Klicke oder tippe auf rot markierte Sperrtage, um Hintergründe und Ferieninfos zu lesen. Gesperrte Tage erscheinen kompakt in Rot, eingeschränkte Slots schimmern in bernsteinfarbenen Tönen, bevorzugte Slots erscheinen in frischem Grün, freie bleiben dezent – so erkennst du Engpässe auf einen Blick. {preferredDescription} {exceptionDescription} Weitere Tage blenden wir nur ein, wenn Mitglieder sie ausdrücklich als bevorzugt markieren.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <LegendItem
              label="Gesperrt"
              description="Eingetragene Abwesenheiten – Details per Klick"
              className="border-destructive/60 bg-transparent"
            />
            <LegendItem
              label="Eingeschränkt"
              description="Teilnahme nur in bestimmten Zeitfenstern"
              className="border-amber-300/60 bg-amber-200/40 text-amber-900 dark:border-amber-400/60 dark:bg-amber-500/20 dark:text-amber-100"
            />
            <LegendItem
              label="Ferien"
              description="Automatische Kalenderdaten"
              className="border-sky-400/60 bg-sky-500/15 text-sky-700 dark:text-sky-200"
            />
            <LegendItem
              label="Frei"
              description="Keine Konflikte gemeldet"
              className="border-border/60 bg-muted/40 text-muted-foreground"
            />
          </div>
        </div>
      </div>

      <div className="hidden sm:block">
        <div className="relative max-h-[70vh] overflow-auto rounded-2xl border border-border/60 bg-card shadow-sm">
          <table className="w-full min-w-[960px] border-collapse text-xs">
            <thead className="sticky top-0 z-30 bg-card/95">
              <tr>
                <th
                  rowSpan={2}
                  className="sticky top-0 left-0 z-40 border-b border-r border-border/60 bg-card/95 px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  Mitglied
                </th>
                {visibleDayInfo.map(({ day, key }, index) => {
                  const weekday = day.getDay();
                  const isPreferredDay = preferredWeekdaySet.has(weekday);
                  const isExceptionDay = exceptionWeekdaySet.has(weekday);
                  const isPreferredExtra = !isPreferredDay && !isExceptionDay;
                  const showDivider =
                    sortedPreferredWeekdays.length > 0 &&
                    weekday === sortedPreferredWeekdays[0] &&
                    index !== 0;
                  const isFirstOfMonth = format(day, "d") === "1";
                  return (
                    <th
                      key={key}
                      className={cn(
                        "border-b border-border/60 bg-card/95 px-3 py-2 text-center align-bottom text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/90",
                        showDivider && "border-l border-border/60",
                        isPreferredDay && "text-foreground",
                        isExceptionDay && !isPreferredDay && "text-muted-foreground",
                        isPreferredExtra && preferredDayKeys.has(key) && "text-emerald-500",
                      )}
                    >
                      <div className="flex flex-col items-center gap-1">
                        <span
                          className={cn(
                            "text-[11px] uppercase tracking-wide",
                            isPreferredDay && "font-semibold text-foreground",
                            isExceptionDay && !isPreferredDay && "text-muted-foreground/80",
                          )}
                        >
                          {format(day, "EE", { locale: de })}
                        </span>
                        <span
                          className={cn(
                            "text-base font-semibold",
                            isToday(day) && "text-primary",
                            isPreferredDay && "font-bold",
                          )}
                        >
                          {format(day, "d", { locale: de })}
                        </span>
                        {isFirstOfMonth ? (
                          <span className="rounded-full bg-muted/60 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/70">
                            {format(day, "MMM", { locale: de })}
                          </span>
                        ) : null}
                      </div>
                    </th>
                  );
                })}
              </tr>
              <tr>
                {holidaySegments.map((segment) => {
                  const summaryLabel =
                    segment.titles.length > 1
                      ? `${segment.titles[0] ?? "Ferien"} +${segment.titles.length - 1}`
                      : segment.titles[0] ?? "Ferien";
                  return (
                    <th
                      key={segment.key}
                      colSpan={segment.span}
                      scope="col"
                      className={cn(
                        "border-b border-border/60 px-2 py-1 text-center align-middle text-[10px] font-semibold uppercase tracking-wide",
                        segment.isHoliday
                          ? "bg-sky-500/15 text-sky-700 dark:bg-sky-500/20 dark:text-sky-200"
                          : "bg-card/95 text-transparent",
                        segment.showDivider && "border-l border-border/60",
                      )}
                      aria-hidden={!segment.isHoliday}
                    >
                      {segment.isHoliday ? (
                        <span title={segment.titles.join(", ")}>{summaryLabel}</span>
                      ) : (
                        <span className="sr-only">Keine Ferien</span>
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {preparedMembers.map((member) => {
                const stats = summary.totals.get(member.id);
                return (
                  <tr key={member.id} className="align-top transition-colors hover:bg-muted/40">
                    <th
                      scope="row"
                      className="sticky left-0 z-30 min-w-[220px] border-b border-r border-border/60 bg-card/95 px-4 py-3 text-left"
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
                          size={44}
                          className="h-11 w-11"
                        />
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold">{member.displayName}</div>
                          <div className="text-xs text-muted-foreground">
                            {stats?.total ? `${stats.total} Sperrtermin${stats.total === 1 ? "" : "e"}` : "Keine Sperrtermine"}
                          </div>
                          {stats?.upcoming ? (
                            <div className="text-sm leading-5 text-primary">{stats.upcoming} bevorstehend</div>
                          ) : null}
                        </div>
                      </div>
                    </th>
                    {visibleDayInfo.map(({ day, key }, index) => {
                      const entry = member.blockedMap.get(key);
                      const trimmedReason = entry?.reason?.trim() || undefined;
                      const hasReason = Boolean(trimmedReason);
                      const createdAtLabel = formatCreatedAtLabel(entry?.createdAt);
                      const weekday = day.getDay();
                      const showDivider =
                        sortedPreferredWeekdays.length > 0 &&
                        weekday === sortedPreferredWeekdays[0] &&
                        index !== 0;
                      const isPreferredDay = preferredWeekdaySet.has(weekday);
                      const isExceptionDay = exceptionWeekdaySet.has(weekday);
                      const holidayEntries = holidayMap.get(key) ?? [];
                      const isHoliday = holidayEntries.length > 0;
                      const isBlocked = entry?.kind === "BLOCKED";
                      const isLimited = entry?.kind === "LIMITED";
                      const isPreferred = entry?.kind === "PREFERRED";
                      const label = [
                        format(day, "EEEE, d. MMMM yyyy", { locale: de }),
                        entry
                          ? isPreferred
                            ? trimmedReason
                              ? `bevorzugt: ${trimmedReason}`
                              : "bevorzugt"
                            : isLimited
                              ? trimmedReason
                                ? `eingeschränkt: ${trimmedReason}`
                                : "eingeschränkt"
                              : trimmedReason
                                ? `gesperrt: ${trimmedReason}`
                                : "gesperrt"
                          : "frei",
                      ];
                      if (createdAtLabel) {
                        label.push(`Eingetragen am ${createdAtLabel}`);
                      }
                      if (isHoliday) {
                        label.push(`Ferien: ${holidayEntries.map((h) => h.title).join(", ")}`);
                      } else if (!entry) {
                        if (isPreferredDay) {
                          label.push("bevorzugter Probentag");
                        }
                        if (isExceptionDay) {
                          label.push("Ausnahmeprobentag");
                        }
                      }

                      const openDetails = () => {
                        if (!entry || !isBlocked) return;
                        setSelectedBlockedDay({
                          member,
                          entry,
                          date: day,
                          holidayEntries,
                        });
                        setDetailsOpen(true);
                      };

                      return (
                        <td
                          key={key}
                          className={cn(
                            "border-b border-border/40 px-2 py-2 text-center align-top text-xs",
                            showDivider && "border-l border-border/60",
                            isPreferredDay && !entry && "bg-primary/10 dark:bg-primary/20",
                            isExceptionDay && !entry && "bg-primary/5 dark:bg-primary/15",
                          )}
                        >
                          {isBlocked && entry ? (
                          <button
                            type="button"
                            onClick={openDetails}
                            className={cn(
                              "flex h-full min-h-[56px] w-full flex-col items-center justify-center rounded-lg border border-transparent bg-transparent px-2 py-2 text-xs leading-5 text-destructive transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background hover:text-destructive/80",
                              isToday(day) && "ring-1 ring-primary/60",
                              !isSameMonth(day, currentMonth) && "opacity-70",
                            )}
                              aria-label={[...label, "Details öffnen"].join(". ")}
                              title={label.join(". ")}
                            >
                              <span className="text-[11px] font-semibold uppercase tracking-wide">Gesperrt</span>
                              {hasReason ? (
                                <span className="mt-1 flex items-start gap-2 text-left text-[11px] leading-4">
                                  <span aria-hidden className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-destructive" />
                                  <span className="line-clamp-2">{trimmedReason}</span>
                                </span>
                              ) : (
                                <span className="mt-1 text-[11px] leading-4 text-destructive/70">
                                  Keine Details
                                </span>
                              )}
                              <span className="sr-only">Sperrtermin öffnen</span>
                            </button>
                          ) : (
                            <div
                              className={cn(
                                "flex h-full min-h-[56px] flex-col items-center justify-center rounded-lg border border-transparent px-2 py-2 text-xs leading-5 transition-colors",
                                isLimited &&
                                  "border-amber-300/60 bg-amber-200/30 text-amber-900 dark:border-amber-400/60 dark:bg-amber-500/15 dark:text-amber-100",
                                isPreferred &&
                                  "border-emerald-400/60 bg-emerald-500/15 text-emerald-900 dark:text-emerald-100",
                                !entry && isHoliday &&
                                  "border-sky-400/40 bg-sky-500/10 text-sky-900 dark:text-sky-100",
                                !entry && !isHoliday &&
                                  "border-border/50 bg-muted/20 text-muted-foreground/80",
                                !entry && !isHoliday && isPreferredDay &&
                                  "border-primary/40 bg-primary/10 text-primary/90 dark:border-primary/50 dark:bg-primary/20 dark:text-primary-foreground",
                                !entry && !isHoliday && isExceptionDay &&
                                  "border-primary/25 bg-primary/5 text-primary/75 dark:border-primary/40 dark:bg-primary/15 dark:text-primary-foreground/80",
                                isToday(day) && "ring-1 ring-primary/60",
                                !isSameMonth(day, currentMonth) && "opacity-70",
                              )}
                              aria-label={label.join(". ")}
                              title={label.join(". ")}
                            >
                              {entry ? (
                                <>
                                  <span className="text-[11px] font-semibold uppercase tracking-wide">
                                    {isPreferred ? "Bevorzugt" : "Eingeschränkt"}
                                  </span>
                                  {trimmedReason ? (
                                    <span className="mt-1 line-clamp-2 text-[11px] leading-4">{trimmedReason}</span>
                                  ) : (
                                    <span className="mt-1 text-[11px] leading-4 text-muted-foreground/80">
                                      {isPreferred ? "Ohne Angabe" : "Keine Details"}
                                    </span>
                                  )}
                                </>
                              ) : isHoliday ? (
                                <span className="sr-only">{holidayEntries[0]?.title ?? "Ferien"}</span>
                              ) : isPreferredDay ? (
                                <span className="sr-only">Bevorzugter Probentag</span>
                              ) : isExceptionDay ? (
                                <span className="sr-only">Ausnahmeprobentag</span>
                              ) : (
                                <span className="text-xs font-medium leading-5 text-muted-foreground/80">Frei</span>
                              )}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="space-y-3 sm:hidden">
        {preparedMembers.map((member) => {
          const stats = summary.totals.get(member.id);
          return (
            <div key={member.id} className="rounded-2xl border border-border/60 bg-background/95 p-4 shadow-sm">
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
                    {stats?.total ? `${stats.total} Sperrtermin${stats.total === 1 ? "" : "e"}` : "Keine Sperrtermine"}
                  </div>
                  {stats?.upcoming ? (
                    <div className="text-sm leading-5 text-primary">{stats.upcoming} bevorstehend</div>
                  ) : null}
                </div>
              </div>
              <div className="relative mt-3">
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-[hsl(var(--background))] via-[hsl(var(--background))] to-transparent"
                />
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-[hsl(var(--background))] via-[hsl(var(--background))] to-transparent"
                />
                <div className="flex gap-2 overflow-x-auto pb-1 pl-1 pr-4 [scrollbar-width:thin] snap-x snap-mandatory">
                  {visibleDayInfo.map(({ day, key }) => {
                    const entry = member.blockedMap.get(key);
                    const holidayEntries = holidayMap.get(key) ?? [];
                    const isHoliday = holidayEntries.length > 0;
                    const isBlocked = entry?.kind === "BLOCKED";
                    const isLimited = entry?.kind === "LIMITED";
                    const isPreferred = entry?.kind === "PREFERRED";
                    const trimmedReason = entry?.reason?.trim() || undefined;
                    const hasReason = Boolean(trimmedReason);
                    const createdAtLabel = formatCreatedAtLabel(entry?.createdAt);
                    const label = [
                      format(day, "EEEE, d. MMMM yyyy", { locale: de }),
                      entry
                        ? isPreferred
                          ? trimmedReason ?? "bevorzugt"
                          : isLimited
                            ? trimmedReason ?? "eingeschränkt"
                            : trimmedReason ?? "gesperrt"
                        : "frei",
                    ];
                    if (isHoliday) {
                      label.push(`Ferien: ${holidayEntries.map((h) => h.title).join(", ")}`);
                    }
                    if (createdAtLabel) {
                      label.push(`Eingetragen am ${createdAtLabel}`);
                    }

                    const openDetails = () => {
                      if (!entry || !isBlocked) return;
                      setSelectedBlockedDay({
                        member,
                        entry,
                        date: day,
                        holidayEntries,
                      });
                      setDetailsOpen(true);
                    };

                    return (
                      <div key={key} className="min-w-[64px] shrink-0 snap-center">
                        {isBlocked && entry ? (
                          <button
                            type="button"
                            onClick={openDetails}
                            className={cn(
                              "flex h-full w-full flex-col items-center rounded-2xl border border-transparent bg-transparent px-2 py-2 text-center text-xs leading-5 text-destructive transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background hover:text-destructive/80",
                              isToday(day) && "ring-2 ring-primary/70",
                            )}
                            aria-label={[...label, "Details öffnen"].join(". ")}
                            title={label.join(". ")}
                          >
                            <span className="text-xs uppercase tracking-wide text-muted-foreground/80">
                              {format(day, "EE", { locale: de })}
                            </span>
                            <span className="text-sm font-semibold">{format(day, "d", { locale: de })}</span>
                            {hasReason ? (
                              <span className="mt-2 flex items-start gap-2 text-left text-[11px] leading-4">
                                <span aria-hidden className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-destructive" />
                                <span className="line-clamp-2">{trimmedReason}</span>
                              </span>
                            ) : (
                              <span className="mt-2 text-[11px] leading-4 text-destructive/70">
                                Keine Details
                              </span>
                            )}
                            <span className="sr-only">Sperrtermin öffnen</span>
                          </button>
                        ) : (
                          <div
                            className={cn(
                              "flex h-full flex-col items-center rounded-2xl border border-border/50 px-2 py-2 text-center text-xs leading-5 shadow-sm",
                              isLimited &&
                                "border-amber-300/60 bg-amber-200/30 text-amber-900 dark:border-amber-400/60 dark:bg-amber-500/15 dark:text-amber-100",
                              isPreferred && "border-emerald-400/50 bg-emerald-500/15 text-emerald-700 dark:text-emerald-100",
                              !entry && isHoliday && "border-sky-400/40 bg-sky-500/15 text-sky-800 dark:text-sky-100",
                              !entry && !isHoliday && "bg-muted/30 text-muted-foreground",
                              isToday(day) && "ring-2 ring-primary/70",
                            )}
                            aria-label={label.join(". ")}
                            title={
                              entry
                                ? trimmedReason ?? (isPreferred ? "Bevorzugt" : "Eingeschränkt")
                                : isHoliday
                                  ? holidayEntries[0]?.title ?? "Ferien"
                                  : "Frei"
                            }
                          >
                            <span className="text-xs uppercase tracking-wide text-muted-foreground/90">
                              {format(day, "EE", { locale: de })}
                            </span>
                            <span className="text-sm font-semibold">
                              {format(day, "d", { locale: de })}
                            </span>
                            {entry ? (
                              <span className="mt-1 line-clamp-2 text-xs leading-4">
                                {trimmedReason ?? (isPreferred ? "Ohne Angabe" : "Eingeschränkt")}
                              </span>
                            ) : isHoliday ? (
                              <span className="mt-1 line-clamp-2 text-xs leading-4">{holidayEntries[0]?.title}</span>
                            ) : (
                              <span className="mt-1 text-xs leading-4 text-muted-foreground">frei</span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="mt-2 flex items-center justify-center gap-2 text-xs leading-5 text-muted-foreground/90">
                  <ArrowRightLeft className="h-4 w-4" aria-hidden />
                  <span>Wische für weitere Tage</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
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
                ? format(selectedBlockedDay.date, "EEEE, d. MMMM yyyy", { locale: de })
                : "Sperrtermin"}
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
                  <p>{selectedBlockedDay.entry.reason?.trim() || "Kein Grund hinterlegt."}</p>
                  <p className="mt-2 text-xs text-muted-foreground/80">
                    {selectedBlockedCreatedAtLabel
                      ? `Eingetragen am ${selectedBlockedCreatedAtLabel}.`
                      : "Zeitpunkt konnte nicht ermittelt werden."}
                  </p>
                </div>
              </div>
              {selectedBlockedDay.holidayEntries.length ? (
                <div className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Ferien am Tag
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {selectedBlockedDay.holidayEntries.map((holiday) => (
                      <Badge key={holiday.id} variant="info">
                        {holiday.title}
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
