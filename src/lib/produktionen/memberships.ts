import { prisma } from "@/lib/prisma";
import { requestServiceGroupSync } from "@/lib/authentik/service-groups";
import { syncProductionRoles } from "@/lib/produktionen/production-roles";

/**
 * Beendet eine Produktionsmitgliedschaft, statt sie zu löschen: `status: "left"` plus `leftAt`
 * bleiben als Historie erhalten („Ehemalige laden“ auf der Ensemble-Seite).
 *
 * Genutzt von der Ensemble-Seite (per `membershipId`) und der Mitgliederverwaltung (per
 * `showId` + `userId`, weil dort nur das Mitglied bekannt ist).
 */
export type LeaveMembershipTarget = { membershipId: string } | { showId: string; userId: string };

export type LeftMembership = { showId: string; userId: string };

/**
 * Schließt die offene Mitgliedschaft und zieht die abgeleiteten Rollen sowie die
 * Authentik-Service-Groups nach. Gibt `null` zurück, wenn es nichts zu beenden gab.
 */
export async function leaveProductionMembership(
  target: LeaveMembershipTarget,
): Promise<LeftMembership | null> {
  const membership = await prisma.productionMembership.findFirst({
    where:
      "membershipId" in target
        ? { id: target.membershipId, status: { not: "left" } }
        : { showId: target.showId, userId: target.userId, status: { not: "left" } },
    select: { id: true, showId: true, userId: true },
  });

  if (!membership) {
    return null;
  }

  await prisma.productionMembership.update({
    where: { id: membership.id },
    data: { status: "left", leftAt: new Date() },
  });
  await syncProductionRoles([membership.userId]);
  requestServiceGroupSync();

  return { showId: membership.showId, userId: membership.userId };
}
