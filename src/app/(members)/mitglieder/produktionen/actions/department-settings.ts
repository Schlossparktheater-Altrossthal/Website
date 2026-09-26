"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { ensureBoardColumns } from "@/lib/departments/board";
import { prisma } from "@/lib/prisma";
import {
  actionFailure,
  actionSuccess,
  ensureUniqueDepartmentSlug,
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
  id: z.string().optional(),
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

/** Gewerk der Produktion anlegen oder bearbeiten (Regie/Board). Gibt den Slug fürs Portal zurück. */
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
    if (data.id) {
      const department = await prisma.department.findFirst({
        where: { id: data.id, showId: data.showId },
        select: { id: true, slug: true },
      });
      if (!department) throw new Error("Gewerk wurde nicht gefunden.");
      await prisma.department.update({ where: { id: department.id }, data: fields });
      revalidateTeams();
      return { ...actionSuccess(), slug: department.slug };
    }
    const show = await prisma.show.findUnique({ where: { id: data.showId }, select: { id: true } });
    if (!show) throw new Error("Produktion wurde nicht gefunden.");
    const slug = await ensureUniqueDepartmentSlug(data.showId, slugify(data.name));
    const last = await prisma.department.aggregate({
      where: { showId: data.showId },
      _max: { sortOrder: true },
    });
    const created = await prisma.department.create({
      data: { ...fields, showId: data.showId, slug, sortOrder: (last._max.sortOrder ?? 0) + 1 },
    });
    await ensureBoardColumns(created.id);
    revalidateTeams();
    return { ...actionSuccess(), slug };
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
