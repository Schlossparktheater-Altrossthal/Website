"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

import { hasPermission } from "@/lib/permissions";
import { requireAuth } from "@/lib/rbac";
import { clearImpersonationCookie, setImpersonationCookie } from "@/lib/auth/impersonation";
import { requestServiceGroupSync } from "@/lib/authentik/service-groups";
import { revalidateShow } from "@/lib/produktionen/actions-helpers";
import { leaveProductionMembership } from "@/lib/produktionen/memberships";
import { syncProductionRoles } from "@/lib/produktionen/production-roles";

const DEFAULT_REDIRECT = "/";

export type StartImpersonationResult =
  { ok: true; redirectTo: string } | { ok: false; error: string };

export async function startImpersonationAction(input: {
  targetUserId: string;
  redirectTo?: string | null;
}): Promise<StartImpersonationResult> {
  const targetUserId = input?.targetUserId?.trim();
  const redirectTo =
    typeof input?.redirectTo === "string" && input.redirectTo.startsWith("/")
      ? input.redirectTo
      : DEFAULT_REDIRECT;

  if (!targetUserId) {
    return { ok: false, error: "Ungültige Auswahl" } as const;
  }

  const session = await requireAuth(["owner"], { allowImpersonation: false });
  const ownerId = session.user?.id;

  if (!ownerId) {
    return { ok: false, error: "Sitzung konnte nicht geprüft werden" } as const;
  }

  if (targetUserId === ownerId) {
    await clearImpersonationCookie();
    return { ok: true, redirectTo } as const;
  }

  const target = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { id: true },
  });

  if (!target) {
    return { ok: false, error: "Mitglied wurde nicht gefunden" } as const;
  }

  await setImpersonationCookie(ownerId, target.id);
  return { ok: true, redirectTo } as const;
}

export type DirectionViewResult = { ok: true } | { ok: false; error: string };

/** Regie-Ansicht ein-/ausschalten (docs/Plan/regie-plan.md). */
export async function setDirectionViewAction(input: {
  userId: string;
  enabled: boolean;
}): Promise<DirectionViewResult> {
  const session = await requireAuth();
  if (!(await hasPermission(session.user, "PRIVATE.ADMIN.MEMBERS.MANAGE"))) {
    return { ok: false, error: "Nicht berechtigt" };
  }
  const userId = input?.userId?.trim();
  if (!userId) return { ok: false, error: "Ungültige Auswahl" };

  const updated = await prisma.user.updateMany({
    where: { id: userId },
    data: { directionView: input.enabled === true },
  });
  if (updated.count === 0) return { ok: false, error: "Mitglied wurde nicht gefunden" };

  revalidatePath(`/mitglieder/mitgliederverwaltung/${userId}`);
  return { ok: true };
}

export type MemberAssignmentResult = { ok: true } | { ok: false; error: string };

async function requireMembersManager(): Promise<string | null> {
  const session = await requireAuth();
  if (!(await hasPermission(session.user, "PRIVATE.ADMIN.MEMBERS.MANAGE"))) return null;
  return session.user?.id ?? null;
}

function revalidateMemberAssignments(userId: string, showId: string) {
  revalidatePath(`/mitglieder/mitgliederverwaltung/${userId}`);
  revalidatePath("/mitglieder/mitgliederverwaltung");
  revalidatePath("/mitglieder/produktionen/zuweisung");
  revalidatePath("/mitglieder", "layout");
  revalidateShow(showId);
}

/**
 * Nimmt eine Person direkt aus der Mitgliederverwaltung in eine Produktion auf (aktiv, ohne
 * Onboarding – z. B. die Regie) oder beendet die Mitgliedschaft samt ihren Gewerken.
 */
export async function setMemberProductionAction(input: {
  userId: string;
  showId: string;
  member: boolean;
}): Promise<MemberAssignmentResult> {
  if (!(await requireMembersManager())) return { ok: false, error: "Nicht berechtigt" };
  const userId = input?.userId?.trim();
  const showId = input?.showId?.trim();
  if (!userId || !showId) return { ok: false, error: "Ungültige Auswahl" };

  try {
    if (input.member) {
      const [show, user] = await Promise.all([
        prisma.show.findUnique({ where: { id: showId }, select: { id: true } }),
        prisma.user.findUnique({ where: { id: userId }, select: { id: true } }),
      ]);
      if (!show || !user) return { ok: false, error: "Nicht gefunden" };
      await prisma.productionMembership.upsert({
        where: { showId_userId: { showId, userId } },
        update: { status: "active", leftAt: null },
        create: { showId, userId, status: "active" },
      });
      await syncProductionRoles([userId]);
      requestServiceGroupSync();
    } else {
      await prisma.departmentMembership.updateMany({
        where: { userId, status: "active", department: { showId } },
        data: { status: "left", decidedAt: new Date() },
      });
      await leaveProductionMembership({ showId, userId });
    }
  } catch (error) {
    console.error("[members] Produktion zuordnen fehlgeschlagen", error);
    return { ok: false, error: "Speichern fehlgeschlagen" };
  }

  revalidateMemberAssignments(userId, showId);
  return { ok: true };
}

/**
 * Ordnet eine Person einem Gewerk zu oder nimmt sie heraus. Fehlt die Produktions-
 * mitgliedschaft, wird sie gleich mit angelegt (aktiv).
 */
export async function setMemberDepartmentAction(input: {
  userId: string;
  departmentId: string;
  member: boolean;
}): Promise<MemberAssignmentResult> {
  const actorId = await requireMembersManager();
  if (!actorId) return { ok: false, error: "Nicht berechtigt" };
  const userId = input?.userId?.trim();
  const departmentId = input?.departmentId?.trim();
  if (!userId || !departmentId) return { ok: false, error: "Ungültige Auswahl" };

  const department = await prisma.department.findUnique({
    where: { id: departmentId },
    select: { id: true, showId: true, archivedAt: true },
  });
  if (!department || department.archivedAt) return { ok: false, error: "Gewerk nicht gefunden" };

  try {
    if (input.member) {
      const membership = await prisma.productionMembership.findUnique({
        where: { showId_userId: { showId: department.showId, userId } },
        select: { status: true },
      });
      if (!membership || membership.status === "left") {
        await prisma.productionMembership.upsert({
          where: { showId_userId: { showId: department.showId, userId } },
          update: { status: "active", leftAt: null },
          create: { showId: department.showId, userId, status: "active" },
        });
        await syncProductionRoles([userId]);
        requestServiceGroupSync();
      }
      await prisma.departmentMembership.upsert({
        where: { departmentId_userId: { departmentId, userId } },
        update: { status: "active", assignedById: actorId, decidedAt: new Date() },
        create: {
          departmentId,
          userId,
          role: "member",
          status: "active",
          source: "assigned",
          assignedById: actorId,
          decidedAt: new Date(),
        },
      });
    } else {
      await prisma.departmentMembership.updateMany({
        where: { departmentId, userId, status: "active" },
        data: { status: "left", assignedById: actorId, decidedAt: new Date() },
      });
    }
  } catch (error) {
    console.error("[members] Gewerk zuordnen fehlgeschlagen", error);
    return { ok: false, error: "Speichern fehlgeschlagen" };
  }

  revalidateMemberAssignments(userId, department.showId);
  return { ok: true };
}
