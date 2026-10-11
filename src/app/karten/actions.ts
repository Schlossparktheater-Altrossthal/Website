"use server";

import { headers } from "next/headers";
import { z } from "zod";

import { getRequestIp, recordTicketBookingAttempt } from "@/lib/auth/rate-limit";
import {
  itemsSchema,
  optionalTrimmed,
  revalidateTickets,
  ticketFailure,
  type TicketActionResult,
} from "@/lib/karten/actions-helpers";
import {
  BookingError,
  cancelReservation,
  confirmReservation,
  createReservation,
  findReservationByToken,
  updateReservation,
} from "@/lib/karten/booking";
import { sendCancellation, sendConfirmationRequest, sendTicket } from "@/lib/karten/mails";
import { prisma } from "@/lib/prisma";

async function requestIp() {
  const store = await headers();
  return getRequestIp(new Request("http://local", { headers: store }));
}

const bookingSchema = z.object({
  eventId: z.string().min(1),
  name: z.string().trim().min(2, "Bitte deinen Namen angeben.").max(120),
  email: z.string().trim().email("Bitte eine gültige E-Mail-Adresse angeben.").max(200),
  phone: optionalTrimmed(40),
  note: optionalTrimmed(500),
  items: itemsSchema,
  privacy: z.literal(true, { message: "Bitte der Datenschutzerklärung zustimmen." }),
  /** Honeypot: Menschen sehen das Feld nicht. */
  website: z.string().max(0).optional(),
});

export async function bookTicketsAction(
  input: z.input<typeof bookingSchema>,
): Promise<TicketActionResult<{ mailed: boolean }>> {
  try {
    const data = bookingSchema.parse(input);
    const limit = recordTicketBookingAttempt(data.email, await requestIp());
    if (!limit.allowed) {
      return {
        ok: false,
        error:
          "Zu viele Reservierungen in kurzer Zeit. Bitte später erneut versuchen oder anrufen.",
      };
    }
    const { reservation, token } = await createReservation({
      eventId: data.eventId,
      source: "online",
      name: data.name,
      email: data.email,
      phone: data.phone,
      note: data.note,
      items: data.items,
    });
    const mailed = await sendConfirmationRequest(reservation.id, token);
    revalidateTickets();
    return { ok: true, data: { mailed } };
  } catch (error) {
    if (error instanceof z.ZodError && error.issues.some((issue) => issue.path[0] === "website")) {
      // Bots bekommen eine scheinbar erfolgreiche Antwort.
      return { ok: true, data: { mailed: true } };
    }
    return ticketFailure(error, "Die Reservierung konnte nicht gespeichert werden.");
  }
}

const tokenSchema = z.string().min(10).max(100);

export async function confirmTicketsAction(token: string): Promise<TicketActionResult> {
  try {
    const reservation = await confirmReservation(tokenSchema.parse(token));
    await sendTicket(reservation.id, token);
    revalidateTickets();
    return { ok: true };
  } catch (error) {
    return ticketFailure(error, "Die Bestätigung hat nicht geklappt.");
  }
}

async function guestReservation(token: string) {
  const reservation = await findReservationByToken(tokenSchema.parse(token));
  if (!reservation) throw new BookingError("Buchung nicht gefunden.", "NOT_FOUND");
  if (reservation.event.start <= new Date()) {
    throw new BookingError("Die Vorstellung hat schon begonnen.", "CLOSED");
  }
  return reservation;
}

const guestUpdateSchema = z.object({
  eventId: z.string().min(1).optional(),
  items: itemsSchema.optional(),
});

export async function guestUpdateTicketsAction(
  token: string,
  input: z.input<typeof guestUpdateSchema>,
): Promise<TicketActionResult> {
  try {
    const reservation = await guestReservation(token);
    if (reservation.source === "free_ticket") {
      throw new BookingError(
        "Freikarten ändert die mitwirkende Person im Mitgliederbereich.",
        "INVALID",
      );
    }
    const data = guestUpdateSchema.parse(input);
    await updateReservation(reservation.id, { ...data, asGuest: true });
    if (reservation.status === "confirmed") await sendTicket(reservation.id, token);
    revalidateTickets();
    return { ok: true, message: "Reservierung geändert." };
  } catch (error) {
    return ticketFailure(error, "Die Änderung hat nicht geklappt.");
  }
}

export async function guestCancelTicketsAction(token: string): Promise<TicketActionResult> {
  try {
    const reservation = await guestReservation(token);
    await cancelReservation(reservation.id, "Vom Gast storniert");
    if (reservation.status === "confirmed") await sendCancellation(reservation.id);
    revalidateTickets();
    return { ok: true, message: "Reservierung storniert." };
  } catch (error) {
    return ticketFailure(error, "Die Stornierung hat nicht geklappt.");
  }
}

const waitlistSchema = z.object({
  eventId: z.string().min(1),
  name: z.string().trim().min(2, "Bitte deinen Namen angeben.").max(120),
  email: z.string().trim().email("Bitte eine gültige E-Mail-Adresse angeben.").max(200),
  seats: z.number().int().min(1).max(20),
  privacy: z.literal(true, { message: "Bitte der Datenschutzerklärung zustimmen." }),
  website: z.string().max(0).optional(),
});

export async function joinWaitlistAction(
  input: z.input<typeof waitlistSchema>,
): Promise<TicketActionResult> {
  try {
    const data = waitlistSchema.parse(input);
    const limit = recordTicketBookingAttempt(data.email, await requestIp());
    if (!limit.allowed) {
      return { ok: false, error: "Zu viele Anfragen. Bitte später erneut versuchen." };
    }
    const event = await prisma.calendarEvent.findFirst({
      where: { id: data.eventId, kind: "PERFORMANCE", ticketing: { isNot: null } },
      select: { id: true },
    });
    if (!event) throw new BookingError("Vorstellung nicht gefunden.", "NOT_FOUND");
    const email = data.email.toLowerCase();
    const existing = await prisma.waitlistEntry.findFirst({
      where: { eventId: event.id, email, status: "waiting" },
    });
    if (existing) {
      await prisma.waitlistEntry.update({
        where: { id: existing.id },
        data: { seats: data.seats, name: data.name },
      });
    } else {
      await prisma.waitlistEntry.create({
        data: { eventId: event.id, name: data.name, email, seats: data.seats },
      });
    }
    return { ok: true, message: "Du stehst auf der Warteliste." };
  } catch (error) {
    if (error instanceof z.ZodError && error.issues.some((issue) => issue.path[0] === "website")) {
      return { ok: true, message: "Du stehst auf der Warteliste." };
    }
    return ticketFailure(error, "Eintrag in die Warteliste hat nicht geklappt.");
  }
}
