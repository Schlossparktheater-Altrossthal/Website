import { createHash, randomUUID } from "node:crypto";

import { z, type ZodIssue } from "zod";

import type {
  InventoryItemRecord,
  OfflineScope,
  TicketRecord,
} from "@/lib/offline/types";
import { prisma } from "@/lib/prisma";
import {
  Prisma,
  type PrismaClient,
  SyncScope,
  type SyncEvent as SyncEventModel,
  type SyncMutation,
} from "@prisma/client";

const MAX_BASELINE_LIMIT = 500;
const MAX_DELTA_LIMIT = 500;

type DbClient = PrismaClient | Prisma.TransactionClient;

export interface BaselineOptions {
  cursor?: string | null;
  limit?: number | null;
}

interface BaseBaselineResult<TRecord> {
  scope: OfflineScope;
  records: TRecord[];
  serverSeq: number;
  capturedAt: string;
  hasMore: boolean;
  nextCursor?: string;
}

export type InventoryBaselineResult = BaseBaselineResult<InventoryItemRecord>;
export type TicketBaselineResult = BaseBaselineResult<TicketRecord>;
export type BaselineResult = InventoryBaselineResult | TicketBaselineResult;

export interface ServerSyncEvent {
  id: string;
  scope: OfflineScope;
  type: string;
  payload: Record<string, unknown>;
  occurredAt: string;
  serverSeq: number;
  clientId: string;
  dedupeKey?: string | null;
}

export interface DeltaOptions {
  limit?: number | null;
}

export interface DeltaResult {
  scope: OfflineScope;
  events: ServerSyncEvent[];
  serverSeq: number;
  hasMore: boolean;
  nextCursor?: number;
}

export interface IncomingEventInput {
  id?: string;
  dedupeKey?: string | null;
  type: string;
  payload: Record<string, unknown>;
  occurredAt: string;
}

export interface ApplyIncomingEventsInput {
  scope: OfflineScope;
  clientId: string;
  clientMutationId: string;
  events: IncomingEventInput[];
  lastKnownServerSeq: number;
}

type NormalizedIncomingEvent = Required<IncomingEventInput>;

const finiteNumber = z
  .number()
  .refine((value) => Number.isFinite(value), { message: "Value must be a finite number" });

const inventoryEventPayloadSchema = z
  .object({
    itemId: z.string().min(1),
    sku: z.string().min(1).optional(),
    name: z.string().min(1).optional(),
    delta: finiteNumber.refine((value) => Number.isInteger(value), {
      message: "delta must be an integer",
    }),
    quantity: finiteNumber.refine((value) => Number.isInteger(value) && value >= 0, {
      message: "quantity must be a non-negative integer",
    }),
    adjustedAt: z.string().datetime(),
    source: z.string().min(1),
    reason: z.string().min(1).optional(),
  })
  .strict();

const ticketEventPayloadSchema = z
  .object({
    ticketId: z.string().min(1),
    code: z.string().min(1),
    eventId: z.string().min(1),
    status: z.literal("checked_in"),
    attemptedAt: z.string().datetime(),
    source: z.string().min(1),
  })
  .strict();

export interface SkippedIncomingEvent {
  id: string;
  dedupeKey?: string | null;
  reason: "duplicate-id" | "duplicate-dedupe-key";
}

export type ApplyIncomingEventsResult =
  | {
      status: "applied";
      serverSeq: number;
      events: ServerSyncEvent[];
      skipped: SkippedIncomingEvent[];
      mutation: SyncMutation;
    }
  | {
      status: "duplicate";
      serverSeq: number;
      events: ServerSyncEvent[];
      mutation: SyncMutation;
    }
  | {
      status: "stale";
      serverSeq: number;
      events: ServerSyncEvent[];
      mutation?: SyncMutation;
    };

export class SyncEventValidationError extends Error {
  constructor(message: string, public readonly issues: ZodIssue[]) {
    super(message);
    this.name = "SyncEventValidationError";
  }
}

