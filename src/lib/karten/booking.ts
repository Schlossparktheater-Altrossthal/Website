import { randomUUID } from "node:crypto";

import {
  Prisma,
  type Reservation,
  type ReservationPaymentStatus,
  type ReservationSource,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";

import { computeAvailability, seatsAvailableFor, type TakenSeats } from "./availability";
import { generateReservationCode, generateSecretToken, hashSecretToken } from "./codes";

type Tx = Prisma.TransactionClient;

export class BookingError extends Error {
  constructor(
    message: string,
    readonly code:
      "NOT_FOUND" | "CLOSED" | "SOLD_OUT" | "INVALID" | "LIMIT" | "FREE_TICKETS_EXCEEDED",
  ) {
    super(message);
    this.name = "BookingError";
  }
}

export type BookingActor = { userId?: string | null; accessId?: string | null };

export type ItemInput = { categoryId: string; quantity: number };

export type ReservationInput = {
  eventId: string;
  source: ReservationSource;
  name: string;
  email?: string | null;
  phone?: string | null;
  note?: string | null;
  internalNote?: string | null;
  /** Kategorien und Anzahlen; bei Freikarten stattdessen `freeTickets`. */
  items?: ItemInput[];
  freeTickets?: number;
  memberId?: string | null;
  paymentStatus?: ReservationPaymentStatus;
  /** Kartenbüro darf bewusst überbuchen (z. B. Rollstuhlplatz, Zusatzstuhl). */
  allowOverbook?: boolean;
  actor?: BookingActor;
  /** Gemeinsame Kennung, wenn eine Online-Buchung mehrere Vorstellungen umfasst. */
  groupId?: string | null;
};

type BuiltItem = {
  categoryId: string | null;
  label: string;
  quantity: number;
  unitPriceCents: number;
  needsSeat: boolean;
};

export const FREE_TICKET_LABEL = "Freikarte";

/** Sperrt die Kontingentzeile der Vorstellung bis zum Ende der Transaktion. */
async function lockPerformance(tx: Tx, eventId: string) {
  const rows = await tx.$queryRaw<{ id: string }[]>`
    SELECT "id" FROM "PerformanceTicketing" WHERE "eventId" = ${eventId} FOR UPDATE`;
  if (rows.length === 0) {
    throw new BookingError("Für diese Vorstellung gibt es keinen Kartenverkauf.", "CLOSED");
  }
}

/** Plätze, die Buchungen belegen: bestätigt oder unbestätigt mit laufender Haltezeit. */
export function occupyingReservationWhere(now: Date = new Date()): Prisma.ReservationWhereInput {
  return {
    OR: [{ status: "confirmed" }, { status: "pending", holdUntil: { gt: now } }],
  };
}

export async function loadTakenSeats(
  db: Tx | typeof prisma,
  eventIds: string[],
  options: { excludeReservationId?: string; now?: Date } = {},
): Promise<Map<string, TakenSeats>> {
  const groups = await db.reservation.groupBy({
    by: ["eventId", "source"],
    where: {
      eventId: { in: eventIds },
      ...occupyingReservationWhere(options.now),
      ...(options.excludeReservationId ? { id: { not: options.excludeReservationId } } : {}),
    },
    _sum: { seats: true },
  });
  const result = new Map<string, TakenSeats>(eventIds.map((id) => [id, { total: 0, online: 0 }]));
  for (const group of groups) {
    const entry = result.get(group.eventId) ?? { total: 0, online: 0 };
    const seats = group._sum.seats ?? 0;
    entry.total += seats;
    if (group.source === "online") entry.online += seats;
    result.set(group.eventId, entry);
  }
  return result;
}

async function loadPerformance(tx: Tx, eventId: string) {
  const event = await tx.calendarEvent.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      kind: true,
      status: true,
      start: true,
      showId: true,
      ticketing: true,
      show: { select: { ticketingSettings: true } },
    },
  });
  if (!event || event.kind !== "PERFORMANCE" || !event.showId || !event.ticketing) {
    throw new BookingError("Vorstellung nicht gefunden.", "NOT_FOUND");
  }
  return { ...event, showId: event.showId, ticketing: event.ticketing };
}

