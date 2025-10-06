"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ComponentProps, CSSProperties } from "react";
import {
  addDays,
  addWeeks,
  endOfWeek,
  format,
  getDay,
  parse,
  parseISO,
  setHours,
  setMinutes,
  startOfDay,
  startOfWeek,
} from "date-fns";
import { de } from "date-fns/locale/de";
import type { EventProps, EventPropGetter, Formats, Messages } from "react-big-calendar";
import {
  Calendar as BigCalendar,
  Views,
  dateFnsLocalizer,
} from "react-big-calendar";
import { ChevronLeft, ChevronRight, MapPin } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { cn } from "@/lib/utils";

import {
  type MemberCalendarEvent,
  type MemberCalendarEventBadgeTone,
  type MemberCalendarSource,
  type MemberCalendarSummaryItem,
} from "./types";

interface CalendarClientProps {
  initialDate: string;
  calendars: MemberCalendarSource[];
  events: MemberCalendarEvent[];
  summary: MemberCalendarSummaryItem[];
}

type CalendarView = "day" | "week" | "agenda";

type DeviceKind = "mobile" | "tablet" | "desktop";

type CalendarEventWithDates = Omit<MemberCalendarEvent, "start" | "end"> & {
  startIso: string;
  endIso: string | null;
  startDate: Date;
  endDate: Date;
};

type BigCalendarEvent = CalendarEventWithDates & {
  start: Date;
  end: Date;
};

type CalendarEventStyle = CSSProperties & {
  "--member-calendar-accent"?: string;
};

const AGENDA_RANGE_DAYS = 60;

const localizer = dateFnsLocalizer({
  format,
  parse: (value: string, formatString: string) =>
    parse(value, formatString, new Date(), { locale: de }),
  startOfWeek: (date: Date) => startOfWeek(date, { weekStartsOn: 1 }),
  getDay,
  locales: { de },
});

const calendarMessages: Messages<BigCalendarEvent> = {
  today: "Heute",
  previous: "Zurück",
  next: "Vor",
  month: "Monat",
  week: "Woche",
  day: "Tag",
  agenda: "Agenda",
  showMore: (total) => `+${total} mehr`,
  allDay: "Ganztägig",
  date: "Datum",
  time: "Zeit",
  event: "Termin",
  noEventsInRange: "Keine Termine im ausgewählten Zeitraum.",
};