function getDb(client?: Prisma.TransactionClient): DbClient {
  return client ?? prisma;
}

function toSyncScope(scope: OfflineScope): SyncScope {
  switch (scope) {
    case "inventory":
      return SyncScope.inventory;
    case "tickets":
      return SyncScope.tickets;
    default:
      const exhaustiveCheck: never = scope;
      throw new Error(`Unsupported scope: ${exhaustiveCheck}`);
  }
}

function fromSyncScope(scope: SyncScope): OfflineScope {
  switch (scope) {
    case SyncScope.inventory:
      return "inventory";
    case SyncScope.tickets:
      return "tickets";
    default:
      const exhaustiveCheck: never = scope;
      throw new Error(`Unsupported scope enum: ${exhaustiveCheck}`);
  }
}

function mapSyncEvent(event: SyncEventModel): ServerSyncEvent {
  return {
    id: event.id,
    scope: fromSyncScope(event.scope),
    type: event.type,
    payload: (event.payload ?? {}) as Record<string, unknown>,
    occurredAt: event.occurredAt.toISOString(),
    serverSeq: event.serverSeq,
    clientId: event.clientId,
    dedupeKey: event.dedupeKey,
  };
}

async function getLatestServerSeq(
  scope: SyncScope,
  client?: Prisma.TransactionClient,
): Promise<number> {
  const db = getDb(client);
  const latest = await db.syncEvent.findFirst({
    where: { scope },
    orderBy: { serverSeq: "desc" },
    select: { serverSeq: true },
  });

  return latest?.serverSeq ?? 0;
}

function clampLimit(value: number | null | undefined, max: number): number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return max;
  }

  const normalized = Math.max(1, Math.floor(value));
  return Math.min(normalized, max);
}

export function buildSyncEtag(
  ...parts: Array<string | number | boolean | null | undefined>
): string {
  const hash = createHash("sha256");

  for (const part of parts) {
    if (part === null || typeof part === "undefined") {
      hash.update("-");
    } else {
      hash.update(String(part));
    }

    hash.update("|");
  }

  return hash.digest("base64url");
}

export async function selectBaseline(
  scope: OfflineScope,
  options: BaselineOptions = {},
): Promise<BaselineResult> {
  const normalizedScope = toSyncScope(scope);
  const limit = clampLimit(options.limit, MAX_BASELINE_LIMIT);
  const capturedAt = new Date().toISOString();
  const serverSeq = await getLatestServerSeq(normalizedScope);

  if (scope === "inventory") {
    const items = await prisma.inventoryItem.findMany({
      orderBy: { id: "asc" },
      take: limit + 1,
      ...(options.cursor
        ? {
            skip: 1,
            cursor: { id: options.cursor },
          }
        : {}),
    });

    const hasMore = items.length > limit;
    const records = hasMore ? items.slice(0, limit) : items;

    const mapped: InventoryItemRecord[] = records.map((item) => ({
      id: item.id,
      sku: item.id,
      name: item.name,
      quantity: item.qty,
      updatedAt: capturedAt,
    }));

    return {
      scope,
      records: mapped,
      serverSeq,
      capturedAt,
      hasMore,
      nextCursor: hasMore ? records[records.length - 1]?.id : undefined,
    } satisfies InventoryBaselineResult;
  }

  if (scope === "tickets") {
    const tickets = await prisma.ticket.findMany({
      orderBy: { id: "asc" },
      take: limit + 1,
      ...(options.cursor
        ? {
            skip: 1,
            cursor: { id: options.cursor },
          }
        : {}),
    });

    const hasMore = tickets.length > limit;
    const records = hasMore ? tickets.slice(0, limit) : tickets;

    const mapped: TicketRecord[] = records.map((ticket) => ({
      id: ticket.id,
      code: ticket.code,
      status: ticket.status as TicketRecord["status"],
      holderName: ticket.holderName ?? undefined,
      eventId: ticket.eventId,
      updatedAt: ticket.updatedAt.toISOString(),
    }));

    return {
      scope,
      records: mapped,
      serverSeq,
      capturedAt,
      hasMore,
      nextCursor: hasMore ? records[records.length - 1]?.id : undefined,
    } satisfies TicketBaselineResult;
  }

  const hasMore = false;
  return {
    scope,
    records: [],
    serverSeq,
    capturedAt,
    hasMore,
  } satisfies TicketBaselineResult;
}

