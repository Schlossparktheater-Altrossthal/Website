import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

import { availabilityLevel, computeAvailability, type Availability } from "./availability";
import { loadTakenSeats } from "./booking";

export type PerformanceSummary = {
  eventId: string;
  title: string;
  start: Date;
  location: string | null;
  cancelled: boolean;
  configured: boolean;
  capacity: number;
  onlineLimit: number | null;
  boxOfficeReserve: number;
  salesOpen: boolean;
  salesEndAt: Date | null;
  availability: Availability;
  level: "free" | "few" | "sold_out";
  checkedIn: number;
};

/** Produktionen, für die Karten eingerichtet sind oder werden können (neueste zuerst). */
export async function listTicketingShows(where: Prisma.ShowWhereInput = {}) {
  return prisma.show.findMany({
    where: { archivedAt: null, ...where },
    orderBy: [{ year: "desc" }, { title: "asc" }],
    select: {
      id: true,
      title: true,
      year: true,
      ticketingSettings: { select: { enabled: true } },
    },
  });
}

export async function loadPerformances(
  showId: string,
  options: { includePast?: boolean; now?: Date } = {},
): Promise<PerformanceSummary[]> {
  const now = options.now ?? new Date();
  const events = await prisma.calendarEvent.findMany({
    where: {
      showId,
      kind: "PERFORMANCE",
      status: { not: "DRAFT" },
      ...(options.includePast ? {} : { start: { gte: new Date(now.getTime() - 6 * 3600_000) } }),
    },
    orderBy: { start: "asc" },
    select: {
      id: true,
      title: true,
      start: true,
      location: true,
      status: true,
      ticketing: true,
    },
  });
  const ids = events.map((event) => event.id);
  const [taken, checkedIn] = await Promise.all([
    loadTakenSeats(prisma, ids, { now }),
    prisma.reservation.groupBy({
      by: ["eventId"],
      where: { eventId: { in: ids }, status: "confirmed" },
      _sum: { checkedInCount: true },
    }),
  ]);
  const checkedInByEvent = new Map(
    checkedIn.map((group) => [group.eventId, group._sum.checkedInCount ?? 0]),
  );

  return events.map((event) => {
    const quota = event.ticketing ?? { capacity: 0, onlineLimit: null, boxOfficeReserve: 0 };
    const availability = computeAvailability(quota, taken.get(event.id) ?? { total: 0, online: 0 });
    return {
      eventId: event.id,
      title: event.title,
      start: event.start,
      location: event.location,
      cancelled: event.status === "CANCELLED",
      configured: event.ticketing !== null,
      capacity: quota.capacity,
      onlineLimit: quota.onlineLimit,
      boxOfficeReserve: quota.boxOfficeReserve,
      salesOpen: event.ticketing?.salesOpen ?? false,
      salesEndAt: event.ticketing?.salesEndAt ?? null,
      availability,
      level: availabilityLevel(availability.online, quota.capacity),
      checkedIn: checkedInByEvent.get(event.id) ?? 0,
    };
  });
}

export async function loadTicketCategories(showId: string, options: { activeOnly?: boolean } = {}) {
  return prisma.ticketCategory.findMany({
    where: { showId, ...(options.activeOnly ? { isActive: true } : {}) },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
}

export async function loadTicketingSettings(showId: string) {
  return prisma.ticketingSettings.findUnique({ where: { showId } });
}

export const reservationListSelect = {
  id: true,
  code: true,
  eventId: true,
  source: true,
  status: true,
  name: true,
  email: true,
  phone: true,
  note: true,
  internalNote: true,
  seats: true,
  totalCents: true,
  paymentStatus: true,
  holdUntil: true,
  checkedInCount: true,
  createdAt: true,
  memberId: true,
  member: { select: { name: true } },
  items: {
    select: { categoryId: true, label: true, quantity: true, unitPriceCents: true },
    orderBy: { label: "asc" },
  },
} satisfies Prisma.ReservationSelect;

export type ReservationListEntry = Prisma.ReservationGetPayload<{
  select: typeof reservationListSelect;
}>;

export async function loadReservationsForEvent(eventId: string | string[]) {
  return prisma.reservation.findMany({
    where: { eventId: Array.isArray(eventId) ? { in: eventId } : eventId },
    orderBy: [{ name: "asc" }, { createdAt: "asc" }],
    select: reservationListSelect,
  });
}

/** Suche über alle Vorstellungen einer Produktion (Name, Telefon, Mail, Code). */
export async function searchReservations(showId: string, query: string, take = 30) {
  const q = query.trim();
  if (!q) return [];
  return prisma.reservation.findMany({
    where: {
      showId,
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
        { phone: { contains: q } },
        { code: q.toUpperCase().replace(/[^A-Z0-9]/g, "") },
      ],
    },
    orderBy: { createdAt: "desc" },
    take,
    select: reservationListSelect,
  });
}

/** Öffentlich: Produktionen mit Kartenverkauf und kommenden, eingerichteten Vorstellungen. */
export async function loadPublicShows(now: Date = new Date()) {
  return prisma.show.findMany({
    where: {
      archivedAt: null,
      ticketingSettings: { enabled: true },
      calendarEvents: {
        some: { kind: "PERFORMANCE", start: { gt: now }, ticketing: { isNot: null } },
      },
    },
    orderBy: [{ year: "desc" }],
    select: {
      id: true,
      title: true,
      year: true,
      revealedAt: true,
      posterUrl: true,
      synopsis: true,
    },
  });
}

/** Öffentliche Sicht einer Produktion: nur buchbare Angaben, keine Personen. */
export async function loadPublicShow(showId: string, now: Date = new Date()) {
  const show = await prisma.show.findFirst({
    where: { id: showId, archivedAt: null, ticketingSettings: { enabled: true } },
    select: {
      id: true,
      title: true,
      year: true,
      revealedAt: true,
      posterUrl: true,
      synopsis: true,
      ticketingSettings: { select: { infoText: true, maxSeatsPerBooking: true } },
    },
  });
  if (!show) return null;
  const [performances, categories] = await Promise.all([
    loadPerformances(show.id, { now }),
    loadTicketCategories(show.id, { activeOnly: true }),
  ]);
  return {
    show,
    performances: performances
      .filter((row) => row.configured && row.start > now)
      .map((row) => ({
        eventId: row.eventId,
        start: row.start,
        location: row.location,
        cancelled: row.cancelled,
        bookable:
          !row.cancelled &&
          row.salesOpen &&
          (row.salesEndAt ?? row.start) > now &&
          row.availability.online > 0,
        salesClosed: !row.salesOpen || (row.salesEndAt ?? row.start) <= now,
        free: row.availability.online,
        level: row.level,
      })),
    categories: categories.filter((category) => category.onlineBookable),
  };
}
