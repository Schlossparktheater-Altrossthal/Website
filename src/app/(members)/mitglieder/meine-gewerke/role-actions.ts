"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import {
  actionFailure,
  actionSuccess,
  type ProductionActionResult,
} from "@/lib/produktionen/actions-helpers";
import { requireAuth } from "@/lib/rbac";

const notesSchema = z.object({
  characterId: z.string(),
  notes: z.string().trim().max(4000),
});

/** Gemeinsame Rollennotizen: pflegen Besetzung und Regie/Board. */
export async function updateRoleNotesAction(
  input: z.input<typeof notesSchema>,
): Promise<ProductionActionResult> {
  try {
    const data = notesSchema.parse(input);
    const session = await requireAuth();
    const userId = session.user?.id;
    if (!userId) throw new Error("Nicht angemeldet.");
    const [cast, isManager] = await Promise.all([
      prisma.characterCasting.count({ where: { characterId: data.characterId, userId } }),
      hasPermission(session.user, "PRIVATE.PRODUCTION.SHOW.MANAGE"),
    ]);
    if (!cast && !isManager) throw new Error("Notizen pflegen Besetzung und Regie.");
    await prisma.character.update({
      where: { id: data.characterId },
      data: { notes: data.notes || null },
    });
    revalidatePath(`/mitglieder/meine-gewerke/rolle/${data.characterId}`);
    return actionSuccess();
  } catch (error) {
    return actionFailure(error, "Notizen konnten nicht gespeichert werden.");
  }
}
