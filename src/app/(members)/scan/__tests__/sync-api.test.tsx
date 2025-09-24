import type { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, test, vi } from "vitest";

type SyncScopeValue = "inventory" | "tickets";
type TicketStatusValue = "unused" | "checked_in" | "invalid" | "pending";

interface InventoryItemRow {
  id: string;
  name: string;
  qty: number;
}

interface TicketRow {
  id: string;
  code: string;
  eventId: string;
  holderName: string | null;
  status: TicketStatusValue;
  updatedAt: Date;
}

interface SyncEventRow {
  id: string;
  scope: SyncScopeValue;
  clientId: string;
  clientMutationId: string;
  dedupeKey: string | null;
  type: string;
  payload: Record<string, unknown>;
  occurredAt: Date;
  serverSeq: number;
}

interface SyncMutationRow {
  clientMutationId: string;
  clientId: string;
  scope: SyncScopeValue;
  eventCount: number;
  firstServerSeq: number | null;
  lastServerSeq: number | null;
  acknowledgedSeq: number;
}

const fakeDb: {
  inventoryItems: InventoryItemRow[];
  tickets: TicketRow[];
  syncEvents: SyncEventRow[];
  syncMutations: SyncMutationRow[];
} = {
  inventoryItems: [],
  tickets: [],
  syncEvents: [],
  syncMutations: [],
};

let serverSeqCounter = 0;

function normalizeScope(value: unknown): SyncScopeValue {
  if (value === "inventory") {
    return "inventory";
  }

  if (value === "tickets") {
    return "tickets";
  }

  throw new Error(`Unsupported sync scope: ${String(value)}`);
}

function toDate(value: Date | string | number | null | undefined): Date {
  if (value instanceof Date) {
    return new Date(value.getTime());
  }

  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  return new Date();
}

function cloneInventoryItem(item: InventoryItemRow): InventoryItemRow {
  return { ...item };
}

function cloneTicket(ticket: TicketRow): TicketRow {
  return {
    ...ticket,
    updatedAt: new Date(ticket.updatedAt.getTime()),
  };
}

function cloneSyncEvent(event: SyncEventRow): SyncEventRow {
  return {
    ...event,
    occurredAt: new Date(event.occurredAt.getTime()),
    payload: { ...event.payload },
  };
}

function cloneSyncMutation(mutation: SyncMutationRow): SyncMutationRow {
  return { ...mutation };
}

function matchesStringFilter(
  value: string,
  filter?: string | Prisma.StringFilter,
): boolean {
  if (typeof filter === "undefined") {
    return true;
  }

  if (typeof filter === "string") {
    return value === filter;
  }

  if (filter && typeof filter === "object") {
    if (typeof filter.equals === "string" && value !== filter.equals) {
      return false;
    }

    if (Array.isArray(filter.in) && !filter.in.includes(value)) {
      return false;
    }

    if (filter.not) {
      if (typeof filter.not === "string") {
        return value !== filter.not;
      }

      return !matchesStringFilter(value, filter.not);
    }
  }

  return true;
}

function matchesNullableStringFilter(
  value: string | null,
  filter?: string | null | Prisma.StringNullableFilter,
): boolean {
  if (typeof filter === "undefined") {
    return true;
  }

  if (filter === null) {
    return value === null;
  }

  if (typeof filter === "string") {
    return value === filter;
  }

  if (filter && typeof filter === "object") {
    if (filter.equals !== undefined && value !== filter.equals) {
      return false;
    }

    if (Array.isArray(filter.in)) {
      const allowed = filter.in.filter(
        (item): item is string | null =>
          typeof item === "string" || item === null,
      );

      if (!allowed.includes(value)) {
        return false;
      }
    }

    if (filter.not) {
      if (filter.not === null) {
        return value !== null;
      }

      if (typeof filter.not === "string") {
        return value !== filter.not;
      }

      return !matchesNullableStringFilter(value, filter.not);
    }
  }

  return true;
}

function matchesScopeFilter(value: SyncScopeValue, filter?: unknown): boolean {
  if (typeof filter === "undefined") {
    return true;
  }

  if (typeof filter === "string") {
    return value === normalizeScope(filter);
  }

  if (filter && typeof filter === "object") {
    const scoped = filter as {
      equals?: unknown;
      in?: unknown[];
      not?: unknown;
    };

    if (typeof scoped.equals !== "undefined") {
      return value === normalizeScope(scoped.equals);
    }

    if (Array.isArray(scoped.in)) {
      const allowed = scoped.in.map(normalizeScope);
      return allowed.includes(value);
    }

    if (typeof scoped.not !== "undefined") {
      return !matchesScopeFilter(value, scoped.not);
    }
  }

  return true;
}