export async function selectDeltas(
  scope: OfflineScope,
  lastServerSeq: number,
  options: DeltaOptions = {},
): Promise<DeltaResult> {
  const normalizedScope = toSyncScope(scope);
  const limit = clampLimit(options.limit, MAX_DELTA_LIMIT);
  const serverSeq = await getLatestServerSeq(normalizedScope);

  if (lastServerSeq >= serverSeq) {
    return {
      scope,
      events: [],
      serverSeq,
      hasMore: false,
    };
  }

  const events = await prisma.syncEvent.findMany({
    where: {
      scope: normalizedScope,
      serverSeq: { gt: lastServerSeq },
    },
    orderBy: { serverSeq: "asc" },
    take: limit + 1,
  });

  const hasMore = events.length > limit;
  const trimmed = hasMore ? events.slice(0, limit) : events;

  return {
    scope,
    events: trimmed.map(mapSyncEvent),
    serverSeq,
    hasMore,
    nextCursor: trimmed.at(-1)?.serverSeq,
  };
}

function normalizeIncomingEvent(event: IncomingEventInput): NormalizedIncomingEvent {
  const occurredAt = new Date(event.occurredAt);

  if (Number.isNaN(occurredAt.getTime())) {
    throw new Error(`Invalid occurredAt timestamp for event ${event.id ?? "<unknown>"}`);
  }

  return {
    id: event.id ?? randomUUID(),
    dedupeKey: event.dedupeKey ?? null,
    type: event.type,
    payload: event.payload,
    occurredAt: occurredAt.toISOString(),
  } satisfies NormalizedIncomingEvent;
}

function validateIncomingEventPayload(
  scope: OfflineScope,
  event: NormalizedIncomingEvent,
): Record<string, unknown> {
  if (scope === "inventory") {
    if (event.type !== "inventory.adjustment") {
      const issue: ZodIssue = {
        code: z.ZodIssueCode.custom,
        path: ["type"],
        message: "Expected inventory.adjustment event type",
      };

      throw new SyncEventValidationError("Unsupported inventory event type", [issue]);
    }

    const result = inventoryEventPayloadSchema.safeParse(event.payload);

    if (!result.success) {
      throw new SyncEventValidationError("Invalid inventory event payload", result.error.issues);
    }

    return result.data;
  }

  if (scope === "tickets") {
    if (event.type !== "ticket.checkin") {
      const issue: ZodIssue = {
        code: z.ZodIssueCode.custom,
        path: ["type"],
        message: "Expected ticket.checkin event type",
      };

      throw new SyncEventValidationError("Unsupported ticket event type", [issue]);
    }

    const result = ticketEventPayloadSchema.safeParse(event.payload);

    if (!result.success) {
      throw new SyncEventValidationError("Invalid ticket event payload", result.error.issues);
    }

    return result.data;
  }

  const issue: ZodIssue = {
    code: z.ZodIssueCode.custom,
    path: ["scope"],
    message: `Unsupported scope ${scope}`,
  };

  throw new SyncEventValidationError("Unsupported sync scope", [issue]);
}

