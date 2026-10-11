"use server";

import { z } from "zod";

import {
  optionalTrimmed,
  revalidateTickets,
  ticketFailure,
  type TicketActionResult,
} from "@/lib/karten/actions-helpers";
import {
  BookingError,
  cancelReservation,
  createReservation,
  updateReservation,
} from "@/lib/karten/booking";
import { sendTicket } from "@/lib/karten/mails";
import { prisma } from "@/lib/prisma";
import { currentMembershipWhere } from "@/lib/produktionen/status";
import { requireAuth } from "@/lib/rbac";

async function requireCastMember(eventId: string) {
  const session = await requireAuth();
  const userId = session.user?.id;
  if (!userId) throw new BookingError("Bitte anmelden.", "INVALID");
  const event = await prisma.calendarEvent.findUnique({
    where: { id: eventId },
    select: { showId: true },
  });
  if (!event?.showId) throw new BookingError("Vorstellung nicht gefunden.", "NOT_FOUND");
  const membership = await prisma.productionMembership.findFirst({
    where: { userId, showId: event.showId, ...currentMembershipWhere() },
    select: { id: true },
  });
  if (!membership) {
    throw new BookingError("Freikarten gibt es nur für Mitwirkende dieser Produktion.", "INVALID");
  }
  return userId;
}

async function requireOwnReservation(reservationId: string) {
  const session = await requireAuth();
  const reservation = await prisma.reservation.findUnique({
    where: { id: reservationId },
    select: { id: true, memberId: true, source: true, event: { select: { start: true } } },
  });
  if (
    !reservation ||
    reservation.source !== "free_ticket" ||
    reservation.memberId !== session.user?.id
  ) {
    throw new BookingError("Freikarte nicht gefunden.", "NOT_FOUND");
  }
  if (reservation.event.start <= new Date()) {
    throw new BookingError("Die Vorstellung hat schon begonnen.", "CLOSED");
  }
  return reservation;
}

const createSchema = z.object({
  eventId: z.string().min(1),
  name: z.string().trim().min(2, "Bitte den Namen des Gastes angeben.").max(120),
  quantity: z.number().int().min(1).max(20),
  email: z
    .string()
    .trim()
    .max(200)
    .optional()
    .nullable()
    .transform((value) => value || null)
    .pipe(z.string().email("Ungültige E-Mail-Adresse.").nullable()),
  note: optionalTrimmed(300),
});

export async function registerFreeTicketsAction(
  input: z.input<typeof createSchema>,
): Promise<TicketActionResult> {
  try {
    const data = createSchema.parse(input);
    const userId = await requireCastMember(data.eventId);
    const { reservation, token } = await createReservation({
      eventId: data.eventId,
      source: "free_ticket",
      name: data.name,
      email: data.email,
      note: data.note,
      freeTickets: data.quantity,
      memberId: userId,
      actor: { userId },
    });
    const mailed = reservation.email ? await sendTicket(reservation.id, token) : false;
    revalidateTickets();
    return {
      ok: true,
      message: mailed
        ? `Freikarten für ${reservation.name} angemeldet, Ticket gemailt.`
        : `Freikarten für ${reservation.name} angemeldet.`,
    };
  } catch (error) {
    return ticketFailure(error, "Freikarten konnten nicht angemeldet werden.");
  }
}

export async function updateFreeTicketsAction(
  reservationId: string,
  input: { eventId?: string; quantity?: number; name?: string },
): Promise<TicketActionResult> {
  try {
    const reservation = await requireOwnReservation(reservationId);
    const data = z
      .object({
        eventId: z.string().min(1).optional(),
        quantity: z.number().int().min(1).max(20).optional(),
        name: z.string().trim().min(2).max(120).optional(),
      })
      .parse(input);
    if (data.eventId) await requireCastMember(data.eventId);
    await updateReservation(reservation.id, {
      eventId: data.eventId,
      freeTickets: data.quantity,
      name: data.name,
    });
    revalidateTickets();
    return { ok: true, message: "Freikarten geändert." };
  } catch (error) {
    return ticketFailure(error, "Freikarten konnten nicht geändert werden.");
  }
}

export async function cancelFreeTicketsAction(reservationId: string): Promise<TicketActionResult> {
  try {
    const reservation = await requireOwnReservation(reservationId);
    await cancelReservation(reservation.id, "Von der mitwirkenden Person zurückgegeben");
    revalidateTickets();
    return { ok: true, message: "Freikarten zurückgegeben." };
  } catch (error) {
    return ticketFailure(error, "Freikarten konnten nicht zurückgegeben werden.");
  }
}
