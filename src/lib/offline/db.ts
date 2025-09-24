import Dexie, { Table } from "dexie";

import type {
  AuditRecord,
  InventoryItemRecord,
  PendingEvent,
  SyncState,
  TicketRecord,
} from "./types";

const DATABASE_NAME = "scan_offline_db";
const DATABASE_VERSION = 1;

class OfflineDatabase extends Dexie {
  items!: Table<InventoryItemRecord, string>;
  tickets!: Table<TicketRecord, string>;
  eventQueue!: Table<PendingEvent, string>;
  syncState!: Table<SyncState, string>;
  audits!: Table<AuditRecord, string>;

  constructor() {
    super(DATABASE_NAME);
    this.version(DATABASE_VERSION).stores({
      items: "id, sku, updatedAt",
      tickets: "id, code, eventId, updatedAt",
      eventQueue: "id, type, createdAt, dedupeKey",
      syncState: "scope",
      audits: "id, scope, createdAt, action",
    });
  }
}

const hasIndexedDb =
  typeof window !== "undefined" && typeof window.indexedDB !== "undefined";

export const offlineDb = hasIndexedDb ? new OfflineDatabase() : null;

export type { OfflineDatabase };
