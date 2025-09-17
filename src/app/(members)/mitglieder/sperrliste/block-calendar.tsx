"use client";

import {
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { de } from "date-fns/locale/de";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, CircleX } from "lucide-react";

const DATE_FORMAT = "yyyy-MM-dd";

export type BlockedDay = {
  id: string;
  date: string;
  reason: string | null;
};

interface BlockCalendarProps {
  initialBlockedDays: BlockedDay[];
}

type SelectionIntent = "select" | "deselect";

export function BlockCalendar({ initialBlockedDays }: BlockCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(new Date()));
  const [blockedDays, setBlockedDays] = useState<BlockedDay[]>(() =>
    [...initialBlockedDays].sort((a, b) => a.date.localeCompare(b.date))
  );
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedDayKeys, setSelectedDayKeys] = useState<Set<string>>(
    () => new Set<string>()
  );
  const [bulkReason, setBulkReason] = useState("");
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [recentlyAdded, setRecentlyAdded] = useState<Set<string>>(new Set());
  const [recentlyRemoved, setRecentlyRemoved] = useState<Set<string>>(new Set());
  const [enterDir, setEnterDir] = useState<"left" | "right">("right");

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

  const monthLabel = useMemo(
    () => format(currentMonth, "MMMM yyyy", { locale: de }),
    [currentMonth]
  );

  const weekDayLabels = useMemo(() => {
    const start = startOfWeek(new Date(), { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, index) =>
      format(addDays(start, index), "EEE", { locale: de })
    );
  }, []);

  const daysInView = useMemo(() => {
    const firstDayOfMonth = startOfMonth(currentMonth);
    const lastDayOfMonth = endOfMonth(currentMonth);
    const gridStart = startOfWeek(firstDayOfMonth, { weekStartsOn: 1 });
    const gridEnd = endOfWeek(lastDayOfMonth, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: gridStart, end: gridEnd });
  }, [currentMonth]);

  const weeksInView = useMemo(() => {
    const weeks: { weekStart: Date; weekNumber: number; days: Date[] }[] = [];
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

  const selectedDateKey = selectedDate ? format(selectedDate, DATE_FORMAT) : null;
  const selectedEntry = selectedDateKey ? blockedByDate.get(selectedDateKey) : undefined;

  const selectedKeys = useMemo(
    () => Array.from(selectedDayKeys).sort((a, b) => a.localeCompare(b)),
    [selectedDayKeys]
  );

  const selectedBlockedCount = useMemo(
    () => selectedKeys.filter((key) => blockedByDate.has(key)).length,
    [selectedKeys, blockedByDate]
  );

  const selectedFreeCount = selectedKeys.length - selectedBlockedCount;

  // Planungsfenster: Sperrtermine erst ab einer Woche im Voraus
  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const freezeUntil = addDays(startOfToday, 7);
  const freezeUntilKey = format(freezeUntil, DATE_FORMAT);
  const isWithinFreeze = useCallback((key: string) => key < freezeUntilKey, [freezeUntilKey]);

  useEffect(() => {
    if (!modalOpen) return;
    if (selectedEntry) {
      setReason(selectedEntry.reason ?? "");
    } else if (selectedDate) {
      setReason("");
    }
  }, [modalOpen, selectedEntry, selectedDate]);

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
  }, [setBulkError, setBulkReason]);

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
  }, []);

  const handleToggleSelectionMode = () => {
    const nextMode = !selectionMode;
    setSelectionMode(nextMode);
    if (nextMode) {
      closeModal();
      clearSelection();
    } else {
      clearSelection();
    }
  };

  const openDay = (day: Date) => {
    setSelectedDate(day);
    setError(null);
    setModalOpen(true);
  };

  const goToday = () => {
    const target = startOfMonth(new Date());
    setEnterDir(target.getTime() >= currentMonth.getTime() ? "right" : "left");
    setCurrentMonth(target);
  };

  const goPrevMonth = () => {
    setEnterDir("left");
    setCurrentMonth((prev) => addMonths(prev, -1));
  };

  const goNextMonth = () => {
    setEnterDir("right");
    setCurrentMonth((prev) => addMonths(prev, 1));
  };

  const handleDayPointerDown = (
    event: ReactPointerEvent<HTMLButtonElement>,
    key: string
  ) => {
    if (!selectionMode || event.button !== 0) {
      return;
    }
    event.preventDefault();
    pointerHandledRef.current = true;
    const shouldSelect = !selectedDayKeys.has(key);
    dragIntentRef.current = shouldSelect ? "select" : "deselect";
    draggingRef.current = true;
    updateSelection(key, shouldSelect);
  };

  const handleDayPointerEnter = (
    event: ReactPointerEvent<HTMLButtonElement>,
    key: string
  ) => {
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
  };

  const handleDayClick = (day: Date, key: string) => {
    if (selectionMode) {
      if (pointerHandledRef.current) {
        pointerHandledRef.current = false;
        return;
      }
      updateSelection(key, !selectedDayKeys.has(key));
      return;
    }
    openDay(day);
  };

  const formatKeyForMessage = useCallback((key: string) => {
    return format(parseISO(key), "EEEE, d. MMMM yyyy", { locale: de });
  }, []);

  const handleCreate = async () => {
    if (!selectedDateKey) return;
    const trimmed = reason.trim();
    setSubmitting(true);
    setError(null);
    try {
      if (isWithinFreeze(selectedDateKey)) {
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
      toast.success("Sperrtermin eingetragen.");
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
        body: JSON.stringify({ reason: trimmed.length > 0 ? trimmed : null }),
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
      toast.success("Sperrtermin aktualisiert.");
      setReason(data.reason ?? "");
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
      toast.success("Sperrtermin entfernt.");
      closeModal();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler.");
    } finally {
      setSubmitting(false);
    }
  };

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
        body: JSON.stringify({ dates: keysToCreate, reason: trimmed || undefined }),
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
      toast.success(
        created.length > 1
          ? `${created.length} Sperrtermine eingetragen.`
          : "Sperrtermin eingetragen."
      );
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
      toast.success(
        (deleted ?? 0) > 1 ? `${deleted} Sperrtermine entfernt.` : "Sperrtermin entfernt."
      );
      clearSelection();
    } catch (err) {
      setBulkError(err instanceof Error ? err.message : "Unbekannter Fehler");
    } finally {
      setBulkSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-card shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/40 px-4 py-3">
          <div className="space-y-1">
            <h2 className="text-xl font-semibold">{monthLabel}</h2>
            <p className="text-sm text-muted-foreground">
              Tippe auf einen Tag, um einen Sperrtermin hinzuzufügen oder zu bearbeiten.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={goToday}
            >
              Heute
            </Button>
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
            <Button
              type="button"
              variant={selectionMode ? "default" : "outline"}
              size="sm"
              onClick={handleToggleSelectionMode}
            >
              {selectionMode ? "Auswahl beenden" : "Mehrfachauswahl"}
            </Button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <div className="min-w-[640px] space-y-3 p-3 sm:p-4">
            <div className="grid grid-cols-[64px_repeat(7,minmax(0,1fr))] text-center text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <div className="py-2">KW</div>
              {weekDayLabels.map((label) => (
                <div key={label} className="py-2">
                  {label}
                </div>
              ))}
            </div>
            <div
              key={format(currentMonth, "yyyy-MM")}
              className={cn(
                "space-y-1.5 text-sm month-enter",
                enterDir === "right" ? "month-from-right" : "month-from-left"
              )}
            >
              {weeksInView.map((week) => (
                <div
                  key={week.weekStart.toISOString()}
                  className="grid grid-cols-[64px_repeat(7,minmax(0,1fr))] gap-1.5"
                >
                  <div className="flex items-center justify-center rounded-lg bg-muted/40 px-2 py-2 text-xs font-semibold text-muted-foreground">
                    KW {week.weekNumber}
                  </div>
                  {week.days.map((day) => {
                    const key = format(day, DATE_FORMAT);
                    const entry = blockedByDate.get(key);
                    const isCurrentMonth = isSameMonth(day, currentMonth);
                    const isCurrentDay = isToday(day);
                    const isSelected = selectedDayKeys.has(key);
                    const wasAdded = recentlyAdded.has(key);
                    const wasRemoved = recentlyRemoved.has(key);

                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => handleDayClick(day, key)}
                        onPointerDown={(event) => handleDayPointerDown(event, key)}
                        onPointerEnter={(event) => handleDayPointerEnter(event, key)}
                        className={cn(
                          "block-cell relative flex min-h-[78px] flex-col overflow-hidden rounded-lg border bg-background p-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:p-3",
                          !isCurrentMonth && "text-muted-foreground/60",
                          entry && "border-destructive/50 bg-destructive/10",
                          isCurrentDay && !isSelected && "ring-2 ring-primary/80",
                          isSelected && "border-primary ring-2 ring-primary/60",
                          "hover:shadow-sm hover:translate-y-[-1px]",
                          wasAdded && "added-anim",
                          wasRemoved && "removed-anim"
                        )}
                        aria-current={isCurrentDay ? "date" : undefined}
                        aria-pressed={selectionMode ? isSelected : undefined}
                        aria-label={`${format(day, "EEEE, d. MMMM yyyy", { locale: de })}${
                          entry
                            ? `, gesperrt${entry.reason ? `: ${entry.reason}` : ""}`
                            : ", frei"
                        }`}
                      >
                        <span className="text-xs font-medium">{format(day, "d")}</span>
                        {entry ? (
                          <span className="mt-auto flex items-center gap-1 text-xs font-semibold text-destructive transition-opacity duration-300">
                            <CircleX className="h-4 w-4" />
                            <span className="truncate" title={entry.reason ?? undefined}>
                              {entry.reason ?? "Gesperrt"}
                            </span>
                          </span>
                        ) : (
                          <span className="mt-auto text-xs text-muted-foreground">Frei</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>

            {selectionMode && (
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
                      <p className="text-xs text-muted-foreground">
                        {[
                          selectedFreeCount > 0
                            ? `${selectedFreeCount} ${
                                selectedFreeCount === 1 ? "Tag ist" : "Tage sind"
                              } frei`
                            : null,
                          selectedBlockedCount > 0
                            ? `${selectedBlockedCount} ${
                                selectedBlockedCount === 1
                                  ? "Tag ist gesperrt"
                                  : "Tage sind gesperrt"
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
                    >
                      Auswahl leeren
                    </Button>
                  </div>
                </div>

                {selectedFreeCount > 0 && (
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                    <div className="sm:flex-1">
                      <label
                        htmlFor="bulk-reason"
                        className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground"
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
                      className="sm:w-auto"
                      disabled={bulkSubmitting}
                      onClick={handleBulkCreate}
                    >
                      {selectedFreeCount > 1
                        ? `${selectedFreeCount} Tage sperren`
                        : "Tag sperren"}
                    </Button>
                  </div>
                )}

                {selectedBlockedCount > 0 && (
                  <div>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={bulkSubmitting}
                      onClick={handleBulkRemove}
                    >
                      {selectedBlockedCount > 1
                        ? `${selectedBlockedCount} Sperrtermine aufheben`
                        : "Sperrtermin aufheben"}
                    </Button>
                  </div>
                )}

                {bulkError && <p className="text-sm text-destructive">{bulkError}</p>}
              </div>
            )}
          </div>
        </div>
      </div>

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
            ? "Dieser Tag ist derzeit gesperrt."
            : "Trage einen Sperrtermin für diesen Tag ein."
        }
      >
        <div className="space-y-4">
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
                  Grund speichern
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="sm:flex-1"
                  disabled={submitting}
                  onClick={handleRemove}
                >
                  Sperrtermin aufheben
                </Button>
              </>
            ) : (
              <Button
                type="button"
                className="w-full"
                disabled={submitting}
                onClick={handleCreate}
              >
                Sperrtermin eintragen
              </Button>
            )}
          </div>
        </div>
      </Modal>
      <style jsx global>{`
        @keyframes cellPop { 0% { transform: scale(0.96); } 100% { transform: scale(1); } }
        @keyframes addedFlash { 0% { box-shadow: 0 0 0 0 rgba(34,197,94,.55); } 100% { box-shadow: 0 0 0 12px rgba(34,197,94,0); } }
        @keyframes removedFlash { 0% { background-color: rgba(239,68,68,.15); } 100% { background-color: transparent; } }
        @keyframes hoverGlow { 0% { box-shadow: 0 0 0 rgba(99,102,241,0); } 50% { box-shadow: 0 0 18px rgba(99,102,241,.35); } 100% { box-shadow: 0 0 0 rgba(99,102,241,0); } }
        @keyframes sheenSlide { 0% { transform: translateX(-150%) skewX(-20deg);} 100% { transform: translateX(150%) skewX(-20deg);} }
        @keyframes monthInRight { 0% { opacity: 0; transform: translateX(24px);} 100% { opacity: 1; transform: translateX(0);} }
        @keyframes monthInLeft { 0% { opacity: 0; transform: translateX(-24px);} 100% { opacity: 1; transform: translateX(0);} }
        .block-cell { position: relative; }
        .block-cell.added-anim { animation: cellPop .22s ease-out, addedFlash .6s ease-out; }
        .block-cell.removed-anim { animation: removedFlash .6s ease-out; }
        .block-cell::before { content: ""; position:absolute; inset:-2px; border-radius: inherit; pointer-events:none; opacity:0; }
        .block-cell::after { content:""; position:absolute; top:0; left:0; width:60%; height:100%; pointer-events:none; opacity:0; background: linear-gradient(120deg, rgba(255,255,255,0), rgba(255,255,255,.11), rgba(255,255,255,0)); transform: translateX(-150%) skewX(-20deg); }
        .block-cell:hover { border-color: rgba(99,102,241,.45); background-image: radial-gradient(100% 60% at 50% 0%, rgba(99,102,241,.10), transparent 60%); }
        @media (prefers-reduced-motion: no-preference) {
          .block-cell:hover::before { opacity:1; animation: hoverGlow 1.2s ease-in-out infinite; }
          .block-cell:hover::after { opacity:1; animation: sheenSlide 900ms ease-out; }
        }
        .dark .block-cell:hover { border-color: rgba(129,140,248,.55); background-image: radial-gradient(100% 60% at 50% 0%, rgba(129,140,248,.14), transparent 65%); }
        .month-enter { will-change: transform, opacity; }
        @media (prefers-reduced-motion: no-preference) {
          .month-enter.month-from-right { animation: monthInRight .32s ease-out; }
          .month-enter.month-from-left  { animation: monthInLeft  .32s ease-out; }
        }
      `}</style>
    </div>
  );
}
