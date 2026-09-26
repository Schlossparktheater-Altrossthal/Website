"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getActiveProduction } from "@/lib/active-production";
import { getUserDisplayName } from "@/lib/names";
import { prisma } from "@/lib/prisma";
import {
  actionFailure,
  actionSuccess,
  type ProductionActionResult,
} from "@/lib/produktionen/actions-helpers";
import { requireAuth } from "@/lib/rbac";

function revalidateTeams() {
  revalidatePath("/mitglieder", "layout");
  revalidatePath("/mitglieder/produktionen/zuweisung");
}

/**
 * Selbst einem Gewerk der aktiven Produktion beitreten. Mit Beitrittsprüfung entsteht eine
 * Anfrage, die Leitung oder Regie unter „Teams & Zuweisung“ entscheiden (Leitung wird benachrichtigt).
 */
export async function joinDepartmentAction(input: {
  departmentId: string;
}): Promise<ProductionActionResult> {
  try {
    const session = await requireAuth();
    const userId = session.user?.id;
    if (!userId) throw new Error("Nicht angemeldet.");
    const departmentId = z.string().parse(input.departmentId);
    const production = await getActiveProduction(userId);
    const department = await prisma.department.findFirst({
      where: { id: departmentId, showId: production?.id ?? "", archivedAt: null },
      select: { id: true, name: true, requiresJoinApproval: true },
    });
    if (!department) throw new Error("Das Gewerk gibt es in dieser Produktion nicht.");

    const existing = await prisma.departmentMembership.findUnique({
      where: { departmentId_userId: { departmentId: department.id, userId } },
      select: { status: true },
    });
    if (existing?.status === "active") return actionSuccess("Du bist schon dabei.");

    const status = department.requiresJoinApproval ? "requested" : "active";
    await prisma.departmentMembership.upsert({
      where: { departmentId_userId: { departmentId: department.id, userId } },
      update: {
        status,
        source: "self",
        role: "member",
        decidedAt: status === "active" ? new Date() : null,
      },
      create: {
        departmentId: department.id,
        userId,
        role: "member",
        status,
        source: "self",
        decidedAt: status === "active" ? new Date() : null,
      },
    });

    if (status === "requested") {
      const [leads, user] = await Promise.all([
        prisma.departmentMembership.findMany({
          where: {
            departmentId: department.id,
            status: "active",
            role: { in: ["lead", "deputy"] },
          },
          select: { userId: true },
        }),
        prisma.user.findUnique({
          where: { id: userId },
          select: { firstName: true, lastName: true, name: true, email: true },
        }),
      ]);
      if (leads.length) {
        await prisma.notification.create({
          data: {
            title: `Anfrage für ${department.name}: ${user ? getUserDisplayName(user) : "Jemand"} möchte mitmachen`,
            type: "department-request",
            recipients: { create: leads.map((entry) => ({ userId: entry.userId })) },
          },
        });
      }
    }

    revalidateTeams();
    return actionSuccess(
      status === "requested" ? "Anfrage gesendet" : `Willkommen bei ${department.name}`,
    );
  } catch (error) {
    return actionFailure(error, "Das hat nicht geklappt.");
  }
}

/** Eigene offene Anfrage zurückziehen. */
export async function withdrawJoinRequestAction(input: {
  departmentId: string;
}): Promise<ProductionActionResult> {
  try {
    const session = await requireAuth();
    const userId = session.user?.id;
    if (!userId) throw new Error("Nicht angemeldet.");
    await prisma.departmentMembership.deleteMany({
      where: { departmentId: z.string().parse(input.departmentId), userId, status: "requested" },
    });
    revalidateTeams();
    return actionSuccess("Anfrage zurückgezogen");
  } catch (error) {
    return actionFailure(error, "Das hat nicht geklappt.");
  }
}
