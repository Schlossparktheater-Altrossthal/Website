import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import {
  checkInTicket,
  TicketCheckInError,
  type TicketCheckInResult,
} from "@/lib/tickets/service";

const payloadSchema = z
  .object({
    ticketId: z.string().trim().min(1).optional(),
    code: z.string().trim().min(1).optional(),
    dedupeKey: z.string().trim().min(1).optional(),
    occurredAt: z.string().datetime().optional(),
    source: z.string().trim().min(1).optional(),
    clientId: z.string().trim().min(1).optional(),
    clientMutationId: z.string().trim().min(1).optional(),
  })
  .refine((value) => Boolean(value.ticketId || value.code), {
    message: "ticketId oder code erforderlich",
    path: ["code"],
  });

function formatTicket(response: TicketCheckInResult["ticket"]) {
  return {
    id: response.id,
    code: response.code,
    status: response.status,
    holderName: response.holderName ?? null,
    eventId: response.eventId,
    updatedAt: response.updatedAt.toISOString(),
  };
}

function formatScanEvent(event: TicketCheckInResult["scanEvent"]) {
  if (!event) {
    return null;
  }

  return {
    id: event.id,
    ticketId: event.ticketId,
    occurredAt: event.occurredAt.toISOString(),
    processedAt: event.processedAt ? event.processedAt.toISOString() : null,
    statusBefore: event.statusBefore,
    statusAfter: event.statusAfter,
    source: event.source ?? null,
    dedupeKey: event.dedupeKey ?? null,
    serverSeq: event.serverSeq ?? null,
    provisional: event.provisional,
  };
}

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const payload = payloadSchema.parse(json);

    const result = await prisma.$transaction((tx) =>
      checkInTicket(tx, {
        ticketId: payload.ticketId ?? null,
        code: payload.code ?? null,
        dedupeKey: payload.dedupeKey ?? null,
        occurredAt: payload.occurredAt ?? null,
        source: payload.source ?? "scanner",
        clientId: payload.clientId ?? null,
        clientMutationId: payload.clientMutationId ?? null,
      }),
    );

    const message = result.alreadyCheckedIn
      ? "Ticket wurde bereits eingecheckt."
      : "Ticket erfolgreich eingecheckt.";

    return NextResponse.json({
      status: result.status,
      provisional: result.provisional,
      serverSeq: result.serverSeq,
      alreadyCheckedIn: result.alreadyCheckedIn,
      message,
      ticket: formatTicket(result.ticket),
      event: formatScanEvent(result.scanEvent),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Ungültiger Ticket-Scan", issues: error.issues },
        { status: 400 },
      );
    }

    if (error instanceof TicketCheckInError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    }

    console.error("Ticket check-in failed", error);
    return NextResponse.json(
      { error: "Ticket-Check-in fehlgeschlagen" },
      { status: 500 },
    );
  }
}
