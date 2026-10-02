export type OfflineScope = "tickets";

export type TicketStatus = "unused" | "checked_in" | "invalid" | "pending";

export interface TicketRecord {
  id: string;
  code: string;
  status: TicketStatus;
  holderName?: string | null;
  eventId: string;
  updatedAt: string;
}

export type PendingEventType = "ticket.checkin";

export interface PendingEvent {
  id: string;
  type: PendingEventType;
  payload: Record<string, unknown>;
  createdAt: string;
  retryCount: number;
  dedupeKey: string;
}

export interface PendingEventInput extends Omit<PendingEvent, "id" | "createdAt" | "retryCount"> {
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

export type TicketSnapshot = SnapshotEnvelope<TicketRecord> & {
  scope: "tickets";
};

export type OfflineSnapshot = TicketSnapshot;

export interface DeltaEnvelope<TRecord> {
  upserts?: TRecord[];
  deletes?: string[];
  serverSeq: number;
}

export type TicketDelta = DeltaEnvelope<TicketRecord> & {
  scope: "tickets";
};

export type OfflineDelta = TicketDelta;
