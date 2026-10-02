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
import { canManagePlan, recalculateShowPlan } from "@/lib/planning/plan-service";
import {
  SUGGESTED_TEMPLATE,
  buildTemplateItems,
  instantiateTemplate,
  templateItemsSchema,
} from "@/lib/planning/templates";

const PLAN_PATH = "/mitglieder/produktionen";

async function requirePlanManager() {
  const session = await requireAuth();
  if (!(await canManagePlan(session.user))) {
    throw new Error("Du darfst den Produktionsplan nicht bearbeiten.");
  }
  return session;
}

/** Speichert den Plan einer Produktion als Vorlage für kommende Jahre. */
export async function savePlanTemplateAction(
  showId: string,
  name: string,
): Promise<ProductionActionResult> {
  try {
    const session = await requirePlanManager();
    const title = z.string().trim().min(1, "Bitte einen Namen angeben.").max(120).parse(name);
    const show = await prisma.show.findUnique({
      where: { id: showId },
      select: { year: true, premiereAt: true },
    });
    if (!show) throw new Error("Produktion nicht gefunden.");
    const milestones = await prisma.showMilestone.findMany({
      where: { showId },
      orderBy: [{ dueAt: "asc" }, { position: "asc" }],
      include: {
        department: { select: { slug: true } },
        predecessors: { select: { fromId: true, lagDays: true } },
      },
    });
    if (!milestones.length) throw new Error("Der Plan ist noch leer.");
    const items = buildTemplateItems(
      milestones.map((milestone) => ({
        ...milestone,
        departmentSlug: milestone.department?.slug ?? null,
      })),
      show,
    );
    await prisma.planTemplate.create({
      data: { name: title, items, createdById: session.user?.id ?? null },
    });
    revalidatePath(PLAN_PATH);
    return actionSuccess("Vorlage gespeichert.");
  } catch (error) {
    console.error("savePlanTemplateAction", error);
    return actionFailure(
      error instanceof z.ZodError ? new Error(error.issues[0]?.message) : error,
      "Vorlage konnte nicht gespeichert werden.",
    );
  }
}

/** Übernimmt eine Vorlage in einen leeren Plan; Daten rechnen sich aus Premiere und Endprobenwoche. */
export async function applyPlanTemplateAction(
  showId: string,
  templateId: string,
): Promise<ProductionActionResult> {
  try {
    await requirePlanManager();
    const [show, existing, departments, stored] = await Promise.all([
      prisma.show.findUnique({ where: { id: showId }, select: { year: true } }),
      prisma.showMilestone.count({ where: { showId } }),
      prisma.department.findMany({
        where: { showId, archivedAt: null },
        select: { id: true, slug: true },
      }),
      templateId === SUGGESTED_TEMPLATE.id
        ? Promise.resolve(null)
        : prisma.planTemplate.findUnique({ where: { id: templateId }, select: { items: true } }),
    ]);
    if (!show) throw new Error("Produktion nicht gefunden.");
    if (existing) throw new Error("Vorlagen lassen sich nur in einen leeren Plan übernehmen.");
    if (templateId !== SUGGESTED_TEMPLATE.id && !stored) throw new Error("Vorlage nicht gefunden.");
    const items =
      templateId === SUGGESTED_TEMPLATE.id
        ? SUGGESTED_TEMPLATE.items
        : templateItemsSchema.parse(stored?.items);

    const planned = instantiateTemplate(items, {
      year: show.year,
      departmentIdsBySlug: new Map(
        departments.map((department) => [department.slug, department.id]),
      ),
    });

    await prisma.$transaction(async (tx) => {
      const ids = new Map<string, string>();
      for (const [index, entry] of planned.entries()) {
        const created = await tx.showMilestone.create({
          data: {
            showId,
            title: entry.title,
            description: entry.description,
            kind: entry.kind,
            departmentId: entry.departmentId,
            anchorType: entry.anchorType,
            offsetDays: entry.offsetDays,
            fixedDate: entry.fixedDate,
            position: index,
          },
          select: { id: true },
        });
        ids.set(entry.key, created.id);
      }
      for (const entry of planned) {
        const id = ids.get(entry.key) as string;
        if (entry.anchorKey) {
          await tx.showMilestone.update({
            where: { id },
            data: { anchorMilestoneId: ids.get(entry.anchorKey) ?? null },
          });
        }
        const deps = entry.predecessors.flatMap((dep) => {
          const fromId = ids.get(dep.key);
          return fromId ? [{ fromId, toId: id, lagDays: dep.lagDays }] : [];
        });
        if (deps.length) await tx.milestoneDependency.createMany({ data: deps });
      }
      await recalculateShowPlan(showId, tx);
    });

    revalidatePath(PLAN_PATH);
    return actionSuccess(`${planned.length} Meilensteine übernommen.`);
  } catch (error) {
    console.error("applyPlanTemplateAction", error);
    return actionFailure(error, "Vorlage konnte nicht übernommen werden.");
  }
}

export async function deletePlanTemplateAction(
  templateId: string,
): Promise<ProductionActionResult> {
  try {
    await requirePlanManager();
    await prisma.planTemplate.delete({ where: { id: templateId } });
    revalidatePath(PLAN_PATH);
    return actionSuccess("Vorlage gelöscht.");
  } catch (error) {
    console.error("deletePlanTemplateAction", error);
    return actionFailure(error, "Vorlage konnte nicht gelöscht werden.");
  }
}
