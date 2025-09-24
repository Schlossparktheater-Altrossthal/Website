import { randomUUID } from "node:crypto";

import {
  Prisma,
  SyncScope,
  TicketStatus,
  type Ticket,
  type TicketScanEvent,
} from "@prisma/client";

export type TransactionClient = Prisma.TransactionClient;

type TicketIdentifier = {
  ticketId?: string | null;
  code?: string | null;
};

export interface TicketCheckInInput extends TicketIdentifier {
  dedupeKey?: string | null;
  occurredAt?: Date | string | null;
  source?: string | null;
  clientId?: string | null;
  clientMutationId?: string | null;
}

export interface TicketCheckInResult {
  ticket: Ticket;
  scanEvent: TicketScanEvent | null;
  status: TicketStatus;
  provisional: boolean;
  serverSeq: number | null;
  alreadyCheckedIn: boolean;
}

export class TicketCheckInError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: "NOT_FOUND" | "INVALID_STATE" | "INVALID_INPUT",
  ) {
    super(message);
    this.name = "TicketCheckInError";
  }
}

export function normalizeOccurredAt(value?: Date | string | null): Date {
  if (!value) {
    return new Date();
  }

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw new TicketCheckInError(
        "Zeitstempel für Scan ungültig.",
        400,
        "INVALID_INPUT",
      );
    }

    return value;
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    throw new TicketCheckInError(
      "Zeitstempel für Scan ungültig.",
      400,
      "INVALID_INPUT",
    );
  }

  return parsed;
}

export function computeDedupeKey(ticketId: string, provided?: string | null): string {
  if (provided && provided.trim().length > 0) {
    return provided.trim();
  }

  if (!ticketId || ticketId.trim().length === 0) {
    throw new TicketCheckInError(
      "Ticket-Identifikator fehlt.",
      400,
      "INVALID_INPUT",
    );
  }

  return `ticket:${ticketId}`;
}

export function serializeTicketForPayload(ticket: Ticket): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    id: ticket.id,
    code: ticket.code,
    status: ticket.status,
    eventId: ticket.eventId,
    updatedAt: ticket.updatedAt.toISOString(),
  };

  if (ticket.holderName) {
    payload.holderName = ticket.holderName;
  }

  return payload;
}

export function serializeScanEventForPayload(
  scanEvent: TicketScanEvent,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    id: scanEvent.id,
    ticketId: scanEvent.ticketId,
    code: scanEvent.code,
    statusBefore: scanEvent.statusBefore,
    statusAfter: scanEvent.statusAfter,
    occurredAt: scanEvent.occurredAt.toISOString(),
    provisional: scanEvent.provisional,
  };

  if (scanEvent.processedAt) {
    payload.processedAt = scanEvent.processedAt.toISOString();
  }

  if (scanEvent.source) {
    payload.source = scanEvent.source;
  }

  if (scanEvent.dedupeKey) {
    payload.dedupeKey = scanEvent.dedupeKey;
  }

  return payload;
}

