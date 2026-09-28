"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  applyProtocolOp,
  protocolOpSchema,
  type ProtocolCandidate,
  type ProtocolOp,
  type ProtocolState,
} from "@/lib/calendar/protocol";

import { applyProtocolOpsAction } from "./actions";

const RETRY_MS = 15_000;
const BATCH = 50;

function storageKey(eventId: string) {
  return `mb-probe-queue:${eventId}`;
}

function loadQueue(eventId: string): ProtocolOp[] {
  try {
    const raw = window.localStorage.getItem(storageKey(eventId));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((entry) => {
      const result = protocolOpSchema.safeParse(entry);
      return result.success ? [result.data] : [];
    });
  } catch (error) {
    console.warn("[probe] Warteschlange nicht lesbar", error);
    return [];
  }
}

function saveQueue(eventId: string, queue: readonly ProtocolOp[]) {
  try {
    if (queue.length) window.localStorage.setItem(storageKey(eventId), JSON.stringify(queue));
    else window.localStorage.removeItem(storageKey(eventId));
  } catch (error) {
    console.warn("[probe] Warteschlange nicht gespeichert", error);
  }
}

export type SyncStatus = "synced" | "sending" | "waiting" | "offline";

/**
 * Zustand des Probenmodus: Server-Stand plus noch nicht bestätigte Änderungen dieses Geräts.
 * Änderungen landen sofort in `localStorage` und werden gesendet, sobald Netz da ist. Nach dem
 * Senden lädt die Seite den Server-Stand neu – so kommen auch Änderungen anderer Geräte an.
 */
export function useProtocolSync(
  eventId: string,
  serverState: ProtocolState,
  candidates: readonly ProtocolCandidate[],
) {
  const router = useRouter();
  const [queue, setQueue] = useState<ProtocolOp[]>([]);
  const [online, setOnline] = useState(true);
  const [sending, setSending] = useState(false);
  // Bestätigte Änderungen bleiben sichtbar, bis der neu geladene Server-Stand sie enthält.
  const [acked, setAcked] = useState<{ base: ProtocolState; ops: ProtocolOp[] }>({
    base: serverState,
    ops: [],
  });
  const queueRef = useRef<ProtocolOp[]>([]);
  const serverStateRef = useRef(serverState);
  useEffect(() => {
    serverStateRef.current = serverState;
  }, [serverState]);
  const sendingRef = useRef(false);

  const updateQueue = useCallback(
    (next: ProtocolOp[]) => {
      queueRef.current = next;
      setQueue(next);
      saveQueue(eventId, next);
    },
    [eventId],
  );

  /** Sendet die Warteschlange in Paketen, bis sie leer ist oder das Netz fehlt. */
  const flush = useCallback(async () => {
    if (sendingRef.current) return;
    sendingRef.current = true;
    setSending(true);
    try {
      while (queueRef.current.length && navigator.onLine) {
        const batch = queueRef.current.slice(0, BATCH);
        const result = await applyProtocolOpsAction({ eventId, ops: batch });
        if (!result.ok && result.retry) break;
        updateQueue(queueRef.current.slice(batch.length));
        if (result.ok) {
          const base = serverStateRef.current;
          setAcked((current) => ({
            base,
            ops: current.base === base ? [...current.ops, ...batch] : batch,
          }));
          if (result.rejected) {
            toast.error("Nicht alles gespeichert", {
              description: `${result.rejected} Änderung(en) passten nicht mehr zum Stand.`,
              duration: 5000,
            });
          }
        } else {
          toast.error("Änderungen verworfen", { description: result.error, duration: 5000 });
        }
        router.refresh();
      }
    } catch (error) {
      // Kein Netz oder Server weg: in der Warteschlange lassen und später erneut senden.
      console.warn("[probe] Senden fehlgeschlagen, später erneut", error);
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  }, [eventId, router, updateQueue]);

  // Beim Öffnen: liegen gebliebene Änderungen laden und senden.
  useEffect(() => {
    queueRef.current = loadQueue(eventId);
    setQueue(queueRef.current);
    setOnline(navigator.onLine);
    void flush();
  }, [eventId, flush]);

  useEffect(() => {
    const goOnline = () => {
      setOnline(true);
      void flush();
      router.refresh();
    };
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    const timer = window.setInterval(() => void flush(), RETRY_MS);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
      window.clearInterval(timer);
    };
  }, [flush, router]);

  const dispatch = useCallback(
    (op: ProtocolOp) => {
      updateQueue([...queueRef.current, op]);
      void flush();
    },
    [flush, updateQueue],
  );

  // Neuer Server-Stand: bestätigte Änderungen sind darin enthalten.
  const state = useMemo(() => {
    const confirmed = acked.base === serverState ? acked.ops : [];
    return [...confirmed, ...queue].reduce(
      (current, op) => applyProtocolOp(current, op, candidates),
      serverState,
    );
  }, [acked, queue, serverState, candidates]);

  const status: SyncStatus = !online
    ? "offline"
    : sending
      ? "sending"
      : queue.length
        ? "waiting"
        : "synced";

  return { state, dispatch, status, pending: queue.length };
}
