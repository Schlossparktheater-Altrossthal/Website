"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";
import {
  actionFailure,
  actionSuccess,
  type ProductionActionResult,
} from "@/lib/produktionen/actions-helpers";
import { currentMembershipWhere } from "@/lib/produktionen/status";
import { canEditWishArea, loadWishlistAreas } from "@/lib/wishes/wishlist";

const setWishSchema = z.object({
  showId: z.string().min(1),
  userId: z.string().min(1),
  code: z.string().min(1),
  /** `null` entfernt einen nachgetragenen Wunsch. */
  weight: z.number().int().min(1).max(100).nullable(),
});

const noteSchema = z.object({
  showId: z.string().min(1),
  userId: z.string().min(1),
  text: z.string().max(2000),
});

function revalidateWishes() {
  revalidatePath("/mitglieder/produktionen/zuweisung");
  revalidatePath("/mitglieder/profil");
}

async function authorize(showId: string, targetUserId: string) {
  const session = await requireAuth();
  const actorId = session.user?.id;
  if (!actorId) throw new Error("Nicht angemeldet.");
  const manageAll = await hasPermission(session.user, "PRIVATE.PRODUCTION.SHOW.MANAGE");
  const leads = await prisma.departmentMembership.findMany({
    where: {
      userId: actorId,
      status: "active",
      role: "lead",
      department: { showId, archivedAt: null },
    },
    select: { departmentId: true },
  });
  const leadDepartmentIds = leads.map((entry) => entry.departmentId);
  if (!manageAll && !leadDepartmentIds.length) {
    throw new Error("Dafür fehlt dir die Berechtigung.");
  }
  const member = await prisma.productionMembership.findFirst({
    where: { showId, userId: targetUserId, ...currentMembershipWhere() },
    select: { id: true },
  });
  if (!member) throw new Error("Die Person gehört nicht zu dieser Produktion.");
  return { actorId, manageAll, leadDepartmentIds };
}

/**
 * Trägt einen Wunsch für eine Person nach oder ändert/entfernt einen nachgetragenen.
 * Selbst angegebene Wünsche bleiben unverändert – dafür gibt es die Notiz.
 */
export async function setWishAction(
  input: z.input<typeof setWishSchema>,
): Promise<ProductionActionResult> {
  try {
    const data = setWishSchema.parse(input);
    const access = await authorize(data.showId, data.userId);
    const area = (await loadWishlistAreas(data.showId)).find((entry) => entry.code === data.code);
    if (!area) throw new Error("Diesen Bereich gibt es in der Produktion nicht.");
    if (!canEditWishArea(area, access)) {
      throw new Error("Wünsche für diesen Bereich trägt die Leitung des Gewerks nach.");
    }

    const existing = await prisma.memberRolePreference.findMany({
      where: { userId: data.userId, showId: data.showId, code: { in: area.matchCodes } },
      select: { id: true, code: true, enteredById: true },
    });
    if (existing.some((entry) => entry.enteredById === null)) {
      throw new Error("Diesen Wunsch hat die Person selbst angegeben. Nutze dafür die Notiz.");
    }

    await prisma.$transaction(async (tx) => {
      // Alt-Codes derselben Blaupause zusammenführen: es gilt nur noch der Bereichs-Code.
      await tx.memberRolePreference.deleteMany({
        where: { id: { in: existing.map((entry) => entry.id) } },
      });
      if (data.weight !== null) {
        await tx.memberRolePreference.create({
          data: {
            userId: data.userId,
            showId: data.showId,
            code: area.code,
            domain: area.domain,
            weight: data.weight,
            enteredById: access.actorId,
          },
        });
      }
    });

    revalidateWishes();
    return actionSuccess(data.weight === null ? "Wunsch entfernt" : "Wunsch nachgetragen");
  } catch (error) {
    return actionFailure(error, "Wunsch konnte nicht gespeichert werden.");
  }
}

/** Interne Notiz zu den Wünschen einer Person (leerer Text löscht sie). */
export async function saveWishNoteAction(
  input: z.input<typeof noteSchema>,
): Promise<ProductionActionResult> {
  try {
    const data = noteSchema.parse(input);
    const { actorId } = await authorize(data.showId, data.userId);
    const text = data.text.trim();
    if (!text) {
      await prisma.memberWishNote.deleteMany({
        where: { userId: data.userId, showId: data.showId },
      });
    } else {
      await prisma.memberWishNote.upsert({
        where: { userId_showId: { userId: data.userId, showId: data.showId } },
        update: { text, updatedById: actorId },
        create: { userId: data.userId, showId: data.showId, text, updatedById: actorId },
      });
    }
    revalidateWishes();
    return actionSuccess(text ? "Notiz gespeichert" : "Notiz entfernt");
  } catch (error) {
    return actionFailure(error, "Notiz konnte nicht gespeichert werden.");
  }
}
