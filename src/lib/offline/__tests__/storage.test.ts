import "fake-indexeddb/auto";

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { OfflineDatabase } from "../db";
import type { OfflineDelta, OfflineSnapshot } from "../types";

describe("offline storage", () => {
  let db: OfflineDatabase;
  let storageModule: typeof import("../storage");

  beforeAll(async () => {
    const globalWithWindow = globalThis as typeof globalThis & { window?: typeof globalThis };
    if (!globalWithWindow.window) {
      globalWithWindow.window = globalWithWindow;
    }

    const dbModule = await import("../db");
    storageModule = await import("../storage");

    if (!dbModule.offlineDb) {
      throw new Error("Expected offlineDb to be available for tests");
    }

    db = dbModule.offlineDb;
    await db.delete().catch(() => undefined);
    await db.open();
  });

  afterAll(async () => {
    await db.close();
  });

  beforeEach(async () => {
    await db.transaction(
      "rw",
      db.items,
      db.tickets,
      db.eventQueue,
      db.syncState,
      db.audits,
      async () => {
        await db.items.clear();
        await db.tickets.clear();
        await db.eventQueue.clear();
        await db.syncState.clear();
        await db.audits.clear();
      },
    );
  });

  it("initialises the offline database with expected stores", () => {
    const tableNames = db.tables.map((table) => table.name).sort();
    expect(tableNames).toEqual([
      "audits",
      "eventQueue",
      "items",
      "syncState",
      "tickets",
    ]);

    const eventQueue = db.tables.find((table) => table.name === "eventQueue");
    expect(eventQueue?.schema.primKey.keyPath).toBe("id");
    expect(eventQueue?.schema.indexes.map((index) => index.name).sort()).toEqual([
      "createdAt",
      "dedupeKey",
      "type",
    ]);
  });

  it("merges events with matching dedupe keys and records an audit", async () => {
    const { enqueueEvent } = storageModule;

    const first = await enqueueEvent({
      id: "event-1",
      type: "ticket.checkin",
      payload: { ticketId: "ticket-42" },
      dedupeKey: "ticket:ticket-42",
      createdAt: new Date("2025-01-10T12:00:00.000Z").toISOString(),
    });

    const merged = await enqueueEvent({
      type: "ticket.checkin",
      payload: { ticketId: "ticket-42", status: "checked_in" },
      dedupeKey: "ticket:ticket-42",
      createdAt: new Date("2025-01-10T12:05:00.000Z").toISOString(),
    });

    expect(merged.id).toBe(first.id);

    const stored = await db.eventQueue.get(first.id);
    expect(stored?.payload).toEqual({ ticketId: "ticket-42", status: "checked_in" });
    expect(stored?.retryCount).toBe(0);

    const audits = await db.audits.orderBy("createdAt").toArray();
    expect(audits).toHaveLength(2);
    expect(audits[0]).toMatchObject({ action: "queue" });
    expect(audits[1]).toMatchObject({
      action: "queue",
      summary: "Merged event with dedupe key ticket:ticket-42",
    });
  });

  it("consumes queued events oldest-first and emits dequeue audits", async () => {
    const { enqueueEvent, consumeEvents } = storageModule;

    await enqueueEvent({
      id: "inventory-1",
      type: "inventory.adjustment",
      payload: { itemId: "item-1", delta: 1 },
      dedupeKey: "inventory:item-1",
      createdAt: new Date("2025-01-10T09:00:00.000Z").toISOString(),
    });

    await enqueueEvent({
      id: "ticket-1",
      type: "ticket.checkin",
      payload: { ticketId: "ticket-1" },
      dedupeKey: "ticket:ticket-1",
      createdAt: new Date("2025-01-10T09:05:00.000Z").toISOString(),
    });

    const events = await consumeEvents(10);

    expect(events.map((event) => event.id)).toEqual(["inventory-1", "ticket-1"]);
    expect(await db.eventQueue.count()).toBe(0);

    const auditSummaries = await db.audits
      .filter((audit) => audit.action === "dequeue")
      .toArray()
      .then((records) => records.map((record) => record.summary).sort());
    expect(auditSummaries).toEqual([
      "Dequeued offline event inventory-1",
      "Dequeued offline event ticket-1",
    ]);
  });

  it("applies inventory snapshots by replacing local state", async () => {
    const { applySnapshot } = storageModule;

    const snapshot: OfflineSnapshot = {
      scope: "inventory",
      serverSeq: 42,
      capturedAt: "2025-01-10T11:30:00.000Z",
      records: [
        {
          id: "item-1",
          sku: "SKU-1",
          name: "Scheinwerfer",
          quantity: 5,
          updatedAt: "2025-01-10T11:30:00.000Z",
        },
        {
          id: "item-2",
          sku: "SKU-2",
          name: "Funkmikrofon",
          quantity: 3,
          updatedAt: "2025-01-10T11:30:00.000Z",
        },
      ],
    };

    await applySnapshot(snapshot);

    const items = await db.items.orderBy("id").toArray();
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ id: "item-1", quantity: 5 });

    const state = await db.syncState.get("inventory");
    expect(state).toMatchObject({
      scope: "inventory",
      lastServerSeq: 42,
      lastSnapshotAt: "2025-01-10T11:30:00.000Z",
    });

    const audit = await db.audits.where("action").equals("snapshot").first();
    expect(audit).toMatchObject({
      scope: "inventory",
      summary: "Applied snapshot for inventory",
    });
  });

  it("applies ticket deltas with upserts and deletes", async () => {
    const { applySnapshot, applyDeltas } = storageModule;

    await applySnapshot({
      scope: "tickets",
      serverSeq: 5,
      capturedAt: "2025-01-09T10:00:00.000Z",
      records: [
        {
          id: "ticket-1",
          code: "T-1",
          status: "unused",
          holderName: "Erika Muster",
          eventId: "event-1",
          updatedAt: "2025-01-09T10:00:00.000Z",
        },
        {
          id: "ticket-2",
          code: "T-2",
          status: "unused",
          holderName: null,
          eventId: "event-1",
          updatedAt: "2025-01-09T10:00:00.000Z",
        },
      ],
    });

    const delta: OfflineDelta = {
      scope: "tickets",
      serverSeq: 6,
      upserts: [
        {
          id: "ticket-2",
          code: "T-2",
          status: "checked_in",
          holderName: "Alex Beispiel",
          eventId: "event-1",
          updatedAt: "2025-01-10T12:00:00.000Z",
        },
        {
          id: "ticket-3",
          code: "T-3",
          status: "pending",
          holderName: null,
          eventId: "event-2",
          updatedAt: "2025-01-10T12:00:00.000Z",
        },
      ],
      deletes: ["ticket-1"],
    };

    await applyDeltas(delta);

    const tickets = await db.tickets.orderBy("id").toArray();
    expect(tickets).toEqual([
      {
        id: "ticket-2",
        code: "T-2",
        status: "checked_in",
        holderName: "Alex Beispiel",
        eventId: "event-1",
        updatedAt: "2025-01-10T12:00:00.000Z",
      },
      {
        id: "ticket-3",
        code: "T-3",
        status: "pending",
        holderName: null,
        eventId: "event-2",
        updatedAt: "2025-01-10T12:00:00.000Z",
      },
    ]);

    const state = await db.syncState.get("tickets");
    expect(state).toMatchObject({
      scope: "tickets",
      lastServerSeq: 6,
      lastSnapshotAt: "2025-01-09T10:00:00.000Z",
    });

    const audit = await db.audits.where("action").equals("delta").first();
    expect(audit).toMatchObject({
      scope: "tickets",
      summary: "Applied delta for tickets",
      metadata: expect.objectContaining({ upserts: 2, deletes: 1 }),
    });
  });
});
