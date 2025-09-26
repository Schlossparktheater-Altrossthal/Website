"use client";

import { createContext } from "react";

import { offlineDb, type OfflineDatabase } from "./db";
import {
  applyDeltas,
  applySnapshot,
  enqueueEvent as persistEvent,
} from "./storage";
import type {
  InventoryDelta,
  InventoryItemRecord,
  OfflineScope,
  OfflineSnapshot,
  PendingEvent,
  PendingEventInput,
  TicketDelta,
  TicketRecord,
} from "./types";

const DEFAULT_RETRY_ATTEMPTS = 3;
const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_FLUSH_LIMIT = 50;
const BASE_BACKOFF_MS = 400;
const MAX_BACKOFF_MS = 10_000;
const BACKGROUND_SYNC_TAG = "workbox-background-sync:offline-events";
const CLIENT_ID_STORAGE_KEY = "offline.sync.clientId";
const AUTO_SYNC_SCOPES: OfflineScope[] = ["inventory", "tickets"];

export type SyncActivity =
  | "idle"
  | "bootstrapping"
  | "flushing"
  | "pulling"
  | "error";

export interface SyncScopeState {
  status: SyncActivity;
  lastSyncedAt: string | null;
  lastError: string | null;
  lastServerSeq: number;
}

export interface BootstrapResult {
  scope: OfflineScope;
  serverSeq: number;
  recordCount: number;
  capturedAt: string;
}

export interface FlushResult {
  scope: OfflineScope;
  status: "applied" | "duplicate" | "noop";
  pushed: number;
  skipped: number;
  serverSeq: number;
  completedAt: string;
}

export interface PullResult {
  scope: OfflineScope;
  events: number;
  applied: number;
  serverSeq: number;
  completedAt: string;
  hasMore: boolean;
}

export interface OfflineSyncContextValue {
  client: SyncClient;
  scopes: Record<OfflineScope, SyncScopeState>;
  bootstrap: (scope: OfflineScope) => Promise<BootstrapResult>;
  flush: (scope: OfflineScope) => Promise<FlushResult>;
  pull: (scope: OfflineScope) => Promise<PullResult>;
  enqueue: (event: PendingEventInput) => Promise<PendingEvent>;
  isSyncing: boolean;
}

export const OfflineSyncContext =
  createContext<OfflineSyncContextValue | null>(null);

interface RequestOptions {
  retries?: number;
  timeoutMs?: number;
  acceptStatuses?: number[];
}

interface BaselineResponse<TRecord extends InventoryItemRecord | TicketRecord> {
  scope: OfflineScope;
  records: TRecord[];
  serverSeq: number;
  capturedAt: string;
  hasMore: boolean;
  nextCursor?: string;
}

interface PullResponse {
  scope: OfflineScope;
  events: ServerSyncEvent[];
  serverSeq: number;
  hasMore: boolean;
  nextCursor?: number;
}

interface PushResponseBase {
  status: "applied" | "duplicate" | "stale";
  serverSeq: number;
  events: ServerSyncEvent[];
}

interface PushResponseApplied extends PushResponseBase {
  status: "applied";
  skipped: { id: string; dedupeKey?: string | null; reason: string }[];
  mutation: {
    clientMutationId: string;
    scope: OfflineScope;
    eventCount: number;
    firstServerSeq: number | null;
    lastServerSeq: number | null;
  };
}

interface PushResponseDuplicate extends PushResponseBase {
  status: "duplicate";
  mutation: {
    clientMutationId: string;
    scope: OfflineScope;
    eventCount: number;
    firstServerSeq: number | null;
    lastServerSeq: number | null;
  };
}

interface PushResponseStale extends PushResponseBase {
  status: "stale";
}

type PushResponse =
  | PushResponseApplied
  | PushResponseDuplicate
  | PushResponseStale;

export interface ServerSyncEvent {
  id: string;
  scope: OfflineScope;
  type: string;
  payload: Record<string, unknown> | null;
  occurredAt: string;
  serverSeq: number;
  clientId: string;
  dedupeKey?: string | null;
}

