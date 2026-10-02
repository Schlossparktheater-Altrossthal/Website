"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { ensureBoardColumns } from "@/lib/departments/board";
import { DEFAULT_DEPARTMENT_MODULES, normalizeModules } from "@/lib/departments/modules";
import {
  createDepartmentFromTemplate,
  ensureUniqueTemplateSlug,
  listTemplateChoices,
  type TemplateChoice,
} from "@/lib/departments/templates";
import { prisma } from "@/lib/prisma";
import {
  actionFailure,
  actionSuccess,
  requireProductionManager,
  slugify,
  type ProductionActionResult,
} from "@/lib/produktionen/actions-helpers";

const hexColor = /^#[0-9a-f]{6}$/i;

function revalidateTeams() {
  revalidatePath("/mitglieder/meine-gewerke", "layout");
  revalidatePath("/mitglieder/produktionen/zuweisung");
}

const departmentSchema = z.object({
  showId: z.string(),
  id: z.string(),
  name: z.string().trim().min(2, "Name ist zu kurz.").max(80),
  description: z
    .string()
    .trim()
    .max(2000)
    .nullish()
    .transform((value) => value || null),
  color: z.string().regex(hexColor).nullish(),
  requiresJoinApproval: z.boolean(),
});

/** Gewerk der Produktion bearbeiten (Regie/Board). Angelegt wird nur aus einer Blaupause. */
export async function saveDepartmentAction(
  input: z.input<typeof departmentSchema>,
): Promise<ProductionActionResult & { slug?: string }> {
  try {
    await requireProductionManager();
    const data = departmentSchema.parse(input);
    const fields = {
      name: data.name,
      description: data.description,
      color: data.color ?? null,
      requiresJoinApproval: data.requiresJoinApproval,
    };
    const department = await prisma.department.findFirst({
      where: { id: data.id, showId: data.showId },
      select: { id: true, slug: true },
    });
    if (!department) throw new Error("Gewerk wurde nicht gefunden.");
    await prisma.department.update({ where: { id: department.id }, data: fields });
    revalidateTeams();
    return { ...actionSuccess(), slug: department.slug };
  } catch (error) {
    return actionFailure(error, "Gewerk konnte nicht gespeichert werden.");
  }
}

/** Gewerk archivieren: verschwindet aus Portal, Zuweisung und Navigation, Daten bleiben erhalten. */
export async function archiveDepartmentAction(input: {
  id: string;
}): Promise<ProductionActionResult> {
  try {
    await requireProductionManager();
    const id = z.string().parse(input.id);
    await prisma.department.update({ where: { id }, data: { archivedAt: new Date() } });
    revalidateTeams();
    return actionSuccess();
  } catch (error) {
    return actionFailure(error, "Gewerk konnte nicht archiviert werden.");
  }
}

/** Blaupausen zur Auswahl beim Anlegen (Regie/Board). */
export async function listTemplateChoicesAction(input: {
  showId: string;
}): Promise<ProductionActionResult & { templates?: TemplateChoice[] }> {
  try {
    await requireProductionManager();
    return {
      ...actionSuccess(),
      templates: await listTemplateChoices(z.string().parse(input.showId)),
    };
  } catch (error) {
    return actionFailure(error, "Blaupausen konnten nicht geladen werden.");
  }
}

/** Gewerk aus einer vorhandenen Blaupause anlegen. Gibt den Slug fürs Portal zurück. */
export async function createDepartmentFromTemplateAction(input: {
  showId: string;
  templateId: string;
}): Promise<ProductionActionResult & { slug?: string }> {
  try {
    await requireProductionManager();
    const showId = z.string().parse(input.showId);
    const templateId = z.string().parse(input.templateId);
    const department = await prisma.$transaction((tx) =>
      createDepartmentFromTemplate(showId, templateId, tx),
    );
    await ensureBoardColumns(department.id);
    revalidateTeams();
    return {
      ...actionSuccess(department.restored ? "Archiviertes Gewerk wiederhergestellt." : undefined),
      slug: department.slug,
    };
  } catch (error) {
    return actionFailure(error, "Gewerk konnte nicht angelegt werden.");
  }
}

const newTemplateSchema = z.object({
  showId: z.string(),
  name: z.string().trim().min(2, "Name ist zu kurz.").max(80),
  description: z
    .string()
    .trim()
    .max(2000)
    .nullish()
    .transform((value) => value || null),
  color: z.string().regex(hexColor).nullish(),
  modules: z.array(z.string()).max(12),
  requiresJoinApproval: z.boolean(),
});

/**
 * Gibt es keine passende Blaupause, wird sie beim Anlegen miterstellt (E7) und das Gewerk
 * gleich daraus angelegt. Rechte der neuen Blaupause beginnen leer.
 */
export async function createDepartmentWithNewTemplateAction(
  input: z.input<typeof newTemplateSchema>,
): Promise<ProductionActionResult & { slug?: string }> {
  try {
    await requireProductionManager();
    const data = newTemplateSchema.parse(input);
    const show = await prisma.show.findUnique({ where: { id: data.showId }, select: { id: true } });
    if (!show) throw new Error("Produktion wurde nicht gefunden.");
    const modules = normalizeModules(data.modules);
    const department = await prisma.$transaction(async (tx) => {
      const last = await tx.departmentTemplate.aggregate({ _max: { sortOrder: true } });
      const template = await tx.departmentTemplate.create({
        data: {
          slug: await ensureUniqueTemplateSlug(slugify(data.name), tx),
          name: data.name,
          description: data.description,
          color: data.color ?? null,
          requiresJoinApproval: data.requiresJoinApproval,
          modules: modules.length ? modules : DEFAULT_DEPARTMENT_MODULES,
          sortOrder: (last._max.sortOrder ?? 0) + 1,
        },
        select: { id: true },
      });
      return createDepartmentFromTemplate(data.showId, template.id, tx);
    });
    await ensureBoardColumns(department.id);
    revalidateTeams();
    revalidatePath("/mitglieder/blaupausen");
    return { ...actionSuccess(), slug: department.slug };
  } catch (error) {
    return actionFailure(error, "Gewerk konnte nicht angelegt werden.");
  }
}
