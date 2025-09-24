"use client";

import { useCallback, useEffect, useState } from "react";
import { liveQuery } from "dexie";

import { offlineDb } from "./db";
import { useOfflineSync } from "./storage";
import { useOfflineSyncClient } from "./hooks";
import type {
  InventoryItemRecord,
  PendingEvent,
  PendingEventInput,
} from "./types";

interface InventoryAdjustmentOptions {
  reason?: string;
  source?: string;
}

export interface InventoryAdjustmentResult {
  item: InventoryItemRecord;
  delta: number;
}

export interface InventoryBufferEntry {
  key: string;
  itemId?: string;
  sku?: string;
  delta: number;
  quantityAfter?: number;
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function createBufferEntry(event: PendingEvent): InventoryBufferEntry | null {
  const { payload } = event;
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const record = payload as Record<string, unknown>;
  const sku = isString(record.sku) ? record.sku.trim() : undefined;
  const itemId = isString(record.itemId)
    ? record.itemId.trim()
    : sku ?? undefined;
  const delta = isNumber(record.delta)
    ? record.delta
    : isNumber(record.change)
      ? record.change
      : 0;

  if (!itemId && !sku) {
    return null;
  }

  if (!isNumber(delta) || delta === 0) {
    return null;
  }

  const quantityAfter = isNumber(record.quantity)
    ? record.quantity
    : isNumber(record.newQuantity)
      ? record.newQuantity
      : undefined;

  return {
    key: itemId ?? sku ?? event.id,
    itemId: itemId ?? undefined,
    sku,
    delta,
    quantityAfter,
  };
}

async function updateInventoryRecord(
  code: string,
  delta: number,
): Promise<{ previous: InventoryItemRecord; updated: InventoryItemRecord } | null> {
  if (!offlineDb) {
    return null;
  }

  const normalized = code.trim();
  if (!normalized) {
    return null;
  }

  const db = offlineDb;
  return db.transaction("rw", db.items, async () => {
    const existing =
      (await db.items.where("sku").equals(normalized).first()) ??
      (await db.items.get(normalized));

    if (!existing) {
      return null;
    }

    const updatedAt = new Date().toISOString();
    const updated: InventoryItemRecord = {
      ...existing,
      quantity: existing.quantity + delta,
      updatedAt,
    };

    await db.items.put(updated);
    return { previous: existing, updated };
  });
}

export function useInventory() {
  const storage = useOfflineSync();
  const { enqueue, scopes, flush, pull, bootstrap } = useOfflineSyncClient();

  const [items, setItems] = useState<InventoryItemRecord[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [bufferEntries, setBufferEntries] = useState<InventoryBufferEntry[]>([]);

  useEffect(() => {
    const db = offlineDb;

    if (!storage.isSupported || !storage.isReady || !db) {
      setItems([]);
      return;
    }

    const subscription = liveQuery(() => db.items.orderBy("name").toArray()).subscribe({
      next: (records) => setItems(records),
      error: (error) => {
        console.error("[inventory] failed to observe items", error);
      },
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [storage.isReady, storage.isSupported]);

  useEffect(() => {
    const db = offlineDb;

    if (!storage.isSupported || !storage.isReady || !db) {
      setPendingCount(0);
      setBufferEntries([]);
      return;
    }

    const subscription = liveQuery(() =>
      db.eventQueue.where("type").startsWith("inventory").toArray(),
    ).subscribe({
      next: (events) => {
        setPendingCount(events.length);
        const aggregated = new Map<string, InventoryBufferEntry>();

        for (const event of events) {
          const entry = createBufferEntry(event);
          if (!entry) {
            continue;
          }

          const key = entry.key;
          const existing = aggregated.get(key);

          if (existing) {
            existing.delta += entry.delta;
            if (isNumber(entry.quantityAfter)) {
              existing.quantityAfter = entry.quantityAfter;
            }
          } else {
            aggregated.set(key, { ...entry });
          }
        }

        setBufferEntries(Array.from(aggregated.values()));
      },
      error: (error) => {
        console.error("[inventory] failed to observe pending events", error);
      },
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [storage.isReady, storage.isSupported]);

  const scopeState = scopes.inventory;

  const adjustQuantity = useCallback(
    async (
      code: string,
      delta: number,
      options?: InventoryAdjustmentOptions,
    ): Promise<InventoryAdjustmentResult> => {
      if (!offlineDb || !storage.isSupported) {
        throw new Error("Offline-Inventur ist in diesem Browser nicht verfügbar.");
      }

      if (!storage.isReady) {
        throw new Error("Offline-Datenbank ist noch nicht bereit.");
      }

      if (!delta || !Number.isFinite(delta)) {
        throw new Error("Die Inventur-Anpassung benötigt eine gültige Änderung.");
      }

      const change = await updateInventoryRecord(code, delta);

      if (!change) {
        throw new Error("Kein Inventar-Eintrag für den gescannten Code gefunden.");
      }

      const timestamp = change.updated.updatedAt;
      const payload: PendingEventInput["payload"] = {
        itemId: change.previous.id,
        sku: change.previous.sku,
        name: change.previous.name,
        delta,
        quantity: change.updated.quantity,
        adjustedAt: timestamp,
        source: options?.source ?? "scanner",
        reason: options?.reason,
      };

      try {
        await enqueue({
          type: "inventory.adjustment",
          payload,
          dedupeKey: `inventory:${change.previous.id}:${timestamp}`,
        });
      } catch (error) {
        // revert optimistic inventory change if queuing fails
        await offlineDb.items.put(change.previous);
        throw error;
      }

      return { item: change.updated, delta } satisfies InventoryAdjustmentResult;
    },
    [enqueue, storage.isReady, storage.isSupported],
  );

  const flushInventory = useCallback(() => flush("inventory"), [flush]);
  const pullInventory = useCallback(() => pull("inventory"), [pull]);
  const bootstrapInventory = useCallback(() => bootstrap("inventory"), [bootstrap]);

  return {
    items,
    isSupported: storage.isSupported,
    isReady: storage.isReady,
    pendingCount,
    bufferEntries,
    scopeState,
    adjustQuantity,
    flushInventory,
    pullInventory,
    bootstrapInventory,
  } as const;
}
