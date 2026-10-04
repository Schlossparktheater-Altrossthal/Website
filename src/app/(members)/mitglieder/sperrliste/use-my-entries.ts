"use client";

import { useCallback, useState } from "react";
import type { BlockedDayKind } from "@prisma/client";
import { toast } from "sonner";

import {
  isSettableStatus,
  type AvailabilityStatus,
  type SettableStatus,
} from "@/components/ui/availability-status";

import { KIND_TO_STATUS, STATUS_TO_KIND, type MyBlockedDay, type TeamEntry } from "./types";

type BlockDayResponse = {
  id: string;
  date: string;
  reason: string | null;
  kind: BlockedDayKind;
};

async function readError(response: Response, fallback: string) {
  const payload = (await response.json().catch(() => null)) as { error?: string } | null;
  return payload?.error ?? fallback;
}

type Options = {
  initialEntries: MyBlockedDay[];
  currentUserId: string;
  /** Planer sehen Gründe auch in der Team-Ansicht. */
  showReasonsInTeam: boolean;
  onTeamChange: (update: (entries: TeamEntry[]) => TeamEntry[]) => void;
};

/** Eigene Einträge lesen und speichern; hält die Team-Ansicht synchron. */
export function useMyEntries({
  initialEntries,
  currentUserId,
  showReasonsInTeam,
  onTeamChange,
}: Options) {
  const [entries, setEntries] = useState<MyBlockedDay[]>(initialEntries);
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  const syncTeam = useCallback(
    (changed: MyBlockedDay[], removedDates: string[] = []) => {
      const touched = new Set([...changed.map((entry) => entry.date), ...removedDates]);
      onTeamChange((team) => [
        ...team.filter((entry) => !(entry.userId === currentUserId && touched.has(entry.date))),
        ...changed.map((entry) => ({
          userId: currentUserId,
          date: entry.date,
          status: KIND_TO_STATUS[entry.kind],
          reason: showReasonsInTeam ? entry.reason : null,
        })),
      ]);
    },
    [currentUserId, onTeamChange, showReasonsInTeam],
  );

  const applyLocal = useCallback(
    (changed: MyBlockedDay[], removedDates: string[] = []) => {
      const touched = new Set([...changed.map((entry) => entry.date), ...removedDates]);
      setEntries((current) =>
        [...current.filter((entry) => !touched.has(entry.date)), ...changed].sort((a, b) =>
          a.date.localeCompare(b.date),
        ),
      );
      syncTeam(changed, removedDates);
    },
    [syncTeam],
  );

  /** Status eines Tages setzen; `free` löscht den Eintrag. */
  const setDay = useCallback(
    async (date: string, status: AvailabilityStatus, reason: string | null) => {
      const existing = entries.find((entry) => entry.date === date);
      const trimmedReason = reason?.trim() || null;
      setPendingKey(date);
      try {
        if (status === "free") {
          if (!existing) return true;
          const response = await fetch(`/api/block-days/${existing.id}`, { method: "DELETE" });
          if (!response.ok) throw new Error(await readError(response, "Löschen fehlgeschlagen"));
          applyLocal([], [date]);
          return true;
        }
        if (!isSettableStatus(status)) {
          // „Notfall“ entsteht nur über eine Notfall-Absage in „Meine Termine“.
          console.warn("[sperrliste:set-day] Zustand ist hier nicht setzbar", status);
          return false;
        }
        const kind = STATUS_TO_KIND[status];
        const response = existing
          ? await fetch(`/api/block-days/${existing.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ kind, reason: trimmedReason }),
            })
          : await fetch("/api/block-days", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ date, kind, reason: trimmedReason ?? undefined }),
            });
        if (!response.ok) throw new Error(await readError(response, "Speichern fehlgeschlagen"));
        const saved = (await response.json()) as BlockDayResponse;
        applyLocal([{ id: saved.id, date: saved.date, kind: saved.kind, reason: saved.reason }]);
        return true;
      } catch (error) {
        console.error("[sperrliste:set-day]", error);
        toast.error("Nicht gespeichert", {
          description: error instanceof Error ? error.message : undefined,
          duration: 5000,
        });
        return false;
      } finally {
        setPendingKey(null);
      }
    },
    [applyLocal, entries],
  );

  /** Rückgängig nach dem Sammel-Eintrag: die dabei neu angelegten Tage wieder löschen. */
  const undoAdded = useCallback(
    async (added: BlockDayResponse[]) => {
      const results = await Promise.allSettled(
        added.map(async (entry) => {
          const response = await fetch(`/api/block-days/${entry.id}`, { method: "DELETE" });
          if (!response.ok) throw new Error(await readError(response, "Löschen fehlgeschlagen"));
          return entry.date;
        }),
      );
      const removed = results.flatMap((result) =>
        result.status === "fulfilled" ? [result.value] : [],
      );
      applyLocal([], removed);
      if (removed.length < added.length) {
        toast.error("Nicht alles rückgängig gemacht", {
          description: `${added.length - removed.length} Tage sind noch eingetragen.`,
          duration: 5000,
        });
      }
    },
    [applyLocal],
  );

  /** Mehrere Tage auf einmal eintragen (z. B. Urlaub). Bestehende Tage bleiben unverändert. */
  const addRange = useCallback(
    async (dates: string[], status: SettableStatus, reason: string | null) => {
      // Schon eingetragene Tage lässt der Server unverändert – Rückgängig darf nur neue löschen.
      const existingDates = new Set(entries.map((entry) => entry.date));
      try {
        const response = await fetch("/api/block-days/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            dates,
            kind: STATUS_TO_KIND[status],
            reason: reason?.trim() || null,
          }),
        });
        if (!response.ok) throw new Error(await readError(response, "Speichern fehlgeschlagen"));
        const payload = (await response.json()) as {
          created: BlockDayResponse[];
          skipped?: string[];
        };
        applyLocal(
          payload.created.map((entry) => ({
            id: entry.id,
            date: entry.date,
            kind: entry.kind,
            reason: entry.reason,
          })),
        );
        const skipped = payload.skipped?.length ?? 0;
        const added = payload.created.filter((entry) => !existingDates.has(entry.date));
        toast.success(`${added.length} ${added.length === 1 ? "Tag" : "Tage"} eingetragen`, {
          description: skipped
            ? `${skipped} Tage liegen in der Sperrfrist und wurden übersprungen.`
            : undefined,
          duration: 6000,
          action: added.length
            ? { label: "Rückgängig", onClick: () => void undoAdded(added) }
            : undefined,
        });
        return true;
      } catch (error) {
        console.error("[sperrliste:add-range]", error);
        toast.error("Zeitraum nicht gespeichert", {
          description: error instanceof Error ? error.message : undefined,
          duration: 5000,
        });
        return false;
      }
    },
    [applyLocal, entries, undoAdded],
  );

  return { entries, setDay, addRange, pendingKey };
}