const calendarFormats: Formats = {
  dayFormat: (date, culture, loc) => loc?.format(date, "EEEE, d. MMM", culture) ?? "",
  weekdayFormat: (date, culture, loc) => loc?.format(date, "EEE", culture) ?? "",
  timeGutterFormat: (date, culture, loc) => loc?.format(date, "HH:mm", culture) ?? "",
  agendaDateFormat: (date, culture, loc) => loc?.format(date, "EEEE, d. MMM", culture) ?? "",
  agendaTimeRangeFormat: ({ start, end }, culture, loc) =>
    `${loc?.format(start, "HH:mm", culture) ?? ""} – ${loc?.format(end, "HH:mm", culture) ?? ""}`,
  eventTimeRangeFormat: ({ start, end }, culture, loc) =>
    `${loc?.format(start, "HH:mm", culture) ?? ""} – ${loc?.format(end, "HH:mm", culture) ?? ""}`,
  eventTimeRangeStartFormat: ({ start }, culture, loc) => loc?.format(start, "HH:mm", culture) ?? "",
  eventTimeRangeEndFormat: ({ end }, culture, loc) => loc?.format(end, "HH:mm", culture) ?? "",
};

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
        const { start: startIso, end: endIso, ...rest } = event;
        const startDate = parseISO(startIso);
        const endDate = endIso ? parseISO(endIso) : startDate;
        return {
          ...rest,
          startIso,
          endIso,
          startDate,
          endDate,
        } satisfies CalendarEventWithDates;
      })
      .sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
  }, [events]);

  const activeEvents = useMemo(() => {
    return parsedEvents.filter((event) => activeCalendarIds.includes(event.calendarId));
  }, [parsedEvents, activeCalendarIds]);

  const bigCalendarEvents = useMemo<BigCalendarEvent[]>(() => {
    return activeEvents.map((event) => {
      const start = event.startDate;
      const end = event.allDay ? addDays(startOfDay(event.endDate), 1) : event.endDate;
      return {
        ...event,
        start,
        end,
      } satisfies BigCalendarEvent;
    });
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
    return activeEvents.filter((event) => {
      const eventStart = event.startDate;
      const eventEnd = event.endDate;
      return eventStart <= end && eventEnd >= start;
    });
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

  const eventPropGetter = useCallback<EventPropGetter<BigCalendarEvent>>(
    (event) => {
      const source = calendarMap.get(event.calendarId);
      const accentColor = source?.color;
      const style: CalendarEventStyle = {};

      if (accentColor) {
        style["--member-calendar-accent"] = accentColor;
      }

      return {
        className: cn(
          "member-calendar-event",
          event.allDay ? "member-calendar-event--all-day" : "member-calendar-event--timed",
        ),
        style,
      };
    },
    [calendarMap],
  );

  const calendarComponents = useMemo(() => {
    return {
      toolbar: () => null,
      event: (props: EventProps<BigCalendarEvent>) => (
        <CalendarEventContent {...props} calendarMap={calendarMap} />
      ),
      agenda: {
        event: (props: EventProps<BigCalendarEvent>) => (
          <AgendaEventContent {...props} calendarMap={calendarMap} />
        ),
      },
    };
  }, [calendarMap]);

  const calendarHeight = useMemo(() => {
    if (deviceKind === "desktop") return 720;
    if (deviceKind === "tablet") return 640;
    return 560;
  }, [deviceKind]);

  const minTime = useMemo(() => setHours(setMinutes(new Date(), 0), 7), []);
  const maxTime = useMemo(() => setHours(setMinutes(new Date(), 0), 23), []);
  const scrollToTime = useMemo(() => setHours(setMinutes(new Date(), 0), 9), []);

  return (
    <section className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <div className="order-2 flex flex-col gap-6 lg:order-1">
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

        <div className="order-1 space-y-4 lg:order-2">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" onClick={() => handleNavigate("previous")} aria-label="Zurück">
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
              <div className="member-calendar">
                <BigCalendar<BigCalendarEvent>
                  culture="de"
                  localizer={localizer}
                  date={currentDate}
                  onNavigate={(nextDate) => setCurrentDate(nextDate)}
                  view={view}
                  onView={(nextView) => handleViewChange(nextView as CalendarView)}
                  events={bigCalendarEvents}
                  views={[Views.DAY, Views.WEEK, Views.AGENDA]}
                  components={calendarComponents}
                  eventPropGetter={eventPropGetter}
                  messages={calendarMessages}
                  formats={calendarFormats}
                  step={30}
                  timeslots={2}
                  dayLayoutAlgorithm="no-overlap"
                  length={AGENDA_RANGE_DAYS}
                  min={minTime}
                  max={maxTime}
                  scrollToTime={scrollToTime}
                  popup
                  style={{ height: calendarHeight }}
                />
              </div>
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
                  {item.hint ? <p className="text-xs text-muted-foreground">{item.hint}</p> : null}
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

interface CalendarEventComponentProps extends EventProps<BigCalendarEvent> {
  calendarMap: Map<string, MemberCalendarSource>;
}

function CalendarEventContent({ event, calendarMap }: CalendarEventComponentProps) {
  const source = calendarMap.get(event.calendarId);
  const accentColor = source?.color ?? undefined;
  const attendance = event.metadata?.attendanceStatus ?? null;
  const note = event.metadata?.note ?? null;
  const badge = event.metadata?.badge ?? null;
  const timeLabel = event.allDay
    ? `Ganztägig${source ? ` • ${source.label}` : ""}`
    : `${format(event.startDate, "HH:mm", { locale: de })} – ${format(event.endDate, "HH:mm", { locale: de })}`;

  return (
    <div className="member-calendar-event-content flex h-full flex-col justify-between gap-2 rounded-[0.9rem] bg-background/95 p-2 text-xs">
      <div className="space-y-1">
        <p
          className="member-calendar-event-title line-clamp-2 text-sm font-semibold leading-tight"
          style={accentColor ? { color: accentColor } : undefined}
        >
          {event.title}
        </p>
        <p className="member-calendar-event-meta text-[11px] text-muted-foreground">{timeLabel}</p>
        {event.location ? (
          <p className="member-calendar-event-location flex items-center gap-1 text-[11px] text-muted-foreground">
            <MapPin className="h-3 w-3" /> {event.location}
          </p>
        ) : null}
        {note ? (
          <p className="member-calendar-event-note line-clamp-2 text-[11px] text-muted-foreground/90">{note}</p>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-1">
        {attendance ? (
          <Badge
            variant="outline"
            className="member-calendar-event-attendance-badge rounded-full px-2 py-0 text-[10px]"
            style={accentColor ? { borderColor: accentColor, color: accentColor } : undefined}
          >
            {attendance}
          </Badge>
        ) : null}
        {badge ? (
          <Badge
            variant={resolveBadgeVariant(badge.tone)}
            className="member-calendar-event-badge rounded-full px-2 py-0 text-[10px]"
          >
            {badge.label}
          </Badge>
        ) : null}
      </div>
    </div>
  );
}

function AgendaEventContent({ event, calendarMap }: CalendarEventComponentProps) {
  const source = calendarMap.get(event.calendarId);
  const accentColor = source?.color ?? undefined;
  const attendance = event.metadata?.attendanceStatus ?? null;
  const note = event.metadata?.note ?? null;
  const badge = event.metadata?.badge ?? null;

  return (
    <div className="member-calendar-agenda-event flex flex-col gap-2 rounded-2xl border border-border/60 bg-background/85 px-3 py-2 text-xs">
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1">
          <p
            className="member-calendar-event-title text-sm font-semibold"
            style={accentColor ? { color: accentColor } : undefined}
          >
            {event.title}
          </p>
          <p className="member-calendar-event-meta text-[11px] text-muted-foreground">
            {format(event.startDate, "EEEE, d. MMMM yyyy", { locale: de })}
          </p>
          <p className="member-calendar-event-meta text-[11px] text-muted-foreground">
            {event.allDay
              ? "Ganztägig"
              : `${format(event.startDate, "HH:mm", { locale: de })} – ${format(event.endDate, "HH:mm", { locale: de })}`}
          </p>
          {event.location ? (
            <p className="member-calendar-event-location flex items-center gap-1 text-[11px] text-muted-foreground">
              <MapPin className="h-3 w-3" /> {event.location}
            </p>
          ) : null}
        </div>
        {source ? (
          <Badge
            variant="outline"
            className="member-calendar-agenda-source-badge h-fit rounded-full px-2 py-0 text-[10px]"
            style={accentColor ? { borderColor: accentColor, color: accentColor } : undefined}
          >
            {source.label}
          </Badge>
        ) : null}
      </div>
      {note ? <p className="member-calendar-event-note text-[11px] text-muted-foreground/90">{note}</p> : null}
      <div className="flex flex-wrap gap-1">
        {attendance ? (
          <Badge variant="secondary" className="member-calendar-event-badge rounded-full px-2 py-0 text-[10px]">
            {attendance}
          </Badge>
        ) : null}
        {badge ? (
          <Badge
            variant={resolveBadgeVariant(badge.tone)}
            className="member-calendar-event-badge rounded-full px-2 py-0 text-[10px]"
          >
            {badge.label}
          </Badge>
        ) : null}
      </div>
    </div>
  );
}