async function buildItems(
  tx: Tx,
  showId: string,
  input: Pick<ReservationInput, "items" | "freeTickets" | "source">,
): Promise<BuiltItem[]> {
  if (input.source === "free_ticket") {
    const quantity = input.freeTickets ?? 0;
    if (!Number.isInteger(quantity) || quantity < 1) {
      throw new BookingError("Bitte mindestens eine Freikarte angeben.", "INVALID");
    }
    return [
      { categoryId: null, label: FREE_TICKET_LABEL, quantity, unitPriceCents: 0, needsSeat: true },
    ];
  }

  const requested = (input.items ?? []).filter((item) => item.quantity > 0);
  if (requested.length === 0) {
    throw new BookingError("Bitte mindestens eine Karte auswählen.", "INVALID");
  }
  const categories = await tx.ticketCategory.findMany({
    where: { showId, id: { in: requested.map((item) => item.categoryId) } },
  });
  const byId = new Map(categories.map((category) => [category.id, category]));
  const merged = new Map<string, number>();
  for (const item of requested) {
    if (!Number.isInteger(item.quantity) || item.quantity < 0) {
      throw new BookingError("Ungültige Anzahl.", "INVALID");
    }
    merged.set(item.categoryId, (merged.get(item.categoryId) ?? 0) + item.quantity);
  }

  return [...merged.entries()].map(([categoryId, quantity]) => {
    const category = byId.get(categoryId);
    if (!category || !category.isActive) {
      throw new BookingError("Diese Kartenart gibt es nicht mehr.", "INVALID");
    }
    if (input.source === "online" && !category.onlineBookable) {
      throw new BookingError(`„${category.name}“ gibt es nur an der Kasse.`, "INVALID");
    }
    return {
      categoryId,
      label: category.name,
      quantity,
      unitPriceCents: category.priceCents,
      needsSeat: category.needsSeat,
    };
  });
}

function sumItems(items: BuiltItem[]) {
  return {
    seats: items.reduce((sum, item) => sum + (item.needsSeat ? item.quantity : 0), 0),
    tickets: items.reduce((sum, item) => sum + item.quantity, 0),
    totalCents: items.reduce((sum, item) => sum + item.quantity * item.unitPriceCents, 0),
  };
}

/** Freikarten-Kontingent einer Person für eine Produktion und wie viele davon belegt sind. */
export async function loadFreeTicketQuota(
  db: Tx | typeof prisma,
  showId: string,
  userId: string,
  options: { excludeReservationId?: string } = {},
) {
  const [settings, allowance, used] = await Promise.all([
    db.ticketingSettings.findUnique({ where: { showId }, select: { freeTicketsPerMember: true } }),
    db.freeTicketAllowance.findUnique({ where: { showId_userId: { showId, userId } } }),
    db.reservation.aggregate({
      where: {
        showId,
        memberId: userId,
        source: "free_ticket",
        status: { in: ["confirmed", "pending"] },
        ...(options.excludeReservationId ? { id: { not: options.excludeReservationId } } : {}),
      },
      _sum: { seats: true },
    }),
  ]);
  const total = allowance?.quantity ?? settings?.freeTicketsPerMember ?? 0;
  const usedSeats = used._sum.seats ?? 0;
  return { total, used: usedSeats, remaining: Math.max(0, total - usedSeats) };
}

function salesEnd(event: { start: Date; ticketing: { salesEndAt: Date | null } }) {
  return event.ticketing.salesEndAt ?? event.start;
}

async function assertBookable(
  tx: Tx,
  event: Awaited<ReturnType<typeof loadPerformance>>,
  input: {
    source: ReservationSource;
    seats: number;
    tickets: number;
    allowOverbook?: boolean;
    excludeReservationId?: string;
    now: Date;
  },
) {
  const settings = event.show?.ticketingSettings;
  if (event.status === "CANCELLED") {
    throw new BookingError("Diese Vorstellung ist abgesagt.", "CLOSED");
  }
  if (input.source === "online") {
    if (!settings?.enabled || !event.ticketing.salesOpen || salesEnd(event) <= input.now) {
      throw new BookingError("Für diese Vorstellung ist keine Online-Buchung möglich.", "CLOSED");
    }
    if (input.tickets > settings.maxSeatsPerBooking) {
      throw new BookingError(
        `Online sind höchstens ${settings.maxSeatsPerBooking} Karten pro Buchung möglich. Für größere Gruppen bitte anrufen.`,
        "LIMIT",
      );
    }
  }
  if (input.source === "free_ticket" && settings?.freeTicketDeadline) {
    if (settings.freeTicketDeadline <= input.now) {
      throw new BookingError("Die Anmeldefrist für Freikarten ist vorbei.", "CLOSED");
    }
  }
  if (input.allowOverbook || input.seats === 0) return;

  const taken = await loadTakenSeats(tx, [event.id], {
    excludeReservationId: input.excludeReservationId,
    now: input.now,
  });
  const availability = computeAvailability(
    event.ticketing,
    taken.get(event.id) ?? { total: 0, online: 0 },
  );
  const free = seatsAvailableFor(availability, input.source);
  if (input.seats > free) {
    throw new BookingError(
      free === 0
        ? "Diese Vorstellung ist leider ausgebucht."
        : `Es sind nur noch ${free} Plätze frei.`,
      "SOLD_OUT",
    );
  }
}

