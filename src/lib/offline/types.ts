export type OfflineScope = "inventory" | "tickets";

export type InventoryItemCategoryValue =
  | "light"
  | "sound"
  | "network"
  | "video"
  | "instruments"
  | "cables"
  | "cases"
  | "accessories";

export interface InventoryItemRecord {
  id: string;
  sku: string;
  name: string;
  manufacturer?: string | null;
  itemType?: string | null;
  quantity: number;
  updatedAt: string;
  category: InventoryItemCategoryValue;
  acquisitionCost?: number | null;
  totalValue?: number | null;
  purchaseDate?: string | null;
  details?: string | null;
  lastUsedAt?: string | null;
  lastInventoryAt?: string | null;
  location?: string | null;
  owner?: string | null;
  condition?: string | null;
}

export type TicketStatus = "unused" | "checked_in" | "invalid" | "pending";

export interface TicketRecord {
  id: string;
  code: string;
  status: TicketStatus;
  holderName?: string;
  eventId: string;
  updatedAt: string;
}

export type PendingEventType = "inventory.adjustment" | "ticket.checkin";

export interface PendingEvent {
  id: string;
  type: PendingEventType;
  payload: Record<string, unknown>;
  createdAt: string;
  retryCount: number;
  dedupeKey: string;
}

export interface PendingEventInput
  extends Omit<PendingEvent, "id" | "createdAt" | "retryCount"> {
  id?: string;
  createdAt?: string;
  retryCount?: number;
}

export interface SyncState {
  scope: OfflineScope;
  lastServerSeq: number;
  updatedAt: string;
  lastSnapshotAt?: string;
}

export interface AuditRecord {
  id: string;
  scope: OfflineScope;
  action: "queue" | "snapshot" | "delta" | "dequeue";
  createdAt: string;
  summary?: string;
  metadata?: Record<string, unknown>;
}

export interface SnapshotEnvelope<TRecord> {
  records: TRecord[];
  serverSeq: number;
  capturedAt?: string;
}

export type InventorySnapshot = SnapshotEnvelope<InventoryItemRecord> & {
  scope: "inventory";
};

export type TicketSnapshot = SnapshotEnvelope<TicketRecord> & {
  scope: "tickets";
};

export type OfflineSnapshot = InventorySnapshot | TicketSnapshot;

export interface DeltaEnvelope<TRecord> {
  upserts?: TRecord[];
  deletes?: string[];
  serverSeq: number;
}

export type InventoryDelta = DeltaEnvelope<InventoryItemRecord> & {
  scope: "inventory";
};

export type TicketDelta = DeltaEnvelope<TicketRecord> & {
  scope: "tickets";
};

export type OfflineDelta = InventoryDelta | TicketDelta;