export async function applyIncomingEvents(
  payload: ApplyIncomingEventsInput,
): Promise<ApplyIncomingEventsResult> {
  const normalizedScope = toSyncScope(payload.scope);
  const normalizedEvents = payload.events.map(normalizeIncomingEvent);
  const validatedEvents = normalizedEvents.map((event) => ({
    ...event,
    payload: validateIncomingEventPayload(payload.scope, event),
  } satisfies NormalizedIncomingEvent));

  return prisma.$transaction(async (tx) => {
    const currentSeq = await getLatestServerSeq(normalizedScope, tx);

    if (currentSeq !== payload.lastKnownServerSeq) {
      return {
        status: "stale",
        serverSeq: currentSeq,
        events: [],
      } satisfies ApplyIncomingEventsResult;
    }

    const existingMutation = await tx.syncMutation.findUnique({
      where: { clientMutationId: payload.clientMutationId },
    });

    if (existingMutation) {
      const previousEvents = await tx.syncEvent.findMany({
        where: { clientMutationId: payload.clientMutationId },
        orderBy: { serverSeq: "asc" },
      });

      return {
        status: "duplicate",
        serverSeq: existingMutation.lastServerSeq ?? existingMutation.acknowledgedSeq,
        events: previousEvents.map(mapSyncEvent),
        mutation: existingMutation,
      } satisfies ApplyIncomingEventsResult;
    }

    const eventIds = validatedEvents.map((event) => event.id);
    const dedupeKeys = validatedEvents
      .map((event) => event.dedupeKey)
      .filter((key): key is string => typeof key === "string" && key.length > 0);

    const [existingEvents, existingDedupe] = await Promise.all([
      eventIds.length
        ? tx.syncEvent.findMany({
            where: { id: { in: eventIds } },
            select: { id: true },
          })
        : Promise.resolve([]),
      dedupeKeys.length
        ? tx.syncEvent.findMany({
            where: {
              scope: normalizedScope,
              dedupeKey: { in: dedupeKeys },
            },
            select: { dedupeKey: true },
          })
        : Promise.resolve([]),
    ]);

    const existingIdSet = new Set(existingEvents.map((event) => event.id));
    const existingDedupeSet = new Set(existingDedupe.map((event) => event.dedupeKey).filter(Boolean));

    const skipped: SkippedIncomingEvent[] = [];
    const filtered: NormalizedIncomingEvent[] = [];

    for (const event of validatedEvents) {
      if (existingIdSet.has(event.id)) {
        skipped.push({ id: event.id, dedupeKey: event.dedupeKey, reason: "duplicate-id" });
        continue;
      }

      if (event.dedupeKey) {
        if (existingDedupeSet.has(event.dedupeKey)) {
          skipped.push({ id: event.id, dedupeKey: event.dedupeKey, reason: "duplicate-dedupe-key" });
          continue;
        }

        existingDedupeSet.add(event.dedupeKey);
      }

      filtered.push(event);
    }

    const mutation = await tx.syncMutation.create({
      data: {
        clientMutationId: payload.clientMutationId,
        clientId: payload.clientId,
        scope: normalizedScope,
        eventCount: filtered.length,
        acknowledgedSeq: currentSeq,
      },
    });

    const insertedEvents: SyncEventModel[] = [];

    for (const event of filtered) {
      const created = await tx.syncEvent.create({
        data: {
          id: event.id,
          scope: normalizedScope,
          clientId: payload.clientId,
          clientMutationId: mutation.clientMutationId,
          dedupeKey: event.dedupeKey,
          type: event.type,
          payload: event.payload as Prisma.InputJsonValue,
          occurredAt: new Date(event.occurredAt),
        },
      });

      insertedEvents.push(created);
    }

    const newSeq = insertedEvents.at(-1)?.serverSeq ?? currentSeq;

    const updatedMutation = await tx.syncMutation.update({
      where: { clientMutationId: mutation.clientMutationId },
      data: {
        eventCount: insertedEvents.length,
        firstServerSeq: insertedEvents.at(0)?.serverSeq ?? null,
        lastServerSeq: insertedEvents.at(-1)?.serverSeq ?? null,
        acknowledgedSeq: newSeq,
      },
    });

    return {
      status: "applied",
      serverSeq: newSeq,
      events: insertedEvents.map(mapSyncEvent),
      skipped,
      mutation: updatedMutation,
    } satisfies ApplyIncomingEventsResult;
  });
}

export async function getScopeWatermark(scope: OfflineScope): Promise<number> {
  return getLatestServerSeq(toSyncScope(scope));
}