function defaultPaymentStatus(source: ReservationSource, totalCents: number) {
  if (totalCents === 0) return "free" as const;
  if (source === "box_office") return "paid" as const;
  return "open" as const;
}

async function uniqueCode(tx: Tx): Promise<string> {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = generateReservationCode();
    const exists = await tx.reservation.findUnique({ where: { code }, select: { id: true } });
    if (!exists) return code;
  }
  throw new Error("Kein freier Buchungscode gefunden.");
}

export type CreatedReservation = { reservation: Reservation; token: string };

export async function createReservation(
  input: ReservationInput,
  now: Date = new Date(),
): Promise<CreatedReservation> {
  const name = input.name.trim();
  if (!name && input.source !== "box_office") {
    throw new BookingError("Bitte einen Namen angeben.", "INVALID");
  }
  if (input.source === "online" && !input.email?.trim()) {
    throw new BookingError("Bitte eine E-Mail-Adresse angeben.", "INVALID");
  }
  if (input.source === "free_ticket" && !input.memberId) {
    throw new BookingError("Freikarten gehören zu einer mitwirkenden Person.", "INVALID");
  }

  return prisma.$transaction(async (tx) => {
    await lockPerformance(tx, input.eventId);
    const event = await loadPerformance(tx, input.eventId);
    const items = await buildItems(tx, event.showId, input);
    const { seats, tickets, totalCents } = sumItems(items);

    if (input.source === "free_ticket" && input.memberId) {
      const quota = await loadFreeTicketQuota(tx, event.showId, input.memberId);
      if (tickets > quota.remaining) {
        throw new BookingError(
          quota.remaining === 0
            ? "Dein Freikarten-Kontingent ist aufgebraucht."
            : `Du kannst noch ${quota.remaining} Freikarten anmelden.`,
          "FREE_TICKETS_EXCEEDED",
        );
      }
    }

    await assertBookable(tx, event, {
      source: input.source,
      seats,
      tickets,
      allowOverbook: input.allowOverbook,
      now,
    });

    const holdMinutes = event.show?.ticketingSettings?.holdMinutes ?? 120;
    const pending = input.source === "online";
    const token = generateSecretToken();
    const reservation = await tx.reservation.create({
      data: {
        code: await uniqueCode(tx),
        tokenHash: hashSecretToken(token),
        eventId: event.id,
        showId: event.showId,
        source: input.source,
        status: pending ? "pending" : "confirmed",
        holdUntil: pending ? new Date(now.getTime() + holdMinutes * 60_000) : null,
        confirmedAt: pending ? null : now,
        name: name || "Abendkasse",
        email: input.email?.trim().toLowerCase() || null,
        phone: input.phone?.trim() || null,
        note: input.note?.trim() || null,
        internalNote: input.internalNote?.trim() || null,
        seats,
        totalCents,
        paymentStatus: input.paymentStatus ?? defaultPaymentStatus(input.source, totalCents),
        // Abendkasse: verkauft und eingelassen in einem Schritt.
        checkedInCount: input.source === "box_office" ? tickets : 0,
        memberId: input.memberId ?? null,
        groupId: input.groupId ?? null,
        createdByUserId: input.actor?.userId ?? null,
        createdByAccessId: input.actor?.accessId ?? null,
        items: { create: items },
      },
    });
    return { reservation, token };
  });
}

/**
 * Online-Buchung für mehrere Vorstellungen: je Vorstellung eine Reservierung (eigener QR-Code),
 * verbunden über `groupId`. Klappt eine nicht (z. B. ausgebucht), werden die schon angelegten
 * wieder storniert, damit niemand halbe Buchungen bekommt.
 */
export async function createReservationGroup(
  eventIds: string[],
  input: Omit<ReservationInput, "eventId" | "groupId">,
  describeEvent: (eventId: string) => string,
  now: Date = new Date(),
): Promise<CreatedReservation[]> {
  const unique = [...new Set(eventIds)];
  if (unique.length === 0) throw new BookingError("Bitte eine Vorstellung wählen.", "INVALID");
  if (unique.length === 1) return [await createReservation({ ...input, eventId: unique[0] }, now)];
  const groupId = randomUUID();
  const created: CreatedReservation[] = [];
  try {
    for (const eventId of unique) {
      created.push(await createReservation({ ...input, eventId, groupId }, now));
    }
  } catch (error) {
    await prisma.reservation.updateMany({
      where: { id: { in: created.map((entry) => entry.reservation.id) } },
      data: { status: "cancelled", cancelledAt: now, cancelReason: "Mehrfachbuchung abgebrochen" },
    });
    if (error instanceof BookingError) {
      const failed = unique[created.length];
      throw new BookingError(`${describeEvent(failed)}: ${error.message}`, error.code);
    }
    throw error;
  }
  return created;
}

