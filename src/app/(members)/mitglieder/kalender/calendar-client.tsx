"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import type { ComponentProps } from "react";
import {
  addDays,
  addWeeks,
  differenceInMinutes,
  eachDayOfInterval,
  endOfDay,
  endOfWeek,
  format,
  formatISO,
  isAfter,
  isBefore,
  isSameDay,
  isWithinInterval,
  parseISO,
  setHours,
  setMinutes,
  startOfDay,
  startOfWeek,
} from "date-fns";
import { de } from "date-fns/locale/de";
import { ChevronLeft, ChevronRight, MapPin } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { cn } from "@/lib/utils";

import {
  type MemberCalendarEvent,
  type MemberCalendarSource,
  type MemberCalendarSummaryItem,
  type MemberCalendarEventBadgeTone,
} from "./types";

interface CalendarClientProps {
  initialDate: string;
  calendars: MemberCalendarSource[];
  events: MemberCalendarEvent[];
  summary: MemberCalendarSummaryItem[];
}

type CalendarView = "day" | "week" | "agenda";

type DeviceKind = "mobile" | "tablet" | "desktop";

type CalendarEventWithDates = MemberCalendarEvent & {
  startDate: Date;
  endDate: Date;
};

type PositionedCalendarEvent = CalendarEventWithDates & {
  layout: {
    column: number;
    columns: number;
  };
};

type DayBucket = {
  date: Date;
  events: PositionedCalendarEvent[];
  allDay: CalendarEventWithDates[];
};

const HOURS = Array.from({ length: 24 }, (_, index) => index);
const WEEKDAY_LABELS = [
  "Montag",
  "Dienstag",
  "Mittwoch",
  "Donnerstag",
  "Freitag",
  "Samstag",
  "Sonntag",
];

const AGENDA_RANGE_DAYS = 60;

type BadgeVariant = ComponentProps<typeof Badge>["variant"];

const BADGE_TONE_VARIANT_MAP: Record<MemberCalendarEventBadgeTone, BadgeVariant> = {
  default: "default",
  secondary: "secondary",
  accent: "accent",
  muted: "muted",
  success: "success",
  warning: "warning",
  info: "info",
  destructive: "destructive",
};

function resolveBadgeVariant(tone?: MemberCalendarEventBadgeTone | null): BadgeVariant {
  if (!tone) return "default";
  return BADGE_TONE_VARIANT_MAP[tone] ?? "default";
}

function computeEventLayouts(events: CalendarEventWithDates[]) {
  const sorted = [...events].sort(
    (a, b) => a.startDate.getTime() - b.startDate.getTime(),
  );
  type ActiveEntry = { event: CalendarEventWithDates; column: number; groupId: number };
  const active: ActiveEntry[] = [];
  const layout = new Map<
    string,
    { column: number; columns: number; groupId: number }
  >();
  let groupCounter = 0;

  for (const event of sorted) {
    for (let index = active.length - 1; index >= 0; index -= 1) {
      const candidate = active[index];
      if (candidate.event.endDate <= event.startDate) {
        active.splice(index, 1);
      }
    }

    const overlapping = active.filter((entry) =>
      isBefore(entry.event.startDate, event.endDate) &&
      isAfter(entry.event.endDate, event.startDate),
    );

    const groupId = overlapping.length ? overlapping[0].groupId : groupCounter++;
    const usedColumns = new Set(overlapping.map((entry) => entry.column));
    let column = 0;
    while (usedColumns.has(column)) {
      column += 1;
    }

    layout.set(event.id, { column, columns: column + 1, groupId });
    active.push({ event, column, groupId });
  }

  const groupColumns = new Map<number, number>();
  for (const entry of layout.values()) {
    groupColumns.set(
      entry.groupId,
      Math.max(groupColumns.get(entry.groupId) ?? 0, entry.column + 1),
    );
  }

  const normalized = new Map<string, { column: number; columns: number }>();
  for (const [eventId, entry] of layout.entries()) {
    normalized.set(eventId, {
      column: entry.column,
      columns: Math.max(groupColumns.get(entry.groupId) ?? entry.columns, 1),
    });
  }

  return normalized;
}

