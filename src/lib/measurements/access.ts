import type { Session } from "next-auth";

import { hasPermission, PROFILE_DATA_PERMISSION_KEYS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

/** Baustein einer Blaupause, der die Körpermaße ins Gewerk-Portal holt. */
export const MEASUREMENTS_MODULE = "measurements";

/** Ensemble = Systemrolle „cast“ oder in irgendeiner Rolle besetzt. */
export async function isEnsembleMember(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      role: true,
      roles: { where: { role: "cast" }, select: { role: true } },
      _count: { select: { characterCastings: true } },
    },
  });
  if (!user) return false;
  return user.role === "cast" || user.roles.length > 0 || user._count.characterCastings > 0;
}

/**
 * Produktionen, in denen die Person in einem Gewerk mit Baustein „Körpermaße“ aktiv mitarbeitet
 * (Gäste ausgenommen). Dort darf sie die Maße der besetzten Personen pflegen.
 */
export async function listMeasurementShowIds(userId: string) {
  const memberships = await prisma.departmentMembership.findMany({
    where: {
      userId,
      status: "active",
      role: { not: "guest" },
      department: { archivedAt: null, template: { modules: { has: MEASUREMENTS_MODULE } } },
    },
    select: { department: { select: { showId: true } } },
  });
  return [...new Set(memberships.map((membership) => membership.department.showId))];
}

/**
 * Darf `user` die Maße und Konfektionsgrößen von `targetUserId` sehen und ändern?
 * Eigene Maße (wenn im Ensemble), globales Recht „Körpermaße verwalten“ oder
 * Gewerk mit Baustein „Körpermaße“ in einer Produktion, in der die Person besetzt ist.
 */
export async function canEditMeasurementsOf(user: Session["user"], targetUserId: string) {
  const viewerId = user?.id;
  if (!viewerId) return false;
  if (viewerId === targetUserId) return true;
  if (await hasPermission(user, PROFILE_DATA_PERMISSION_KEYS.measurements)) return true;
  const showIds = await listMeasurementShowIds(viewerId);
  if (!showIds.length) return false;
  const casting = await prisma.characterCasting.findFirst({
    where: { userId: targetUserId, character: { showId: { in: showIds } } },
    select: { id: true },
  });
  return Boolean(casting);
}
