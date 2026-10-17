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
import { SCRIPT_MANAGE_PERMISSION } from "@/lib/skript/service";

/**
 * Gemessene Szenendauer eintragen (docs/Plan/skript-auswertungen-plan.md, E3) – nur
 * Skript-Verwaltung. `null` löscht die Messung, dann gilt wieder die Schätzung.
 */
const inputSchema = z.object({
  sceneId: z.string().min(1),
  seconds: z
    .number()
    .int()
    .min(1)
    .max(4 * 3600)
    .nullable(),
});

export async function saveSceneDurationAction(input: unknown): Promise<ProductionActionResult> {
  try {
    const session = await requireAuth();
    const userId = session.user?.id;
    const { sceneId, seconds } = inputSchema.parse(input);
    const scene = await prisma.scriptScene.findUnique({
      where: { id: sceneId },
      select: { versionId: true, version: { select: { showId: true } } },
    });
    if (!userId || !scene) throw new Error("Szene nicht gefunden.");
    const allowed = await hasPermission(session.user, SCRIPT_MANAGE_PERMISSION, {
      showId: scene.version.showId,
    });
    if (!allowed) throw new Error("Keine Berechtigung.");
    await prisma.scriptScene.update({
      where: { id: sceneId },
      data: {
        measuredSeconds: seconds,
        measuredAt: seconds == null ? null : new Date(),
        measuredById: seconds == null ? null : userId,
      },
    });
    revalidatePath(`/mitglieder/skript/${scene.versionId}`, "layout");
    return actionSuccess(seconds == null ? "Messung entfernt" : "Dauer gespeichert");
  } catch (error) {
    return actionFailure(error, "Dauer konnte nicht gespeichert werden.");
  }
}
