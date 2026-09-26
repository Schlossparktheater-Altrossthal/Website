"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireBoardAccess } from "@/lib/departments/board";
import { prisma } from "@/lib/prisma";
import {
  actionFailure,
  actionSuccess,
  type ProductionActionResult,
} from "@/lib/produktionen/actions-helpers";

/** Datei löschen: wer sie hochgeladen hat, sowie Leitung, Vertretung und Regie. */
export async function deleteTeamFileAction(input: { id: string }): Promise<ProductionActionResult> {
  try {
    const document = await prisma.departmentDocument.findUnique({
      where: { id: z.string().parse(input.id) },
      select: { id: true, departmentId: true, uploadedById: true },
    });
    if (!document) throw new Error("Datei wurde nicht gefunden.");
    const access = await requireBoardAccess(document.departmentId);
    if (!access.canManage && document.uploadedById !== access.userId) {
      throw new Error("Nur wer die Datei hochgeladen hat oder die Leitung kann sie löschen.");
    }
    await prisma.departmentDocument.delete({ where: { id: document.id } });
    revalidatePath("/mitglieder/meine-gewerke", "layout");
    return actionSuccess();
  } catch (error) {
    return actionFailure(error, "Datei konnte nicht gelöscht werden.");
  }
}
