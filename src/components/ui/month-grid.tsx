"use client";

import * as React from "react";
import {
  addDays,
  addMonths,
  addYears,
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
import { applyDayRange } from "@/lib/calendar/day-selection";
import { toDayKey } from "@/lib/sperrliste/day-tiers";
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

export type MonthGridMarker = "event" | "rehearsal" | "holiday";

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

/** Mehrfachauswahl: `keys === null` heißt „nicht aktiv“. */
export type MonthGridMultiSelect = {
  keys: ReadonlySet<string> | null;
  onChange: (keys: Set<string> | null) => void;
  /** Z. B. vergangene Tage ausschließen. */
  isSelectable?: (key: string) => boolean;
};

type MonthGridProps = {
  month: Date;
  getDayState: (key: string, date: Date) => MonthGridDayState;
  selectedKey?: string | null;
  onSelect?: (key: string, date: Date) => void;
  /**
   * Monatswechsel per Wischen, Tastatur (Bild↑/↓, Pfeil über den Monatsrand) und beim Ziehen
   * an den Rand. Ohne diese Prop bleibt das Raster auf `month`.
   */
  onMonthChange?: (month: Date) => void;
  /**
   * Mehrfachauswahl einschalten: mobil Halten + Ziehen, am Desktop Strg/Cmd-Klick, Shift-Klick,
   * Shift+Pfeile und Ziehen mit der Maus; Esc beendet. Ohne diese Prop bewirkt Halten nichts.
   */
  multiSelect?: MonthGridMultiSelect;
  /** Wochentage, deren Spaltenkopf betont wird (z. B. Kerntage). */
  emphasizedWeekdays?: ReadonlySet<number>;
  /** Kalenderwochen als erste Spalte. */
  showWeekNumbers?: boolean;
  /**
   * Zusätzlicher Inhalt pro Tag (Termine, Status als Text). Wird nur ab `lg` gezeigt;
   * darunter bleiben Punkte, damit das Raster mobil ohne Scrollen passt.
   */
  renderDetails?: (key: string, date: Date) => React.ReactNode;
  /** Kurzer Zusatz rechts neben der Tageszahl (z. B. Zähler), nur ab `lg`. */
  renderHeaderAside?: (key: string, date: Date) => React.ReactNode;
  className?: string;
};

const MARKER_CLASS: Record<MonthGridMarker, string> = {
  event: "bg-primary",
  rehearsal: "bg-info",
  // Raute statt Punkt, damit sich der Feiertag von Terminen abhebt.
  holiday: "rotate-45 rounded-none bg-warning",
};

const LONG_PRESS_MS = 450;
/** Bewegung, ab der ein Druck kein Halten mehr ist. */
const MOVE_TOLERANCE_PX = 10;
const SWIPE_THRESHOLD_PX = 56;
/** Verweildauer am Rand, bevor beim Ziehen der Monat wechselt. */
const EDGE_DWELL_MS = 650;

type Gesture = {
  pointerId: number;
  isMouse: boolean;
  startX: number;
  startY: number;
  startTime: number;
  startKey: string | null;
  phase: "pending" | "swipe" | "paint" | "idle";
  longPressTimer?: ReturnType<typeof setTimeout>;
  edgeTimer?: ReturnType<typeof setTimeout>;
  edgeDirection?: -1 | 1;
  base: Set<string>;
  anchor: string;
  mode: "add" | "remove";
  lastKey: string;
};

function haptic(ms = 12) {
  // iOS Safari kennt `vibrate` nicht und ignoriert den Aufruf.
  if (typeof navigator !== "undefined") navigator.vibrate?.(ms);
}

/**
 * Monatskalender (Mo–So) nach dem Vorbild moderner Kalender-Apps: mobil große Tipp-Flächen
 * mit Punkten, am Desktop höhere Zellen mit Details. Status als getönte Fläche, Zeiträume als Band.
 */
export function MonthGrid({
  month,
  getDayState,
  selectedKey,
  onSelect,
  onMonthChange,
  multiSelect,
  emphasizedWeekdays,
  showWeekNumbers = false,
  renderDetails,
  renderHeaderAside,
  className,
}: MonthGridProps) {
  const gridRef = React.useRef<HTMLDivElement>(null);
  const bodyRef = React.useRef<HTMLDivElement>(null);
  const [focusKey, setFocusKey] = React.useState<string | null>(null);
  /** Nach einem Monatswechsel per Tastatur den Fokus auf den neuen Tag setzen. */
  const pendingFocus = React.useRef<string | null>(null);
  const gesture = React.useRef<Gesture | null>(null);
  /** Der Klick nach Halten/Ziehen darf den Tag nicht noch einmal umschalten. */
  const suppressClick = React.useRef(false);
  /** Startpunkt für Shift-Klick und Shift+Pfeile. */
  const anchorRef = React.useRef<string | null>(null);
  // Neueste Props für Timer und native Listener.
  const latest = React.useRef({ month, multiSelect, onMonthChange });
  React.useLayoutEffect(() => {
    latest.current = { month, multiSelect, onMonthChange };
  });

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

  // Richtung des letzten Monatswechsels für die Einblende-Animation.
  const monthKeyPrefix = format(month, "yyyy-MM");
  const [shownMonth, setShownMonth] = React.useState(monthKeyPrefix);
  const [direction, setDirection] = React.useState<"left" | "right" | null>(null);
  if (shownMonth !== monthKeyPrefix) {
    setDirection(monthKeyPrefix > shownMonth ? "right" : "left");
    setShownMonth(monthKeyPrefix);
  }

  // Ein einziger Tab-Stopp (roving tabindex): gewählter Tag, sonst heute, sonst der 1.
  const visibleKeys = React.useMemo(
    () => new Set(weeks.flat().map((date) => toDayKey(date))),
    [weeks],
  );
  const todayKey = toDayKey(new Date());
  const tabKey =
    focusKey && visibleKeys.has(focusKey)
      ? focusKey
      : selectedKey && selectedKey.startsWith(monthKeyPrefix)
        ? selectedKey
        : todayKey.startsWith(monthKeyPrefix)
          ? todayKey
          : `${monthKeyPrefix}-01`;

  React.useEffect(() => {
    const key = pendingFocus.current;
    if (!key) return;
    const cell = gridRef.current?.querySelector<HTMLElement>(`[data-date="${key}"]`);
    if (cell) {
      cell.focus();
      pendingFocus.current = null;
    }
  });

  const multiKeys = multiSelect?.keys ?? null;
  const isSelectable = React.useCallback(
    (key: string) => latest.current.multiSelect?.isSelectable?.(key) ?? true,
    [],
  );

  const changeMonthBy = (delta: number) => {
    const { month: current, onMonthChange: change } = latest.current;
    change?.(startOfMonth(addMonths(current, delta)));
  };

  const moveFocus = (target: Date) => {
    const key = toDayKey(target);
    if (!isSameMonth(target, month)) {
      if (onMonthChange) onMonthChange(startOfMonth(target));
      else if (!visibleKeys.has(key)) return;
    }
    setFocusKey(key);
    pendingFocus.current = key;
    return key;
  };

  /** Ausgangsauswahl beim Start einer Mehrfachauswahl: bisher gewählter Einzeltag zählt mit. */
  const startingKeys = () => {
    if (multiKeys) return new Set(multiKeys);
    return new Set(selectedKey && isSelectable(selectedKey) ? [selectedKey] : []);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape" && multiKeys) {
      event.preventDefault();
      multiSelect?.onChange(null);
      return;
    }
    const cell = (event.target as HTMLElement).closest<HTMLElement>("[data-date]");
    if (!cell?.dataset.date || event.altKey || event.ctrlKey || event.metaKey) return;
    const current = new Date(`${cell.dataset.date}T12:00:00`);
    const weekday = (current.getDay() + 6) % 7; // Mo = 0
    const isArrow = event.key.startsWith("Arrow");
    let target: Date | null = null;
    switch (event.key) {
      case "ArrowLeft":
        target = addDays(current, -1);
        break;
      case "ArrowRight":
        target = addDays(current, 1);
        break;
      case "ArrowUp":
        target = addDays(current, -7);
        break;
      case "ArrowDown":
        target = addDays(current, 7);
        break;
      case "Home":
        target = addDays(current, -weekday);
        break;
      case "End":
        target = addDays(current, 6 - weekday);
        break;
      case "PageUp":
        target = event.shiftKey ? addYears(current, -1) : addMonths(current, -1);
        break;
      case "PageDown":
        target = event.shiftKey ? addYears(current, 1) : addMonths(current, 1);
        break;
      case "t":
      case "T":
        target = new Date();
        break;
    }
    if (!target) return;
    event.preventDefault();
    const key = moveFocus(target);
    // Shift+Pfeil: Auswahl vom Anker bis zum neuen Tag erweitern.
    if (key && isArrow && event.shiftKey && multiSelect) {
      const from = cell.dataset.date;
      const anchor = anchorRef.current ?? from;
      anchorRef.current = anchor;
      multiSelect.onChange(applyDayRange(multiKeys ?? new Set(), anchor, key, "add", isSelectable));
    }
  };

  const activate = (key: string, date: Date, event: React.MouseEvent) => {
    // `detail === 0`: Klick per Tastatur, der kommt nie aus einer Geste.
    if (suppressClick.current && event.detail > 0) {
      suppressClick.current = false;
      return;
    }
    if (multiSelect && event.shiftKey) {
      const anchor = anchorRef.current ?? selectedKey ?? key;
      anchorRef.current = anchor;
      multiSelect.onChange(applyDayRange(multiKeys ?? new Set(), anchor, key, "add", isSelectable));
      return;
    }
    if (multiSelect && isSelectable(key)) {
      if (event.ctrlKey || event.metaKey || multiKeys) {
        const next = startingKeys();
        if (next.has(key)) next.delete(key);
        else next.add(key);
        anchorRef.current = key;
        multiSelect.onChange(next);
        return;
      }
    } else if (multiKeys) {
      // Nicht wählbare Tage (z. B. vergangene) tun in der Mehrfachauswahl nichts.
      return;
    }
    anchorRef.current = key;
    onSelect?.(key, date);
  };

  // ---- Gesten -------------------------------------------------------------------------------

  const setBodyOffset = (dx: number, animate = false) => {
    const body = bodyRef.current;
    if (!body) return;
    body.style.transition = animate ? "transform 180ms ease-out" : "";
    body.style.transform = dx ? `translateX(${dx}px)` : "";
  };

  const clearTimers = (current: Gesture) => {
    if (current.longPressTimer) clearTimeout(current.longPressTimer);
    if (current.edgeTimer) clearTimeout(current.edgeTimer);
  };

  const endGesture = () => {
    const current = gesture.current;
    if (current) clearTimers(current);
    gesture.current = null;
  };

  const paintTo = (key: string) => {
    const current = gesture.current;
    const select = latest.current.multiSelect;
    if (!current || !select || key === current.lastKey) return;
    current.lastKey = key;
    select.onChange(applyDayRange(current.base, current.anchor, key, current.mode, isSelectable));
  };

  const startPaint = (key: string) => {
    const current = gesture.current;
    const select = latest.current.multiSelect;
    if (!current || !select || !isSelectable(key)) return;
    const base = new Set(select.keys ?? []);
    current.phase = "paint";
    current.base = base;
    current.anchor = key;
    current.mode = base.has(key) ? "remove" : "add";
    current.lastKey = "";
    anchorRef.current = key;
    suppressClick.current = true;
    haptic();
    paintTo(key);
  };

  const keyAtPoint = (x: number, y: number) => {
    const element = document.elementFromPoint(x, y);
    const cell = element?.closest<HTMLElement>("[data-date]");
    return cell && gridRef.current?.contains(cell) ? cell : null;
  };

  /** Beim Ziehen am Rand (oder über Tagen des Nachbarmonats) verweilen → Monat wechseln. */
  const updateEdge = (x: number, cell: HTMLElement | null) => {
    const current = gesture.current;
    const grid = gridRef.current;
    if (!current || !grid || !latest.current.onMonthChange) return;
    const rect = grid.getBoundingClientRect();
    let edge: -1 | 1 | undefined;
    if (x < rect.left + 4) edge = -1;
    else if (x > rect.right - 4) edge = 1;
    else if (cell?.dataset.inMonth === "false" && cell.dataset.date) {
      edge = cell.dataset.date < `${format(latest.current.month, "yyyy-MM")}-01` ? -1 : 1;
    }
    if (edge === current.edgeDirection) return;
    if (current.edgeTimer) clearTimeout(current.edgeTimer);
    current.edgeTimer = undefined;
    current.edgeDirection = edge;
    if (!edge) return;
    const step = () => {
      if (gesture.current !== current || current.edgeDirection !== edge) return;
      changeMonthBy(edge);
      haptic(8);
      current.edgeTimer = setTimeout(step, EDGE_DWELL_MS * 1.5);
    };
    current.edgeTimer = setTimeout(step, EDGE_DWELL_MS);
  };

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || !event.isPrimary) return;
    endGesture();
    const cell = (event.target as HTMLElement).closest<HTMLElement>("[data-date]");
    const key = cell?.dataset.date ?? null;
    const isMouse = event.pointerType === "mouse";
    const current: Gesture = {
      pointerId: event.pointerId,
      isMouse,
      startX: event.clientX,
      startY: event.clientY,
      startTime: event.timeStamp,
      startKey: key,
      phase: "pending",
      base: new Set(),
      anchor: key ?? "",
      mode: "add",
      lastKey: "",
    };
    gesture.current = current;
    suppressClick.current = false;
    if (!isMouse && key && multiSelect && cell?.getAttribute("aria-disabled") !== "true") {
      current.longPressTimer = setTimeout(() => {
        if (gesture.current === current && current.phase === "pending") startPaint(key);
      }, LONG_PRESS_MS);
    }
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const current = gesture.current;
    if (!current || current.pointerId !== event.pointerId) return;
    const dx = event.clientX - current.startX;
    const dy = event.clientY - current.startY;

    if (current.phase === "pending") {
      if (Math.hypot(dx, dy) < MOVE_TOLERANCE_PX) return;
      if (current.longPressTimer) clearTimeout(current.longPressTimer);
      if (current.isMouse) {
        // Maus: Ziehen über einen zweiten Tag startet die Auswahl.
        const cell = keyAtPoint(event.clientX, event.clientY);
        if (multiSelect && current.startKey && cell?.dataset.date !== current.startKey) {
          gridRef.current?.setPointerCapture(event.pointerId);
          startPaint(current.startKey);
        } else return;
      } else if (onMonthChange && Math.abs(dx) > Math.abs(dy)) {
        current.phase = "swipe";
      } else {
        // Senkrecht: der Browser scrollt, wir halten uns raus.
        current.phase = "idle";
        return;
      }
    }

    if (current.phase === "swipe") {
      setBodyOffset(dx * 0.6);
      return;
    }
    if (current.phase === "paint") {
      const cell = keyAtPoint(event.clientX, event.clientY);
      if (cell?.dataset.date && cell.dataset.inMonth === "true") paintTo(cell.dataset.date);
      updateEdge(event.clientX, cell);
    }
  };

  const onPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const current = gesture.current;
    if (!current || current.pointerId !== event.pointerId) return;
    if (current.phase === "swipe") {
      const dx = event.clientX - current.startX;
      const velocity = Math.abs(dx) / Math.max(1, event.timeStamp - current.startTime);
      if (Math.abs(dx) > SWIPE_THRESHOLD_PX || (Math.abs(dx) > 24 && velocity > 0.5)) {
        setBodyOffset(0);
        changeMonthBy(dx < 0 ? 1 : -1);
      } else {
        setBodyOffset(0, true);
      }
      // Kein Klick auf den Tag, auf dem das Wischen begann.
      suppressClick.current = true;
    }
    endGesture();
  };

  const onPointerCancel = () => {
    if (gesture.current?.phase === "swipe") setBodyOffset(0, true);
    endGesture();
  };

  // Während Halten/Ziehen bzw. Wischen darf die Seite nicht scrollen. Geht nur mit einem
  // nicht-passiven nativen Listener; `touch-action: pan-y` lässt senkrechtes Scrollen sonst zu.
  React.useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    const onTouchMove = (event: TouchEvent) => {
      const phase = gesture.current?.phase;
      if ((phase === "paint" || phase === "swipe") && event.cancelable) event.preventDefault();
    };
    grid.addEventListener("touchmove", onTouchMove, { passive: false });
    return () => grid.removeEventListener("touchmove", onTouchMove);
  }, []);

  React.useEffect(
    () => () => {
      const current = gesture.current;
      if (current?.longPressTimer) clearTimeout(current.longPressTimer);
      if (current?.edgeTimer) clearTimeout(current.edgeTimer);
    },
    [],
  );

  const columns = showWeekNumbers
    ? "grid-cols-[1.75rem_repeat(7,minmax(0,1fr))] lg:grid-cols-[2.5rem_repeat(7,minmax(0,1fr))]"
    : "grid-cols-7";

  const interactive = Boolean(onSelect);

  return (
    <div
      ref={gridRef}
      className={cn(
        "w-full",
        interactive && (onMonthChange || multiSelect) && "touch-pan-y",
        multiSelect && "select-none [-webkit-touch-callout:none]",
        className,
      )}
      role="grid"
      aria-label={ARIA_MONTH.format(month)}
      aria-multiselectable={multiSelect ? true : undefined}
      aria-keyshortcuts="ArrowLeft ArrowRight ArrowUp ArrowDown Home End PageUp PageDown T"
      onKeyDown={interactive ? onKeyDown : undefined}
      onPointerDown={interactive ? onPointerDown : undefined}
      onPointerMove={interactive ? onPointerMove : undefined}
      onPointerUp={interactive ? onPointerUp : undefined}
      onPointerCancel={interactive ? onPointerCancel : undefined}
      onContextMenu={multiSelect ? (event) => event.preventDefault() : undefined}
    >
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
      <div ref={bodyRef}>
        <div
          key={monthKeyPrefix}
          className={cn(
            "space-y-1 sm:space-y-1.5",
            direction && "motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-200",
            direction === "right" && "motion-safe:slide-in-from-right-6",
            direction === "left" && "motion-safe:slide-in-from-left-6",
          )}
        >
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
              {week.map((date) => {
                const key = toDayKey(date);
                return (
                  <DayCell
                    key={key}
                    date={date}
                    inMonth={isSameMonth(date, month)}
                    state={getDayState(key, date)}
                    selected={multiKeys ? multiKeys.has(key) : selectedKey === key}
                    onActivate={interactive ? activate : undefined}
                    tabbable={key === tabKey}
                    onFocus={() => setFocusKey(key)}
                    details={renderDetails?.(key, date)}
                    headerAside={renderHeaderAside?.(key, date)}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function DayCell({
  date,
  inMonth,
  state,
  selected,
  onActivate,
  tabbable,
  onFocus,
  details,
  headerAside,
}: {
  date: Date;
  inMonth: boolean;
  state: MonthGridDayState;
  selected: boolean;
  onActivate?: (key: string, date: Date, event: React.MouseEvent) => void;
  tabbable: boolean;
  onFocus: () => void;
  details?: React.ReactNode;
  headerAside?: React.ReactNode;
}) {
  // Gesperrte Tage bleiben fokussierbar, damit die Pfeiltasten nicht hängen bleiben.
  const inactive = !onActivate || state.disabled;
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
      data-date={key}
      data-in-month={inMonth}
      disabled={!onActivate}
      aria-disabled={inactive || undefined}
      tabIndex={tabbable ? 0 : -1}
      onFocus={onFocus}
      onClick={(event) => {
        if (!inactive) onActivate?.(key, date, event);
      }}
      className={cn(
        // Mobil: mind. 52 px hohe Tipp-Fläche; Desktop: hohe Zelle mit Details.
        "relative flex h-13 min-w-0 flex-col items-center overflow-hidden rounded-lg border pt-1.5 text-sm transition-[color,background-color,border-color,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.97] disabled:cursor-default aria-disabled:cursor-default aria-disabled:active:scale-100 lg:h-24 lg:items-stretch lg:px-2 lg:pt-1.5 lg:active:scale-100",
        status
          ? cn(AVAILABILITY_STATUS[status].surface, "border-transparent")
          : state.emphasis === "strong"
            ? "border-border bg-muted"
            : state.emphasis === "faint"
              ? "border-border/40 bg-transparent"
              : "border-border/70 bg-card",
        selected && "border-primary ring-2 ring-primary/40",
        !inactive && !selected && "hover:border-foreground/30",
        !inMonth && "opacity-40",
      )}
    >
      <span className="flex items-center justify-center gap-1 lg:justify-between">
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
        {headerAside ? <span className="hidden min-w-0 lg:flex">{headerAside}</span> : null}
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
