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
import { ChevronLeft, ChevronRight, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/user-avatar";
import { cn } from "@/lib/utils";
import { combineNameParts } from "@/lib/names";
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
    <div className="flex items-center gap-2 rounded-xl border border-border/50 bg-background/70 px-3 py-2 shadow-sm backdrop-blur">
      <span
        aria-hidden
        className={cn(
          "h-8 w-8 shrink-0 rounded-full border border-border/60 bg-card shadow-inner",
          className,
        )}
      />
      <div className="flex flex-col">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-foreground/90">
          {label}
        </span>
        <span className="text-[10px] text-muted-foreground/80">{description}</span>
      </div>
    </div>
  );
}

export function BlockOverview({
  members,
  holidays = [],
}: {
  members: OverviewMember[];
  holidays?: HolidayRange[];
}) {
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(new Date()));

  const daysInView = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const rangeStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const rangeEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: rangeStart, end: rangeEnd });
  }, [currentMonth]);

  const dayKeys = useMemo(
    () => daysInView.map((day) => format(day, DATE_FORMAT)),
    [daysInView],
  );

  const preparedMembers = useMemo(() => prepareMembers(members), [members]);
  const holidayMap = useMemo(() => createHolidayMap(holidays), [holidays]);
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

        <div className="mt-5 grid gap-3 text-sm sm:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-inner">
            <div className="text-xs uppercase tracking-wide text-slate-300/80">Teammitglieder</div>
            <div className="mt-1 text-2xl font-semibold">{preparedMembers.length}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-inner">
            <div className="text-xs uppercase tracking-wide text-slate-300/80">Gesperrte Tage im Monat</div>
            <div className="mt-1 text-2xl font-semibold">{summary.total}</div>
            <div className="text-xs text-slate-300/80">Davon bevorstehend: {summary.upcoming}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-inner">
            <div className="text-xs uppercase tracking-wide text-slate-300/80">Ferien in der Ansicht</div>
            <div className="mt-1 text-2xl font-semibold">{holidaysInRange.length}</div>
            <div className="text-xs text-slate-300/80">
              {busiestMember
                ? `Meiste Sperren: ${busiestMember.name} (${busiestMember.total})`
                : "Aktuell keine Häufungen"}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border/60 bg-background/80 p-4 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <p className="text-sm text-muted-foreground lg:max-w-xl">
            Tippe oder fahre über die Tageszellen, um Gründe und Ferieninfos zu sehen. Gesperrte Tage leuchten warm, freie Slots bleiben dezent – so erkennst du Engpässe auf einen Blick.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <LegendItem
              label="Gesperrt"
              description="Eingetragene Abwesenheiten"
              className="border-destructive/70 bg-gradient-to-br from-destructive/80 via-destructive/60 to-destructive/30 shadow-[0_12px_30px_-18px_rgba(220,38,38,0.65)]"
            />
            <LegendItem
              label="Ferien"
              description="Automatische Kalenderdaten"
              className="border-sky-400/50 bg-gradient-to-br from-sky-500/25 via-sky-500/15 to-sky-500/5 shadow-[0_12px_30px_-18px_rgba(56,189,248,0.45)]"
            />
            <LegendItem
              label="Frei"
              description="Keine Konflikte gemeldet"
              className="border-border/50 bg-card/60"
            />
          </div>
        </div>
      </div>

      <div className="hidden sm:block">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-separate border-spacing-y-2">
            <thead>
              <tr>
                <th className="sticky left-0 z-20 rounded-xl bg-background/95 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Mitglied
                </th>
                {daysInView.map((day, index) => {
                  const key = dayKeys[index];
                  const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                  const showDivider = day.getDay() === 1 && index !== 0;
                  const isFirstOfMonth = format(day, "d") === "1";
                  const holidayEntries = holidayMap.get(key) ?? [];
                  return (
                    <th
                      key={key}
                      className={cn(
                        "px-3 pb-3 text-center align-bottom text-[11px] font-medium uppercase tracking-wide text-muted-foreground/80",
                        showDivider && "border-l border-border/60",
                        isWeekend && "text-rose-500/80",
                      )}
                    >
                      <div className="flex flex-col items-center gap-1">
                        <span>{format(day, "EE", { locale: de })}</span>
                        <span
                          className={cn(
                            "text-base font-semibold",
                            isToday(day) && "text-primary",
                          )}
                        >
                          {format(day, "d", { locale: de })}
                        </span>
                        {isFirstOfMonth ? (
                          <span className="rounded-full bg-muted/60 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/70">
                            {format(day, "MMM", { locale: de })}
                          </span>
                        ) : null}
                        {holidayEntries.length ? (
                          <span className="rounded-full bg-sky-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-700 dark:bg-sky-500/20 dark:text-sky-200">
                            Ferien
                          </span>
                        ) : null}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {preparedMembers.map((member) => {
                const stats = summary.totals.get(member.id);
                return (
                  <tr key={member.id} className="align-top">
                    <th
                      scope="row"
                      className="sticky left-0 z-10 min-w-[220px] rounded-2xl border border-border/60 bg-background/95 px-4 py-3 text-left shadow-sm"
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
                            <div className="text-[11px] text-primary">{stats.upcoming} bevorstehend</div>
                          ) : null}
                        </div>
                      </div>
                    </th>
                    {daysInView.map((day, index) => {
                      const key = dayKeys[index];
                      const entry = member.blockedMap.get(key);
                      const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                      const showDivider = day.getDay() === 1 && index !== 0;
                      const holidayEntries = holidayMap.get(key) ?? [];
                      const isHoliday = holidayEntries.length > 0;
                      const label = [
                        format(day, "EEEE, d. MMMM yyyy", { locale: de }),
                        entry
                          ? entry.reason
                            ? `gesperrt: ${entry.reason}`
                            : "gesperrt"
                          : "frei",
                      ];
                      if (isHoliday) {
                        label.push(`Ferien: ${holidayEntries.map((h) => h.title).join(", ")}`);
                      }

                      return (
                        <td
                          key={key}
                          className={cn(
                            "px-2 py-2 text-center align-top text-xs",
                            showDivider && "border-l border-border/60",
                            isWeekend && !entry && "bg-muted/30",
                          )}
                        >
                          <div
                            className={cn(
                              "flex h-full min-h-[64px] flex-col items-center justify-center rounded-xl border border-transparent px-2 py-3 text-[11px] shadow-sm transition-all",
                              entry &&
                                "border-destructive/70 bg-gradient-to-br from-destructive/80 via-destructive/60 to-destructive/25 text-destructive-foreground shadow-[0_12px_30px_-20px_rgba(220,38,38,0.65)]",
                              !entry && isHoliday &&
                                "border-sky-400/40 bg-gradient-to-br from-sky-500/20 via-sky-500/10 to-sky-500/5 text-sky-900 dark:text-sky-100",
                              !entry && !isHoliday && "bg-card/40 text-muted-foreground",
                              isToday(day) && "ring-2 ring-primary/70",
                              !isSameMonth(day, currentMonth) && "opacity-60",
                            )}
                            aria-label={label.join(". ")}
                            title={entry?.reason ?? (isHoliday ? holidayEntries[0]?.title ?? "Ferien" : "Frei")}
                          >
                            {entry ? (
                              <>
                                <span className="text-xs font-semibold uppercase tracking-wide">Gesperrt</span>
                                <span className="mt-1 line-clamp-3 text-[11px]">
                                  {entry.reason ?? "Ohne Grund"}
                                </span>
                              </>
                            ) : isHoliday ? (
                              <>
                                <span className="text-[11px] font-semibold uppercase tracking-wide">Ferien</span>
                                <span className="mt-1 line-clamp-3 text-[11px]">
                                  {holidayEntries[0]?.title}
                                </span>
                              </>
                            ) : (
                              <span className="text-[11px] font-medium text-muted-foreground/80">Frei</span>
                            )}
                          </div>
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
                    <div className="text-[11px] text-primary">{stats.upcoming} bevorstehend</div>
                  ) : null}
                </div>
              </div>
              <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:thin] snap-x snap-mandatory">
                {daysInView.map((day, index) => {
                  const key = dayKeys[index];
                  const entry = member.blockedMap.get(key);
                  const holidayEntries = holidayMap.get(key) ?? [];
                  const isHoliday = holidayEntries.length > 0;
                  const label = [
                    format(day, "EEEE, d. MMMM yyyy", { locale: de }),
                    entry ? entry.reason ?? "gesperrt" : "frei",
                  ];
                  if (isHoliday) {
                    label.push(`Ferien: ${holidayEntries.map((h) => h.title).join(", ")}`);
                  }

                  return (
                    <div
                      key={key}
                      className={cn(
                        "flex min-w-[60px] shrink-0 snap-center flex-col items-center rounded-2xl border border-border/50 px-2 py-2 text-center text-[10px] shadow-sm",
                        entry && "border-destructive/60 bg-destructive/15 text-destructive",
                        !entry && isHoliday && "border-sky-400/40 bg-sky-500/15 text-sky-800 dark:text-sky-100",
                        !entry && !isHoliday && "bg-muted/30 text-muted-foreground",
                        isToday(day) && "ring-2 ring-primary/70",
                      )}
                      aria-label={label.join(". ")}
                      title={entry?.reason ?? (isHoliday ? holidayEntries[0]?.title ?? "Ferien" : "Frei")}
                    >
                      <span className="text-[10px] uppercase tracking-wide">
                        {format(day, "EE", { locale: de })}
                      </span>
                      <span className="text-sm font-semibold">
                        {format(day, "d", { locale: de })}
                      </span>
                      {entry ? (
                        <span className="mt-1 line-clamp-2 text-[10px]">{entry.reason ?? "Gesperrt"}</span>
                      ) : isHoliday ? (
                        <span className="mt-1 line-clamp-2 text-[10px]">{holidayEntries[0]?.title}</span>
                      ) : (
                        <span className="mt-1 text-[10px] text-muted-foreground">frei</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