function matchesIntFilter(
  value: number,
  filter?: number | Prisma.IntFilter,
): boolean {
  if (typeof filter === "undefined") {
    return true;
  }

  if (typeof filter === "number") {
    return value === filter;
  }

  if (filter && typeof filter === "object") {
    if (typeof filter.equals === "number" && value !== filter.equals) {
      return false;
    }

    if (typeof filter.gt === "number" && !(value > filter.gt)) {
      return false;
    }

    if (typeof filter.gte === "number" && !(value >= filter.gte)) {
      return false;
    }

    if (typeof filter.lt === "number" && !(value < filter.lt)) {
      return false;
    }

    if (typeof filter.lte === "number" && !(value <= filter.lte)) {
      return false;
    }

    if (Array.isArray(filter.in) && !filter.in.includes(value)) {
      return false;
    }

    if (filter.not) {
      if (typeof filter.not === "number") {
        return value !== filter.not;
      }

      return !matchesIntFilter(value, filter.not);
    }
  }

  return true;
}

function pickBySelect<TRecord extends Record<string, unknown>>(
  record: TRecord,
  select: Record<string, boolean | undefined>,
) {
  const result: Record<string, unknown> = {};

  for (const [key, enabled] of Object.entries(select)) {
    if (enabled) {
      result[key] = record[key as keyof TRecord];
    }
  }

  return result;
}

function filterSyncEvents(where?: Prisma.SyncEventWhereInput): SyncEventRow[] {
  if (!where) {
    return [...fakeDb.syncEvents];
  }

  return fakeDb.syncEvents.filter((event) => {
    if (!matchesScopeFilter(event.scope, where.scope)) {
      return false;
    }

    if (!matchesIntFilter(event.serverSeq, where.serverSeq)) {
      return false;
    }

    if (
      !matchesStringFilter(
        event.clientMutationId,
        where.clientMutationId as string | Prisma.StringFilter | undefined,
      )
    ) {
      return false;
    }

    if (
      !matchesStringFilter(
        event.clientId,
        where.clientId as string | Prisma.StringFilter | undefined,
      )
    ) {
      return false;
    }

    if (
      !matchesStringFilter(
        event.id,
        where.id as string | Prisma.StringFilter | undefined,
      )
    ) {
      return false;
    }

    if (!matchesNullableStringFilter(event.dedupeKey, where.dedupeKey)) {
      return false;
    }

    return true;
  });
}

function resolveIntUpdate(
  value: number | Prisma.IntFieldUpdateOperationsInput | undefined,
  previous: number,
): number {
  if (typeof value === "number") {
    return value;
  }

  if (value && typeof value === "object") {
    if (typeof value.set === "number") {
      return value.set;
    }

    if (typeof value.increment === "number") {
      return previous + value.increment;
    }

    if (typeof value.decrement === "number") {
      return previous - value.decrement;
    }
  }

  return previous;
}

function resolveNullableIntUpdate(
  value: number | null | Prisma.NullableIntFieldUpdateOperationsInput | undefined,
  previous: number | null,
): number | null {
  if (typeof value === "number" || value === null) {
    return value ?? null;
  }

  if (value && typeof value === "object") {
    if (value.set === null) {
      return null;
    }

    if (typeof value.set === "number") {
      return value.set;
    }
  }

  return previous;
}

