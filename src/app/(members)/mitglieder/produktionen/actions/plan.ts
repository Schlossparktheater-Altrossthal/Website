"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";
import {
  actionFailure,
  actionSuccess,
  type ProductionActionResult,
} from "@/lib/produktionen/actions-helpers";
import {
  canCompleteMilestone,
  canManagePlan,
  recalculateShowPlan,
} from "@/lib/planning/plan-service";
import { findCycle, type ScheduleMilestone } from "@/lib/planning/schedule";

const PLAN_PATH = "/mitglieder/produktionen";

const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Bitte ein gültiges Datum angeben.")
  .transform((value) => new Date(`${value}T00:00:00.000Z`));

const milestoneSchema = z
  .object({
    id: z.string().min(1).optional(),
    showId: z.string().min(1),
    title: z.string().trim().min(1, "Bitte einen Titel angeben.").max(160),
    description: z.string().trim().max(2000).optional().nullable(),
    kind: z.enum(["milestone", "deadline", "handover", "review"]),
    departmentId: z.string().min(1).optional().nullable(),
    anchorType: z.enum(["premiere", "finalRehearsalStart", "milestone", "fixed"]),
    anchorMilestoneId: z.string().min(1).optional().nullable(),
    offsetDays: z.number().int().min(-1000).max(1000),
    fixedDate: dateOnly.optional().nullable(),
    predecessors: z
      .array(z.object({ fromId: z.string().min(1), lagDays: z.number().int().min(0).max(365) }))
      .max(20)
      .default([]),
  })
  .superRefine((value, ctx) => {
    if (value.anchorType === "milestone" && !value.anchorMilestoneId) {
      ctx.addIssue({ code: "custom", message: "Bitte den Bezugs-Meilenstein wählen." });
    }
    if (value.anchorType === "fixed" && !value.fixedDate) {
      ctx.addIssue({ code: "custom", message: "Bitte ein Datum angeben." });
    }
  });

export type MilestoneInput = z.input<typeof milestoneSchema>;

async function requirePlanManager() {
  const session = await requireAuth();
  if (!(await canManagePlan(session.user))) {
    throw new Error("Du darfst den Produktionsplan nicht bearbeiten.");
  }
  return session;
}

export async function saveMilestoneAction(input: MilestoneInput): Promise<ProductionActionResult> {
  try {
    await requirePlanManager();
    const data = milestoneSchema.parse(input);
    const id = data.id ?? "__new__";

    const [existing, deps, departments] = await Promise.all([
      prisma.showMilestone.findMany({
        where: { showId: data.showId },
        select: {
          id: true,
          anchorType: true,
          anchorMilestoneId: true,
          offsetDays: true,
          fixedDate: true,
        },
      }),
      prisma.milestoneDependency.findMany({
        where: { from: { showId: data.showId } },
        select: { fromId: true, toId: true, lagDays: true },
      }),
      data.departmentId
        ? prisma.department.count({ where: { id: data.departmentId, showId: data.showId } })
        : Promise.resolve(1),
    ]);

    if (data.id && !existing.some((row) => row.id === data.id)) {
      throw new Error("Meilenstein nicht gefunden.");
    }
    if (departments === 0) throw new Error("Unbekanntes Gewerk.");
    const known = new Set(existing.map((row) => row.id));
    const anchorMilestoneId = data.anchorType === "milestone" ? data.anchorMilestoneId : null;
    if (anchorMilestoneId && (!known.has(anchorMilestoneId) || anchorMilestoneId === id)) {
      throw new Error("Ungültiger Bezugs-Meilenstein.");
    }
    const predecessors = data.predecessors.filter((dep) => dep.fromId !== id);
    if (predecessors.some((dep) => !known.has(dep.fromId))) {
      throw new Error("Ungültige Abhängigkeit.");
    }

    // Zyklen vor dem Speichern ausschließen – mit dem Meilenstein im neuen Zustand.
    const candidate: ScheduleMilestone = {
      id,
      anchorType: data.anchorType,
      anchorMilestoneId,
      offsetDays: data.offsetDays,
      fixedDate: data.fixedDate ?? null,
    };
    const cycle = findCycle(
      [...existing.filter((row) => row.id !== id), candidate],
      [
        ...deps.filter((dep) => dep.toId !== id),
        ...predecessors.map((dep) => ({ ...dep, toId: id })),
      ],
    );
    if (cycle) {
      throw new Error("Diese Abhängigkeit erzeugt einen Kreis im Plan.");
    }

    const fields = {
      title: data.title,
      description: data.description || null,
      kind: data.kind,
      departmentId: data.departmentId || null,
      anchorType: data.anchorType,
      anchorMilestoneId,
      offsetDays: data.anchorType === "fixed" ? 0 : data.offsetDays,
      fixedDate: data.anchorType === "fixed" ? (data.fixedDate ?? null) : null,
    };

    await prisma.$transaction(async (tx) => {
      const saved = data.id
        ? await tx.showMilestone.update({ where: { id: data.id }, data: fields })
        : await tx.showMilestone.create({
            data: { ...fields, showId: data.showId, position: existing.length },
          });
      await tx.milestoneDependency.deleteMany({ where: { toId: saved.id } });
      if (predecessors.length) {
        await tx.milestoneDependency.createMany({
          data: predecessors.map((dep) => ({ ...dep, toId: saved.id })),
        });
      }
      await recalculateShowPlan(data.showId, tx);
    });

    revalidatePath(PLAN_PATH);
    return actionSuccess(data.id ? "Meilenstein gespeichert." : "Meilenstein angelegt.");
  } catch (error) {
    console.error("saveMilestoneAction", error);
    return actionFailure(
      error instanceof z.ZodError ? new Error(error.issues[0]?.message) : error,
      "Meilenstein konnte nicht gespeichert werden.",
    );
  }
}

export async function deleteMilestoneAction(id: string): Promise<ProductionActionResult> {
  try {
    await requirePlanManager();
    const milestone = await prisma.showMilestone.findUnique({
      where: { id },
      select: { showId: true },
    });
    if (!milestone) throw new Error("Meilenstein nicht gefunden.");
    await prisma.$transaction(async (tx) => {
      await tx.showMilestone.delete({ where: { id } });
      await recalculateShowPlan(milestone.showId, tx);
    });
    revalidatePath(PLAN_PATH);
    return actionSuccess("Meilenstein gelöscht.");
  } catch (error) {
    console.error("deleteMilestoneAction", error);
    return actionFailure(error, "Meilenstein konnte nicht gelöscht werden.");
  }
}

export async function setMilestoneDoneAction(
  id: string,
  done: boolean,
): Promise<ProductionActionResult> {
  try {
    const session = await requireAuth();
    if (!(await canCompleteMilestone(session.user, id))) {
      throw new Error("Nur Planverantwortliche und die Gewerk-Leitung dürfen das abhaken.");
    }
    await prisma.showMilestone.update({
      where: { id },
      data: done
        ? { doneAt: new Date(), doneById: session.user?.id ?? null }
        : { doneAt: null, doneById: null },
    });
    revalidatePath(PLAN_PATH);
    return actionSuccess(done ? "Als erledigt markiert." : "Wieder offen.");
  } catch (error) {
    console.error("setMilestoneDoneAction", error);
    return actionFailure(error, "Status konnte nicht geändert werden.");
  }
}
