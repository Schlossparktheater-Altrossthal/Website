"use client";

import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  getISOWeek,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import type { Locale } from "date-fns";
import { de } from "date-fns/locale/de";
import {
  type AriaAttributes,
  type ButtonHTMLAttributes,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const CALENDAR_DATE_FORMAT = "yyyy-MM-dd";

export interface CalendarDay {
  date: Date;
  key: string;
  weekNumber: number;
  isCurrentMonth: boolean;
  isToday: boolean;
}

export interface CalendarWeek {
  weekStart: Date;
  weekNumber: number;
  days: Date[];
}

export interface CalendarDayRenderResult
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children" | "content"> {
  content?: ReactNode;
}

export interface MonthCalendarProps {
  month?: Date;
  defaultMonth?: Date;
  onMonthChange?: (nextMonth: Date) => void;
  transitionDirection?: "left" | "right";
  weekStartsOn?: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  locale?: Locale;
  monthLabelFormat?: string;
  weekdayFormat?: string;
  renderWeekdayLabel?: (date: Date, index: number) => ReactNode;
  renderWeekNumber?: (week: CalendarWeek) => ReactNode;
  renderDay?: (day: CalendarDay) => CalendarDayRenderResult | undefined;
  renderDayNumber?: (day: CalendarDay) => ReactNode;
  title?: ReactNode;
  subtitle?: ReactNode;
  headerActions?: ReactNode;
  todayLabel?: string;
  showTodayButton?: boolean;
  showWeekNumbers?: boolean;
  className?: string;
  contentClassName?: string;
  minGridWidthClassName?: string;
  dayClassName?: string;
  additionalContent?: ReactNode;
}

const DEFAULT_WEEKDAY_FORMAT = "EEE";
const DEFAULT_MONTH_LABEL_FORMAT = "MMMM yyyy";

const WEEKEND_DAY_INDICES = new Set<number>([5, 6, 0]);

