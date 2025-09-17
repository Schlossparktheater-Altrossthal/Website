"use client";

import { useEffect, useMemo, useState } from "react";
import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
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

  const selectedDateKey = selectedDate ? format(selectedDate, DATE_FORMAT) : null;
  const selectedEntry = selectedDateKey ? blockedByDate.get(selectedDateKey) : undefined;

  useEffect(() => {
    if (!modalOpen) return;
    if (selectedEntry) {
      setReason(selectedEntry.reason ?? "");
    } else if (selectedDate) {
      setReason("");
    }
  }, [modalOpen, selectedEntry, selectedDate]);

  const closeModal = () => {
    setModalOpen(false);
    setSelectedDate(null);
    setReason("");
    setError(null);
    setSubmitting(false);
  };

  const openDay = (day: Date) => {
    setSelectedDate(day);
    setError(null);
    setModalOpen(true);
  };

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
        throw new Error(payload?.error ?? "Der Sperrtermin konnte nicht gespeichert werden.");
      }

      const data = (await response.json()) as BlockedDay;
      setBlockedDays((prev) => [...prev, data].sort((a, b) => a.date.localeCompare(b.date)));
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
        throw new Error(payload?.error ?? "Die Änderung konnte nicht gespeichert werden.");
      }

      const data = (await response.json()) as BlockedDay;
      setBlockedDays((prev) => prev.map((entry) => (entry.id === data.id ? data : entry)));
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
        throw new Error(payload?.error ?? "Der Sperrtermin konnte nicht entfernt werden.");
      }

      setBlockedDays((prev) => prev.filter((entry) => entry.id !== selectedEntry.id));
      toast.success("Sperrtermin entfernt.");
      closeModal();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
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
        </div>
      </div>

      <div className="rounded-xl border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <div className="min-w-[560px] space-y-2 p-3 sm:p-4">
            <div className="grid grid-cols-7 text-center text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {weekDayLabels.map((label) => (
                <div key={label} className="py-2">
                  {label}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1.5 text-sm">
              {daysInView.map((day) => {
                const key = format(day, DATE_FORMAT);
                const entry = blockedByDate.get(key);
                const isCurrentMonth = isSameMonth(day, currentMonth);
                const isCurrentDay = isToday(day);

                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => openDay(day)}
                    className={cn(
                      "relative flex min-h-[78px] flex-col rounded-lg border bg-background p-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:p-3",
                      !isCurrentMonth && "text-muted-foreground/60",
                      entry && "border-destructive/50 bg-destructive/10",
                      isCurrentDay && "ring-2 ring-primary/80"
                    )}
                    aria-current={isCurrentDay ? "date" : undefined}
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
          </div>
        </div>
      </div>

      <Modal
        open={modalOpen && !!selectedDate}
        onClose={closeModal}
        title={selectedDate ? format(selectedDate, "EEEE, d. MMMM yyyy", { locale: de }) : "Sperrtermin"}
        description={selectedEntry ? "Dieser Tag ist derzeit gesperrt." : "Trage einen Sperrtermin für diesen Tag ein."}
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
