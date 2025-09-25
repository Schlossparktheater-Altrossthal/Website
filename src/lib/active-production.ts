import { cache } from "react";
import { cookies } from "next/headers";

import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";

export const ACTIVE_PRODUCTION_COOKIE = "active-production";

type ActiveMembership = {
  showId: string;
  leftAt: Date | null;
  show: {
    id: string;
    title: string | null;
    year: number;
    finalRehearsalWeekStart: Date | null;
  };
};

function isMembershipActive<T extends { leftAt: Date | null }>(entry: T): entry is T {
  if (!entry.leftAt) return true;
  return entry.leftAt.getTime() > Date.now();
}

function selectPreferredMembership(memberships: ActiveMembership[]) {
  if (memberships.length === 0) return null;
  if (memberships.length === 1) return memberships[0];

  return memberships
    .slice()
    .sort((a, b) => {
      const aDate = a.show.finalRehearsalWeekStart?.getTime() ?? 0;
      const bDate = b.show.finalRehearsalWeekStart?.getTime() ?? 0;
      if (aDate !== bDate) {
        return bDate - aDate;
      }
      return b.show.year - a.show.year;
    })[0];
}

async function resolveFallbackActiveProductionId(userId: string | null | undefined) {
  if (!userId) {
    return null;
  }

  const memberships = await prisma.productionMembership.findMany({
    where: { userId },
    include: {
      show: {
        select: {
          id: true,
          title: true,
          year: true,
          finalRehearsalWeekStart: true,
        },
      },
    },
  });

  if (memberships.length === 0) {
    return null;
  }

  const normalizedMemberships: ActiveMembership[] = memberships.map((membership) => ({
    showId: membership.showId,
    leftAt: membership.leftAt,
    show: membership.show,
  }));

  const activeMemberships = normalizedMemberships.filter(isMembershipActive);
  if (activeMemberships.length === 0) {
    return null;
  }

  const preferred = selectPreferredMembership(activeMemberships);
  return preferred?.showId ?? null;
}

type ActiveProductionOptions = {
  canManageProductions?: boolean;
};

export async function getActiveProductionId(
  userId?: string | null,
  options?: ActiveProductionOptions,
) {
  const store = await cookies();
  const cookieValue = store.get(ACTIVE_PRODUCTION_COOKIE)?.value ?? null;

  if (!userId) {
    return cookieValue;
  }

  const canManageProductions =
    options?.canManageProductions ??
    (await hasPermission({ id: userId }, "mitglieder.produktionen"));

  if (cookieValue) {
    if (canManageProductions) {
      return cookieValue;
    }

    const membership = await prisma.productionMembership.findFirst({
      where: {
        userId,
        showId: cookieValue,
        OR: [{ leftAt: null }, { leftAt: { gt: new Date() } }],
      },
      select: { id: true },
    });

    if (membership) {
      return cookieValue;
    }
  }

  const fallbackId = await resolveFallbackActiveProductionId(userId);

  if (!fallbackId) {
    return null;
  }

  return fallbackId;
}

export const getActiveProduction = cache(async (userId?: string | null) => {
  const canManageProductions = userId
    ? await hasPermission({ id: userId }, "mitglieder.produktionen")
    : false;

  const activeProductionId = await getActiveProductionId(userId, {
    canManageProductions,
  });
  if (!activeProductionId) {
    return null;
  }

  const where = userId && !canManageProductions
    ? {
        id: activeProductionId,
        memberships: {
          some: {
            userId,
            OR: [{ leftAt: null }, { leftAt: { gt: new Date() } }],
          },
        },
      }
    : { id: activeProductionId };

  const show = await prisma.show.findFirst({
    where,
    select: {
      id: true,
      title: true,
      year: true,
      synopsis: true,
    },
  });

  if (!show) {
    return null;
  }

  return show;
});
