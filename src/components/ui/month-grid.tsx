"use client";

import * as React from "react";
import {
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  getISOWeek,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from "date-fns";

import { AVAILABILITY_STATUS, type AvailabilityStatus } from "@/components/ui/availability-status";
import { cn } from "@/lib/utils";

const WEEKDAY_HEADERS = [
  { value: 1, label: "Mo" },
  { value: 2, label: "Di" },
  { value: 3, label: "Mi" },
  { value: 4, label: "Do" },
  { value: 5, label: "Fr" },
  { value: 6, label: "Sa" },
  { value: 0, label: "So" },
];

const ARIA_MONTH = new Intl.DateTimeFormat("de-DE", { month: "long", year: "numeric" });
const ARIA_DATE = new Intl.DateTimeFormat("de-DE", {
  weekday: "long",
  day: "numeric",
  month: "long",
});

export type MonthGridMarker = "event" | "rehearsal";

export type MonthGridDayState = {
  status?: AvailabilityStatus;
  /** `strong` = Kerntag, `faint` = Randtag. */
  emphasis?: "strong" | "normal" | "faint";
  markers?: MonthGridMarker[];
  /** Durchgehendes Band am unteren Rand: Endprobenwoche oder Ferien. */
  band?: "final" | "holiday";
  isToday?: boolean;
  disabled?: boolean;
  /** Zusatz für Screenreader, z. B. „Kerntag, Termin: Vorstellung“. */
  description?: string;
};

type MonthGridProps = {
  month: Date;
  getDayState: (key: string, date: Date) => MonthGridDayState;
  selectedKey?: string | null;
  /** Mehrfachauswahl, z. B. mehrere Tage auf einmal sperren. */
  selectedKeys?: ReadonlySet<string>;
  onSelect?: (key: string, date: Date) => void;
  /** Wochentage, deren Spaltenkopf betont wird (z. B. Kerntage). */
  emphasizedWeekdays?: ReadonlySet<number>;
  /** Kalenderwochen als erste Spalte. */
  showWeekNumbers?: boolean;
  /**
   * Zusätzlicher Inhalt pro Tag (Termine, Status als Text). Wird nur ab `lg` gezeigt;
   * darunter bleiben Punkte, damit das Raster mobil ohne Scrollen passt.
   */
  renderDetails?: (key: string, date: Date) => React.ReactNode;
  className?: string;
};

const MARKER_CLASS: Record<MonthGridMarker, string> = {
  event: "bg-primary",
  rehearsal: "bg-info",
};

/**
 * Monatskalender (Mo–So) nach dem Vorbild moderner Kalender-Apps: mobil große Tipp-Flächen
 * mit Punkten, am Desktop höhere Zellen mit Details. Status als getönte Fläche, Zeiträume als Band.
 */
export function MonthGrid({
  month,
  getDayState,
  selectedKey,
  selectedKeys,
  onSelect,
  emphasizedWeekdays,
  showWeekNumbers = false,
  renderDetails,
  className,
}: MonthGridProps) {
  const weeks = React.useMemo(() => {
    const days = eachDayOfInterval({
      start: startOfWeek(startOfMonth(month), { weekStartsOn: 1 }),
      end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }),
    });
    const result: Date[][] = [];
    for (let index = 0; index < days.length; index += 7) {
      result.push(days.slice(index, index + 7));
    }
    return result;
  }, [month]);

  const columns = showWeekNumbers
    ? "grid-cols-[1.75rem_repeat(7,minmax(0,1fr))] lg:grid-cols-[2.5rem_repeat(7,minmax(0,1fr))]"
    : "grid-cols-7";

  return (
    <div className={cn("w-full", className)} role="grid" aria-label={ARIA_MONTH.format(month)}>
      <div className={cn("grid gap-1 pb-1.5 sm:gap-1.5", columns)} role="row">
        {showWeekNumbers ? (
          <span
            role="columnheader"
            className="text-center text-[0.625rem] font-medium uppercase text-muted-foreground"
          >
            KW
          </span>
        ) : null}
        {WEEKDAY_HEADERS.map((weekday) => (
          <span
            key={weekday.value}
            role="columnheader"
            className={cn(
              "text-center text-[0.6875rem] font-medium uppercase tracking-wide lg:text-left lg:px-2",
              emphasizedWeekdays?.has(weekday.value) ? "text-foreground" : "text-muted-foreground",
            )}
          >
            {weekday.label}
          </span>
        ))}
      </div>
      <div className="space-y-1 sm:space-y-1.5">
        {weeks.map((week) => (
          <div
            key={week[0]?.toISOString()}
            className={cn("grid gap-1 sm:gap-1.5", columns)}
            role="row"
          >
            {showWeekNumbers && week[0] ? (
              <span
                role="rowheader"
                className="flex items-start justify-center pt-3 text-[0.6875rem] tabular-nums text-muted-foreground lg:pt-2"
                aria-label={`Kalenderwoche ${getISOWeek(week[0])}`}
              >
                {getISOWeek(week[0])}
              </span>
            ) : null}
            {week.map((date) => (
              <DayCell
                key={date.toISOString()}
                date={date}
                inMonth={isSameMonth(date, month)}
                state={getDayState(format(date, "yyyy-MM-dd"), date)}
                selected={
                  selectedKey === format(date, "yyyy-MM-dd") ||
                  Boolean(selectedKeys?.has(format(date, "yyyy-MM-dd")))
                }
                onSelect={onSelect}
                details={renderDetails?.(format(date, "yyyy-MM-dd"), date)}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function DayCell({
  date,
  inMonth,
  state,
  selected,
  onSelect,
  details,
}: {
  date: Date;
  inMonth: boolean;
  state: MonthGridDayState;
  selected: boolean;
  onSelect?: (key: string, date: Date) => void;
  details?: React.ReactNode;
}) {
  const key = format(date, "yyyy-MM-dd");
  const status = state.status && state.status !== "free" ? state.status : null;
  const label = [
    ARIA_DATE.format(date),
    status ? AVAILABILITY_STATUS[status].label : null,
    state.description,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <button
      type="button"
      role="gridcell"
      aria-selected={selected}
      aria-label={label}
      aria-current={state.isToday ? "date" : undefined}
      disabled={!onSelect || state.disabled}
      onClick={() => onSelect?.(key, date)}
      className={cn(
        // Mobil: mind. 52 px hohe Tipp-Fläche; Desktop: hohe Zelle mit Details.
        "relative flex h-13 min-w-0 flex-col items-center overflow-hidden rounded-lg border pt-1.5 text-sm transition-[color,background-color,border-color,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.97] disabled:cursor-default lg:h-24 lg:items-stretch lg:px-2 lg:pt-1.5 lg:active:scale-100",
        status
          ? cn(AVAILABILITY_STATUS[status].surface, "border-transparent")
          : state.emphasis === "strong"
            ? "border-border bg-muted"
            : state.emphasis === "faint"
              ? "border-border/40 bg-transparent"
              : "border-border/70 bg-card",
        selected && "border-primary ring-2 ring-primary/40",
        onSelect && !state.disabled && !selected && "hover:border-foreground/30",
        !inMonth && "opacity-40",
      )}
    >
      <span className="flex items-center justify-center lg:justify-start">
        <span
          className={cn(
            "flex h-7 min-w-7 items-center justify-center rounded-full px-1 tabular-nums leading-none lg:h-6 lg:min-w-6",
            state.emphasis === "strong" ? "font-semibold text-foreground" : "",
            state.emphasis === "faint" ? "text-muted-foreground" : "",
            status && AVAILABILITY_STATUS[status].text,
            status && "font-semibold",
            state.isToday && "bg-primary font-semibold text-primary-foreground",
          )}
        >
          {date.getDate()}
        </span>
      </span>
      {details ? (
        <span className="mt-1 hidden min-h-0 flex-1 flex-col gap-0.5 overflow-hidden text-left lg:flex">
          {details}
        </span>
      ) : null}
      {state.markers?.length ? (
        <span className={cn("mb-2 mt-auto flex gap-1", details && "lg:hidden")} aria-hidden>
          {state.markers.slice(0, 3).map((marker, index) => (
            <span
              key={`${marker}-${index}`}
              className={cn("h-1.5 w-1.5 rounded-full", MARKER_CLASS[marker])}
            />
          ))}
        </span>
      ) : null}
      {state.band ? (
        <span
          aria-hidden
          className={cn(
            "absolute inset-x-0 bottom-0 h-1",
            state.band === "final" ? "bg-primary" : "bg-info/70",
          )}
        />
      ) : null}
    </button>
  );
}