const prismaStub = {
  inventoryItem: {
    createMany: async ({ data }: Prisma.InventoryItemCreateManyArgs) => {
      const records = Array.isArray(data) ? data : [data];
      const normalized = records.map((item, index) => ({
        id: item.id ?? `inventory-${fakeDb.inventoryItems.length + index + 1}`,
        name: item.name ?? "",
        qty: item.qty ?? 0,
      }));

      fakeDb.inventoryItems.push(...normalized);
      fakeDb.inventoryItems.sort((a, b) => a.id.localeCompare(b.id));

      return { count: normalized.length };
    },
    deleteMany: async () => {
      const count = fakeDb.inventoryItems.length;
      fakeDb.inventoryItems = [];
      return { count };
    },
    findMany: async (options: Prisma.InventoryItemFindManyArgs = {}) => {
      let items = fakeDb.inventoryItems.map(cloneInventoryItem);

      items.sort((a, b) => a.id.localeCompare(b.id));

      if (options.cursor?.id) {
        const index = items.findIndex((item) => item.id === options.cursor?.id);
        if (index >= 0) {
          const skip = options.skip ?? 0;
          items = items.slice(index + skip);
        }
      } else if (typeof options.skip === "number" && options.skip > 0) {
        items = items.slice(options.skip);
      }

      if (typeof options.take === "number") {
        items = items.slice(0, options.take);
      }

      if (options.select) {
        const select = options.select as Record<string, boolean | undefined>;
        const selected = items.map((item) => pickBySelect(item, select));
        return selected as unknown;
      }

      return items as unknown;
    },
  },
  ticket: {
    create: async ({ data }: Prisma.TicketCreateArgs) => {
      const ticket: TicketRow = {
        id: data.data.id ?? `ticket-${fakeDb.tickets.length + 1}`,
        code: data.data.code ?? `code-${fakeDb.tickets.length + 1}`,
        eventId: data.data.eventId ?? "event",
        holderName: data.data.holderName ?? null,
        status: (data.data.status as TicketStatusValue | undefined) ?? "unused",
        updatedAt: toDate(data.data.updatedAt ?? new Date()),
      };

      fakeDb.tickets.push(ticket);
      fakeDb.tickets.sort((a, b) => a.id.localeCompare(b.id));

      return cloneTicket(ticket) as unknown;
    },
    deleteMany: async () => {
      const count = fakeDb.tickets.length;
      fakeDb.tickets = [];
      return { count };
    },
    findMany: async (options: Prisma.TicketFindManyArgs = {}) => {
      let tickets = fakeDb.tickets.map(cloneTicket);

      tickets.sort((a, b) => a.id.localeCompare(b.id));

      if (options.cursor?.id) {
        const index = tickets.findIndex((ticket) => ticket.id === options.cursor?.id);
        if (index >= 0) {
          const skip = options.skip ?? 0;
          tickets = tickets.slice(index + skip);
        }
      } else if (typeof options.skip === "number" && options.skip > 0) {
        tickets = tickets.slice(options.skip);
      }

      if (typeof options.take === "number") {
        tickets = tickets.slice(0, options.take);
      }

      if (options.select) {
        const select = options.select as Record<string, boolean | undefined>;
        const selected = tickets.map((ticket) => pickBySelect(ticket, select));
        return selected as unknown;
      }

      return tickets as unknown;
    },
  },
  syncEvent: {
    create: async (args: Prisma.SyncEventCreateArgs) => {
      const input = args?.data;
      if (!input) {
        throw new Error("Missing sync event data");
      }

      const event: SyncEventRow = {
        id: input.id ?? `evt-${serverSeqCounter + 1}`,
        scope: normalizeScope(input.scope),
        clientId: input.clientId ?? "client",
        clientMutationId:
          input.clientMutationId ?? `mutation-${serverSeqCounter + 1}`,
        dedupeKey: (input.dedupeKey as string | null | undefined) ?? null,
        type: input.type ?? "event",
        payload: (input.payload ?? {}) as Record<string, unknown>,
        occurredAt: toDate(input.occurredAt as Date | string | undefined),
        serverSeq: ++serverSeqCounter,
      };

      fakeDb.syncEvents.push(event);

      return cloneSyncEvent(event) as unknown;
    },
    findMany: async (options: Prisma.SyncEventFindManyArgs = {}) => {
      let events = filterSyncEvents(options.where);

      const order = Array.isArray(options.orderBy)
        ? options.orderBy[0]
        : options.orderBy;

      if (order && typeof order === "object" && order.serverSeq === "desc") {
        events = [...events].sort((a, b) => b.serverSeq - a.serverSeq);
      } else {
        events = [...events].sort((a, b) => a.serverSeq - b.serverSeq);
      }

      if (typeof options.skip === "number" && options.skip > 0) {
        events = events.slice(options.skip);
      }

      if (typeof options.take === "number") {
        events = events.slice(0, options.take);
      }

      const clones = events.map(cloneSyncEvent);

      if (options.select) {
        const select = options.select as Record<string, boolean | undefined>;
        const selected = clones.map((event) => pickBySelect(event, select));
        return selected as unknown;
      }

      return clones as unknown;
    },
    findFirst: async (options: Prisma.SyncEventFindFirstArgs = {}) => {
      const results = (await prismaStub.syncEvent.findMany({
        ...options,
        take: 1,
      })) as Array<Record<string, unknown>>;

      return (results[0] ?? null) as unknown;
    },
    deleteMany: async () => {
      const count = fakeDb.syncEvents.length;
      fakeDb.syncEvents = [];
      return { count };
    },
  },
  syncMutation: {
    create: async (args: Prisma.SyncMutationCreateArgs) => {
      const input = args?.data;
      if (!input) {
        throw new Error("Missing sync mutation data");
      }

      const mutation: SyncMutationRow = {
        clientMutationId:
          input.clientMutationId ?? `mutation-${fakeDb.syncMutations.length + 1}`,
        clientId: input.clientId ?? "client",
        scope: normalizeScope(input.scope),
        eventCount: input.eventCount ?? 0,
        firstServerSeq: (input.firstServerSeq as number | null | undefined) ?? null,
        lastServerSeq: (input.lastServerSeq as number | null | undefined) ?? null,
        acknowledgedSeq: input.acknowledgedSeq as number,
      };

      fakeDb.syncMutations.push(mutation);

      return cloneSyncMutation(mutation) as unknown;
    },
    findUnique: async ({ where }: Prisma.SyncMutationFindUniqueArgs) => {
      if (!where?.clientMutationId) {
        return null;
      }

      const found = fakeDb.syncMutations.find(
        (mutation) => mutation.clientMutationId === where.clientMutationId,
      );

      return found ? (cloneSyncMutation(found) as unknown) : null;
    },
    update: async ({ where, data }: Prisma.SyncMutationUpdateArgs) => {
      if (!where?.clientMutationId) {
        throw new Error("Missing clientMutationId");
      }

      const index = fakeDb.syncMutations.findIndex(
        (mutation) => mutation.clientMutationId === where.clientMutationId,
      );

      if (index < 0) {
        throw new Error("Mutation not found");
      }

      const existing = fakeDb.syncMutations[index];

      const updated: SyncMutationRow = {
        ...existing,
        eventCount: resolveIntUpdate(data.eventCount, existing.eventCount),
        firstServerSeq: resolveNullableIntUpdate(
          data.firstServerSeq,
          existing.firstServerSeq,
        ),
        lastServerSeq: resolveNullableIntUpdate(
          data.lastServerSeq,
          existing.lastServerSeq,
        ),
        acknowledgedSeq: resolveIntUpdate(
          data.acknowledgedSeq,
          existing.acknowledgedSeq,
        ),
      };

      fakeDb.syncMutations[index] = updated;

      return cloneSyncMutation(updated) as unknown;
    },
    deleteMany: async () => {
      const count = fakeDb.syncMutations.length;
      fakeDb.syncMutations = [];
      return { count };
    },
  },
  $transaction: async (
    callback: (tx: typeof prismaStub) => Promise<unknown>,
  ): Promise<unknown> => {
    return callback(prismaStub);
  },
};

