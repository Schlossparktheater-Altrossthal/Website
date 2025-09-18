"use client";

import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale/de";

import {
  CALENDAR_DATE_FORMAT,
  MonthCalendar,
  type CalendarDay,
} from "@/components/calendar/month-calendar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/utils";

import { CreateRehearsalDialog } from "./create-rehearsal-button";

const DEFAULT_NEW_REHEARSAL_TIME = "19:00";

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
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null);
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
          parseISO(a.start).getTime() -
          parseISO(b.start).getTime()
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

  const handleDaySelect = (day: CalendarDay) => {
    setSelectedDate(day.date);
    setSelectedDayKey(day.key);
  };

  const handleModalClose = () => {
    setSelectedDate(null);
    setSelectedDayKey(null);
  };

  const openCreateForDay = (dayKey: string, defaultTime = DEFAULT_NEW_REHEARSAL_TIME) => {
    setCreateDefaults({ date: dayKey, time: defaultTime });
    setCreateOpen(true);
  };

  const handlePlanRehearsalForSelectedDay = () => {
    if (!selectedDayKey) return;
    const dayKey = selectedDayKey;
    handleModalClose();
    openCreateForDay(dayKey);
  };

  const handleCreateOpenChange = (next: boolean) => {
    setCreateOpen(next);
    if (!next) {
      setCreateDefaults(null);
    }
  };

  const handleCreateToday = () => {
    const todayKey = format(new Date(), CALENDAR_DATE_FORMAT);
    openCreateForDay(todayKey);
  };

  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Kalenderübersicht</h2>
        <p className="text-sm text-muted-foreground">
          Klicke auf einen Tag, um geplante Proben und Sperrungen einzusehen oder direkt eine neue Probe anzulegen.
        </p>
      </div>

      <MonthCalendar
        title="Monatsansicht"
        subtitle="Blockierte Mitglieder und geplante Proben auf einen Blick"
        className="bg-card/70"
        headerActions={
          <Button
            size="sm"
            variant="outline"
            onClick={handleCreateToday}
            className="w-full sm:w-auto"
          >
            Probe für heute planen
          </Button>
        }
        renderDay={(day) => {
          const dayBlocked = blockedByDay.get(day.key) ?? [];
          const dayRehearsals = rehearsalsByDay.get(day.key) ?? [];
          const blockedCount = dayBlocked.length;
          const ratio = memberCount > 0 ? blockedCount / memberCount : 0;
          const ratioClamped = Math.max(0, Math.min(1, ratio));
          const blockedLabel =
            memberCount > 0
              ? `${blockedCount} / ${memberCount} blockiert`
              : `${blockedCount} blockiert`;
          const rehearsalSummary = dayRehearsals.length
            ? `${dayRehearsals.length} ${
                dayRehearsals.length === 1 ? "Probe" : "Proben"
              } geplant`
            : "Keine Probe geplant";
          const mobileRehearsals = dayRehearsals.slice(0, 2);
          const remainingCount = Math.max(0, dayRehearsals.length - mobileRehearsals.length);
          const ariaLabelParts: string[] = [
            format(day.date, "EEEE, d. MMMM yyyy", { locale: de }),
          ];
          if (memberCount > 0) {
            ariaLabelParts.push(
              blockedCount
                ? `${blockedCount} von ${memberCount} Mitgliedern gesperrt`
                : "Keine Sperrungen eingetragen"
            );
          } else {
            ariaLabelParts.push(
              blockedCount
                ? `${blockedCount} blockierte Mitglieder`
                : "Keine Sperrungen eingetragen"
            );
          }
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
              dayRehearsals.length > 0 &&
                "border-primary/60 bg-primary/5 shadow-[0_0_0_1px_rgba(129,140,248,0.25)]",
              ratio >= 0.5 && "border-destructive/60 bg-destructive/10",
              ratio >= 0.25 && ratio < 0.5 &&
                "border-amber-400/50 bg-amber-100/40 dark:border-amber-400/40 dark:bg-amber-500/10"
            ),
            "aria-label": ariaLabelParts.join(". "),
            content: (
              <div className="mt-1 flex flex-1 flex-col gap-1.5 text-[11px] sm:mt-2 sm:gap-2 sm:text-xs">
                <div className="flex flex-col gap-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 font-medium">
                    <span className="truncate text-foreground">{rehearsalSummary}</span>
                    <Badge
                      variant={
                        blockedCount === 0
                          ? "outline"
                          : ratio >= 0.5
                          ? "destructive"
                          : "secondary"
                      }
                      className={cn(
                        "flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium sm:text-xs",
                        blockedCount === 0 && "border-dashed text-muted-foreground"
                      )}
                    >
                      {blockedLabel}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                      <span
                        className={cn(
                          "absolute inset-y-0 left-0 block h-full rounded-full transition-[width] duration-300 ease-out",
                          ratio >= 0.5
                            ? "bg-destructive/70"
                            : ratio >= 0.25
                            ? "bg-amber-400"
                            : "bg-primary/70"
                        )}
                        style={{ width: `${ratioClamped * 100}%` }}
                        aria-hidden
                      />
                    </div>
                    <span className="min-w-[56px] text-[10px] font-medium text-muted-foreground">
                      {blockedLabel}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col gap-1 sm:hidden">
                  {dayRehearsals.length ? (
                    <ul className="flex flex-col gap-1">
                      {mobileRehearsals.map((entry) => {
                        const startDate = parseISO(entry.start);
                        const endDate = entry.end ? parseISO(entry.end) : null;
                        const timeLabel = endDate
                          ? `${format(startDate, "HH:mm", { locale: de })} – ${format(endDate, "HH:mm", { locale: de })}`
                          : format(startDate, "HH:mm", { locale: de });
                        return (
                          <li
                            key={entry.id}
                            className="flex items-center gap-2 rounded-md border border-primary/30 bg-primary/10 px-2 py-1"
                          >
                            <span className="text-[10px] font-semibold text-primary">{timeLabel}</span>
                            <span className="flex-1 truncate text-[10px] font-medium text-foreground">
                              {entry.title}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <span className="text-[11px] text-muted-foreground">Keine Probe geplant</span>
                  )}
                  {remainingCount > 0 ? (
                    <span className="text-[11px] text-muted-foreground">
                      +{remainingCount} weitere {remainingCount === 1 ? "Probe" : "Proben"}
                    </span>
                  ) : null}
                </div>
                <div className="hidden flex-col gap-1 sm:flex">
                  {dayRehearsals.length ? (
                    dayRehearsals.map((entry) => {
                      const startDate = parseISO(entry.start);
                      const endDate = entry.end ? parseISO(entry.end) : null;
                      const timeLabel = endDate
                        ? `${format(startDate, "HH:mm", { locale: de })} – ${format(endDate, "HH:mm", { locale: de })}`
                        : format(startDate, "HH:mm", { locale: de });
                      return (
                        <div
                          key={entry.id}
                          className="rounded-md border border-primary/30 bg-primary/10 px-2 py-1.5"
                        >
                          <div className="flex items-center justify-between gap-2 text-[11px] font-medium text-primary">
                            <span>{timeLabel}</span>
                            {entry.location ? (
                              <span className="truncate text-[10px] text-muted-foreground">
                                {entry.location}
                              </span>
                            ) : null}
                          </div>
                          <div className="text-xs font-semibold text-foreground">
                            {entry.title}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <span className="text-xs text-muted-foreground">Keine Probe geplant</span>
                  )}
                </div>
              </div>
            ),
          };
        }}
        additionalContent={
          <div className="flex flex-col gap-2 text-xs text-muted-foreground sm:flex-row sm:flex-wrap sm:gap-3">
            <div className="flex items-center gap-2">
              <span className="relative block h-1.5 w-10 overflow-hidden rounded-full bg-muted" aria-hidden>
                <span className="absolute inset-y-0 left-0 w-2/3 rounded-full bg-primary/70" />
              </span>
              <span>Farbiger Balken zeigt den Anteil blockierter Mitglieder</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-primary/50" />
              <span>Mindestens eine Probe geplant</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-amber-400" />
              <span>25&nbsp;–&nbsp;49&nbsp;% blockiert</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-destructive/60" />
              <span>Ab 50&nbsp;% blockiert</span>
            </div>
          </div>
        }
      />

      <Modal
        open={Boolean(selectedDate)}
        onClose={handleModalClose}
        title={
          selectedDate
            ? format(selectedDate, "EEEE, d. MMMM yyyy", { locale: de })
            : ""
        }
        description={
          selectedDayKey
            ? [
                memberCount > 0
                  ? `${dayDetail?.blocked.length ?? 0} / ${memberCount} blockiert`
                  : `${dayDetail?.blocked.length ?? 0} blockiert`,
                `${dayDetail?.rehearsals.length ?? 0} ${
                  (dayDetail?.rehearsals.length ?? 0) === 1
                    ? "Probe"
                    : "Proben"
                } geplant`,
              ].join(" · ")
            : undefined
        }
      >
        <div className="space-y-5">
          <section className="space-y-2">
            <header>
              <h3 className="text-sm font-semibold">Geplante Proben</h3>
            </header>
            {dayDetail && dayDetail.rehearsals.length ? (
              <ul className="space-y-2">
                {dayDetail.rehearsals.map((entry) => {
                  const startDate = parseISO(entry.start);
                  const endDate = entry.end ? parseISO(entry.end) : null;
                  return (
                    <li
                      key={entry.id}
                      className="rounded-lg border border-border/60 bg-muted/40 px-3 py-2"
                    >
                      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                        <span>
                          {format(startDate, "HH:mm", { locale: de })}
                          {endDate ? ` – ${format(endDate, "HH:mm", { locale: de })}` : ""}
                        </span>
                        {entry.location ? <span className="truncate">{entry.location}</span> : null}
                      </div>
                      <div className="text-sm font-medium text-foreground">
                        {entry.title}
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                Für diesen Tag sind noch keine Proben eingeplant.
              </p>
            )}
          </section>

          <section className="space-y-2">
            <header>
              <h3 className="text-sm font-semibold">Blockierte Mitglieder</h3>
            </header>
            {dayDetail && dayDetail.blocked.length ? (
              <ul className="space-y-2">
                {dayDetail.blocked.map((entry) => {
                  const displayName = entry.user.name ?? entry.user.email ?? "Mitglied";
                  return (
                    <li
                      key={entry.id}
                      className="rounded-lg border border-border/60 bg-background/80 px-3 py-2"
                    >
                      <div className="text-sm font-medium text-foreground">
                        {displayName}
                      </div>
                      {entry.reason ? (
                        <div className="text-xs text-muted-foreground">{entry.reason}</div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                Es sind keine Sperrungen eingetragen.
              </p>
            )}
          </section>

          <div className="flex justify-end">
            <Button onClick={handlePlanRehearsalForSelectedDay}>
              Probe für diesen Tag planen
            </Button>
          </div>
        </div>
      </Modal>

      <CreateRehearsalDialog
        open={createOpen}
        onOpenChange={handleCreateOpenChange}
        initialDate={createDefaults?.date}
        initialTime={createDefaults?.time}
      />
    </section>
  );
}
