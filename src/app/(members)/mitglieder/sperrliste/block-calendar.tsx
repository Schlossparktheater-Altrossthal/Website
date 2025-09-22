"use client";

import {
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { addDays, format, parseISO, startOfMonth, isValid } from "date-fns";
import { de } from "date-fns/locale/de";
import { toast } from "sonner";
import { CalendarDays, CircleX, Star } from "lucide-react";

import {
  MonthCalendar,
  type CalendarDay,
  type CalendarDayRenderResult,
} from "@/components/calendar/month-calendar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/utils";
import type { HolidayRange } from "@/types/holidays";

const DATE_FORMAT = "yyyy-MM-dd";

export type BlockedDayKind = "BLOCKED" | "PREFERRED";

export type BlockedDay = {
  id: string;
  date: string;
  reason: string | null;
  kind: BlockedDayKind;
};

const KIND_OPTIONS: { kind: BlockedDayKind; title: string; description: string }[] = [
  {
    kind: "BLOCKED",
    title: "Tag sperren",
    description: "Du bist an diesem Tag nicht verfügbar.",
  },
  {
    kind: "PREFERRED",
    title: "Bevorzugt kommen",
    description: "Du möchtest an diesem Tag besonders gern proben.",
  },
];

const getSingleActionLabel = (kind: BlockedDayKind) =>
  kind === "PREFERRED" ? "Bevorzugten Tag speichern" : "Sperrtermin eintragen";

const getBulkActionLabel = (kind: BlockedDayKind, count: number) => {
  if (kind === "PREFERRED") {
    return count > 1 ? `${count} Tage bevorzugen` : "Tag bevorzugen";
  }
  return count > 1 ? `${count} Tage sperren` : "Tag sperren";
};

const getCreateToastMessage = (kind: BlockedDayKind, count: number) => {
  if (kind === "PREFERRED") {
    return count > 1
      ? `${count} bevorzugte Tage eingetragen.`
      : "Bevorzugter Tag eingetragen.";
  }
  return count > 1 ? `${count} Sperrtermine eingetragen.` : "Sperrtermin eingetragen.";
};

const getUpdateToastMessage = (kind: BlockedDayKind) =>
  kind === "PREFERRED" ? "Eintrag gespeichert." : "Sperrtermin aktualisiert.";

const getRemoveToastMessage = (count: number) =>
  count > 1 ? `${count} Einträge entfernt.` : "Eintrag entfernt.";

type HolidayDayInfo = HolidayRange & {
  date: string;
  rangeStart: boolean;
  rangeEnd: boolean;
};

interface BlockCalendarProps {
  initialBlockedDays: BlockedDay[];
  holidays?: HolidayRange[];
}

type SelectionIntent = "select" | "deselect";

export function BlockCalendar({ initialBlockedDays, holidays = [] }: BlockCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(new Date()));
  const [blockedDays, setBlockedDays] = useState<BlockedDay[]>(() =>
    [...initialBlockedDays].sort((a, b) => a.date.localeCompare(b.date))
  );
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [reason, setReason] = useState("");
  const [selectedKind, setSelectedKind] = useState<BlockedDayKind>("BLOCKED");
  const [lastUsedKind, setLastUsedKind] = useState<BlockedDayKind>("BLOCKED");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedDayKeys, setSelectedDayKeys] = useState<Set<string>>(
    () => new Set<string>()
  );
  const [bulkReason, setBulkReason] = useState("");
  const [bulkKind, setBulkKind] = useState<BlockedDayKind>("BLOCKED");
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [recentlyAdded, setRecentlyAdded] = useState<Set<string>>(new Set());
  const [recentlyRemoved, setRecentlyRemoved] = useState<Set<string>>(new Set());
  const [enterDir, setEnterDir] = useState<"left" | "right">("right");
  const [showHolidays, setShowHolidays] = useState(false);

  const dragIntentRef = useRef<SelectionIntent | null>(null);
  const draggingRef = useRef(false);
  const pointerHandledRef = useRef(false);

  const blockedByDate = useMemo(() => {
    const map = new Map<string, BlockedDay>();
    for (const entry of blockedDays) {
      map.set(entry.date, entry);
    }
    return map;
  }, [blockedDays]);

  const holidaysByDate = useMemo(() => {
    const map = new Map<string, HolidayDayInfo[]>();
    if (!showHolidays || !holidays.length) {
      return map;
    }

    for (const holiday of holidays) {
      const start = parseISO(`${holiday.startDate}`);
      const parsedEnd = parseISO(`${holiday.endDate}`);
      if (!isValid(start)) {
        continue;
      }
      const inclusiveEnd =
        isValid(parsedEnd) && parsedEnd.getTime() >= start.getTime()
          ? parsedEnd
          : start;

      for (
        let cursor = start;
        cursor.getTime() <= inclusiveEnd.getTime();
        cursor = addDays(cursor, 1)
      ) {
        const key = format(cursor, DATE_FORMAT);
        const info: HolidayDayInfo = {
          ...holiday,
          date: key,
          rangeStart: key === holiday.startDate,
          rangeEnd: key === holiday.endDate,
        };
        const existing = map.get(key);
        if (existing) {
          existing.push(info);
        } else {
          map.set(key, [info]);
        }
      }
    }

    return map;
  }, [holidays, showHolidays]);

  const markRecent = useCallback((keys: string[], type: "added" | "removed") => {
    if (!keys.length) return;
    if (type === "added") {
      setRecentlyAdded((prev) => {
        const next = new Set(prev);
        keys.forEach((k) => next.add(k));
        return next;
      });
      // Clear after delay
      setTimeout(() => {
        setRecentlyAdded((prev) => {
          const next = new Set(prev);
          keys.forEach((k) => next.delete(k));
          return next;
        });
      }, 800);
    } else {
      setRecentlyRemoved((prev) => {
        const next = new Set(prev);
        keys.forEach((k) => next.add(k));
        return next;
      });
      setTimeout(() => {
        setRecentlyRemoved((prev) => {
          const next = new Set(prev);
          keys.forEach((k) => next.delete(k));
          return next;
        });
      }, 800);
    }
  }, []);

  const selectedDateKey = selectedDate ? format(selectedDate, DATE_FORMAT) : null;
  const selectedEntry = selectedDateKey ? blockedByDate.get(selectedDateKey) : undefined;

  const selectedKeys = useMemo(
    () => Array.from(selectedDayKeys).sort((a, b) => a.localeCompare(b)),
    [selectedDayKeys]
  );

  const selectedEntries = useMemo(
    () =>
      selectedKeys
        .map((key) => blockedByDate.get(key))
        .filter((entry): entry is BlockedDay => Boolean(entry)),
    [blockedByDate, selectedKeys]
  );

  const selectedBlockedCount = useMemo(
    () => selectedEntries.filter((entry) => entry.kind === "BLOCKED").length,
    [selectedEntries]
  );

  const selectedPreferredCount = useMemo(
    () => selectedEntries.filter((entry) => entry.kind === "PREFERRED").length,
    [selectedEntries]
  );

  const selectedFreeCount = selectedKeys.length - selectedEntries.length;

  // Planungsfenster: Sperrtermine erst ab einer Woche im Voraus
  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const todayKey = format(startOfToday, DATE_FORMAT);
  const freezeUntil = addDays(startOfToday, 7);
  const freezeUntilKey = format(freezeUntil, DATE_FORMAT);
  const isWithinFreeze = useCallback((key: string) => key < freezeUntilKey, [freezeUntilKey]);

  const upcomingHolidays = useMemo(() => {
    if (!holidays.length) {
      return [] as HolidayRange[];
    }

    const sorted = [...holidays].sort((a, b) =>
      a.startDate.localeCompare(b.startDate),
    );
    const upcoming = sorted.filter((holiday) => holiday.endDate >= todayKey);

    if (upcoming.length > 0) {
      return upcoming.slice(0, 8);
    }

    const startIndex = Math.max(sorted.length - 4, 0);
    return sorted.slice(startIndex);
  }, [holidays, todayKey]);

  const formatHolidayRangeLabel = useCallback((startDate: string, endDate: string) => {
    const start = parseISO(`${startDate}`);
    const end = parseISO(`${endDate}`);

    if (!isValid(start)) {
      return endDate && startDate !== endDate ? `${startDate} – ${endDate}` : startDate;
    }

    if (!isValid(end)) {
      return format(start, "d. MMMM yyyy", { locale: de });
    }

    if (startDate === endDate) {
      return format(start, "d. MMMM yyyy", { locale: de });
    }

    const sameYear = start.getFullYear() === end.getFullYear();
    if (sameYear) {
      const sameMonth = start.getMonth() === end.getMonth();
      if (sameMonth) {
        return `${format(start, "d.", { locale: de })} – ${format(end, "d. MMMM yyyy", { locale: de })}`;
      }
      return `${format(start, "d. MMM", { locale: de })} – ${format(end, "d. MMM yyyy", { locale: de })}`;
    }

    return `${format(start, "d. MMM yyyy", { locale: de })} – ${format(end, "d. MMM yyyy", { locale: de })}`;
  }, []);

  useEffect(() => {
    if (!modalOpen) return;
    if (selectedEntry) {
      setReason(selectedEntry.reason ?? "");
      setSelectedKind(selectedEntry.kind);
    } else if (selectedDate) {
      setReason("");
      setSelectedKind(lastUsedKind);
    }
  }, [lastUsedKind, modalOpen, selectedDate, selectedEntry]);

  useEffect(() => {
    if (!selectionMode) {
      draggingRef.current = false;
      dragIntentRef.current = null;
      pointerHandledRef.current = false;
      return;
    }

    const finishDrag = () => {
      draggingRef.current = false;
      dragIntentRef.current = null;
    };

    window.addEventListener("pointerup", finishDrag);
    window.addEventListener("pointercancel", finishDrag);

    return () => {
      window.removeEventListener("pointerup", finishDrag);
      window.removeEventListener("pointercancel", finishDrag);
    };
  }, [selectionMode]);

  const clearSelection = useCallback(() => {
    setSelectedDayKeys(new Set<string>());
    setBulkReason("");
    setBulkError(null);
    setBulkKind(lastUsedKind);
  }, [lastUsedKind]);

  const updateSelection = useCallback(
    (key: string, shouldSelect: boolean) => {
      setSelectedDayKeys((prev) => {
        const alreadySelected = prev.has(key);
        if (shouldSelect ? alreadySelected : !alreadySelected) {
          return prev;
        }
        const next = new Set(prev);
        if (shouldSelect) {
          next.add(key);
        } else {
          next.delete(key);
        }
        return next;
      });
      setBulkError(null);
    },
    [setBulkError]
  );

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setSelectedDate(null);
    setReason("");
    setError(null);
    setSubmitting(false);
    setSelectedKind(lastUsedKind);
  }, [lastUsedKind]);

  const handleToggleSelectionMode = () => {
    const nextMode = !selectionMode;
    setSelectionMode(nextMode);
    if (nextMode) {
      closeModal();
      clearSelection();
      setBulkKind(lastUsedKind);
    } else {
      clearSelection();
    }
  };

  const openDay = useCallback(
    (day: Date, key: string) => {
      setSelectedDate(day);
      setError(null);
      const entry = blockedByDate.get(key);
      if (entry) {
        setSelectedKind(entry.kind);
      } else {
        setSelectedKind(lastUsedKind);
      }
      setModalOpen(true);
    },
    [blockedByDate, lastUsedKind]
  );

  const handleMonthChange = useCallback(
    (nextMonth: Date) => {
      setEnterDir(
        nextMonth.getTime() >= currentMonth.getTime() ? "right" : "left"
      );
      setCurrentMonth(nextMonth);
    },
    [currentMonth]
  );

  const handleDayPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>, key: string) => {
      if (!selectionMode || event.button !== 0) {
        return;
      }
      event.preventDefault();
      pointerHandledRef.current = true;
      const shouldSelect = !selectedDayKeys.has(key);
      dragIntentRef.current = shouldSelect ? "select" : "deselect";
      draggingRef.current = true;
      updateSelection(key, shouldSelect);
    },
    [selectionMode, selectedDayKeys, updateSelection]
  );

  const handleDayPointerEnter = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>, key: string) => {
      if (!selectionMode || !draggingRef.current) {
        return;
      }
      if (event.buttons === 0) {
        draggingRef.current = false;
        dragIntentRef.current = null;
        return;
      }
      event.preventDefault();
      const intent = dragIntentRef.current ?? "select";
      updateSelection(key, intent === "select");
    },
    [selectionMode, updateSelection]
  );

  const handleDayClick = useCallback(
    (day: Date, key: string) => {
      if (selectionMode) {
        if (pointerHandledRef.current) {
          pointerHandledRef.current = false;
          return;
        }
        updateSelection(key, !selectedDayKeys.has(key));
        return;
      }
      openDay(day, key);
    },
    [openDay, selectionMode, selectedDayKeys, updateSelection]
  );

  const renderCalendarDay = useCallback(
    (day: CalendarDay): CalendarDayRenderResult => {
      const entry = blockedByDate.get(day.key);
      const isBlockedEntry = entry?.kind === "BLOCKED";
      const isPreferredEntry = entry?.kind === "PREFERRED";
      const isSelected = selectedDayKeys.has(day.key);
      const wasAdded = recentlyAdded.has(day.key);
      const wasRemoved = recentlyRemoved.has(day.key);
      const holidayEntries = holidaysByDate.get(day.key) ?? [];
      const isHoliday = holidayEntries.length > 0;

      const ariaLabelParts = [
        format(day.date, "EEEE, d. MMMM yyyy", { locale: de }),
        entry
          ? isPreferredEntry
            ? `, bevorzugt${entry.reason ? `: ${entry.reason}` : ""}`
            : `, gesperrt${entry.reason ? `: ${entry.reason}` : ""}`
          : ", frei",
      ];

      if (isHoliday) {
        const descriptions = holidayEntries.map((holiday) => {
          if (holiday.rangeStart && holiday.rangeEnd) {
            return holiday.title;
          }
          if (holiday.rangeStart) {
            return `${holiday.title} (Beginn)`;
          }
          if (holiday.rangeEnd) {
            return `${holiday.title} (Ende)`;
          }
          return holiday.title;
        });
        ariaLabelParts.push(`, Schulferien: ${descriptions.join(", ")}`);
      }

      const holidayContent = isHoliday ? (
        <div className="flex flex-wrap gap-1 text-[11px] leading-[1.1rem] font-medium sm:text-xs sm:leading-5">
          {holidayEntries.map((holiday) => (
            <span
              key={`${holiday.id}-${holiday.date}`}
              className="inline-flex items-center rounded-md bg-sky-100 px-2 py-0.5 text-sky-700 dark:bg-sky-500/20 dark:text-sky-100"
              title={
                holiday.rangeStart && !holiday.rangeEnd
                  ? `${holiday.title} (Beginn)`
                  : !holiday.rangeStart && holiday.rangeEnd
                    ? `${holiday.title} (Ende)`
                    : holiday.title
              }
            >
              {holiday.title}
            </span>
          ))}
        </div>
      ) : null;

      return {
        onClick: () => handleDayClick(day.date, day.key),
        onPointerDown: (event) => handleDayPointerDown(event, day.key),
        onPointerEnter: (event) => handleDayPointerEnter(event, day.key),
        className: cn(
          isBlockedEntry && "border-destructive/50 bg-destructive/10",
          isPreferredEntry &&
            "border-emerald-400/60 bg-emerald-500/10 dark:border-emerald-500/40 dark:bg-emerald-500/10",
          !entry && isHoliday &&
            "border-sky-400/60 bg-sky-50/80 dark:border-sky-500/40 dark:bg-sky-500/10",
          day.isToday && !isSelected && "ring-2 ring-primary/80",
          isSelected && "border-primary ring-2 ring-primary/60",
          "hover:shadow-sm hover:-translate-y-[1px]",
          wasAdded && "added-anim",
          wasRemoved && "removed-anim"
        ),
        "aria-pressed": selectionMode ? isSelected : undefined,
        "aria-label": ariaLabelParts.join(""),
        content: (
          <>
            {holidayContent}
            {entry ? (
              <span
                className={cn(
                  "mt-auto flex items-center gap-1 text-xs font-semibold transition-opacity duration-300",
                  isPreferredEntry
                    ? "text-emerald-600 dark:text-emerald-200"
                    : "text-destructive"
                )}
              >
                {isPreferredEntry ? (
                  <Star className="h-4 w-4" />
                ) : (
                  <CircleX className="h-4 w-4" />
                )}
                <span className="truncate" title={entry.reason ?? undefined}>
                  {entry.reason ?? (isPreferredEntry ? "Bevorzugt" : "Gesperrt")}
                </span>
              </span>
            ) : (
              <span className="mt-auto text-xs leading-5 text-muted-foreground">Frei</span>
            )}
          </>
        ),
      };
    },
    [
      blockedByDate,
      handleDayClick,
      handleDayPointerDown,
      handleDayPointerEnter,
      holidaysByDate,
      recentlyAdded,
      recentlyRemoved,
      selectedDayKeys,
      selectionMode,
    ]
  );
  // Define bulk handlers before they are referenced in JSX
  const handleBulkCreate = async () => {
    const keysToCreate = selectedKeys.filter((key) => !blockedByDate.has(key));
    if (keysToCreate.length === 0) return;

    const trimmed = bulkReason.trim();
    setBulkSubmitting(true);
    setBulkError(null);

    try {
      const response = await fetch("/api/block-days/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dates: keysToCreate,
          reason: trimmed || undefined,
          kind: bulkKind,
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error ?? "Speichern fehlgeschlagen");
      }
      const payload = (await response.json()) as { created?: BlockedDay[] };
      const created = Array.isArray(payload.created) ? payload.created : [];
      if (created.length > 0) {
        setBlockedDays((prev) => {
          const next = [...prev, ...created];
          next.sort((a, b) => a.date.localeCompare(b.date));
          return next;
        });
        markRecent(created.map((c) => c.date), "added");
      }
      toast.success(getCreateToastMessage(bulkKind, created.length));
      setLastUsedKind(bulkKind);
      clearSelection();
    } catch (err) {
      setBulkError(err instanceof Error ? err.message : "Unbekannter Fehler");
    } finally {
      setBulkSubmitting(false);
    }
  };

  const handleBulkRemove = async () => {
    const entriesToRemove = selectedKeys
      .map((key) => blockedByDate.get(key))
      .filter((entry): entry is BlockedDay => Boolean(entry));

    if (entriesToRemove.length === 0) return;

    setBulkSubmitting(true);
    setBulkError(null);

    try {
      const response = await fetch("/api/block-days/bulk", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dates: entriesToRemove.map((e) => e.date) }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error ?? "Löschen fehlgeschlagen");
      }
      const { deleted } = (await response.json()) as { deleted?: number };
      if ((deleted ?? 0) > 0) {
        setBlockedDays((prev) => prev.filter((entry) => !entriesToRemove.some((e) => e.id === entry.id)));
        markRecent(entriesToRemove.map((e) => e.date), "removed");
      }
      toast.success(getRemoveToastMessage(deleted ?? 0));
      clearSelection();
    } catch (err) {
      setBulkError(err instanceof Error ? err.message : "Unbekannter Fehler");
    } finally {
      setBulkSubmitting(false);
    }
  };

  const selectionPanel = selectionMode ? (
    <div className="space-y-3 rounded-lg border border-dashed bg-muted/30 p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium">
            {selectedKeys.length === 0
              ? "Keine Tage ausgewählt."
              : `${selectedKeys.length} ${
                  selectedKeys.length === 1 ? "Tag" : "Tage"
                } ausgewählt.`}
          </p>
          {selectedKeys.length > 0 && (
            <p className="text-[13px] leading-5 text-muted-foreground sm:text-xs sm:leading-5">
              {[
                selectedFreeCount > 0
                  ? `${selectedFreeCount} ${
                      selectedFreeCount === 1 ? "Tag ist frei" : "Tage sind frei"
                    }`
                  : null,
                selectedBlockedCount > 0
                  ? `${selectedBlockedCount} ${
                      selectedBlockedCount === 1
                        ? "Tag ist gesperrt"
                        : "Tage sind gesperrt"
                    }`
                  : null,
                selectedPreferredCount > 0
                  ? `${selectedPreferredCount} ${
                      selectedPreferredCount === 1
                        ? "Tag ist bevorzugt"
                        : "Tage sind bevorzugt"
                    }`
                  : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={clearSelection}
            disabled={bulkSubmitting || selectedKeys.length === 0}
            className="w-full sm:w-auto"
          >
            Auswahl leeren
          </Button>
        </div>
      </div>

      {selectedFreeCount > 0 && (
        <div className="space-y-3 rounded-lg border border-primary/20 bg-primary/5 p-3 dark:border-primary/30 dark:bg-primary/10">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-primary dark:text-primary sm:text-xs">
              Aktion für freie Tage
            </p>
            <div
              className="mt-2 grid gap-2 sm:grid-cols-2"
              role="radiogroup"
              aria-label="Aktion für ausgewählte Tage"
            >
              {KIND_OPTIONS.map((option) => {
                const isActive = bulkKind === option.kind;
                return (
                  <button
                    key={option.kind}
                    type="button"
                    role="radio"
                    aria-checked={isActive}
                    onClick={() => setBulkKind(option.kind)}
                    className={cn(
                      "rounded-lg border border-border/60 bg-background/80 p-3 text-left transition hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                      isActive && "border-primary bg-primary/10 shadow-sm"
                    )}
                  >
                    <div className="text-sm font-semibold">{option.title}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {option.description}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="sm:flex-1">
              <label
                htmlFor="bulk-reason"
                className="mb-1 block text-sm font-medium uppercase tracking-wide text-muted-foreground sm:text-xs sm:leading-5"
              >
                Grund (optional)
              </label>
              <Input
                id="bulk-reason"
                value={bulkReason}
                onChange={(event) => setBulkReason(event.target.value)}
                placeholder="z. B. Urlaub, Familienfeier"
                maxLength={200}
                disabled={bulkSubmitting}
              />
            </div>
            <Button
              type="button"
              className="w-full sm:w-auto"
              disabled={bulkSubmitting}
              onClick={handleBulkCreate}
            >
              {getBulkActionLabel(bulkKind, selectedFreeCount)}
            </Button>
          </div>
        </div>
      )}

      {selectedEntries.length > 0 && (
        <div>
          <Button
            type="button"
            variant="outline"
            disabled={bulkSubmitting}
            onClick={handleBulkRemove}
            className="w-full sm:w-auto"
          >
            {selectedEntries.length > 1
              ? `${selectedEntries.length} Einträge entfernen`
              : "Eintrag entfernen"}
          </Button>
        </div>
      )}

      {bulkError && <p className="text-sm text-destructive">{bulkError}</p>}
    </div>
  ) : null;

  const holidayToggle = (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setShowHolidays((prev) => !prev)}
        aria-pressed={showHolidays}
        className={cn(
          "flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500",
          showHolidays
            ? "border-sky-300 bg-sky-50 text-sky-900 hover:bg-sky-100 dark:border-sky-500/60 dark:bg-sky-500/20 dark:text-sky-50 dark:hover:bg-sky-500/30"
            : "border-border/60 bg-background/80 text-muted-foreground hover:border-sky-200 hover:bg-muted/60 hover:text-foreground dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-200 dark:hover:bg-slate-900/60",
        )}
      >
        <span className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4" aria-hidden />
          <span>{showHolidays ? "Schulferien ausblenden" : "Schulferien anzeigen"}</span>
        </span>
        <span
          className={cn(
            "text-[10px] font-semibold uppercase tracking-wide",
            showHolidays
              ? "text-sky-800/80 dark:text-sky-100/80"
              : "text-muted-foreground",
          )}
        >
          Optional
        </span>
      </button>
      <p className="text-xs leading-5 text-muted-foreground">
        Blende die Schulferien bei Bedarf für deine persönliche Planung ein.
      </p>
    </div>
  );

  const holidayPanel = !showHolidays
    ? null
    : upcomingHolidays.length
      ? (
          <div className="space-y-3 rounded-lg border border-sky-200 bg-sky-50 p-4 text-[13px] leading-5 sm:text-sm sm:leading-6 dark:border-sky-500/40 dark:bg-sky-500/10">
            <div className="flex items-center gap-2 text-sky-800 dark:text-sky-100">
              <CalendarDays className="h-4 w-4" aria-hidden />
              <span className="font-semibold">Schulferien in Sachsen</span>
            </div>
            <ul className="space-y-2 text-sky-900/90 dark:text-sky-100/90">
              {upcomingHolidays.map((holiday) => {
                const rangeLabel = formatHolidayRangeLabel(holiday.startDate, holiday.endDate);
                const isActive = holiday.startDate <= todayKey && holiday.endDate >= todayKey;

                return (
                  <li
                    key={holiday.id}
                    className="space-y-1 rounded-md bg-white/60 p-2 shadow-sm ring-1 ring-sky-200/60 dark:bg-slate-950/40 dark:ring-sky-500/40"
                  >
                    <div
                      className={cn(
                        "font-medium",
                        isActive
                          ? "text-sky-900 dark:text-sky-50"
                          : "text-sky-900/90 dark:text-sky-100/90",
                      )}
                    >
                      {holiday.title}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs leading-5 sm:text-sm sm:leading-6 text-sky-900/80 dark:text-sky-100/80">
                      <span>{rangeLabel}</span>
                      {isActive ? (
                        <span className="inline-flex items-center rounded-full bg-sky-200/90 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-sky-900 dark:bg-sky-500/30 dark:text-sky-50">
                          Aktuell
                        </span>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )
      : (
          <div className="rounded-lg border border-muted/40 bg-muted/30 p-4 text-xs text-muted-foreground">
            Die Ferienübersicht wird eingeblendet, sobald der abonnierte Kalender Termine liefert.
          </div>
        );

  const rehearsalHint = (
    <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm leading-6 text-primary dark:border-primary/30 dark:bg-primary/10">
      Samstag und Sonntag sind unsere bevorzugten Probentage. Freitage planen wir nur in Ausnahmefällen – markiere sie bitte nur als bevorzugt, wenn du wirklich kommen kannst.
    </div>
  );

  const handleCreate = async () => {
    if (!selectedDateKey) return;
    const trimmed = reason.trim();
    setSubmitting(true);
    setError(null);
    try {
      if (selectedKind === "BLOCKED" && isWithinFreeze(selectedDateKey)) {
        throw new Error(
          `Aus Planungsgründen können Sperrtermine erst ab ${format(freezeUntil, "EEEE, d. MMMM yyyy", { locale: de })} eingetragen werden.`
        );
      }
      const response = await fetch("/api/block-days", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: selectedDateKey,
          reason: trimmed.length > 0 ? trimmed : undefined,
          kind: selectedKind,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(
          payload?.error ?? "Der Sperrtermin konnte nicht gespeichert werden."
        );
      }

      const data = (await response.json()) as BlockedDay;
      setBlockedDays((prev) =>
        [...prev, data].sort((a, b) => a.date.localeCompare(b.date))
      );
      markRecent([data.date], "added");
      toast.success(getCreateToastMessage(selectedKind, 1));
      setLastUsedKind(selectedKind);
      closeModal();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async () => {
    if (!selectedEntry) return;
    const trimmed = reason.trim();
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/block-days/${selectedEntry.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: trimmed.length > 0 ? trimmed : null,
          kind: selectedKind,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(
          payload?.error ?? "Die Änderung konnte nicht gespeichert werden."
        );
      }

      const data = (await response.json()) as BlockedDay;
      setBlockedDays((prev) =>
        prev.map((entry) => (entry.id === data.id ? data : entry))
      );
      toast.success(getUpdateToastMessage(data.kind));
      setReason(data.reason ?? "");
      setLastUsedKind(data.kind);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemove = async () => {
    if (!selectedEntry) return;
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/block-days/${selectedEntry.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(
          payload?.error ?? "Der Sperrtermin konnte nicht entfernt werden."
        );
      }

      setBlockedDays((prev) => prev.filter((entry) => entry.id !== selectedEntry.id));
      markRecent([selectedEntry.date], "removed");
      toast.success(getRemoveToastMessage(1));
      closeModal();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler.");
    } finally {
      setSubmitting(false);
    }
  };


  return (
    <div className="space-y-4">
      <MonthCalendar
        month={currentMonth}
        onMonthChange={handleMonthChange}
        transitionDirection={enterDir}
        subtitle="Tippe auf einen Tag, um ihn zu sperren oder als bevorzugt zu markieren."
        headerActions={
          <Button
            type="button"
            variant={selectionMode ? "default" : "outline"}
            size="sm"
            onClick={handleToggleSelectionMode}
            className="w-full sm:w-auto"
          >
            {selectionMode ? "Auswahl beenden" : "Mehrfachauswahl"}
          </Button>
        }
        renderDay={renderCalendarDay}
        additionalContent={
          <>
            {rehearsalHint}
            {selectionPanel}
            {holidayToggle}
            {holidayPanel}
          </>
        }
      />

      <Modal
        open={modalOpen && !!selectedDate}
        onClose={closeModal}
        title={
          selectedDate
            ? format(selectedDate, "EEEE, d. MMMM yyyy", { locale: de })
            : "Sperrtermin"
        }
        description={
          selectedEntry
            ? selectedEntry.kind === "PREFERRED"
              ? "Dieser Tag ist als bevorzugt markiert."
              : "Dieser Tag ist derzeit gesperrt."
            : selectedKind === "PREFERRED"
              ? "Markiere den Tag als bevorzugten Probentermin."
              : "Blocke den Tag, wenn du nicht verfügbar bist."
        }
      >
        <div className="space-y-4">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Aktion wählen
            </p>
            <div
              className="grid gap-2 sm:grid-cols-2"
              role="radiogroup"
              aria-label="Aktion für diesen Tag"
            >
              {KIND_OPTIONS.map((option) => {
                const isActive = selectedKind === option.kind;
                return (
                  <button
                    key={option.kind}
                    type="button"
                    role="radio"
                    aria-checked={isActive}
                    onClick={() => setSelectedKind(option.kind)}
                    className={cn(
                      "rounded-lg border border-border/60 bg-background/80 p-3 text-left transition hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                      isActive && "border-primary bg-primary/10 shadow-sm"
                    )}
                  >
                    <div className="text-sm font-semibold">{option.title}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {option.description}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label htmlFor="block-reason" className="block text-sm font-medium">
              Grund (optional)
            </label>
            <Input
              id="block-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="z. B. Urlaub, Familienfeier"
              maxLength={200}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Die Angabe hilft der Planung, bleibt aber für andere Mitglieder kurz gehalten.
            </p>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
            {selectedEntry ? (
              <>
                <Button
                  type="button"
                  variant="default"
                  className="sm:flex-1"
                  disabled={submitting}
                  onClick={handleUpdate}
                >
                  Eintrag speichern
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="sm:flex-1"
                  disabled={submitting}
                  onClick={handleRemove}
                >
                  Eintrag entfernen
                </Button>
              </>
            ) : (
              <Button
                type="button"
                className="w-full"
                disabled={submitting}
                onClick={handleCreate}
              >
                {getSingleActionLabel(selectedKind)}
              </Button>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}