/** Weitere Reservierungen derselben Mehrfachbuchung (ohne die angegebene). */
export async function loadGroupSiblings(reservation: { id: string; groupId: string | null }) {
  if (!reservation.groupId) return [];
  return prisma.reservation.findMany({
    where: { groupId: reservation.groupId, id: { not: reservation.id } },
    include: { event: { select: { start: true } } },
    orderBy: { event: { start: "asc" } },
  });
}

/**
 * Bestätigt eine Online-Buchung über den Mail-Link. Ist die Haltezeit abgelaufen, wird neu
 * geprüft, ob die Plätze noch frei sind.
 */
export async function confirmReservation(
  token: string,
  now: Date = new Date(),
): Promise<Reservation> {
  const tokenHash = hashSecretToken(token);
  const found = await prisma.reservation.findUnique({ where: { tokenHash } });
  if (!found) throw new BookingError("Buchung nicht gefunden.", "NOT_FOUND");
  return confirmReservationById(found.id, now);
}

export async function confirmReservationById(
  reservationId: string,
  now: Date = new Date(),
): Promise<Reservation> {
  const found = await prisma.reservation.findUnique({ where: { id: reservationId } });
  if (!found) throw new BookingError("Buchung nicht gefunden.", "NOT_FOUND");
  if (found.status === "confirmed") return found;
  if (found.status === "cancelled") {
    throw new BookingError("Diese Buchung wurde storniert.", "CLOSED");
  }

  return prisma.$transaction(async (tx) => {
    await lockPerformance(tx, found.eventId);
    const current = await tx.reservation.findUniqueOrThrow({ where: { id: found.id } });
    if (current.status === "confirmed") return current;
    const stillHeld = current.status === "pending" && current.holdUntil && current.holdUntil > now;
    if (!stillHeld) {
      const event = await loadPerformance(tx, current.eventId);
      await assertBookable(tx, event, {
        source: "online",
        seats: current.seats,
        tickets: 0,
        excludeReservationId: current.id,
        now,
      });
    }
    return tx.reservation.update({
      where: { id: current.id },
      data: { status: "confirmed", confirmedAt: now, holdUntil: null },
    });
  });
}

export type ReservationUpdate = {
  eventId?: string;
  items?: ItemInput[];
  freeTickets?: number;
  name?: string;
  email?: string | null;
  phone?: string | null;
  note?: string | null;
  internalNote?: string | null;
  paymentStatus?: ReservationPaymentStatus;
  allowOverbook?: boolean;
  /** Gäste dürfen online nur verringern bzw. ohne Abendkassen-Reserve umbuchen. */
  asGuest?: boolean;
};

