import Dexie, { Table } from "dexie";

import type { AuditRecord, PendingEvent, SyncState, TicketRecord } from "./types";

const DATABASE_NAME = "scan_offline_db";

class OfflineDatabase extends Dexie {
  tickets!: Table<TicketRecord, string>;
  eventQueue!: Table<PendingEvent, string>;
  syncState!: Table<SyncState, string>;
  audits!: Table<AuditRecord, string>;

  constructor() {
    super(DATABASE_NAME);
    this.version(1).stores({
      items: "id, sku, updatedAt",
      tickets: "id, code, eventId, updatedAt",
      eventQueue: "id, type, createdAt, dedupeKey",
      syncState: "scope",
      audits: "id, scope, createdAt, action",
    });
    // Version 2: Tabelle des früheren Offline-Inventars entfernt (Lager läuft online).
    this.version(2).stores({ items: null });
  }
}

const hasIndexedDb = typeof window !== "undefined" && typeof window.indexedDB !== "undefined";

export const offlineDb = hasIndexedDb ? new OfflineDatabase() : null;

export type { OfflineDatabase };
