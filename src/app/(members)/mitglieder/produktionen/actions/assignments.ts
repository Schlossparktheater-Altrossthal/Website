"use server";

import { revalidatePath } from "next/cache";
import type { CharacterCastingType, DepartmentMembershipRole } from "@prisma/client";

import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";
import {
  actionFailure,
  actionSuccess,
  type ProductionActionResult,
} from "@/lib/produktionen/actions-helpers";

const DEPARTMENT_ROLES: DepartmentMembershipRole[] = ["lead", "deputy", "member", "guest"];
const CASTING_TYPES: CharacterCastingType[] = ["primary", "alternate"];

const REVALIDATE_PATHS = [
  "/mitglieder/produktionen/zuweisung",
  "/mitglieder/meine-gewerke",
  "/mitglieder",
];

function revalidateAssignments() {
  for (const path of REVALIDATE_PATHS) revalidatePath(path);
}

/** Regie/Board dürfen alles, die Leitung eines Gewerks nur dessen Zugehörigkeiten. */
async function authorizeDepartment(departmentId: string) {
  const session = await requireAuth();
  const userId = session.user?.id;
  if (!userId) throw new Error("Nicht angemeldet.");

  const department = await prisma.department.findUnique({
    where: { id: departmentId },
    select: { id: true, name: true, showId: true, archivedAt: true },
  });
  if (!department || department.archivedAt) throw new Error("Gewerk wurde nicht gefunden.");

  const isManager = await hasPermission(session.user, "PRIVATE.PRODUCTION.SHOW.MANAGE");
  if (!isManager) {
    const lead = await prisma.departmentMembership.findFirst({
      where: { departmentId, userId, status: "active", role: "lead" },
      select: { id: true },
    });
    if (!lead) throw new Error("Dafür fehlt dir die Berechtigung.");
  }
  return { userId, isManager, department };
}

async function notify(userId: string, title: string, body?: string) {
  await prisma.notification.create({
    data: {
      title,
      body: body ?? null,
      type: "department-assignment",
      recipients: { create: { userId } },
    },
  });
}

/**
 * Weist eine Person einem Gewerk zu, ändert deren Funktion oder nimmt eine Anfrage an.
 * Auch mehrere Gewerke pro Person sind möglich.
 */
export async function assignDepartmentMemberAction(input: {
  departmentId: string;
  userId: string;
  role?: DepartmentMembershipRole;
}): Promise<ProductionActionResult> {
  try {
    const {
      userId: actorId,
      isManager,
      department,
    } = await authorizeDepartment(input.departmentId);
    const role = input.role ?? "member";
    if (!DEPARTMENT_ROLES.includes(role)) throw new Error("Ungültige Funktion.");
    // Die Leitung ernennen nur Regie/Board, damit sich niemand selbst befördert.
    if (role === "lead" && !isManager) throw new Error("Die Leitung bestimmt die Regie.");

    const target = await prisma.user.findUnique({
      where: { id: input.userId },
      select: { id: true, deactivatedAt: true },
    });
    if (!target || target.deactivatedAt) throw new Error("Person wurde nicht gefunden.");

    const existing = await prisma.departmentMembership.findUnique({
      where: {
        departmentId_userId: { departmentId: department.id, userId: input.userId },
      },
      select: { status: true, role: true },
    });
    if (
      existing?.status === "active" &&
      existing.role === "lead" &&
      role !== "lead" &&
      !isManager
    ) {
      throw new Error("Die Leitung ändert nur die Regie.");
    }

    await prisma.departmentMembership.upsert({
      where: {
        departmentId_userId: { departmentId: department.id, userId: input.userId },
      },
      update: { status: "active", role, assignedById: actorId, decidedAt: new Date() },
      create: {
        departmentId: department.id,
        userId: input.userId,
        role,
        status: "active",
        source: "assigned",
        assignedById: actorId,
        decidedAt: new Date(),
      },
    });

    if (existing?.status !== "active" && input.userId !== actorId) {
      await notify(
        input.userId,
        `Du bist jetzt im Gewerk ${department.name}`,
        "Unter „Meine Gewerke“ findest du das Team.",
      );
    }

    revalidateAssignments();
    return actionSuccess();
  } catch (error) {
    return actionFailure(error, "Zuweisung konnte nicht gespeichert werden.");
  }
}

/** Entfernt eine Person aus einem Gewerk oder lehnt eine Anfrage ab. */
export async function removeDepartmentMemberAction(input: {
  departmentId: string;
  userId: string;
}): Promise<ProductionActionResult> {
  try {
    const {
      userId: actorId,
      isManager,
      department,
    } = await authorizeDepartment(input.departmentId);
    const existing = await prisma.departmentMembership.findUnique({
      where: {
        departmentId_userId: { departmentId: department.id, userId: input.userId },
      },
      select: { id: true, status: true, role: true },
    });
    if (!existing) return actionSuccess();
    if (existing.role === "lead" && existing.status === "active" && !isManager) {
      throw new Error("Die Leitung entfernt nur die Regie.");
    }

    if (existing.status === "requested") {
      await prisma.departmentMembership.delete({ where: { id: existing.id } });
      if (input.userId !== actorId) {
        await notify(input.userId, `Anfrage für ${department.name} abgelehnt`);
      }
    } else {
      await prisma.departmentMembership.update({
        where: { id: existing.id },
        data: { status: "left", assignedById: actorId, decidedAt: new Date() },
      });
    }

    revalidateAssignments();
    return actionSuccess();
  } catch (error) {
    return actionFailure(error, "Änderung konnte nicht gespeichert werden.");
  }
}

/** Besetzt eine Rolle (Haupt- oder Zweitbesetzung) oder nimmt die Person wieder heraus. */
export async function setCharacterCastingAction(input: {
  characterId: string;
  userId: string;
  type: CharacterCastingType | null;
}): Promise<ProductionActionResult> {
  try {
    const session = await requireAuth();
    if (!(await hasPermission(session.user, "PRIVATE.PRODUCTION.SHOW.MANAGE"))) {
      throw new Error("Dafür fehlt dir die Berechtigung.");
    }
    if (input.type && !CASTING_TYPES.includes(input.type)) throw new Error("Ungültige Besetzung.");

    const character = await prisma.character.findUnique({
      where: { id: input.characterId },
      select: { id: true, name: true },
    });
    if (!character) throw new Error("Rolle wurde nicht gefunden.");
    if (input.type) {
      const target = await prisma.user.findUnique({
        where: { id: input.userId },
        select: { deactivatedAt: true },
      });
      if (!target || target.deactivatedAt) throw new Error("Person wurde nicht gefunden.");
    }

    await prisma.$transaction(async (tx) => {
      await tx.characterCasting.deleteMany({
        where: {
          characterId: character.id,
          userId: input.userId,
          type: { in: CASTING_TYPES },
        },
      });
      if (input.type) {
        await tx.characterCasting.create({
          data: { characterId: character.id, userId: input.userId, type: input.type },
        });
      }
    });

    if (input.type && input.userId !== session.user?.id) {
      await notify(
        input.userId,
        `Du spielst ${character.name}`,
        input.type === "alternate" ? "Als Zweitbesetzung." : undefined,
      );
    }

    revalidateAssignments();
    revalidatePath("/mitglieder/produktionen/stueck");
    return actionSuccess();
  } catch (error) {
    return actionFailure(error, "Besetzung konnte nicht gespeichert werden.");
  }
}
