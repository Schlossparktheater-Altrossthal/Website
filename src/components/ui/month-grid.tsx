"use client";

import * as React from "react";
import {
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
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
  /** `strong` = Probentag, `faint` = Randtag. */
  emphasis?: "strong" | "normal" | "faint";
  markers?: MonthGridMarker[];
  /** Durchgehendes Band am unteren Rand: Endprobenwoche oder Ferien. */
  band?: "final" | "holiday";
  isToday?: boolean;
  disabled?: boolean;
  /** Zusatz für Screenreader, z. B. „Probentag, Termin: Vorstellung“. */
  description?: string;
};

type MonthGridProps = {
  month: Date;
  getDayState: (key: string, date: Date) => MonthGridDayState;
  selectedKey?: string | null;
  onSelect?: (key: string, date: Date) => void;
  /** Wochentage, deren Spaltenkopf betont wird (z. B. Probentage). */
  emphasizedWeekdays?: ReadonlySet<number>;
  size?: "sm" | "md";
  className?: string;
};

const MARKER_CLASS: Record<MonthGridMarker, string> = {
  event: "bg-primary",
  rehearsal: "bg-info",
};

/**
 * Kompakter Monatskalender (Mo–So). Passt mobil ohne horizontales Scrollen; Status als
 * getönte Fläche, Termine als Punkte, Zeiträume als Band.
 */
export function MonthGrid({
  month,
  getDayState,
  selectedKey,
  onSelect,
  emphasizedWeekdays,
  size = "md",
  className,
}: MonthGridProps) {
  const days = React.useMemo(
    () =>
      eachDayOfInterval({
        start: startOfWeek(startOfMonth(month), { weekStartsOn: 1 }),
        end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }),
      }),
    [month],
  );

  return (
    <div className={cn("w-full", className)}>
      <div className="grid grid-cols-7 gap-1 pb-1" aria-hidden>
        {WEEKDAY_HEADERS.map((weekday) => (
          <span
            key={weekday.value}
            className={cn(
              "text-center text-[0.6875rem] font-medium uppercase tracking-wide",
              emphasizedWeekdays?.has(weekday.value) ? "text-foreground" : "text-muted-foreground",
            )}
          >
            {weekday.label}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1" role="grid" aria-label={ARIA_MONTH.format(month)}>
        {days.map((date) => {
          const key = format(date, "yyyy-MM-dd");
          const inMonth = isSameMonth(date, month);
          const state = getDayState(key, date);
          const selected = selectedKey === key;
          const status = state.status && state.status !== "free" ? state.status : null;
          const labelParts = [
            ARIA_DATE.format(date),
            status ? AVAILABILITY_STATUS[status].label : null,
            state.description,
          ].filter(Boolean);

          return (
            <button
              key={key}
              type="button"
              role="gridcell"
              aria-selected={selected}
              aria-label={labelParts.join(", ")}
              aria-current={state.isToday ? "date" : undefined}
              disabled={!onSelect || state.disabled}
              onClick={() => onSelect?.(key, date)}
              className={cn(
                "relative flex flex-col items-center overflow-hidden rounded-md border text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default",
                size === "sm" ? "h-11 pt-1" : "h-12 pt-1.5 sm:h-16 sm:items-start sm:px-2",
                status ? AVAILABILITY_STATUS[status].surface : "bg-card",
                state.emphasis === "faint" && !status && "bg-transparent",
                state.emphasis === "strong" && !status && "bg-muted/60",
                selected ? "border-primary ring-1 ring-primary" : "border-transparent",
                onSelect && !state.disabled && "hover:border-border",
                !inMonth && "opacity-40",
              )}
            >
              <span
                className={cn(
                  "flex h-6 min-w-6 items-center justify-center rounded-full px-1 tabular-nums leading-none",
                  state.emphasis === "strong" ? "font-semibold text-foreground" : "",
                  state.emphasis === "faint" ? "text-muted-foreground" : "",
                  status && AVAILABILITY_STATUS[status].text,
                  state.isToday && "bg-primary font-semibold text-primary-foreground",
                )}
              >
                {date.getDate()}
              </span>
              {state.markers?.length ? (
                <span className="mt-auto mb-1.5 flex gap-0.5 sm:mb-2" aria-hidden>
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
                    state.band === "final" ? "bg-primary" : "bg-info/60",
                  )}
                />
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