vi.mock("@/lib/prisma", () => ({ prisma: prismaStub }));

const { GET: initialRoute } = await import("@/app/api/sync/initial/route");
const { POST: pullRoute } = await import("@/app/api/sync/pull/route");
const { POST: pushRoute } = await import("@/app/api/sync/push/route");

function resetDatabase() {
  fakeDb.inventoryItems = [];
  fakeDb.tickets = [];
  fakeDb.syncEvents = [];
  fakeDb.syncMutations = [];
  serverSeqCounter = 0;
}

beforeEach(() => {
  resetDatabase();
});

describe("sync API integration", () => {
  test("returns paginated inventory baseline with cache headers", async () => {
    await prismaStub.inventoryItem.createMany({
      data: [
        { id: "item-a", name: "Akkupack", qty: 4 },
        { id: "item-b", name: "Bühnenlicht", qty: 6 },
        { id: "item-c", name: "Kabelsatz", qty: 12 },
      ],
    });

    const request = new Request(
      "http://localhost/api/sync/initial?scope=inventory&limit=2",
    );

    const response = await initialRoute(request);
    expect(response.status).toBe(200);
    expect(response.headers.get("ETag")).toBeTruthy();

    const payload = await response.json();
    expect(payload).toMatchObject({
      scope: "inventory",
      hasMore: true,
      nextCursor: "item-b",
      serverSeq: 0,
    });
    expect(payload.records).toHaveLength(2);
    expect(payload.records[0]).toMatchObject({ id: "item-a", quantity: 4 });
  });

  test("returns incremental ticket events when pulling after a server sequence", async () => {
    const mutation = (await prismaStub.syncMutation.create({
      data: {
        clientMutationId: "seed-mutation",
        clientId: "scanner-seed",
        scope: "tickets",
        eventCount: 0,
        acknowledgedSeq: 0,
      },
    })) as SyncMutationRow;

    const firstEvent = (await prismaStub.syncEvent.create({
      data: {
        id: "evt-1",
        scope: "tickets",
        clientId: "scanner-seed",
        clientMutationId: mutation.clientMutationId,
        dedupeKey: "ticket:T-1",
        type: "ticket.checkin",
        payload: { ticketId: "T-1", status: "checked_in" },
        occurredAt: new Date("2025-01-10T08:00:00.000Z"),
      },
    })) as SyncEventRow;

    await prismaStub.syncEvent.create({
      data: {
        id: "evt-2",
        scope: "tickets",
        clientId: "scanner-seed",
        clientMutationId: mutation.clientMutationId,
        dedupeKey: "ticket:T-2",
        type: "ticket.checkin",
        payload: { ticketId: "T-2", status: "checked_in" },
        occurredAt: new Date("2025-01-10T09:15:00.000Z"),
      },
    });

    const pullRequest = new Request("http://localhost/api/sync/pull", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scope: "tickets", lastServerSeq: 0, limit: 10 }),
    });

    const response = await pullRoute(pullRequest);
    expect(response.status).toBe(200);
    expect(response.headers.get("ETag")).toBeTruthy();

    const payload = await response.json();
    expect(payload).toMatchObject({
      scope: "tickets",
      serverSeq: 2,
      hasMore: false,
      nextCursor: 2,
    });
    expect(payload.events).toHaveLength(2);
    expect(payload.events[0]).toMatchObject({ id: firstEvent.id, dedupeKey: "ticket:T-1" });
  });

  test("applies incoming ticket events and skips duplicates by dedupe key", async () => {
    const existingMutation = (await prismaStub.syncMutation.create({
      data: {
        clientMutationId: "existing",
        clientId: "scanner-1",
        scope: "tickets",
        eventCount: 1,
        acknowledgedSeq: 0,
      },
    })) as SyncMutationRow;

    const existingEvent = (await prismaStub.syncEvent.create({
      data: {
        id: "evt-existing",
        scope: "tickets",
        clientId: "scanner-1",
        clientMutationId: existingMutation.clientMutationId,
        dedupeKey: "ticket:T-1",
        type: "ticket.checkin",
        payload: { ticketId: "T-1", status: "checked_in" },
        occurredAt: new Date("2025-01-10T07:00:00.000Z"),
      },
    })) as SyncEventRow;

    await prismaStub.syncMutation.update({
      where: { clientMutationId: existingMutation.clientMutationId },
      data: {
        eventCount: 1,
        firstServerSeq: existingEvent.serverSeq,
        lastServerSeq: existingEvent.serverSeq,
        acknowledgedSeq: existingEvent.serverSeq,
      },
    });

    const pushRequest = new Request("http://localhost/api/sync/push", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scope: "tickets",
        clientId: "scanner-2",
        clientMutationId: "mutation-1",
        lastKnownServerSeq: existingEvent.serverSeq,
        events: [
          {
            id: "evt-new",
            dedupeKey: "ticket:T-2",
            type: "ticket.checkin",
            payload: { ticketId: "T-2", status: "checked_in" },
            occurredAt: "2025-01-10T10:00:00.000Z",
          },
          {
            id: "evt-duplicate",
            dedupeKey: "ticket:T-1",
            type: "ticket.checkin",
            payload: { ticketId: "T-1", status: "checked_in" },
            occurredAt: "2025-01-10T10:05:00.000Z",
          },
        ],
      }),
    });

    const response = await pushRoute(pushRequest);
    expect(response.status).toBe(200);
    expect(response.headers.get("X-Sync-Status")).toBe("applied");

    const payload = await response.json();
    expect(payload.status).toBe("applied");
    expect(payload.skipped).toEqual([
      { id: "evt-duplicate", dedupeKey: "ticket:T-1", reason: "duplicate-dedupe-key" },
    ]);
    expect(payload.events).toHaveLength(1);
    expect(payload.events[0]).toMatchObject({ id: "evt-new", dedupeKey: "ticket:T-2" });
  });
});
