import { prisma } from "@/lib/prisma";

import type { TicketActor } from "./access";
import { actorRef } from "./access";
import { BookingError, createReservation, type ItemInput } from "./booking";

/** Gast in der Einlassliste – nur, was an der Tür gebraucht wird. */
export type DoorGuest = {
  id: string;
  code: string;
  name: string;
  source: string;
  status: string;
  tickets: number;
  checkedIn: number;
  summary: string;
  note: string | null;
  openCents: number;
};

export type DoorSnapshot = {
  eventId: string;
  capacity: number;
  guests: DoorGuest[];
  /** Verkäufe der Abendkasse (ohne Namen). */
  boxOfficeTickets: number;
  boxOfficeCents: number;
  serverTime: string;
};

export async function loadDoorSnapshot(eventId: string): Promise<DoorSnapshot> {
  const [ticketing, reservations] = await Promise.all([
    prisma.performanceTicketing.findUnique({ where: { eventId }, select: { capacity: true } }),
    prisma.reservation.findMany({
      where: { eventId, status: { in: ["confirmed", "pending"] } },
      orderBy: { name: "asc" },
      select: {
        id: true,
        code: true,
        name: true,
        source: true,
        status: true,
        note: true,
        checkedInCount: true,
        totalCents: true,
        paymentStatus: true,
        items: { select: { label: true, quantity: true } },
      },
    }),
  ]);
  let boxOfficeTickets = 0;
  let boxOfficeCents = 0;
  const guests: DoorGuest[] = [];
  for (const reservation of reservations) {
    const tickets = reservation.items.reduce((sum, item) => sum + item.quantity, 0);
    if (reservation.source === "box_office") {
      boxOfficeTickets += tickets;
      boxOfficeCents += reservation.totalCents;
      continue;
    }
    guests.push({
      id: reservation.id,
      code: reservation.code,
      name: reservation.name,
      source: reservation.source,
      status: reservation.status,
      tickets,
      checkedIn: reservation.checkedInCount,
      summary: reservation.items.map((item) => `${item.quantity} × ${item.label}`).join(", "),
      note: reservation.note,
      openCents: reservation.paymentStatus === "open" ? reservation.totalCents : 0,
    });
  }
  return {
    eventId,
    capacity: ticketing?.capacity ?? 0,
    guests,
    boxOfficeTickets,
    boxOfficeCents,
    serverTime: new Date().toISOString(),
  };
}

export type DoorMutation =
  | {
      id: string;
      type: "checkin";
      reservationId: string;
      delta: number;
      occurredAt: string;
    }
  | {
      id: string;
      type: "sale";
      items: ItemInput[];
      occurredAt: string;
    };

export type DoorMutationResult = { id: string; ok: boolean; error?: string };

/**
 * Wendet gepufferte Einlass-Aktionen an. Jede Aktion hat eine Client-ID; doppelt gesendete
 * Aktionen (Netz weg nach dem Senden) werden erkannt und übersprungen.
 */
export async function applyDoorMutations(
  eventId: string,
  mutations: DoorMutation[],
  actor: TicketActor,
  deviceLabel: string | null,
): Promise<DoorMutationResult[]> {
  const results: DoorMutationResult[] = [];
  const ref = actorRef(actor);
  for (const mutation of mutations) {
    try {
      const seen = await prisma.reservationCheckIn.findUnique({
        where: { clientMutationId: mutation.id },
        select: { id: true },
      });
      if (seen) {
        results.push({ id: mutation.id, ok: true });
        continue;
      }
      const occurredAt = new Date(mutation.occurredAt);
      const at = Number.isNaN(occurredAt.getTime()) ? new Date() : occurredAt;

      if (mutation.type === "sale") {
        // Abendkasse darf überbuchen: Wer vor Ort ist und zahlt, kommt rein.
        const { reservation } = await createReservation({
          eventId,
          source: "box_office",
          name: "",
          items: mutation.items,
          allowOverbook: true,
          actor: ref,
        });
        await prisma.reservationCheckIn.create({
          data: {
            reservationId: reservation.id,
            delta: reservation.checkedInCount,
            clientMutationId: mutation.id,
            deviceLabel,
            byUserId: ref.userId ?? null,
            byAccessId: ref.accessId ?? null,
            occurredAt: at,
          },
        });
        results.push({ id: mutation.id, ok: true });
        continue;
      }

      await prisma.$transaction(async (tx) => {
        const reservation = await tx.reservation.findUnique({
          where: { id: mutation.reservationId },
          select: {
            id: true,
            eventId: true,
            status: true,
            checkedInCount: true,
            items: { select: { quantity: true } },
          },
        });
        if (!reservation || reservation.eventId !== eventId) {
          throw new BookingError("Reservierung gehört nicht zu dieser Vorstellung.", "NOT_FOUND");
        }
        if (reservation.status === "cancelled" || reservation.status === "expired") {
          throw new BookingError("Reservierung ist storniert.", "CLOSED");
        }
        const tickets = reservation.items.reduce((sum, item) => sum + item.quantity, 0);
        const next = Math.max(0, Math.min(tickets, reservation.checkedInCount + mutation.delta));
        await tx.reservationCheckIn.create({
          data: {
            reservationId: reservation.id,
            delta: next - reservation.checkedInCount,
            clientMutationId: mutation.id,
            deviceLabel,
            byUserId: ref.userId ?? null,
            byAccessId: ref.accessId ?? null,
            occurredAt: at,
          },
        });
        await tx.reservation.update({
          where: { id: reservation.id },
          data: {
            checkedInCount: next,
            // Wer unbestätigt an der Tür steht und eingelassen wird, ist damit bestätigt.
            ...(reservation.status === "pending" && next > 0
              ? { status: "confirmed", confirmedAt: at, holdUntil: null }
              : {}),
          },
        });
      });
      results.push({ id: mutation.id, ok: true });
    } catch (error) {
      results.push({
        id: mutation.id,
        ok: false,
        error: error instanceof BookingError ? error.message : "Fehler beim Speichern.",
      });
      if (!(error instanceof BookingError)) {
        console.error("[karten] Einlass-Aktion fehlgeschlagen", error);
      }
    }
  }
  return results;
}
