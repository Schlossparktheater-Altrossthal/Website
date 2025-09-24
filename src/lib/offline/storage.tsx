"use client";

import * as React from "react";

import { offlineDb } from "./db";
import type {
  OfflineDelta,
  OfflineScope,
  OfflineSnapshot,
  PendingEvent,
  PendingEventInput,
  PendingEventType,
} from "./types";

interface OfflineSyncContextValue {
  isSupported: boolean;
  isReady: boolean;
  enqueueEvent: (event: PendingEventInput) => Promise<PendingEvent>;
  consumeEvents: (limit?: number) => Promise<PendingEvent[]>;
  applySnapshot: (snapshot: OfflineSnapshot) => Promise<void>;
  applyDeltas: (delta: OfflineDelta) => Promise<void>;
}

const OfflineSyncContext =
  React.createContext<OfflineSyncContextValue | undefined>(undefined);

function createId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `offline_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function ensureDb() {
  if (!offlineDb) {
    throw new Error("IndexedDB is not available in this environment.");
  }

  return offlineDb;
}

function inferScopeFromEventType(type: PendingEventType): OfflineScope {
  return type.startsWith("inventory") ? "inventory" : "tickets";
}

function buildAudit(
  scope: OfflineScope,
  action: "queue" | "snapshot" | "delta" | "dequeue",
  summary: string,
  metadata?: Record<string, unknown>,
  createdAt: string = nowIso(),
) {
  return {
    id: createId(),
    scope,
    action,
    summary,
    metadata,
    createdAt,
  };
}

export async function enqueueEvent(
  input: PendingEventInput,
): Promise<PendingEvent> {
  const db = ensureDb();
  const baseCreatedAt = input.createdAt ?? nowIso();
  const pendingEvent: PendingEvent = {
    id: input.id ?? createId(),
    type: input.type,
    payload: input.payload,
    createdAt: baseCreatedAt,
    retryCount: input.retryCount ?? 0,
    dedupeKey: input.dedupeKey,
  };

  return db.transaction("rw", db.eventQueue, db.audits, async () => {
    if (pendingEvent.dedupeKey) {
      const existing = await db.eventQueue
        .where("dedupeKey")
        .equals(pendingEvent.dedupeKey)
        .first();

      if (existing) {
        const merged: PendingEvent = {
          ...existing,
          payload: pendingEvent.payload,
        };

        await db.eventQueue.put(merged);
        await db.audits.put(
          buildAudit(
            inferScopeFromEventType(merged.type),
            "queue",
            `Merged event with dedupe key ${merged.dedupeKey}`,
            { id: merged.id, type: merged.type },
            baseCreatedAt,
          ),
        );

        return merged;
      }
    }

    await db.eventQueue.put(pendingEvent);
    await db.audits.put(
      buildAudit(
        inferScopeFromEventType(pendingEvent.type),
        "queue",
        `Queued offline event ${pendingEvent.id}`,
        { type: pendingEvent.type, dedupeKey: pendingEvent.dedupeKey },
        baseCreatedAt,
      ),
    );

    return pendingEvent;
  });
}

export async function consumeEvents(
  limit = 20,
): Promise<PendingEvent[]> {
  const db = ensureDb();
  const normalizedLimit = Math.max(0, limit);

  if (normalizedLimit === 0) {
    return [];
  }

  return db.transaction("rw", db.eventQueue, db.audits, async () => {
    const events = await db.eventQueue
      .orderBy("createdAt")
      .limit(normalizedLimit)
      .toArray();

    if (events.length === 0) {
      return events;
    }

    await db.eventQueue.bulkDelete(events.map((event) => event.id));
    const timestamp = nowIso();

    await db.audits.bulkPut(
      events.map((event) =>
        buildAudit(
          inferScopeFromEventType(event.type),
          "dequeue",
          `Dequeued offline event ${event.id}`,
          { type: event.type, dedupeKey: event.dedupeKey },
          timestamp,
        ),
      ),
    );

    return events;
  });
}

export async function applySnapshot(snapshot: OfflineSnapshot) {
  const db = ensureDb();
  const timestamp = snapshot.capturedAt ?? nowIso();
  const table = snapshot.scope === "inventory" ? db.items : db.tickets;

  await db.transaction("rw", table, db.syncState, db.audits, async () => {
    await table.clear();

    if (snapshot.records.length > 0) {
      await table.bulkPut(snapshot.records);
    }

    await db.syncState.put({
      scope: snapshot.scope,
      lastServerSeq: snapshot.serverSeq,
      updatedAt: timestamp,
      lastSnapshotAt: timestamp,
    });

    await db.audits.put(
      buildAudit(
        snapshot.scope,
        "snapshot",
        `Applied snapshot for ${snapshot.scope}`,
        {
          serverSeq: snapshot.serverSeq,
          recordCount: snapshot.records.length,
          capturedAt: snapshot.capturedAt,
        },
        timestamp,
      ),
    );
  });
}

export async function applyDeltas(delta: OfflineDelta) {
  const db = ensureDb();
  const timestamp = nowIso();
  const table = delta.scope === "inventory" ? db.items : db.tickets;

  await db.transaction("rw", table, db.syncState, db.audits, async () => {
    if (delta.upserts?.length) {
      await table.bulkPut(delta.upserts);
    }

    if (delta.deletes?.length) {
      await table.bulkDelete(delta.deletes);
    }

    const previousState = await db.syncState.get(delta.scope);

    await db.syncState.put({
      scope: delta.scope,
      lastServerSeq: delta.serverSeq,
      updatedAt: timestamp,
      lastSnapshotAt: previousState?.lastSnapshotAt,
    });

    await db.audits.put(
      buildAudit(
        delta.scope,
        "delta",
        `Applied delta for ${delta.scope}`,
        {
          serverSeq: delta.serverSeq,
          upserts: delta.upserts?.length ?? 0,
          deletes: delta.deletes?.length ?? 0,
        },
        timestamp,
      ),
    );
  });
}

function createUnsupportedPromise<T = never>() {
  return Promise.reject<T>(
    new Error("Offline persistence is not available in this environment."),
  );
}

export function OfflineSyncProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const isSupported = offlineDb !== null;
  const [isReady, setIsReady] = React.useState(
    () => isSupported && offlineDb?.isOpen() === true,
  );

  React.useEffect(() => {
    if (!isSupported || !offlineDb) {
      return;
    }

    let cancelled = false;

    const openDatabase = async () => {
      try {
        if (!offlineDb.isOpen()) {
          await offlineDb.open();
        }

        if (!cancelled) {
          setIsReady(true);
        }
      } catch (error) {
        console.error("Failed to open offline database", error);

        if (!cancelled) {
          setIsReady(false);
        }
      }
    };

    void openDatabase();

    return () => {
      cancelled = true;
    };
  }, [isSupported]);

  const value = React.useMemo<OfflineSyncContextValue>(() => {
    if (!isSupported) {
      return {
        isSupported: false,
        isReady: false,
        enqueueEvent: () => createUnsupportedPromise(),
        consumeEvents: () => createUnsupportedPromise(),
        applySnapshot: () => createUnsupportedPromise(),
        applyDeltas: () => createUnsupportedPromise(),
      };
    }

    return {
      isSupported: true,
      isReady,
      enqueueEvent,
      consumeEvents,
      applySnapshot,
      applyDeltas,
    };
  }, [isSupported, isReady]);

  return (
    <OfflineSyncContext.Provider value={value}>
      {children}
    </OfflineSyncContext.Provider>
  );
}

export function useOfflineSync() {
  const context = React.useContext(OfflineSyncContext);

  if (!context) {
    throw new Error(
      "useOfflineSync must be used within an OfflineSyncProvider.",
    );
  }

  return context;
}