type RealtimeDeltaPayload<TRecord> = {
  upserts?: TRecord[];
  deletes?: string[];
};

export type InventoryRealtimeSyncPayload = {
  scope: "inventory";
  serverSeq?: number;
  events?: ServerSyncEvent[];
  delta?: RealtimeDeltaPayload<InventoryItemRecord>;
  mutationId?: string | null;
  clientId?: string | null;
  source?: string | null;
};

export type TicketRealtimeSyncPayload = {
  scope: "tickets";
  serverSeq?: number;
  events?: ServerSyncEvent[];
  delta?: RealtimeDeltaPayload<TicketRecord>;
  mutationId?: string | null;
  clientId?: string | null;
  source?: string | null;
};

export type RealtimeSyncPayload =
  | InventoryRealtimeSyncPayload
  | TicketRealtimeSyncPayload;

export class SyncError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "http"
      | "network"
      | "timeout"
      | "stale"
      | "unsupported",
    public readonly scope?: OfflineScope,
    options?: { cause?: unknown },
  ) {
    super(message, { cause: options?.cause });
    this.name = "SyncError";
  }
}

export class SyncClient {
  private readonly fetcher: typeof fetch;
  private mutationCounter = 0;
  private fallbackClientId: string | null = null;
  private backgroundSyncPromise: Promise<void> | null = null;
  private serviceWorkerMessageHandler: ((event: MessageEvent) => void) | null = null;

  private authToken: string | null;

  constructor(fetcher: typeof fetch = fetch, authToken?: string | null) {
    this.fetcher = fetcher;
    this.authToken = authToken ?? null;
    this.initializeBackgroundSyncBridge();
  }

  setAuthToken(token: string | null): void {
    this.authToken = token ?? null;
  }

