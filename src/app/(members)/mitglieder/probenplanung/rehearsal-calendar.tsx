"use client";

import { useMemo, useState } from "react";
import {
  addDays,
  addMonths,
  endOfMonth,
  format,
  isSameMonth,
  parseISO,
  startOfDay,
  startOfMonth,
} from "date-fns";
import { de } from "date-fns/locale/de";

import {
  CALENDAR_DATE_FORMAT,
  MonthCalendar,
  type CalendarDay,
} from "@/components/calendar/month-calendar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { CreateRehearsalDialog } from "./create-rehearsal-button";

const DEFAULT_NEW_REHEARSAL_TIME = "19:00";

const WEEKEND_DAY_INDICES = new Set<number>([5, 6, 0]);

function findUpcomingWeekendDay(reference: Date): Date {
  const start = startOfDay(reference);
  if (WEEKEND_DAY_INDICES.has(start.getDay())) {
    return start;
  }
  for (let offset = 1; offset <= 7; offset++) {
    const candidate = startOfDay(addDays(start, offset));
    if (WEEKEND_DAY_INDICES.has(candidate.getDay())) {
      return candidate;
    }
  }
  return start;
}

function createSelection(date: Date) {
  const normalized = startOfDay(date);
  return {
    date: normalized,
    key: format(normalized, CALENDAR_DATE_FORMAT),
  };
}

export type CalendarBlockedDay = {
  id: string;
  date: string;
  dateKey: string;
  reason: string | null;
  user: { id: string; name: string | null; email: string | null };
};

export type CalendarRehearsal = {
  id: string;
  title: string;
  start: string;
  end: string | null;
  dateKey: string;
  location: string | null;
};

interface RehearsalCalendarProps {
  blockedDays: CalendarBlockedDay[];
  rehearsals: CalendarRehearsal[];
  memberCount: number;
}