export function CalendarClient({ initialDate, calendars, events, summary }: CalendarClientProps) {
  const parsedInitialDate = useMemo(() => parseISO(initialDate), [initialDate]);
  const [currentDate, setCurrentDate] = useState<Date>(parsedInitialDate);
  const [view, setView] = useState<CalendarView>("week");
  const [hasUserCustomizedView, setHasUserCustomizedView] = useState(false);
  const [activeCalendarIds, setActiveCalendarIds] = useState<string[]>(() =>
    calendars.map((item) => item.id),
  );

  const isTablet = useMediaQuery("(min-width: 768px)");
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const isCompactWeekBreakpoint = useMediaQuery("(max-width: 1023px)");
  const isMobileTimeBreakpoint = useMediaQuery("(max-width: 639px)");
  const deviceKind: DeviceKind = isDesktop ? "desktop" : isTablet ? "tablet" : "mobile";
  const previousDeviceRef = useRef<DeviceKind | null>(null);

  useEffect(() => {
    if (previousDeviceRef.current && previousDeviceRef.current !== deviceKind) {
      setHasUserCustomizedView(false);
    }
    previousDeviceRef.current = deviceKind;
  }, [deviceKind]);

  const preferredView = useMemo<CalendarView>(() => {
    if (deviceKind === "desktop") return "week";
    if (deviceKind === "tablet") return "week";
    return "agenda";
  }, [deviceKind]);

  useEffect(() => {
    if (isDesktop) {
      setView((previous) => (previous === "agenda" ? "week" : previous));
    }
  }, [isDesktop]);

  useEffect(() => {
    if (hasUserCustomizedView) return;
    setView((previous) => {
      if (previous === preferredView) return previous;
      return preferredView;
    });
  }, [preferredView, hasUserCustomizedView, currentDate]);

  const setViewFromUser = (nextView: CalendarView) => {
    setHasUserCustomizedView(true);
    setView(nextView);
  };

  const calendarMap = useMemo(() => {
    const map = new Map<string, MemberCalendarSource>();
    for (const source of calendars) {
      map.set(source.id, source);
    }
    return map;
  }, [calendars]);

  const parsedEvents = useMemo<CalendarEventWithDates[]>(() => {
    return events
      .map((event) => {
        const startDate = parseISO(event.start);
        const endDate = event.end ? parseISO(event.end) : startDate;
        return {
          ...event,
          startDate,
          endDate,
        } satisfies CalendarEventWithDates;
      })
      .sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
  }, [events]);

  const activeEvents = useMemo(() => {
    return parsedEvents.filter((event) => activeCalendarIds.includes(event.calendarId));
  }, [parsedEvents, activeCalendarIds]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEventWithDates[]>();
    for (const event of activeEvents) {
      const start = startOfDay(event.startDate);
      const end = startOfDay(event.endDate);
      const days = eachDayOfInterval({ start, end });
      for (const day of days) {
        const key = formatISO(day, { representation: "date" });
        if (!map.has(key)) {
          map.set(key, []);
        }
        map.get(key)!.push(event);
      }
    }
    return map;
  }, [activeEvents]);

  const rangeLabel = useMemo(() => {
    if (view === "day") {
      return format(currentDate, "EEEE, d. MMMM yyyy", { locale: de });
    }
    if (view === "week") {
      const start = startOfWeek(currentDate, { weekStartsOn: 1 });
      const end = endOfWeek(currentDate, { weekStartsOn: 1 });
      const sameMonth = start.getMonth() === end.getMonth();
      const monthPart = sameMonth
        ? format(start, "MMMM yyyy", { locale: de })
        : `${format(start, "MMMM", { locale: de })} – ${format(end, "MMMM yyyy", { locale: de })}`;
      return `${format(start, "d.", { locale: de })} – ${format(end, "d.", { locale: de })} ${monthPart}`;
    }
    const start = startOfDay(currentDate);
    const end = addDays(start, AGENDA_RANGE_DAYS);
    return `${format(start, "d. MMM", { locale: de })} – ${format(end, "d. MMM yyyy", { locale: de })}`;
  }, [currentDate, view]);

  const agendaEvents = useMemo(() => {
    if (view !== "agenda") return [] as CalendarEventWithDates[];
    const start = startOfDay(currentDate);
    const end = addDays(start, AGENDA_RANGE_DAYS);
    return activeEvents.filter((event) =>
      isWithinInterval(event.startDate, { start, end }) ||
      isWithinInterval(event.endDate, { start, end }),
    );
  }, [activeEvents, currentDate, view]);

  const handleNavigate = (direction: "previous" | "next") => {
    const factor = direction === "next" ? 1 : -1;
    if (view === "day") {
      setCurrentDate((prev) => addDays(prev, factor));
    } else {
      setCurrentDate((prev) => addWeeks(prev, factor));
    }
  };

  const handleToday = () => {
    const today = new Date();
    setCurrentDate(today);
  };

  const toggleCalendar = (calendarId: string) => {
    setActiveCalendarIds((prev) => {
      if (prev.includes(calendarId)) {
        return prev.filter((id) => id !== calendarId);
      }
      return [...prev, calendarId];
    });
  };

  const handleViewChange = (nextView: CalendarView) => {
    setViewFromUser(nextView);
  };

  const bucketsForWeek = useMemo(() => {
    if (view !== "week" && view !== "day") return [] as DayBucket[];
    const weekStart =
      view === "day"
        ? startOfDay(currentDate)
        : startOfWeek(currentDate, { weekStartsOn: 1 });
    const days =
      view === "day"
        ? [weekStart]
        : eachDayOfInterval({
            start: weekStart,
            end: addDays(weekStart, 6),
          });
    return days.map((day) => {
      const key = formatISO(day, { representation: "date" });
      const dayEvents = (eventsByDay.get(key) ?? []).filter((event) =>
        isSameDay(event.startDate, day) ||
        isWithinInterval(day, { start: startOfDay(event.startDate), end: endOfDay(event.endDate) }),
      );
      const allDay = dayEvents.filter((event) => event.allDay);
      const timed = dayEvents.filter((event) => !event.allDay);
      const sorted = timed.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
      const layoutMap = computeEventLayouts(sorted);
      return {
        date: day,
        events: sorted.map((event) => ({
          ...event,
          layout: layoutMap.get(event.id) ?? { column: 0, columns: 1 },
        })),
        allDay,
      } satisfies DayBucket;
    });
  }, [currentDate, eventsByDay, view]);

  return (
    <section className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <div className="order-1 flex flex-col gap-6 lg:order-1">
          <Card className="rounded-3xl border border-border/60 bg-card/70 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base font-semibold">Meine Kalender</CardTitle>
              <p className="text-sm text-muted-foreground">
                Blende einzelne Quellen aus, um dich auf bestimmte Termine zu konzentrieren.
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              {calendars.map((calendar) => {
                const isActive = activeCalendarIds.includes(calendar.id);
                return (
                  <button
                    key={calendar.id}
                    type="button"
                    onClick={() => toggleCalendar(calendar.id)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-2xl border px-3 py-2 text-left text-sm transition",
                      isActive
                        ? "border-transparent bg-primary/10 text-foreground"
                        : "border-border/70 bg-background/70 text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <span
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: calendar.color }}
                      aria-hidden
                    />
                    <span className="flex-1">
                      <span className="block font-medium">{calendar.label}</span>
                      {calendar.secondaryLabel ? (
                        <span className="text-xs text-muted-foreground/80">{calendar.secondaryLabel}</span>
                      ) : null}
                    </span>
                    <Badge variant={isActive ? "default" : "outline"} className="rounded-full px-2 py-0 text-[10px]">
                      {isActive ? "Aktiv" : "Aus"}
                    </Badge>
                  </button>
                );
              })}
            </CardContent>
          </Card>
        </div>

        <div className="order-2 space-y-4 lg:order-2">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" onClick={() => handleNavigate("previous")}
                  aria-label="Zurück">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" onClick={handleToday} className="px-4">
                  Heute
                </Button>
                <Button variant="outline" size="icon" onClick={() => handleNavigate("next")} aria-label="Vor">
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <div>
                <p className="text-lg font-semibold text-foreground">{rangeLabel}</p>
                <p className="text-sm text-muted-foreground">
                  {view === "week"
                    ? `Kalenderwoche ${format(currentDate, "I", { locale: de })}`
                    : view === "day"
                      ? format(currentDate, "EEEE", { locale: de })
                      : `${agendaEvents.length} Termine in der Liste`}
                </p>
              </div>
            </div>

            <Tabs value={view} onValueChange={(value) => handleViewChange(value as CalendarView)} className="w-full md:w-auto">
              <TabsList className="w-full justify-start sm:grid sm:grid-cols-3">
                <TabsTrigger value="day" className="min-w-0 basis-1/2 px-3 py-2 sm:basis-auto sm:px-4">
                  Tag
                </TabsTrigger>
                <TabsTrigger value="week" className="min-w-0 basis-1/2 px-3 py-2 sm:basis-auto sm:px-4">
                  Woche
                </TabsTrigger>
                <TabsTrigger value="agenda" className="min-w-0 basis-1/2 px-3 py-2 sm:basis-auto sm:px-4">
                  Agenda
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <Card className="rounded-3xl border border-border/60 bg-card/80 shadow-sm">
            <CardContent className="p-0">
              {view === "week" || view === "day" ? (
                isMobileTimeBreakpoint ? (
                  <div className="p-3 sm:p-4">
                    <WeekGrid
                      buckets={bucketsForWeek}
                      calendarMap={calendarMap}
                      view={view}
                      isCompact
                    />
                  </div>
                ) : isCompactWeekBreakpoint ? (
                  <div className="p-4">
                    <WeekGrid
                      buckets={bucketsForWeek}
                      calendarMap={calendarMap}
                      view={view}
                      isCompact
                    />
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <div className="min-w-full lg:min-w-[720px]">
                      <WeekGrid buckets={bucketsForWeek} calendarMap={calendarMap} view={view} />
                    </div>
                  </div>
                )
              ) : null}

              {view === "agenda" ? (
                <div className="divide-y divide-border/60">
                  {agendaEvents.length ? (
                    agendaEvents.map((event) => (
                      <AgendaRow key={event.id} event={event} source={calendarMap.get(event.calendarId)} />
                    ))
                  ) : (
                    <p className="p-6 text-sm text-muted-foreground">
                      Für den ausgewählten Zeitraum sind keine Termine geplant.
                    </p>
                  )}
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="max-w-xl">
        <Card className="rounded-3xl border border-border/60 bg-card/70 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Kalenderstatistiken</CardTitle>
            <p className="text-sm text-muted-foreground">
              Überblick über deine Aktivitäten in den letzten Monaten.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {summary.length ? (
              summary.map((item) => (
                <div key={item.id} className="rounded-2xl border border-border/60 bg-background/70 px-3 py-2">
                  <p className="text-sm font-semibold text-foreground">{item.label}</p>
                  <p className="text-lg font-bold text-primary">{item.value}</p>
                  {item.hint ? (
                    <p className="text-xs text-muted-foreground">{item.hint}</p>
                  ) : null}
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">Keine Statistiken verfügbar.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

interface WeekGridProps {
  buckets: DayBucket[];
  calendarMap: Map<string, MemberCalendarSource>;
  view: CalendarView;
  isCompact?: boolean;
}

function WeekGrid({ buckets, calendarMap, view, isCompact = false }: WeekGridProps) {
  if (!buckets.length) {
    return <p className="p-6 text-sm text-muted-foreground">Keine Termine in diesem Zeitraum.</p>;
  }

  const showWeekdays = view === "week";

  if (isCompact) {
    return (
      <div className="flex flex-col gap-4 sm:gap-6">
        {buckets.map((bucket, index) => {
          const bucketId = formatISO(bucket.date, { representation: "date" });
          const dayStart = startOfDay(bucket.date);
          const dayEnd = endOfDay(bucket.date);

          const timedEvents = bucket.events
            .map((event) => {
              const clippedStart = isBefore(event.startDate, dayStart) ? dayStart : event.startDate;
              const clippedEnd = isAfter(event.endDate, dayEnd) ? dayEnd : event.endDate;
              return { event, clippedStart, clippedEnd };
            })
            .filter(({ clippedStart, clippedEnd }) => clippedEnd > dayStart && clippedStart < dayEnd)
            .sort((a, b) => a.clippedStart.getTime() - b.clippedStart.getTime());

          return (
            <section
              key={bucketId}
              className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-muted/15 p-4"
            >
              <header className="flex items-baseline justify-between gap-3">
                <div className="flex flex-col">
                  {showWeekdays ? (
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {WEEKDAY_LABELS[index] ?? format(bucket.date, "EEEE", { locale: de })}
                    </span>
                  ) : null}
                  <span className="text-lg font-semibold text-foreground">
                    {format(bucket.date, "d.")}
                    <span className="ml-1 text-xs text-muted-foreground">
                      {format(bucket.date, "MMM", { locale: de })}
                    </span>
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {bucket.allDay.length + timedEvents.length} Termine
                </span>
              </header>

              <div className="flex flex-col gap-2">
                {bucket.allDay.length ? (
                  bucket.allDay.map((event) => (
                    <InlineEvent
                      key={`all-day-${bucketId}-${event.id}`}
                      event={event}
                      source={calendarMap.get(event.calendarId)}
                    />
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground">Keine Ganztagesereignisse</p>
                )}
              </div>

              <div className="flex flex-col gap-2">
                {timedEvents.length ? (
                  timedEvents.map(({ event, clippedStart, clippedEnd }) => (
                    <CompactTimedEvent
                      key={`${event.id}-${bucketId}`}
                      event={event}
                      start={clippedStart}
                      end={clippedEnd}
                      source={calendarMap.get(event.calendarId)}
                    />
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground">Keine Termine mit Uhrzeit</p>
                )}
              </div>
            </section>
          );
        })}
      </div>
    );
  }

  return (
    <div className="grid" style={{ gridTemplateColumns: `64px repeat(${buckets.length}, minmax(0, 1fr))` }}>
      <div className="border-b border-border/60 bg-muted/30" />
      {buckets.map((bucket, index) => (
        <div key={formatISO(bucket.date, { representation: "date" })} className="border-b border-border/60 bg-muted/30 p-2">
          <div className="flex flex-col">
            {showWeekdays ? (
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {WEEKDAY_LABELS[index] ?? format(bucket.date, "EEEE", { locale: de })}
              </span>
            ) : null}
            <span className="text-lg font-semibold">
              {format(bucket.date, "d.")}
              <span className="ml-1 text-xs text-muted-foreground">{format(bucket.date, "MMM", { locale: de })}</span>
            </span>
          </div>
        </div>
      ))}

      <div className="border-r border-border/60 bg-muted/20" />
      {buckets.map((bucket) => (
        <div key={`all-day-${bucket.date.toISOString()}`} className="border-r border-border/60 bg-muted/20 p-2">
          {bucket.allDay.length ? (
            <div className="space-y-2">
              {bucket.allDay.map((event) => (
                <InlineEvent key={event.id} event={event} source={calendarMap.get(event.calendarId)} />
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Keine Ganztagesereignisse</p>
          )}
        </div>
      ))}

      {HOURS.map((hour) => (
        <Fragment key={`hour-${hour}`}>
          <div className="border-t border-border/60 px-2 py-4 text-right text-xs text-muted-foreground">
            {format(setMinutes(setHours(new Date(), hour), 0), "HH:mm")}
          </div>
          {buckets.map((bucket) => (
            <div key={`${bucket.date.toISOString()}-${hour}`} className="relative border-t border-border/60">
              <HourCell hour={hour} bucket={bucket} calendarMap={calendarMap} />
            </div>
          ))}
        </Fragment>
      ))}
    </div>
  );
}

interface HourCellProps {
  hour: number;
  bucket: DayBucket;
  calendarMap: Map<string, MemberCalendarSource>;
}

function HourCell({ hour, bucket, calendarMap }: HourCellProps) {
  if (!bucket.events.length) return null;
  const dayStart = startOfDay(bucket.date);

  const eventsStartingThisHour = bucket.events.filter((event) => {
    const startsSameDay = isSameDay(event.startDate, bucket.date);
    if (startsSameDay) {
      return event.startDate.getHours() === hour;
    }
    return hour === 0 && event.startDate < dayStart;
  });

  return (
    <>
      {eventsStartingThisHour.map((event) => (
        <TimedEvent
          key={event.id}
          event={event}
          dayStart={dayStart}
          calendarMap={calendarMap}
        />
      ))}
    </>
  );
}

interface TimedEventProps {
  event: PositionedCalendarEvent;
  dayStart: Date;
  calendarMap: Map<string, MemberCalendarSource>;
}

function TimedEvent({ event, dayStart, calendarMap }: TimedEventProps) {
  const width = 100 / event.layout.columns;
  const left = event.layout.column * width;

  const rawStart = differenceInMinutes(event.startDate, dayStart);
  const rawEnd = differenceInMinutes(event.endDate, dayStart);
  const startMinutes = Math.max(0, rawStart);
  const endMinutes = Math.min(24 * 60, Math.max(rawEnd, startMinutes + 15));
  const durationMinutes = Math.max(30, endMinutes - startMinutes);
  const top = (startMinutes / (24 * 60)) * 100;
  const height = (durationMinutes / (24 * 60)) * 100;

  const source = calendarMap.get(event.calendarId);
  const accentColor = source?.color ?? undefined;

  return (
    <div
      className="absolute z-10 overflow-hidden rounded-xl border bg-background/90 p-2 text-xs shadow-md"
      style={{
        top: `${top}%`,
        left: `${left}%`,
        width: `${width}%`,
        height: `${height}%`,
        borderColor: accentColor,
      }}
    >
      <p
        className="line-clamp-2 font-semibold"
        style={accentColor ? { color: accentColor } : undefined}
      >
        {event.title}
      </p>
      <p className="text-[11px] text-muted-foreground">
        {format(event.startDate, "HH:mm", { locale: de })} – {format(event.endDate, "HH:mm", { locale: de })}
      </p>
      {event.location ? (
        <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
          <MapPin className="h-3 w-3" /> {event.location}
        </p>
      ) : null}
    </div>
  );
}

interface CompactTimedEventProps {
  event: PositionedCalendarEvent;
  start: Date;
  end: Date;
  source?: MemberCalendarSource;
}

function CompactTimedEvent({ event, start, end, source }: CompactTimedEventProps) {
  const accentColor = source?.color ?? undefined;
  const note = event.metadata?.note ?? null;
  const badge = event.metadata?.badge ?? null;

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border/60 bg-background/85 p-3">
      <div className="flex items-center justify-between gap-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        <span>
          {format(start, "HH:mm", { locale: de })} – {format(end, "HH:mm", { locale: de })}
        </span>
        {source ? (
          <Badge
            variant="outline"
            className="h-5 rounded-full border-border/60 px-2 py-0 text-[10px] font-semibold"
            style={accentColor ? { borderColor: accentColor, color: accentColor } : undefined}
          >
            {source.label}
          </Badge>
        ) : null}
      </div>
      <p className="text-sm font-semibold" style={accentColor ? { color: accentColor } : undefined}>
        {event.title}
      </p>
      {event.location ? (
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          <MapPin className="h-3 w-3" /> {event.location}
        </p>
      ) : null}
      {note ? <p className="text-xs text-muted-foreground">{note}</p> : null}
      {badge ? (
        <Badge
          variant={resolveBadgeVariant(badge.tone)}
          className="h-5 w-fit rounded-full px-2 py-0 text-[10px] font-semibold"
        >
          {badge.label}
        </Badge>
      ) : null}
    </div>
  );
}

interface InlineEventProps {
  event: CalendarEventWithDates;
  source?: MemberCalendarSource;
}

function InlineEvent({ event, source }: InlineEventProps) {
  const accentColor = source?.color ?? null;
  const note = event.metadata?.note ?? null;
  const badge = event.metadata?.badge ?? null;
  return (
    <div className="flex items-start gap-2 rounded-xl border border-border/60 bg-background/80 px-3 py-2 text-xs">
      <span
        className={cn("mt-1 h-2 w-2 rounded-full", !accentColor && "bg-primary")}
        style={accentColor ? { backgroundColor: accentColor } : undefined}
        aria-hidden
      />
      <div className="min-w-0 flex-1 space-y-1">
        <p className="truncate font-medium text-foreground">{event.title}</p>
        <p className="text-[11px] text-muted-foreground">
          Ganztägig{source ? ` • ${source.label}` : ""}
        </p>
        {note ? <p className="text-[11px] text-muted-foreground/80">{note}</p> : null}
        {badge ? (
          <Badge variant={resolveBadgeVariant(badge.tone)} className="w-fit text-[10px]">
            {badge.label}
          </Badge>
        ) : null}
      </div>
    </div>
  );
}

interface AgendaRowProps {
  event: CalendarEventWithDates;
  source?: MemberCalendarSource;
}

function AgendaRow({ event, source }: AgendaRowProps) {
  const note = event.metadata?.note ?? null;
  const customBadge = event.metadata?.badge ?? null;
  const attendanceStatus = event.metadata?.attendanceStatus ?? null;
  return (
    <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <span
          className="h-3 w-3 rounded-full"
          style={{ backgroundColor: source?.color ?? "var(--primary)" }}
          aria-hidden
        />
        <div className="space-y-1">
          <p className="text-sm font-semibold text-foreground">{event.title}</p>
          <p className="text-xs text-muted-foreground">
            {event.allDay
              ? "Ganztägig"
              : `${format(event.startDate, "EEE, d. MMM · HH:mm", { locale: de })} – ${format(event.endDate, "HH:mm", {
                  locale: de,
                })}`}
            {event.location ? ` · ${event.location}` : ""}
          </p>
          {source ? (
            <p className="text-xs text-muted-foreground/80">{source.label}</p>
          ) : null}
          {note ? <p className="text-xs text-muted-foreground/80">{note}</p> : null}
        </div>
      </div>
      {attendanceStatus || customBadge ? (
        <div className="flex flex-wrap items-center gap-2">
          {attendanceStatus ? (
            <Badge variant="outline" className="w-fit">
              Status: {attendanceStatus}
            </Badge>
          ) : null}
          {customBadge ? (
            <Badge variant={resolveBadgeVariant(customBadge.tone)} className="w-fit">
              {customBadge.label}
            </Badge>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