  private initializeBackgroundSyncBridge() {
    if (typeof window === "undefined") {
      return;
    }

    if (this.serviceWorkerMessageHandler) {
      return;
    }

    const handler = (event: MessageEvent) => {
      const { data } = event;

      if (!data || typeof data !== "object") {
        return;
      }

      if (data.type === "offline-events:flushed") {
        void this.runBackgroundSyncPull();
      } else if (data.type === "offline-events:error") {
        console.warn("Background sync failed", data.message);
      }
    };

    this.serviceWorkerMessageHandler = handler;

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener("message", handler);
    } else {
      window.addEventListener("message", handler);
    }
  }

  private async runBackgroundSyncPull(): Promise<void> {
    if (this.backgroundSyncPromise) {
      return this.backgroundSyncPromise;
    }

    this.backgroundSyncPromise = (async () => {
      await Promise.all(
        AUTO_SYNC_SCOPES.map(async (scope) => {
          try {
            await this.pull(scope);
          } catch (error) {
            console.warn(`Failed to refresh scope ${scope} after background sync`, error);
          }
        }),
      );
    })()
      .catch((error) => {
        console.warn("Background sync refresh failed", error);
      })
      .finally(() => {
        this.backgroundSyncPromise = null;
      });

    return this.backgroundSyncPromise;
  }

  async bootstrap(scope: OfflineScope): Promise<BootstrapResult> {
    if (scope === "inventory") {
      const baseline = await this.loadBaseline<InventoryItemRecord>(scope);
      const snapshot: OfflineSnapshot = {
        scope: "inventory",
        records: baseline.records,
        serverSeq: baseline.serverSeq,
        capturedAt: baseline.capturedAt,
      };

      await applySnapshot(snapshot);

      return {
        scope,
        serverSeq: baseline.serverSeq,
        recordCount: baseline.records.length,
        capturedAt: baseline.capturedAt,
      } satisfies BootstrapResult;
    }

    const baseline = await this.loadBaseline<TicketRecord>(scope);
    const snapshot: OfflineSnapshot = {
      scope: "tickets",
      records: baseline.records,
      serverSeq: baseline.serverSeq,
      capturedAt: baseline.capturedAt,
    };

    await applySnapshot(snapshot);

    return {
      scope,
      serverSeq: baseline.serverSeq,
      recordCount: baseline.records.length,
      capturedAt: baseline.capturedAt,
    } satisfies BootstrapResult;
  }

  private async loadBaseline<TRecord extends InventoryItemRecord | TicketRecord>(
    scope: OfflineScope,
  ): Promise<{ records: TRecord[]; serverSeq: number; capturedAt: string }> {
    const records: TRecord[] = [];
    let cursor: string | undefined;
    let serverSeq = 0;
    let capturedAt = new Date().toISOString();

    while (true) {
      const searchParams = new URLSearchParams({ scope });

      if (cursor) {
        searchParams.set("cursor", cursor);
      }

      const { data } = await this.requestJson<BaselineResponse<TRecord>>(
        `/api/sync/initial?${searchParams.toString()}`,
      );

      records.push(...data.records);
      serverSeq = data.serverSeq;
      capturedAt = data.capturedAt ?? capturedAt;

      if (!data.hasMore || !data.nextCursor) {
        break;
      }

      cursor = data.nextCursor;
    }

    return { records, serverSeq, capturedAt };
  }

  async enqueue(input: PendingEventInput): Promise<PendingEvent> {
    const event = await persistEvent(input);
    void this.scheduleBackgroundSync();
    return event;
  }

  async flush(scope: OfflineScope): Promise<FlushResult> {
    const db = this.ensureDb();
    const events = await this.takeEvents(db, scope, DEFAULT_FLUSH_LIMIT);

    if (events.length === 0) {
      return {
        scope,
        status: "noop",
        pushed: 0,
        skipped: 0,
        serverSeq: await this.getServerSeq(db, scope),
        completedAt: new Date().toISOString(),
      } satisfies FlushResult;
    }

    const lastServerSeq = await this.getServerSeq(db, scope);
    const payload = {
      scope,
      clientId: this.ensureClientId(),
      clientMutationId: this.createMutationId(),
      events: events.map((event) => ({
        id: event.id,
        dedupeKey: event.dedupeKey || undefined,
        type: event.type,
        payload: event.payload,
        occurredAt: event.createdAt,
      })),
      lastKnownServerSeq: lastServerSeq,
    };

    try {
      const { data, response } = await this.requestJson<PushResponse>(
        "/api/sync/push",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
        { acceptStatuses: [409] },
      );

      if (data.status === "stale" || response.status === 409) {
        await this.requeueEvents(events);
        void this.scheduleBackgroundSync();
        throw new SyncError(
          "Server rejected offline events because local snapshot is stale.",
          "stale",
          scope,
        );
      }

      const skipped = data.status === "applied" ? data.skipped.length : 0;
      const completedAt = new Date().toISOString();
      await this.touchSyncState(db, scope, data.serverSeq);

      return {
        scope,
        status: data.status,
        pushed: events.length,
        skipped,
        serverSeq: data.serverSeq,
        completedAt,
      } satisfies FlushResult;
    } catch (error) {
      await this.requeueEvents(events);
      void this.scheduleBackgroundSync();

      if (error instanceof SyncError) {
        throw error;
      }

      if (this.isAbortError(error)) {
        throw new SyncError(
          "Sync request timed out while pushing pending events.",
          "timeout",
          scope,
          { cause: error },
        );
      }

      throw new SyncError(
        "Failed to deliver offline events to the server.",
        "network",
        scope,
        { cause: error },
      );
    }
  }

  async pull(scope: OfflineScope): Promise<PullResult> {
    const db = this.ensureDb();
    const lastServerSeq = await this.getServerSeq(db, scope);

    const { data } = await this.requestJson<PullResponse>(
      "/api/sync/pull",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scope,
          lastServerSeq,
        }),
      },
    );

    const applied = await this.applyRealtimePayload({
      scope,
      serverSeq: data.serverSeq,
      events: data.events,
    });

    const resolvedServerSeq = applied?.serverSeq ?? Math.max(data.serverSeq, lastServerSeq);
    const completedAt = new Date().toISOString();

    return {
      scope,
      events: data.events.length,
      applied: applied?.applied ?? 0,
      serverSeq: resolvedServerSeq,
      completedAt,
      hasMore: data.hasMore,
    } satisfies PullResult;
  }

  async applyRealtimePayload(
    payload: RealtimeSyncPayload,
  ): Promise<{ scope: OfflineScope; applied: number; serverSeq: number } | null> {
    if (!payload) {
      return null;
    }

    const scope = payload.scope;
    const db = this.ensureDb();
    const scopedEvents = (payload.events ?? []).filter((event) => event.scope === scope);
    const providedSeq = typeof payload.serverSeq === "number" ? payload.serverSeq : 0;
    const maxSeqFromEvents = scopedEvents.reduce(
      (highest, event) => Math.max(highest, event.serverSeq ?? 0),
      0,
    );
    const currentSeq = await this.getServerSeq(db, scope);
    const deltaOverrides = payload.delta ?? {};
    const hasOverrideDelta =
      typeof deltaOverrides.upserts !== "undefined" ||
      typeof deltaOverrides.deletes !== "undefined";
    const containsNewEvents = scopedEvents.some((event) => event.serverSeq > currentSeq);

    const candidateSeq = Math.max(providedSeq, maxSeqFromEvents);
    const serverSeq = candidateSeq > 0 ? candidateSeq : currentSeq;

    if (!containsNewEvents && !hasOverrideDelta && serverSeq <= currentSeq) {
      await this.touchSyncState(db, scope, currentSeq);
      return { scope, applied: 0, serverSeq: currentSeq };
    }

    if (scope === "inventory") {
      const computed = scopedEvents.length
        ? this.buildInventoryDelta(scopedEvents)
        : { upserts: undefined, deletes: undefined };

      const upserts =
        typeof payload.delta?.upserts !== "undefined" ? payload.delta.upserts : computed.upserts;
      const deletes =
        typeof payload.delta?.deletes !== "undefined" ? payload.delta.deletes : computed.deletes;

      const delta: InventoryDelta = {
        scope: "inventory",
        serverSeq,
        upserts,
        deletes,
      };

      await applyDeltas(delta);
      const appliedCount = (delta.upserts?.length ?? 0) + (delta.deletes?.length ?? 0);
      return { scope: "inventory", applied: appliedCount, serverSeq };
    }

    const computed = scopedEvents.length
      ? this.buildTicketDelta(scopedEvents)
      : { upserts: undefined, deletes: undefined };

    const upserts =
      typeof payload.delta?.upserts !== "undefined" ? payload.delta.upserts : computed.upserts;
    const deletes =
      typeof payload.delta?.deletes !== "undefined" ? payload.delta.deletes : computed.deletes;

    const delta: TicketDelta = {
      scope: "tickets",
      serverSeq,
      upserts,
      deletes,
    };

    await applyDeltas(delta);
    const appliedCount = (delta.upserts?.length ?? 0) + (delta.deletes?.length ?? 0);
    return { scope: "tickets", applied: appliedCount, serverSeq };
  }

  determineScopeFromEvent(event: PendingEvent | PendingEventInput): OfflineScope {
    return this.inferScope(event.type);
  }

  private ensureDb(): OfflineDatabase {
    if (!offlineDb) {
      throw new SyncError(
        "IndexedDB is not available; offline sync cannot be used.",
        "unsupported",
      );
    }

    return offlineDb;
  }

  private async getServerSeq(db: OfflineDatabase, scope: OfflineScope) {
    const state = await db.syncState.get(scope);
    return state?.lastServerSeq ?? 0;
  }

  private async takeEvents(
    db: OfflineDatabase,
    scope: OfflineScope,
    limit: number,
  ): Promise<PendingEvent[]> {
    if (limit <= 0) {
      return [];
    }

    const result: PendingEvent[] = [];
    // Dexie transaction scope ensures atomic dequeue of events
    await db.transaction("rw", db.eventQueue, async () => {
      const ordered = await db.eventQueue.orderBy("createdAt").toArray();

      for (const event of ordered) {
        if (result.length >= limit) {
          break;
        }

        if (this.inferScope(event.type) !== scope) {
          continue;
        }

        result.push(event);
      }

      if (result.length > 0) {
        await db.eventQueue.bulkDelete(result.map((event) => event.id));
      }
    });

    return result;
  }

  private async requeueEvents(events: PendingEvent[]) {
    if (!events.length) {
      return;
    }

    for (const event of events) {
      await persistEvent({
        ...event,
        id: event.id,
        createdAt: event.createdAt,
        retryCount: event.retryCount + 1,
      });
    }
  }

  private inferScope(type: string): OfflineScope {
    return type.startsWith("inventory") ? "inventory" : "tickets";
  }

  private createMutationId(): string {
    this.mutationCounter += 1;

    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }

    return `${Date.now()}-${Math.random().toString(16).slice(2)}-${this.mutationCounter}`;
  }

  private ensureClientId(): string {
    if (typeof window === "undefined") {
      this.fallbackClientId ??=
        `offline-client-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      return this.fallbackClientId;
    }

    try {
      const stored = window.localStorage.getItem(CLIENT_ID_STORAGE_KEY);

      if (stored) {
        return stored;
      }

      const newId =
        typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : `offline-client-${Date.now()}-${Math.random().toString(16).slice(2)}`;

      window.localStorage.setItem(CLIENT_ID_STORAGE_KEY, newId);
      return newId;
    } catch {
      this.fallbackClientId ??=
        `offline-client-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      return this.fallbackClientId;
    }
  }

  private async touchSyncState(
    db: OfflineDatabase,
    scope: OfflineScope,
    serverSeq: number,
  ) {
    await db.transaction("rw", db.syncState, async () => {
      const existing = await db.syncState.get(scope);
      const updatedAt = new Date().toISOString();

      await db.syncState.put({
        scope,
        lastServerSeq: Math.max(serverSeq, existing?.lastServerSeq ?? 0),
        updatedAt,
        lastSnapshotAt: existing?.lastSnapshotAt,
      });
    });
  }

  private async scheduleBackgroundSync() {
    if (typeof window === "undefined") {
      return;
    }

    if (!("serviceWorker" in navigator)) {
      return;
    }

    try {
      const registration = await navigator.serviceWorker.ready;

      const syncManager = (
        registration as ServiceWorkerRegistration & {
          sync?: { register?: (tag: string) => Promise<void> };
        }
      ).sync;

      if (typeof syncManager?.register === "function") {
        await syncManager.register(BACKGROUND_SYNC_TAG);
        return;
      }

      registration.active?.postMessage({ type: BACKGROUND_SYNC_TAG });
    } catch (error) {
      console.warn("Failed to register background sync", error);
    }
  }

  private async requestJson<T>(
    input: RequestInfo | URL,
    init: RequestInit = {},
    options: RequestOptions = {},
  ): Promise<{ data: T; response: Response }> {
    const response = await this.fetchWithRetry(input, init, options);
    const data = await this.parseJson<T>(response);
    return { data, response };
  }

  private async fetchWithRetry(
    input: RequestInfo | URL,
    init: RequestInit = {},
    options: RequestOptions = {},
  ): Promise<Response> {
    const {
      retries = DEFAULT_RETRY_ATTEMPTS,
      timeoutMs = DEFAULT_TIMEOUT_MS,
      acceptStatuses = [],
    } = options;
    const accepted = new Set(acceptStatuses);

    let attempt = 0;
    let lastError: unknown;

    while (attempt <= retries) {
      const controller = new AbortController();
      const timeoutId =
        timeoutMs > 0 ? setTimeout(() => controller.abort(), timeoutMs) : undefined;

      try {
        if (!this.authToken) {
          throw new SyncError(
            "Sync authentication token is missing.",
            "http",
          );
        }

        const headers = new Headers(init.headers as HeadersInit | undefined);
        headers.set("X-Sync-Token", this.authToken);

        const response = await this.fetcher(input, {
          ...init,
          headers,
          signal: controller.signal,
        });

        if (timeoutId) {
          clearTimeout(timeoutId);
        }

        if (!response.ok && !accepted.has(response.status)) {
          if (response.status === 401) {
            throw new SyncError("Sync authentication failed. Please sign in again.", "http");
          }

          if (response.status === 403) {
            throw new SyncError("Sync permission denied for offline synchronisation.", "http");
          }

          if (this.shouldRetryStatus(response.status) && attempt < retries) {
            await this.delay(this.getBackoffDelay(attempt));
            attempt += 1;
            continue;
          }

          throw new SyncError(
            `Request failed with status ${response.status}`,
            "http",
          );
        }

        return response;
      } catch (error) {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }

        if (error instanceof SyncError) {
          throw error;
        }

        lastError = error;

        if (this.isAbortError(error)) {
          if (attempt >= retries) {
            throw new SyncError("Request aborted", "timeout", undefined, {
              cause: error,
            });
          }

          await this.delay(this.getBackoffDelay(attempt));
          attempt += 1;
          continue;
        }

        if (attempt >= retries) {
          throw error;
        }

        await this.delay(this.getBackoffDelay(attempt));
        attempt += 1;
      }
    }

    throw lastError ?? new Error("Unknown sync request failure");
  }

  private getBackoffDelay(attempt: number) {
    const exponential = BASE_BACKOFF_MS * 2 ** attempt;
    const jitter = Math.random() * BASE_BACKOFF_MS;
    return Math.min(exponential + jitter, MAX_BACKOFF_MS);
  }

  private delay(durationMs: number) {
    return new Promise((resolve) => {
      setTimeout(resolve, durationMs);
    });
  }

  private shouldRetryStatus(status: number) {
    return status >= 500 || status === 408 || status === 429;
  }

  private isAbortError(error: unknown): boolean {
    return (
      (typeof DOMException !== "undefined" && error instanceof DOMException
        ? error.name === "AbortError"
        : false) ||
      (error instanceof Error && error.name === "AbortError")
    );
  }

  private async parseJson<T>(response: Response): Promise<T> {
    try {
      const clone = response.clone();
      return (await clone.json()) as T;
    } catch {
      return {} as T;
    }
  }

  private buildDeltaFromEvents(
    scope: "inventory",
    events: ServerSyncEvent[],
  ): { upserts?: InventoryItemRecord[]; deletes?: string[] };
  private buildDeltaFromEvents(
    scope: "tickets",
    events: ServerSyncEvent[],
  ): { upserts?: TicketRecord[]; deletes?: string[] };
  private buildDeltaFromEvents(
    scope: OfflineScope,
    events: ServerSyncEvent[],
  ): { upserts?: InventoryItemRecord[] | TicketRecord[]; deletes?: string[] } {
    if (scope === "inventory") {
      return this.buildInventoryDelta(events);
    }

    return this.buildTicketDelta(events);
  }

  private buildInventoryDelta(events: ServerSyncEvent[]) {
    const upserts: InventoryItemRecord[] = [];
    const deletes: string[] = [];

    for (const event of events) {
      const payload = event.payload ?? {};
      const normalizedType = event.type.toLowerCase();
      const recordCandidate =
        this.extractInventoryRecord(payload.record, event.occurredAt) ??
        this.extractInventoryRecord(payload.item, event.occurredAt) ??
        this.extractInventoryRecord(payload, event.occurredAt);

      if (recordCandidate) {
        upserts.push(recordCandidate);
        continue;
      }

      const shouldDelete =
        normalizedType.includes("delete") ||
        normalizedType.includes("remove") ||
        payload.deleted === true;

      if (!shouldDelete) {
        continue;
      }

      const deleteId = this.extractIdentifier(payload);

      if (deleteId) {
        deletes.push(deleteId);
      }
    }

    return {
      upserts: upserts.length ? upserts : undefined,
      deletes: deletes.length ? deletes : undefined,
    } satisfies { upserts?: InventoryItemRecord[]; deletes?: string[] };
  }

  private buildTicketDelta(events: ServerSyncEvent[]) {
    const upserts: TicketRecord[] = [];
    const deletes: string[] = [];

    for (const event of events) {
      const payload = event.payload ?? {};
      const normalizedType = event.type.toLowerCase();
      const recordCandidate =
        this.extractTicketRecord(payload.record, event.occurredAt) ??
        this.extractTicketRecord(payload.ticket, event.occurredAt) ??
        this.extractTicketRecord(payload, event.occurredAt);

      if (recordCandidate) {
        upserts.push(recordCandidate);
        continue;
      }

      const shouldDelete =
        normalizedType.includes("delete") ||
        normalizedType.includes("remove") ||
        payload.deleted === true;

      if (!shouldDelete) {
        continue;
      }

      const deleteId = this.extractIdentifier(payload);

      if (deleteId) {
        deletes.push(deleteId);
      }
    }

    return {
      upserts: upserts.length ? upserts : undefined,
      deletes: deletes.length ? deletes : undefined,
    } satisfies { upserts?: TicketRecord[]; deletes?: string[] };
  }

  private extractInventoryRecord(
    value: unknown,
    occurredAt: string,
  ): InventoryItemRecord | null {
    if (!value || typeof value !== "object") {
      return null;
    }

    const record = value as Record<string, unknown>;
    const id = this.pickString(record, [
      "id",
      "itemId",
      "inventoryItemId",
    ]);

    if (!id) {
      return null;
    }

    const quantity = this.pickNumber(record, ["quantity", "qty", "count"]);

    if (typeof quantity !== "number") {
      return null;
    }

    const name =
      this.pickString(record, ["name", "label", "title"]) ?? "Unbekannt";
    const sku = this.pickString(record, ["sku", "code"]) ?? id;

    const updatedAt =
      this.pickString(record, ["updatedAt", "occurredAt"]) ?? occurredAt;

    return {
      id,
      sku,
      name,
      quantity,
      updatedAt,
    } satisfies InventoryItemRecord;
  }

  private extractTicketRecord(
    value: unknown,
    occurredAt: string,
  ): TicketRecord | null {
    if (!value || typeof value !== "object") {
      return null;
    }

    const record = value as Record<string, unknown>;
    const id = this.pickString(record, ["id", "ticketId"]);
    const code = this.pickString(record, ["code", "qr", "ticketCode"]);
    const status = this.pickString(record, ["status"]);
    const eventId = this.pickString(record, ["eventId", "showId"]);

    if (!id || !code || !status || !eventId) {
      return null;
    }

    const updatedAt =
      this.pickString(record, ["updatedAt", "occurredAt"]) ?? occurredAt;

    const holderName = this.pickString(record, ["holderName", "name"]);

    return {
      id,
      code,
      status: status as TicketRecord["status"],
      eventId,
      holderName: holderName ?? undefined,
      updatedAt,
    } satisfies TicketRecord;
  }

  private pickString(
    source: Record<string, unknown>,
    keys: string[],
  ): string | null {
    for (const key of keys) {
      const value = source[key];

      if (typeof value === "string" && value.length > 0) {
        return value;
      }
    }

    return null;
  }

  private pickNumber(
    source: Record<string, unknown>,
    keys: string[],
  ): number | null {
    for (const key of keys) {
      const value = source[key];

      if (typeof value === "number" && Number.isFinite(value)) {
        return value;
      }
    }

    return null;
  }

  private extractIdentifier(payload: Record<string, unknown>): string | null {
    return (
      this.pickString(payload, [
        "id",
        "itemId",
        "ticketId",
        "deletedId",
        "deleteId",
      ]) ?? null
    );
  }
}