export function RehearsalCalendar({
  blockedDays,
  rehearsals,
  memberCount,
}: RehearsalCalendarProps) {
  const initialSelection = useMemo(
    () => createSelection(findUpcomingWeekendDay(new Date())),
    []
  );
  const [selectedDate, setSelectedDate] = useState<Date | null>(
    initialSelection.date
  );
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(
    initialSelection.key
  );
  const [currentMonth, setCurrentMonth] = useState<Date>(() =>
    startOfMonth(initialSelection.date)
  );
  const [createOpen, setCreateOpen] = useState(false);
  const [createDefaults, setCreateDefaults] = useState<{
    date: string;
    time: string;
  } | null>(null);

  const blockedByDay = useMemo(() => {
    const map = new Map<string, CalendarBlockedDay[]>();
    for (const entry of blockedDays) {
      const key = entry.dateKey;
      const list = map.get(key) ?? [];
      list.push(entry);
      map.set(key, list);
    }
    for (const [, list] of map) {
      list.sort((a, b) => {
        const nameA = (a.user.name ?? a.user.email ?? "").toLowerCase();
        const nameB = (b.user.name ?? b.user.email ?? "").toLowerCase();
        return nameA.localeCompare(nameB);
      });
    }
    return map;
  }, [blockedDays]);

  const rehearsalsByDay = useMemo(() => {
    const map = new Map<string, CalendarRehearsal[]>();
    for (const entry of rehearsals) {
      const key = entry.dateKey;
      const list = map.get(key) ?? [];
      list.push(entry);
      map.set(key, list);
    }
    for (const [, list] of map) {
      list.sort(
        (a, b) =>
          parseISO(a.start).getTime() - parseISO(b.start).getTime()
      );
    }
    return map;
  }, [rehearsals]);

  const dayDetail = useMemo(() => {
    if (!selectedDayKey) return null;
    return {
      blocked: blockedByDay.get(selectedDayKey) ?? [],
      rehearsals: rehearsalsByDay.get(selectedDayKey) ?? [],
    };
  }, [blockedByDay, rehearsalsByDay, selectedDayKey]);

  const selectedDayBlocked = dayDetail?.blocked ?? [];
  const selectedDayRehearsals = dayDetail?.rehearsals ?? [];
  const selectedIsWeekend =
    selectedDate ? WEEKEND_DAY_INDICES.has(selectedDate.getDay()) : false;
  const selectedBlockedLabel =
    memberCount > 0
      ? `${selectedDayBlocked.length} / ${memberCount} blockiert`
      : `${selectedDayBlocked.length} blockiert`;
  const selectedRehearsalLabel = `${selectedDayRehearsals.length} ${
    selectedDayRehearsals.length === 1 ? "Probe" : "Proben"
  } geplant`;
  const selectedSummary =
    selectedDayKey != null
      ? [selectedBlockedLabel, selectedRehearsalLabel].join(" · ")
      : null;
  const selectedBlockedCount = selectedDayBlocked.length;
  const selectedBlockedRatio =
    memberCount > 0 ? selectedBlockedCount / memberCount : 0;
  const selectedBlockedPercent = Math.round(
    Math.max(0, Math.min(1, selectedBlockedRatio)) * 100
  );

  const handleSelectDayByKey = (dayKey: string) => {
    const parsed = startOfDay(parseISO(dayKey));
    setSelectedDate(parsed);
    setSelectedDayKey(dayKey);
    const monthStart = startOfMonth(parsed);
    if (monthStart.getTime() !== currentMonth.getTime()) {
      setCurrentMonth(monthStart);
    }
  };

  const handleDaySelect = (day: CalendarDay) => {
    const normalized = startOfDay(day.date);
    setSelectedDate(normalized);
    setSelectedDayKey(day.key);
    const monthStart = startOfMonth(normalized);
    if (monthStart.getTime() !== currentMonth.getTime()) {
      setCurrentMonth(monthStart);
    }
  };

  const openCreateForDay = (
    dayKey: string,
    defaultTime = DEFAULT_NEW_REHEARSAL_TIME
  ) => {
    setCreateDefaults({ date: dayKey, time: defaultTime });
    setCreateOpen(true);
  };

  const handlePlanRehearsalForSelectedDay = () => {
    if (!selectedDayKey) return;
    openCreateForDay(selectedDayKey);
  };

  const handleCreateOpenChange = (next: boolean) => {
    setCreateOpen(next);
    if (!next) {
      setCreateDefaults(null);
    }
  };

  const handlePlanNextWeekend = () => {
    const target = createSelection(findUpcomingWeekendDay(new Date()));
    handleSelectDayByKey(target.key);
    openCreateForDay(target.key);
  };

  const weekendFocusDays = useMemo(() => {
    const baseMonth = startOfMonth(currentMonth);
    const focusEnd = endOfMonth(addMonths(baseMonth, 1));
    const todayStart = startOfDay(new Date());
    const todayMonthStart = startOfMonth(new Date());
    const isCurrentView = isSameMonth(baseMonth, todayMonthStart);
    const days: { date: Date; key: string }[] = [];
    for (
      let cursor = baseMonth;
      cursor.getTime() <= focusEnd.getTime();
      cursor = addDays(cursor, 1)
    ) {
      if (!WEEKEND_DAY_INDICES.has(cursor.getDay())) {
        continue;
      }
      if (isCurrentView && cursor.getTime() < todayStart.getTime()) {
        continue;
      }
      days.push(createSelection(cursor));
      if (days.length >= 9) {
        break;
      }
    }
    if (days.length === 0) {
      return [createSelection(findUpcomingWeekendDay(new Date()))];
    }
    return days;
  }, [currentMonth]);


  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Kalenderübersicht</h2>
        <p className="text-sm text-muted-foreground">
          Die Split-Ansicht verbindet Tagesplan und Monatskalender. Auf kleineren Bildschirmen stapeln
          sich die Bereiche automatisch, während auf großen Displays ein zweispaltiges Layout entsteht.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,3.5fr)_minmax(0,2.5fr)] xl:items-start">
        <div className="order-2 space-y-6 xl:order-1">
          <div className="rounded-3xl border border-border/60 bg-card/90 p-5 shadow-sm">
            <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Tagesplan
                </span>
                <h3 className="text-xl font-semibold text-foreground">
                  {selectedDate
                    ? format(selectedDate, "EEEE, d. MMMM yyyy", { locale: de })
                    : "Kein Tag ausgewählt"}
                </h3>
                {selectedSummary ? (
                  <p className="text-sm text-muted-foreground">{selectedSummary}</p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Wähle im Kalender einen Tag aus, um die Tagesplanung zu sehen.
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {selectedIsWeekend ? (
                  <Badge className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary">
                    Wochenende
                  </Badge>
                ) : null}
                <Badge
                  variant="outline"
                  className="rounded-full px-3 py-1 text-xs font-semibold text-muted-foreground"
                >
                  {selectedBlockedPercent}% blockiert
                </Badge>
              </div>
            </header>

            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex w-full flex-col gap-2 sm:max-w-xs">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Verfügbarkeit</span>
                  <span>{selectedBlockedLabel}</span>
                </div>
                <div className="relative h-2 overflow-hidden rounded-full bg-muted">
                  <span
                    className={cn(
                      "absolute inset-y-0 left-0 rounded-full transition-[width] duration-300 ease-out",
                      selectedBlockedRatio >= 0.5
                        ? "bg-destructive/80"
                        : selectedBlockedRatio >= 0.25
                        ? "bg-amber-400"
                        : "bg-primary/70"
                    )}
                    style={{ width: `${selectedBlockedPercent}%` }}
                    aria-hidden
                  />
                </div>
              </div>
              <Button
                onClick={handlePlanRehearsalForSelectedDay}
                disabled={!selectedDayKey}
                className="w-full sm:w-auto"
              >
                Probe am ausgewählten Tag planen
              </Button>
            </div>

            <div className="mt-6">
              {selectedDayRehearsals.length ? (
                <ul className="space-y-6 border-l border-border/60 pl-6">
                  {selectedDayRehearsals.map((entry) => {
                    const startDate = parseISO(entry.start);
                    const endDate = entry.end ? parseISO(entry.end) : null;
                    const startLabel = format(startDate, "HH:mm", { locale: de });
                    const endLabel = endDate
                      ? format(endDate, "HH:mm", { locale: de })
                      : null;
                    const timeChip = endLabel
                      ? `${startLabel} – ${endLabel}`
                      : `Start ${startLabel}`;
                    return (
                      <li
                        key={entry.id}
                        className="relative grid grid-cols-[auto_minmax(0,1fr)] items-start gap-4"
                      >
                        <span
                          className="absolute -left-6 top-2 flex h-3 w-3 -translate-x-1/2 items-center justify-center rounded-full border-2 border-background bg-primary shadow-[0_0_0_3px_rgba(129,140,248,0.15)]"
                          aria-hidden
                        />
                        <time className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          {startLabel}
                        </time>
                        <article className="rounded-2xl border border-border/60 bg-background/90 p-4 shadow-sm">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <h4 className="text-sm font-semibold text-foreground">{entry.title}</h4>
                            {entry.location ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-[11px] font-medium text-muted-foreground">
                                <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden />
                                {entry.location}
                              </span>
                            ) : null}
                          </div>
                          <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-primary">
                            {timeChip}
                          </div>
                        </article>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <div className="rounded-2xl border border-dashed border-border/70 bg-muted/30 p-5 text-sm text-muted-foreground">
                  Für diesen Tag sind noch keine Proben geplant. Nutze die Schaltfläche oben, um eine Probe anzulegen.
                  {selectedIsWeekend
                    ? " Wochenenden sind besonders beliebt – sichere dir frühzeitig einen Slot."
                    : ""}
                </div>
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-border/60 bg-background/90 p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h4 className="text-sm font-semibold text-foreground">Blockierte Mitglieder</h4>
                <p className="text-xs text-muted-foreground">
                  {selectedDate
                    ? `Für ${format(selectedDate, "EEEE, d. MMMM yyyy", { locale: de })}`
                    : "Wähle einen Tag, um Sperrungen zu sehen."}
                </p>
              </div>
              <Badge
                variant="outline"
                className="rounded-full px-3 py-1 text-xs font-semibold text-muted-foreground"
              >
                {selectedBlockedLabel}
              </Badge>
            </div>
            {selectedDayBlocked.length ? (
              <ul className="mt-4 space-y-3">
                {selectedDayBlocked.map((entry) => {
                  const displayName = entry.user.name ?? entry.user.email ?? "Mitglied";
                  return (
                    <li
                      key={entry.id}
                      className="rounded-2xl border border-border/60 bg-card/70 px-3 py-2"
                    >
                      <div className="text-sm font-medium text-foreground">{displayName}</div>
                      {entry.reason ? (
                        <p className="text-xs text-muted-foreground">{entry.reason}</p>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="mt-4 text-sm text-muted-foreground">Es sind keine Sperrungen eingetragen.</p>
            )}
          </div>
        </div>

        <div className="order-1 space-y-6 xl:order-2">
          <MonthCalendar
            month={currentMonth}
            onMonthChange={setCurrentMonth}
            title="Monatsansicht"
            subtitle="Split-Ansicht mit Wochenendfokus"
            className="rounded-3xl border border-border/60 bg-card/80 shadow-sm"
            headerActions={
              <Button
                size="sm"
                variant="outline"
                onClick={handlePlanNextWeekend}
                className="w-full sm:w-auto"
              >
                Probe fürs Wochenende planen
              </Button>
            }
            renderDay={(day) => {
              const dayBlocked = blockedByDay.get(day.key) ?? [];
              const dayRehearsals = rehearsalsByDay.get(day.key) ?? [];
              const blockedCount = dayBlocked.length;
              const ratio =
                memberCount > 0 ? blockedCount / memberCount : 0;
              const ratioClamped = Math.max(0, Math.min(1, ratio));
              const blockedLabel =
                memberCount > 0
                  ? `${blockedCount} / ${memberCount} blockiert`
                  : `${blockedCount} blockiert`;
              const rehearsalSummary = dayRehearsals.length
                ? `${dayRehearsals.length} ${
                    dayRehearsals.length === 1 ? "Probe" : "Proben"
                  } geplant`
                : "Noch frei";
              const displayedRehearsals = dayRehearsals.slice(0, 2);
              const remainingCount = Math.max(
                0,
                dayRehearsals.length - displayedRehearsals.length
              );
              const isWeekend = WEEKEND_DAY_INDICES.has(
                day.date.getDay()
              );
              const isSelected = selectedDayKey === day.key;

              const ariaLabelParts: string[] = [
                format(day.date, "EEEE, d. MMMM yyyy", { locale: de }),
              ];
              if (isWeekend) {
                ariaLabelParts.push("Wochenendtag");
              }
              ariaLabelParts.push(
                blockedCount
                  ? memberCount > 0
                    ? `${blockedCount} von ${memberCount} Mitgliedern gesperrt`
                    : `${blockedCount} blockierte Mitglieder`
                  : "Keine Sperrungen eingetragen"
              );
              ariaLabelParts.push(
                dayRehearsals.length
                  ? `${dayRehearsals.length} ${
                      dayRehearsals.length === 1 ? "Probe" : "Proben"
                    } geplant`
                  : "Keine Probe geplant"
              );

              return {
                onClick: () => handleDaySelect(day),
                className: cn(
                  "transition",
                  dayRehearsals.length > 0 &&
                    "border-primary/50 bg-primary/5 shadow-[0_0_0_1px_rgba(129,140,248,0.25)]",
                  ratio >= 0.5 && "border-destructive/60 bg-destructive/10",
                  ratio >= 0.25 &&
                    ratio < 0.5 &&
                    "border-amber-400/60 bg-amber-100/30 dark:border-amber-400/40 dark:bg-amber-500/10",
                  isWeekend &&
                    "bg-gradient-to-br from-primary/5 via-background to-background dark:from-primary/10",
                  isSelected &&
                    "border-primary/70 bg-primary/10 shadow-[0_12px_30px_rgba(129,140,248,0.25)]"
                ),
                "aria-label": ariaLabelParts.join(". "),
                "aria-pressed": isSelected,
                content: (
                  <div className="flex h-full flex-col justify-between gap-2 text-[11px] sm:text-xs">
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-0.5">
                        <p className="font-semibold leading-tight text-foreground">
                          {rehearsalSummary}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {blockedLabel}
                        </p>
                      </div>
                      {isWeekend ? (
                        <Badge className="rounded-full px-2 py-0 text-[9px] font-semibold uppercase tracking-wide">
                          Wochenende
                        </Badge>
                      ) : null}
                    </div>
                    {dayRehearsals.length ? (
                      <ul className="space-y-1">
                        {displayedRehearsals.map((entry) => {
                          const startDate = parseISO(entry.start);
                          const endDate = entry.end
                            ? parseISO(entry.end)
                            : null;
                          const timeLabel = endDate
                            ? `${format(startDate, "HH:mm", {
                                locale: de,
                              })} – ${format(endDate, "HH:mm", {
                                locale: de,
                              })}`
                            : format(startDate, "HH:mm", { locale: de });
                          return (
                            <li
                              key={entry.id}
                              className="flex items-center gap-1"
                            >
                              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                                {timeLabel}
                              </span>
                              <span className="truncate text-[10px] text-muted-foreground">
                                {entry.title}
                              </span>
                            </li>
                          );
                        })}
                        {remainingCount > 0 ? (
                          <li className="text-[10px] font-medium text-muted-foreground">
                            +{remainingCount} weitere {remainingCount === 1 ? "Probe" : "Proben"}
                          </li>
                        ) : null}
                      </ul>
                    ) : (
                      <span className="text-[10px] text-muted-foreground">
                        Keine Proben geplant
                      </span>
                    )}
                    <div className="flex items-center gap-2">
                      <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                        <span
                          className={cn(
                            "absolute inset-y-0 left-0 rounded-full transition-[width] duration-300 ease-out",
                            ratio >= 0.5
                              ? "bg-destructive/80"
                              : ratio >= 0.25
                              ? "bg-amber-400"
                              : "bg-primary/70"
                          )}
                          style={{ width: `${ratioClamped * 100}%` }}
                          aria-hidden
                        />
                      </div>
                      <span className="text-[10px] font-medium text-muted-foreground">
                        {Math.round(ratioClamped * 100)}%
                      </span>
                    </div>
                  </div>
                ),
              };
            }}
            additionalContent={
              <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                <div className="flex items-center gap-2">
                  <span
                    className="relative block h-1.5 w-10 overflow-hidden rounded-full bg-muted"
                    aria-hidden
                  >
                    <span className="absolute inset-y-0 left-0 w-2/3 rounded-full bg-primary/70" />
                  </span>
                  <span>Balken = Anteil blockierter Mitglieder</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-amber-400" />
                  <span>25&nbsp;–&nbsp;49&nbsp;% blockiert</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-destructive/70" />
                  <span>Ab 50&nbsp;% blockiert</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-gradient-to-br from-primary/60 via-primary/20 to-transparent" />
                  <span>Freitag bis Sonntag hervorgehoben</span>
                </div>
              </div>
            }
          />

          {weekendFocusDays.length ? (
            <div className="rounded-3xl border border-border/60 bg-background/90 p-5 shadow-sm">
              <div className="space-y-1">
                <h3 className="text-sm font-semibold">Wochenend-Fokus</h3>
                <p className="text-xs text-muted-foreground">
                  Freitag bis Sonntag immer im Blick. Tippe auf eine Karte, um den Tagesplan links zu öffnen.
                </p>
              </div>
              <div className="mt-4 flex gap-3 overflow-x-auto pb-2 [scrollbar-width:none] sm:grid sm:auto-rows-fr sm:grid-cols-2 sm:gap-4 xl:flex xl:overflow-visible">
                {weekendFocusDays.map((entry) => {
                  const dayBlocked = blockedByDay.get(entry.key) ?? [];
                  const dayRehearsals =
                    rehearsalsByDay.get(entry.key) ?? [];
                  const blockedCount = dayBlocked.length;
                  const ratio =
                    memberCount > 0 ? blockedCount / memberCount : 0;
                  const ratioClamped = Math.max(0, Math.min(1, ratio));
                  const isSelected = selectedDayKey === entry.key;
                  const summary = dayRehearsals.length
                    ? `${dayRehearsals.length} ${
                        dayRehearsals.length === 1 ? "Probe" : "Proben"
                      }`
                    : "Noch frei";
                  const firstRehearsal = dayRehearsals[0];
                  const timePreview = firstRehearsal
                    ? (() => {
                        const startDate = parseISO(firstRehearsal.start);
                        const endDate = firstRehearsal.end
                          ? parseISO(firstRehearsal.end)
                          : null;
                        const startLabel = format(startDate, "HH:mm", {
                          locale: de,
                        });
                        const endLabel = endDate
                          ? format(endDate, "HH:mm", { locale: de })
                          : null;
                        return endLabel ? `${startLabel} – ${endLabel}` : `Start ${startLabel}`;
                      })()
                    : null;
                  const label = format(entry.date, "EEE, d. MMM", {
                    locale: de,
                  });

                  return (
                    <button
                      key={entry.key}
                      type="button"
                      onClick={() => handleSelectDayByKey(entry.key)}
                      className={cn(
                        "group relative min-w-[180px] snap-start rounded-2xl border border-border/60 bg-card/70 p-4 text-left transition hover:border-primary/40 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:min-w-0",
                        isSelected &&
                          "border-primary/60 bg-primary/10 shadow-lg"
                      )}
                      aria-pressed={isSelected}
                      aria-label={`Wochenende ${label}: ${summary}`}
                    >
                      <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        <span>{format(entry.date, "EEE", { locale: de })}</span>
                        <span>{format(entry.date, "d. MMM", { locale: de })}</span>
                      </div>
                      <div className="mt-2 text-sm font-semibold text-foreground">
                        {summary}
                      </div>
                      <div className="mt-2 flex items-center gap-2 text-[10px] text-muted-foreground">
                        <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                          <span
                            className={cn(
                              "absolute inset-y-0 left-0 rounded-full",
                              ratio >= 0.5
                                ? "bg-destructive/80"
                                : ratio >= 0.25
                                ? "bg-amber-400"
                                : "bg-primary/70"
                            )}
                            style={{ width: `${ratioClamped * 100}%` }}
                            aria-hidden
                          />
                        </div>
                        <span>
                          {blockedCount}
                          {memberCount ? ` / ${memberCount}` : ""}
                        </span>
                      </div>
                      {timePreview ? (
                        <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-muted px-2 py-1 text-[10px] font-medium text-muted-foreground">
                          <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden />
                          {timePreview}
                        </div>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <CreateRehearsalDialog
        open={createOpen}
        onOpenChange={handleCreateOpenChange}
        initialDate={createDefaults?.date}
        initialTime={createDefaults?.time}
      />
    </section>
  );
}