function isUniqueConstraintError(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

async function lockTicket(
  db: TransactionClient,
  identifier: TicketIdentifier,
): Promise<Ticket | null> {
  const { ticketId, code } = identifier;

  if (ticketId && ticketId.trim().length > 0) {
    const rows = await db.$queryRaw<Ticket[]>`
      SELECT * FROM "Ticket"
      WHERE id = ${ticketId}
      FOR UPDATE
    `;

    const ticket = rows[0] ?? null;

    if (ticket && code) {
      const normalizedCode = code.trim();

      if (normalizedCode.length > 0 && normalizedCode !== ticket.code) {
        throw new TicketCheckInError(
          "Ticket-Code stimmt nicht mit Ticket-ID überein.",
          400,
          "INVALID_INPUT",
        );
      }
    }

    return ticket;
  }

  if (code && code.trim().length > 0) {
    const normalizedCode = code.trim();
    const rows = await db.$queryRaw<Ticket[]>`
      SELECT * FROM "Ticket"
      WHERE code = ${normalizedCode}
      FOR UPDATE
    `;

    return rows[0] ?? null;
  }

  return null;
}

async function createSyncEnvelope(
  db: TransactionClient,
  ticket: Ticket,
  scanEvent: TicketScanEvent,
  dedupeKey: string,
  occurredAt: Date,
  clientId?: string | null,
  clientMutationId?: string | null,
): Promise<{ serverSeq: number; mutationId: string }> {
  const normalizedClientId = clientId?.trim() && clientId.trim().length > 0 ? clientId.trim() : "server";
  const mutationId =
    clientMutationId && clientMutationId.trim().length > 0
      ? clientMutationId.trim()
      : `ticket-checkin:${scanEvent.id}`;

  const latest = await db.syncEvent.findFirst({
    where: { scope: SyncScope.tickets },
    orderBy: { serverSeq: "desc" },
    select: { serverSeq: true },
  });

  await db.syncMutation.create({
    data: {
      clientMutationId: mutationId,
      clientId: normalizedClientId,
      scope: SyncScope.tickets,
      eventCount: 0,
      acknowledgedSeq: latest?.serverSeq ?? 0,
    },
  });

  const payload = {
    ticket: serializeTicketForPayload(ticket),
    scanEvent: serializeScanEventForPayload(scanEvent),
  } satisfies Record<string, unknown>;

  const created = await db.syncEvent.create({
    data: {
      id: randomUUID(),
      scope: SyncScope.tickets,
      clientId: normalizedClientId,
      clientMutationId: mutationId,
      dedupeKey,
      type: "ticket.checkin",
      payload: payload as Prisma.InputJsonValue,
      occurredAt,
    },
  });

  await db.syncMutation.update({
    where: { clientMutationId: mutationId },
    data: {
      eventCount: 1,
      firstServerSeq: created.serverSeq,
      lastServerSeq: created.serverSeq,
      acknowledgedSeq: created.serverSeq,
    },
  });

  return { serverSeq: created.serverSeq, mutationId };
}

export async function checkInTicket(
  db: TransactionClient,
  input: TicketCheckInInput,
): Promise<TicketCheckInResult> {
  const occurredAt = normalizeOccurredAt(input.occurredAt);
  const dedupeFromPayload = input.dedupeKey?.trim() && input.dedupeKey.trim().length > 0 ? input.dedupeKey.trim() : null;

  if (dedupeFromPayload) {
    const existing = await db.ticketScanEvent.findUnique({
      where: { dedupeKey: dedupeFromPayload },
      include: { ticket: true },
    });

    if (existing?.ticket) {
      return {
        ticket: existing.ticket,
        scanEvent: existing,
        status: existing.statusAfter,
        provisional: existing.provisional,
        serverSeq: existing.serverSeq ?? null,
        alreadyCheckedIn: existing.statusAfter === TicketStatus.checked_in,
      } satisfies TicketCheckInResult;
    }
  }

  const ticket = await lockTicket(db, {
    ticketId: input.ticketId,
    code: input.code,
  });

  if (!ticket) {
    throw new TicketCheckInError("Ticket wurde nicht gefunden.", 404, "NOT_FOUND");
  }

  if (ticket.status === TicketStatus.invalid) {
    throw new TicketCheckInError(
      "Ticket ist ungültig und kann nicht eingecheckt werden.",
      409,
      "INVALID_STATE",
    );
  }

  if (ticket.status === TicketStatus.checked_in) {
    const latestEvent = await db.ticketScanEvent.findFirst({
      where: { ticketId: ticket.id },
      orderBy: { occurredAt: "desc" },
    });

    return {
      ticket,
      scanEvent: latestEvent ?? null,
      status: ticket.status,
      provisional: latestEvent?.provisional ?? false,
      serverSeq: latestEvent?.serverSeq ?? null,
      alreadyCheckedIn: true,
    } satisfies TicketCheckInResult;
  }

  if (ticket.status !== TicketStatus.unused) {
    throw new TicketCheckInError(
      "Ticket befindet sich in einem unbekannten Status.",
      409,
      "INVALID_STATE",
    );
  }

  const updatedTicket = await db.ticket.update({
    where: { id: ticket.id },
    data: { status: TicketStatus.checked_in },
  });

  const dedupeKey = computeDedupeKey(updatedTicket.id, dedupeFromPayload);
  const processedAt = new Date();
  const normalizedSource = input.source?.trim() && input.source.trim().length > 0 ? input.source.trim() : null;
  const normalizedClientId = input.clientId?.trim() && input.clientId.trim().length > 0 ? input.clientId.trim() : null;
  const normalizedClientMutationId =
    input.clientMutationId?.trim() && input.clientMutationId.trim().length > 0
      ? input.clientMutationId.trim()
      : null;

  let scanEvent: TicketScanEvent;

  try {
    scanEvent = await db.ticketScanEvent.create({
      data: {
        ticketId: updatedTicket.id,
        code: updatedTicket.code,
        statusBefore: ticket.status,
        statusAfter: TicketStatus.checked_in,
        source: normalizedSource,
        occurredAt,
        dedupeKey,
        processedAt,
        provisional: false,
        clientId: normalizedClientId,
        clientMutationId: normalizedClientMutationId,
      },
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      const existing = await db.ticketScanEvent.findUnique({
        where: { dedupeKey },
        include: { ticket: true },
      });

      if (existing?.ticket) {
        return {
          ticket: existing.ticket,
          scanEvent: existing,
          status: existing.statusAfter,
          provisional: existing.provisional,
          serverSeq: existing.serverSeq ?? null,
          alreadyCheckedIn: existing.statusAfter === TicketStatus.checked_in,
        } satisfies TicketCheckInResult;
      }
    }

    throw error;
  }

  const syncEvent = await createSyncEnvelope(
    db,
    updatedTicket,
    scanEvent,
    dedupeKey,
    occurredAt,
    normalizedClientId,
    normalizedClientMutationId,
  );

  const finalizedEvent = await db.ticketScanEvent.update({
    where: { id: scanEvent.id },
    data: { serverSeq: syncEvent.serverSeq },
  });

  return {
    ticket: updatedTicket,
    scanEvent: finalizedEvent,
    status: updatedTicket.status,
    provisional: finalizedEvent.provisional,
    serverSeq: finalizedEvent.serverSeq ?? null,
    alreadyCheckedIn: false,
  } satisfies TicketCheckInResult;
}
