"use server";

import { z } from "zod";

import { actorRef, requireTicketActor } from "@/lib/karten/access";
import {
  itemsSchema,
  optionalTrimmed,
  revalidateTickets,
  ticketFailure,
  type TicketActionResult,
} from "@/lib/karten/actions-helpers";
import {
  cancelReservation,
  createReservation,
  restoreReservation,
  rotateReservationToken,
  updateReservation,
} from "@/lib/karten/booking";
import { sendCancellation, sendTicket } from "@/lib/karten/mails";
import { searchReservations, type ReservationListEntry } from "@/lib/karten/queries";
import { prisma } from "@/lib/prisma";

async function requireOfficeFor(reservationId: string) {
  const reservation = await prisma.reservation.findUniqueOrThrow({
    where: { id: reservationId },
    select: { id: true, showId: true, email: true, status: true },
  });
  const actor = await requireTicketActor("office", reservation.showId);
  return { actor, reservation };
}

async function eventShowId(eventId: string) {
  const event = await prisma.calendarEvent.findUniqueOrThrow({
    where: { id: eventId },
    select: { showId: true },
  });
  return event.showId;
}

const createSchema = z.object({
  eventId: z.string().min(1),
  name: z.string().trim().min(1, "Bitte einen Namen angeben.").max(120),
  phone: optionalTrimmed(40),
  email: z
    .string()
    .trim()
    .max(200)
    .optional()
    .nullable()
    .transform((value) => value || null)
    .pipe(z.string().email("Ungültige E-Mail-Adresse.").nullable()),
  note: optionalTrimmed(500),
  internalNote: optionalTrimmed(500),
  items: itemsSchema,
  paid: z.boolean().default(false),
  allowOverbook: z.boolean().default(false),
  sendMail: z.boolean().default(true),
});

export async function officeCreateReservationAction(
  input: z.input<typeof createSchema>,
): Promise<TicketActionResult<{ id: string; code: string; mailed: boolean }>> {
  try {
    const data = createSchema.parse(input);
    const actor = await requireTicketActor("office", await eventShowId(data.eventId));
    const { reservation, token } = await createReservation({
      eventId: data.eventId,
      source: "phone",
      name: data.name,
      email: data.email,
      phone: data.phone,
      note: data.note,
      internalNote: data.internalNote,
      items: data.items,
      paymentStatus: data.paid ? "paid" : undefined,
      allowOverbook: data.allowOverbook,
      actor: actorRef(actor),
    });
    const mailed =
      data.sendMail && reservation.email ? await sendTicket(reservation.id, token) : false;
    revalidateTickets();
    return {
      ok: true,
      message: `Reserviert für ${reservation.name} (${reservation.code}).`,
      data: { id: reservation.id, code: reservation.code, mailed },
    };
  } catch (error) {
    return ticketFailure(error, "Reservierung konnte nicht angelegt werden.");
  }
}

const updateSchema = z.object({
  eventId: z.string().min(1).optional(),
  name: z.string().trim().min(1).max(120).optional(),
  phone: optionalTrimmed(40),
  email: z
    .string()
    .trim()
    .max(200)
    .optional()
    .nullable()
    .transform((value) => value || null)
    .pipe(z.string().email("Ungültige E-Mail-Adresse.").nullable()),
  note: optionalTrimmed(500),
  internalNote: optionalTrimmed(500),
  items: itemsSchema.optional(),
  freeTickets: z.number().int().min(1).max(50).optional(),
  allowOverbook: z.boolean().default(false),
  sendMail: z.boolean().default(false),
});

export async function officeUpdateReservationAction(
  reservationId: string,
  input: z.input<typeof updateSchema>,
): Promise<TicketActionResult> {
  try {
    const { reservation } = await requireOfficeFor(reservationId);
    const { sendMail, ...data } = updateSchema.parse(input);
    if (data.eventId) await requireTicketActor("office", await eventShowId(data.eventId));
    const updated = await updateReservation(reservation.id, data);
    if (sendMail && updated.email && updated.status === "confirmed") {
      await sendTicket(updated.id, await rotateReservationToken(updated.id));
    }
    revalidateTickets();
    return { ok: true, message: "Reservierung geändert." };
  } catch (error) {
    return ticketFailure(error, "Reservierung konnte nicht geändert werden.");
  }
}

export async function officeCancelReservationAction(
  reservationId: string,
  input: { reason?: string | null; notify?: boolean },
): Promise<TicketActionResult> {
  try {
    const { reservation } = await requireOfficeFor(reservationId);
    const reason = optionalTrimmed(300).parse(input.reason);
    await cancelReservation(reservation.id, reason);
    if (input.notify && reservation.email && reservation.status === "confirmed") {
      await sendCancellation(reservation.id, reason);
    }
    revalidateTickets();
    return { ok: true, message: "Reservierung storniert." };
  } catch (error) {
    return ticketFailure(error, "Reservierung konnte nicht storniert werden.");
  }
}

export async function officeRestoreReservationAction(
  reservationId: string,
  allowOverbook = false,
): Promise<TicketActionResult> {
  try {
    const { reservation } = await requireOfficeFor(reservationId);
    await restoreReservation(reservation.id, { allowOverbook });
    revalidateTickets();
    return { ok: true, message: "Reservierung wiederhergestellt." };
  } catch (error) {
    return ticketFailure(error, "Reservierung konnte nicht wiederhergestellt werden.");
  }
}

export async function officeSetPaymentAction(
  reservationId: string,
  status: "open" | "paid" | "free",
): Promise<TicketActionResult> {
  try {
    const { reservation } = await requireOfficeFor(reservationId);
    await prisma.reservation.update({
      where: { id: reservation.id },
      data: { paymentStatus: z.enum(["open", "paid", "free"]).parse(status) },
    });
    revalidateTickets();
    return { ok: true };
  } catch (error) {
    return ticketFailure(error, "Zahlstatus konnte nicht geändert werden.");
  }
}

/** Neuer Ticket-Link per Mail (z. B. Mail nicht angekommen); der alte Link verfällt. */
export async function officeResendTicketAction(reservationId: string): Promise<TicketActionResult> {
  try {
    const { reservation } = await requireOfficeFor(reservationId);
    if (!reservation.email) throw new Error("Keine E-Mail-Adresse hinterlegt.");
    if (reservation.status !== "confirmed") throw new Error("Nur bestätigte Reservierungen.");
    const mailed = await sendTicket(reservation.id, await rotateReservationToken(reservation.id));
    return mailed
      ? { ok: true, message: `Ticket an ${reservation.email} gesendet.` }
      : { ok: false, error: "Mail konnte nicht gesendet werden." };
  } catch (error) {
    return ticketFailure(error, "Ticket konnte nicht gesendet werden.");
  }
}

/** Unbestätigte Online-Buchung am Telefon bestätigen (Gast hat die Mail nicht bekommen). */
export async function officeConfirmReservationAction(
  reservationId: string,
): Promise<TicketActionResult> {
  try {
    const { reservation } = await requireOfficeFor(reservationId);
    await restoreReservation(reservation.id);
    revalidateTickets();
    return { ok: true, message: "Reservierung bestätigt." };
  } catch (error) {
    return ticketFailure(error, "Reservierung konnte nicht bestätigt werden.");
  }
}

export async function officeSearchAction(
  showId: string,
  query: string,
): Promise<TicketActionResult<ReservationListEntry[]>> {
  try {
    await requireTicketActor("office", showId);
    const results = await searchReservations(showId, z.string().max(100).parse(query));
    return { ok: true, data: results };
  } catch (error) {
    return ticketFailure(error, "Suche fehlgeschlagen.");
  }
}
