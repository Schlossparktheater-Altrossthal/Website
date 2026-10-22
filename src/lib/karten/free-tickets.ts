import { prisma } from "@/lib/prisma";
import { currentMembershipWhere } from "@/lib/produktionen/status";

import { loadFreeTicketQuota } from "./booking";
import { reservationListSelect } from "./queries";

/** Mitwirkende einer Produktion mit Kontingent und angemeldeten Freikarten (Einstellungen). */
export async function loadFreeTicketOverview(showId: string) {
  const [settings, memberships, allowances, used] = await Promise.all([
    prisma.ticketingSettings.findUnique({ where: { showId } }),
    prisma.productionMembership.findMany({
      where: { showId, ...currentMembershipWhere() },
      select: { user: { select: { id: true, name: true, email: true } } },
    }),
    prisma.freeTicketAllowance.findMany({ where: { showId } }),
    prisma.reservation.groupBy({
      by: ["memberId"],
      where: { showId, source: "free_ticket", status: { in: ["confirmed", "pending"] } },
      _sum: { seats: true },
    }),
  ]);
  const defaultQuantity = settings?.freeTicketsPerMember ?? 2;
  const allowanceByUser = new Map(allowances.map((entry) => [entry.userId, entry.quantity]));
  const usedByUser = new Map(used.map((entry) => [entry.memberId, entry._sum.seats ?? 0]));
  return memberships
    .map(({ user }) => ({
      userId: user.id,
      name: user.name ?? user.email ?? "Unbekannt",
      override: allowanceByUser.get(user.id) ?? null,
      total: allowanceByUser.get(user.id) ?? defaultQuantity,
      used: usedByUser.get(user.id) ?? 0,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "de"));
}

/** Freikarten-Seite eines Mitwirkenden: Produktionen mit Kartenverkauf, an denen die Person mitwirkt. */
export async function loadMyFreeTicketShows(userId: string) {
  const memberships = await prisma.productionMembership.findMany({
    where: {
      userId,
      AND: [
        currentMembershipWhere(),
        { show: { archivedAt: null, ticketingSettings: { enabled: true } } },
      ],
    },
    select: {
      show: {
        select: { id: true, title: true, year: true, revealedAt: true, ticketingSettings: true },
      },
    },
    orderBy: { show: { year: "desc" } },
  });
  return Promise.all(
    memberships.map(async ({ show }) => {
      const [quota, reservations] = await Promise.all([
        loadFreeTicketQuota(prisma, show.id, userId),
        prisma.reservation.findMany({
          where: { showId: show.id, memberId: userId, source: "free_ticket" },
          orderBy: { createdAt: "asc" },
          select: {
            ...reservationListSelect,
            event: { select: { start: true } },
          },
        }),
      ]);
      return { show, quota, reservations };
    }),
  );
}
