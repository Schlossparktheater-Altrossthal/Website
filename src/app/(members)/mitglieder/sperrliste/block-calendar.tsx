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

      setBlockedDays((prev) =>
        prev.filter((entry) => entry.id !== selectedEntry.id)
      );
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

    const created: BlockedDay[] = [];
    let errorMessage: string | null = null;

    for (const key of keysToCreate) {
      const response = await fetch("/api/block-days", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: key,
          reason: trimmed.length > 0 ? trimmed : undefined,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        errorMessage =
          payload?.error ??
          `Der Sperrtermin für ${formatKeyForMessage(key)} konnte nicht gespeichert werden.`;
        break;
      }

      const data = (await response.json()) as BlockedDay;
      created.push(data);
    }

    if (created.length > 0) {
      setBlockedDays((prev) => {
        const next = [...prev, ...created];
        next.sort((a, b) => a.date.localeCompare(b.date));
        return next;
      });
    }

    if (errorMessage) {
      setBulkError(errorMessage);
    } else {
      toast.success(
        created.length > 1
          ? `${created.length} Sperrtermine eingetragen.`
          : "Sperrtermin eingetragen."
      );
      clearSelection();
    }

    setBulkSubmitting(false);
  };

  const handleBulkRemove = async () => {
    const entriesToRemove = selectedKeys
      .map((key) => blockedByDate.get(key))
      .filter((entry): entry is BlockedDay => Boolean(entry));

    if (entriesToRemove.length === 0) return;

    setBulkSubmitting(true);
    setBulkError(null);

    const removedIds: string[] = [];
    let errorMessage: string | null = null;

    for (const entry of entriesToRemove) {
      const response = await fetch(`/api/block-days/${entry.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        errorMessage =
          payload?.error ??
          `Der Sperrtermin für ${formatKeyForMessage(entry.date)} konnte nicht entfernt werden.`;
        break;
      }

      removedIds.push(entry.id);
    }

    if (removedIds.length > 0) {
      setBlockedDays((prev) =>
        prev.filter((entry) => !removedIds.includes(entry.id))
      );
    }

    if (errorMessage) {
      setBulkError(errorMessage);
    } else {
      toast.success(
        removedIds.length > 1
          ? `${removedIds.length} Sperrtermine entfernt.`
          : "Sperrtermin entfernt."
      );
      clearSelection();
    }

    setBulkSubmitting(false);
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
              onClick={() => setCurrentMonth(startOfMonth(new Date()))}
            >
              Heute
            </Button>
            <div className="flex items-center rounded-md border">
              <button
                type="button"
                onClick={() => setCurrentMonth((prev) => addMonths(prev, -1))}
                className="p-2 text-sm text-muted-foreground transition hover:text-foreground"
                aria-label="Vorheriger Monat"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setCurrentMonth((prev) => addMonths(prev, 1))}
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
            <div className="space-y-1.5 text-sm">
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

                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => handleDayClick(day, key)}
                        onPointerDown={(event) => handleDayPointerDown(event, key)}
                        onPointerEnter={(event) => handleDayPointerEnter(event, key)}
                        className={cn(
                          "relative flex min-h-[78px] flex-col rounded-lg border bg-background p-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:p-3",
                          !isCurrentMonth && "text-muted-foreground/60",
                          entry && "border-destructive/50 bg-destructive/10",
                          isCurrentDay && !isSelected && "ring-2 ring-primary/80",
                          isSelected && "border-primary ring-2 ring-primary/60"
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
                          <span className="mt-auto flex items-center gap-1 text-xs font-semibold text-destructive">
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
    </div>
  );
}