export function MonthCalendar({
  month,
  defaultMonth,
  onMonthChange,
  transitionDirection,
  weekStartsOn = 1,
  locale = de,
  monthLabelFormat = DEFAULT_MONTH_LABEL_FORMAT,
  weekdayFormat = DEFAULT_WEEKDAY_FORMAT,
  renderWeekdayLabel,
  renderWeekNumber,
  renderDay,
  renderDayNumber,
  title,
  subtitle,
  headerActions,
  todayLabel = "Heute",
  showTodayButton = true,
  showWeekNumbers = true,
  className,
  contentClassName,
  minGridWidthClassName = "min-w-[540px] sm:min-w-[640px]",
  dayClassName,
  additionalContent,
}: MonthCalendarProps) {
  const initialMonth = useMemo(
    () => startOfMonth(month ?? defaultMonth ?? new Date()),
    [defaultMonth, month]
  );

  const [internalMonth, setInternalMonth] = useState<Date>(initialMonth);
  const [internalDirection, setInternalDirection] = useState<"left" | "right">(
    "right"
  );
  const previousMonthRef = useRef<Date>(initialMonth);

  useEffect(() => {
    if (month) {
      const normalized = startOfMonth(month);
      if (!transitionDirection) {
        const previous = previousMonthRef.current;
        if (previous) {
          setInternalDirection(
            normalized.getTime() >= previous.getTime() ? "right" : "left"
          );
        }
      }
      previousMonthRef.current = normalized;
    }
  }, [month, transitionDirection]);

  useEffect(() => {
    if (!month) {
      previousMonthRef.current = internalMonth;
    }
  }, [internalMonth, month]);

  const displayedMonth = month ? startOfMonth(month) : internalMonth;
  const resolvedDirection = transitionDirection ?? internalDirection;

  const monthLabel = useMemo(
    () => format(displayedMonth, monthLabelFormat, { locale }),
    [displayedMonth, locale, monthLabelFormat]
  );

  const weekDayMeta = useMemo(() => {
    const start = startOfWeek(displayedMonth, { weekStartsOn });
    return Array.from({ length: 7 }, (_, index) => {
      const date = addDays(start, index);
      const label = renderWeekdayLabel
        ? renderWeekdayLabel(date, index)
        : format(date, weekdayFormat, { locale });
      const weekday = date.getDay();
      return {
        date,
        label,
        weekday,
        isWeekend: WEEKEND_DAY_INDICES.has(weekday),
      };
    });
  }, [displayedMonth, locale, renderWeekdayLabel, weekStartsOn, weekdayFormat]);

  const daysInView = useMemo(() => {
    const firstDayOfMonth = startOfMonth(displayedMonth);
    const lastDayOfMonth = endOfMonth(displayedMonth);
    const gridStart = startOfWeek(firstDayOfMonth, { weekStartsOn });
    const gridEnd = endOfWeek(lastDayOfMonth, { weekStartsOn });
    return eachDayOfInterval({ start: gridStart, end: gridEnd });
  }, [displayedMonth, weekStartsOn]);

  const weeksInView = useMemo<CalendarWeek[]>(() => {
    const weeks: CalendarWeek[] = [];
    for (let index = 0; index < daysInView.length; index += 7) {
      const weekDays = daysInView.slice(index, index + 7);
      if (weekDays.length === 0) continue;
      weeks.push({
        weekStart: weekDays[0],
        weekNumber: getISOWeek(weekDays[0]),
        days: weekDays,
      });
    }
    return weeks;
  }, [daysInView]);

  const updateMonth = (next: Date, direction: "left" | "right") => {
    const normalized = startOfMonth(next);
    if (!month) {
      setInternalMonth(normalized);
    }
    if (!transitionDirection) {
      setInternalDirection(direction);
    }
    onMonthChange?.(normalized);
  };

  const goToday = () => {
    const todayMonth = startOfMonth(new Date());
    updateMonth(
      todayMonth,
      todayMonth.getTime() >= displayedMonth.getTime() ? "right" : "left"
    );
  };

  const goPrevMonth = () => {
    updateMonth(addMonths(displayedMonth, -1), "left");
  };

  const goNextMonth = () => {
    updateMonth(addMonths(displayedMonth, 1), "right");
  };

  const headerTitle = title ?? monthLabel;

  const weekdayHeaderClass = showWeekNumbers
    ? "grid grid-cols-[repeat(7,minmax(0,1fr))] gap-1 sm:grid-cols-[64px_repeat(7,minmax(0,1fr))] sm:gap-1.5"
    : "grid grid-cols-[repeat(7,minmax(0,1fr))] gap-1 sm:gap-1.5";

  const weekRowClass = showWeekNumbers
    ? "grid grid-cols-7 gap-1 sm:grid-cols-[64px_repeat(7,minmax(0,1fr))] sm:gap-1.5"
    : "grid grid-cols-7 gap-1 sm:gap-1.5";

  return (
    <div className={cn("w-full rounded-xl border bg-card shadow-sm", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/40 px-4 py-3">
        <div className="space-y-1">
          {typeof headerTitle === "string" ? (
            <h2 className="text-xl font-semibold">{headerTitle}</h2>
          ) : (
            headerTitle
          )}
          {subtitle ? (
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {showTodayButton ? (
            <Button type="button" variant="outline" size="sm" onClick={goToday}>
              {todayLabel}
            </Button>
          ) : null}
          <div className="flex items-center rounded-md border">
            <button
              type="button"
              onClick={goPrevMonth}
              className="p-2 text-sm text-muted-foreground transition hover:text-foreground"
              aria-label="Vorheriger Monat"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={goNextMonth}
              className="p-2 text-sm text-muted-foreground transition hover:text-foreground"
              aria-label="Nächster Monat"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          {headerActions}
        </div>
      </div>
      <div className="overflow-x-auto">
        <div
          className={cn(
            minGridWidthClassName,
            "space-y-3 p-2.5 sm:p-4",
            contentClassName
          )}
        >
          <div
            className={cn(
              weekdayHeaderClass,
              "text-center text-[11px] font-medium uppercase tracking-wide text-muted-foreground sm:text-xs"
            )}
          >
            {showWeekNumbers ? (
              <div className="hidden py-2 text-[11px] sm:block">KW</div>
            ) : null}
            {weekDayMeta.map(({ label, weekday, isWeekend }, index) => (
              <div
                key={index}
                className="calendar-weekday rounded-lg px-2 py-2"
                data-weekday={weekday}
                data-weekend={isWeekend ? "true" : undefined}
              >
                {label}
              </div>
            ))}
          </div>
          <div
            key={format(displayedMonth, "yyyy-MM")}
            className={cn(
              "space-y-1.5 text-sm calendar-month-enter",
              resolvedDirection === "right"
                ? "calendar-month-from-right"
                : "calendar-month-from-left"
            )}
          >
            {weeksInView.map((week) => (
              <div key={week.weekStart.toISOString()} className={weekRowClass}>
                {showWeekNumbers ? (
                  <div className="hidden items-center justify-center rounded-lg bg-muted/40 px-2 py-2 text-[11px] font-semibold text-muted-foreground sm:flex">
                    {renderWeekNumber ? renderWeekNumber(week) : <>KW {week.weekNumber}</>}
                  </div>
                ) : null}
                {week.days.map((day) => {
                  const key = format(day, CALENDAR_DATE_FORMAT);
                  const isCurrentMonth = isSameMonth(day, displayedMonth);
                  const weekday = day.getDay();
                  const isWeekend = WEEKEND_DAY_INDICES.has(weekday);
                  const dayInfo: CalendarDay = {
                    date: day,
                    key,
                    weekNumber: week.weekNumber,
                    isCurrentMonth,
                    isToday: isToday(day),
                  };
                  const result = renderDay?.(dayInfo) ?? {};
                  const {
                    content,
                    className: daySpecificClass,
                    type: buttonType,
                    ["aria-label"]: ariaLabelProp,
                    ["aria-current"]: ariaCurrentProp,
                    ...restButtonProps
                  } = result;
                  const ariaLabel =
                    ariaLabelProp ??
                    format(day, "EEEE, d. MMMM yyyy", { locale });
                  const ariaCurrent = ariaCurrentProp ?? (dayInfo.isToday ? "date" : undefined);
                  const dayNumberContent = renderDayNumber
                    ? renderDayNumber(dayInfo)
                    : format(day, "d", { locale });
                  const finalClassName = cn(
                    "calendar-cell relative flex min-h-[68px] flex-col gap-1 overflow-hidden rounded-lg border bg-background p-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-[96px] sm:p-3",
                    !isCurrentMonth && "text-muted-foreground/60",
                    dayClassName,
                    daySpecificClass
                  );
                  return (
                    <button
                      key={key}
                      type={buttonType ?? "button"}
                      aria-label={ariaLabel}
                      aria-current={ariaCurrent as AriaAttributes["aria-current"]}
                      {...restButtonProps}
                      className={finalClassName}
                      data-date={key}
                      data-today={dayInfo.isToday ? "true" : undefined}
                      data-current-month={dayInfo.isCurrentMonth ? "true" : undefined}
                      data-weekday={weekday}
                      data-weekend={isWeekend ? "true" : undefined}
                    >
                      <span className="text-[11px] font-medium sm:text-xs">{dayNumberContent}</span>
                      {content}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
          {additionalContent}
        </div>
      </div>
      <style jsx global>{`
        @keyframes calendarCellPop { 0% { transform: scale(0.96); } 100% { transform: scale(1); } }
        @keyframes calendarAddedFlash { 0% { box-shadow: 0 0 0 0 rgba(34,197,94,.55); } 100% { box-shadow: 0 0 0 12px rgba(34,197,94,0); } }
        @keyframes calendarRemovedFlash { 0% { background-color: rgba(239,68,68,.15); } 100% { background-color: transparent; } }
        @keyframes calendarMonthInRight { 0% { opacity: 0; transform: translateX(24px);} 100% { opacity: 1; transform: translateX(0);} }
        @keyframes calendarMonthInLeft { 0% { opacity: 0; transform: translateX(-24px);} 100% { opacity: 1; transform: translateX(0);} }
        .calendar-weekday[data-weekend="true"] {
          background: linear-gradient(120deg, rgba(129,140,248,.14), rgba(129,140,248,.04));
          color: rgba(67,56,202,.9);
        }
        .dark .calendar-weekday[data-weekend="true"] {
          background: linear-gradient(120deg, rgba(129,140,248,.22), rgba(99,102,241,.08));
          color: rgba(224,231,255,.92);
        }
        .calendar-cell { position: relative; transition: transform .18s ease, box-shadow .18s ease, border-color .18s ease; }
        .calendar-cell[data-weekend="true"] {
          background-image: linear-gradient(135deg, rgba(129,140,248,.12), rgba(129,140,248,0));
        }
        .dark .calendar-cell[data-weekend="true"] {
          background-image: linear-gradient(135deg, rgba(99,102,241,.18), rgba(129,140,248,.06));
        }
        .calendar-cell:hover { border-color: rgba(99,102,241,.55); transform: translateY(-2px) scale(1.01); box-shadow: 0 16px 28px -18px rgba(79,70,229,.65); }
        .dark .calendar-cell:hover { border-color: rgba(165,180,252,.75); box-shadow: 0 16px 32px -16px rgba(30,64,175,.65); }
        .calendar-month-enter { will-change: transform, opacity; }
        @media (prefers-reduced-motion: no-preference) {
          .calendar-month-enter.calendar-month-from-right { animation: calendarMonthInRight .32s ease-out; }
          .calendar-month-enter.calendar-month-from-left  { animation: calendarMonthInLeft  .32s ease-out; }
        }
      `}</style>
    </div>
  );
}
