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
  BookingError,
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
  /** Eine Zeile je Vorstellung – am Telefon oft mehrere Termine in verschiedenen Besetzungen. */
  lines: z
    .array(z.object({ eventId: z.string().min(1), items: itemsSchema }))
    .min(1, "Bitte eine Vorstellung wählen.")
    .max(20),
  paid: z.boolean().default(false),
  allowOverbook: z.boolean().default(false),
  sendMail: z.boolean().default(true),
});

/**
 * Telefonbuchung für eine oder mehrere Vorstellungen. Jede Vorstellung wird eine eigene Buchung
 * (eigener Code, eigener Einlass). Scheitert eine Zeile, werden die schon angelegten wieder
 * entfernt – entweder alles oder nichts.
 */
export async function officeCreateReservationAction(
  input: z.input<typeof createSchema>,
): Promise<TicketActionResult<{ codes: string[]; mailed: number }>> {
  const created: { id: string; token: string; code: string; email: string | null }[] = [];
  try {
    const data = createSchema.parse(input);
    const eventIds = new Set<string>();
    for (const line of data.lines) {
      if (eventIds.has(line.eventId)) {
        throw new BookingError("Jede Vorstellung bitte nur einmal auswählen.", "INVALID");
      }
      eventIds.add(line.eventId);
    }
    const actors = await Promise.all(
      [...eventIds].map(async (eventId) =>
        requireTicketActor("office", await eventShowId(eventId)),
      ),
    );
    const actor = actors[0];
    for (const line of data.lines) {
      const { reservation, token } = await createReservation({
        eventId: line.eventId,
        source: "phone",
        name: data.name,
        email: data.email,
        phone: data.phone,
        note: data.note,
        internalNote: data.internalNote,
        items: line.items,
        paymentStatus: data.paid ? "paid" : undefined,
        allowOverbook: data.allowOverbook,
        actor: actorRef(actor),
      });
      created.push({ id: reservation.id, token, code: reservation.code, email: reservation.email });
    }
    let mailed = 0;
    if (data.sendMail) {
      for (const entry of created) {
        if (entry.email && (await sendTicket(entry.id, entry.token))) mailed += 1;
      }
    }
    revalidateTickets();
    const codes = created.map((entry) => entry.code);
    return {
      ok: true,
      message:
        codes.length === 1
          ? `Reserviert für ${data.name} (${codes[0]}).`
          : `${codes.length} Vorstellungen für ${data.name} reserviert (${codes.join(", ")}).`,
      data: { codes, mailed },
    };
  } catch (error) {
    if (created.length > 0) {
      await prisma.reservation.deleteMany({
        where: { id: { in: created.map((entry) => entry.id) } },
      });
    }
    const failure = ticketFailure(error, "Reservierung konnte nicht angelegt werden.");
    if (error instanceof BookingError && created.length > 0) {
      return {
        ...failure,
        error: `Vorstellung ${created.length + 1}: ${failure.error} Es wurde nichts gespeichert.`,
      };
    }
    return failure;
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

/**
 * Stornierte oder verfallene Buchung endgültig entfernen (z. B. Fehleingabe, Datenschutz-Wunsch).
 * Aktive Buchungen müssen erst storniert werden; die Oberfläche bietet das nur in Suchtreffern an.
 */
export async function officeDeleteReservationAction(
  reservationId: string,
): Promise<TicketActionResult> {
  try {
    const { reservation } = await requireOfficeFor(reservationId);
    if (reservation.status !== "cancelled" && reservation.status !== "expired") {
      throw new BookingError("Nur stornierte Reservierungen lassen sich löschen.", "INVALID");
    }
    await prisma.reservation.delete({ where: { id: reservation.id } });
    revalidateTickets();
    return { ok: true, message: "Reservierung endgültig gelöscht." };
  } catch (error) {
    return ticketFailure(error, "Reservierung konnte nicht gelöscht werden.");
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
