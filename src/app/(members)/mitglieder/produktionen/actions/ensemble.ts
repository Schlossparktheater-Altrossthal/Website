"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";
import { hasPermission } from "@/lib/permissions";
import { requestServiceGroupSync } from "@/lib/authentik/service-groups";
import {
  actionFailure,
  actionSuccess,
  readOptionalString,
  readString,
  revalidateShow,
  type ProductionActionResult,
} from "@/lib/produktionen/actions-helpers";
import { sanitizeProductionRoles, syncProductionRoles } from "@/lib/produktionen/production-roles";
import { createConfiguredMailSender } from "@/lib/email/send";
import {
  inviteFormerMembers,
  type ReturneeInviteOutcome,
} from "@/lib/produktionen/returnee-invites";

async function ensureManager() {
  const session = await requireAuth();
  if (!(await hasPermission(session.user, "PRIVATE.PRODUCTION.SHOW.MANAGE"))) {
    throw new Error("Du hast keinen Zugriff auf die Produktionsplanung.");
  }
  return session;
}

function ensemblePath(showId: string) {
  return `/mitglieder/produktionen/${showId}/ensemble`;
}

/**
 * Nimmt eine Person ins Ensemble auf. Wer für diese Produktion schon ongeboardet ist, wird
 * direkt aktiv; alle anderen sind „eingeladen“ und bekommen Zugriff erst mit dem Onboarding (E2).
 */
export async function addProductionMemberAction(
  formData: FormData,
): Promise<ProductionActionResult> {
  try {
    await ensureManager();
    const showId = readString(formData, "showId", { label: "Produktion" });
    const userId = readString(formData, "userId", { label: "Mitglied" });

    const [show, user, onboarding] = await Promise.all([
      prisma.show.findUnique({ where: { id: showId }, select: { id: true } }),
      prisma.user.findUnique({ where: { id: userId }, select: { id: true } }),
      prisma.productionOnboarding.findUnique({
        where: { userId_showId: { userId, showId } },
        select: { completedAt: true },
      }),
    ]);
    if (!show) throw new Error("Produktion wurde nicht gefunden.");
    if (!user) throw new Error("Mitglied wurde nicht gefunden.");

    const status = onboarding?.completedAt ? "active" : "invited";
    await prisma.productionMembership.upsert({
      where: { showId_userId: { showId, userId } },
      update: { status, leftAt: null },
      create: { showId, userId, status },
    });
    await syncProductionRoles([userId]);
    requestServiceGroupSync();

    revalidateShow(showId, ensemblePath(showId));
    return actionSuccess(
      status === "active"
        ? "Mitglied wurde ins Ensemble aufgenommen."
        : "Mitglied wurde eingeladen und bekommt Zugriff nach dem Onboarding.",
    );
  } catch (error) {
    console.error("addProductionMemberAction", error);
    return actionFailure(error, "Mitglied konnte nicht aufgenommen werden.");
  }
}

/** Rollen (Ensemble/Technik) und Funktion einer Mitgliedschaft setzen – nur durch Admins (E1). */
export async function updateProductionMemberAction(
  formData: FormData,
): Promise<ProductionActionResult> {
  try {
    await ensureManager();
    const membershipId = readString(formData, "membershipId", { label: "Mitgliedschaft" });
    const roles = sanitizeProductionRoles(formData.getAll("roles"));
    const func = readOptionalString(formData, "function", { label: "Funktion", maxLength: 120 });

    const membership = await prisma.productionMembership.update({
      where: { id: membershipId },
      data: { roles, function: func ?? null },
      select: { showId: true, userId: true },
    });
    const changed = await syncProductionRoles([membership.userId]);
    if (changed.length > 0) requestServiceGroupSync();

    revalidateShow(membership.showId, ensemblePath(membership.showId));
    return actionSuccess("Rollen wurden gespeichert.");
  } catch (error) {
    console.error("updateProductionMemberAction", error);
    return actionFailure(error, "Rollen konnten nicht gespeichert werden.");
  }
}

/** Beendet eine Mitgliedschaft (die Person bleibt in der Historie der Produktion). */
export async function removeProductionMemberAction(
  formData: FormData,
): Promise<ProductionActionResult> {
  try {
    await ensureManager();
    const membershipId = readString(formData, "membershipId", { label: "Mitgliedschaft" });

    const membership = await prisma.productionMembership.update({
      where: { id: membershipId },
      data: { status: "left", leftAt: new Date() },
      select: { showId: true, userId: true },
    });
    await syncProductionRoles([membership.userId]);
    requestServiceGroupSync();

    revalidateShow(membership.showId, ensemblePath(membership.showId));
    return actionSuccess("Mitgliedschaft wurde beendet.");
  } catch (error) {
    console.error("removeProductionMemberAction", error);
    return actionFailure(error, "Mitgliedschaft konnte nicht beendet werden.");
  }
}

export type InviteFormerMembersResult =
  { ok: true; message: string; outcomes: ReturneeInviteOutcome[] } | { ok: false; error: string };

/** Lädt ausgewählte ehemalige Mitglieder mit persönlichem Link zur Produktion ein. */
export async function inviteFormerMembersAction(
  formData: FormData,
): Promise<InviteFormerMembersResult> {
  try {
    const session = await ensureManager();
    const showId = readString(formData, "showId", { label: "Produktion" });
    const userIds = formData
      .getAll("userIds")
      .filter((value): value is string => typeof value === "string" && value.length > 0);
    if (userIds.length === 0) {
      throw new Error("Bitte wähle mindestens eine Person aus.");
    }
    if (userIds.length > 100) {
      throw new Error("Bitte lade höchstens 100 Personen auf einmal ein.");
    }
    const createdById = session.user?.id;
    if (!createdById) {
      throw new Error("Nicht angemeldet.");
    }

    const sender = await createConfiguredMailSender();
    const outcomes = await inviteFormerMembers({ showId, userIds, createdById, sender });

    revalidateShow(showId, ensemblePath(showId));
    const sent = outcomes.filter((outcome) => outcome.status === "sent").length;
    const withLink = outcomes.length - sent;
    const message =
      withLink === 0
        ? `${sent} Einladungen per Mail verschickt.`
        : `${sent} Einladungen per Mail verschickt, ${withLink} Links bitte selbst weitergeben.`;
    return { ok: true, message, outcomes };
  } catch (error) {
    console.error("inviteFormerMembersAction", error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Einladungen konnten nicht erstellt werden.",
    };
  }
}