export async function updateReservation(
  reservationId: string,
  update: ReservationUpdate,
  now: Date = new Date(),
): Promise<Reservation> {
  return prisma.$transaction(async (tx) => {
    const current = await tx.reservation.findUnique({
      where: { id: reservationId },
      include: { items: true },
    });
    if (!current) throw new BookingError("Buchung nicht gefunden.", "NOT_FOUND");
    if (current.status === "cancelled" || current.status === "expired") {
      throw new BookingError("Diese Buchung ist nicht mehr aktiv.", "CLOSED");
    }

    const targetEventId = update.eventId ?? current.eventId;
    const eventIds = [...new Set([current.eventId, targetEventId])].sort();
    for (const eventId of eventIds) await lockPerformance(tx, eventId);
    const event = await loadPerformance(tx, targetEventId);
    if (event.showId !== current.showId) {
      throw new BookingError("Umbuchen geht nur innerhalb derselben Produktion.", "INVALID");
    }

    const itemsChanged = update.items !== undefined || update.freeTickets !== undefined;
    const items = itemsChanged
      ? await buildItems(tx, current.showId, {
          source: current.source,
          items: update.items,
          freeTickets: update.freeTickets,
        })
      : current.items.map((item) => ({
          categoryId: item.categoryId,
          label: item.label,
          quantity: item.quantity,
          unitPriceCents: item.unitPriceCents,
          needsSeat: item.needsSeat,
        }));
    const { seats, tickets, totalCents } = sumItems(items);

    if (current.source === "free_ticket" && current.memberId && itemsChanged) {
      const quota = await loadFreeTicketQuota(tx, current.showId, current.memberId, {
        excludeReservationId: current.id,
      });
      if (tickets > quota.remaining) {
        throw new BookingError(
          `Du kannst noch ${quota.remaining} Freikarten anmelden.`,
          "FREE_TICKETS_EXCEEDED",
        );
      }
    }

    const grows = targetEventId !== current.eventId || seats > current.seats;
    if (grows) {
      await assertBookable(tx, event, {
        source: update.asGuest ? "online" : current.source,
        seats,
        tickets: update.asGuest ? tickets : 0,
        allowOverbook: update.allowOverbook,
        excludeReservationId: current.id,
        now,
      });
    }

    const paymentStatus =
      update.paymentStatus ??
      (itemsChanged && current.paymentStatus !== "paid"
        ? defaultPaymentStatus(current.source, totalCents)
        : current.paymentStatus);

    if (itemsChanged) {
      await tx.reservationItem.deleteMany({ where: { reservationId: current.id } });
    }
    return tx.reservation.update({
      where: { id: current.id },
      data: {
        eventId: targetEventId,
        seats,
        totalCents,
        paymentStatus,
        ...(update.name !== undefined ? { name: update.name.trim() || current.name } : {}),
        ...(update.email !== undefined
          ? { email: update.email?.trim().toLowerCase() || null }
          : {}),
        ...(update.phone !== undefined ? { phone: update.phone?.trim() || null } : {}),
        ...(update.note !== undefined ? { note: update.note?.trim() || null } : {}),
        ...(update.internalNote !== undefined
          ? { internalNote: update.internalNote?.trim() || null }
          : {}),
        ...(targetEventId !== current.eventId ? { checkedInCount: 0, reminderSentAt: null } : {}),
        ...(itemsChanged ? { items: { create: items } } : {}),
      },
    });
  });
}

export async function cancelReservation(
  reservationId: string,
  reason: string | null,
  now: Date = new Date(),
): Promise<Reservation> {
  const current = await prisma.reservation.findUnique({ where: { id: reservationId } });
  if (!current) throw new BookingError("Buchung nicht gefunden.", "NOT_FOUND");
  if (current.status === "cancelled") return current;
  return prisma.reservation.update({
    where: { id: reservationId },
    data: { status: "cancelled", cancelledAt: now, cancelReason: reason?.trim() || null },
  });
}

/** Stornierte Buchung wieder aktivieren (Fehlklick im Kartenbüro). */
export async function restoreReservation(
  reservationId: string,
  options: { allowOverbook?: boolean } = {},
  now: Date = new Date(),
): Promise<Reservation> {
  return prisma.$transaction(async (tx) => {
    const current = await tx.reservation.findUnique({ where: { id: reservationId } });
    if (!current) throw new BookingError("Buchung nicht gefunden.", "NOT_FOUND");
    if (current.status === "confirmed") return current;
    await lockPerformance(tx, current.eventId);
    const event = await loadPerformance(tx, current.eventId);
    await assertBookable(tx, event, {
      source: current.source === "online" ? "phone" : current.source,
      seats: current.seats,
      tickets: 0,
      allowOverbook: options.allowOverbook,
      excludeReservationId: current.id,
      now,
    });
    return tx.reservation.update({
      where: { id: current.id },
      data: {
        status: "confirmed",
        confirmedAt: current.confirmedAt ?? now,
        cancelledAt: null,
        cancelReason: null,
        holdUntil: null,
      },
    });
  });
}

/** Markiert unbestätigte Buchungen mit abgelaufener Haltezeit als verfallen. */
export async function expireStaleReservations(now: Date = new Date()): Promise<number> {
  const result = await prisma.reservation.updateMany({
    where: { status: "pending", holdUntil: { lte: now } },
    data: { status: "expired" },
  });
  return result.count;
}

export async function findReservationByToken(token: string) {
  return prisma.reservation.findUnique({
    where: { tokenHash: hashSecretToken(token) },
    include: {
      items: { orderBy: { label: "asc" } },
      event: { select: { id: true, title: true, start: true, location: true, status: true } },
      show: { select: { id: true, title: true, year: true, ticketingSettings: true } },
    },
  });
}

/** Neuer Link (z. B. „Ticket erneut senden“ aus dem Kartenbüro) – der alte wird ungültig. */
export async function rotateReservationToken(reservationId: string): Promise<string> {
  const token = generateSecretToken();
  await prisma.reservation.update({
    where: { id: reservationId },
    data: { tokenHash: hashSecretToken(token) },
  });
  return token;
}
