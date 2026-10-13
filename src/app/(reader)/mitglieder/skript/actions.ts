"use server";

import { z } from "zod";

import { hasPermission } from "@/lib/permissions";
import {
  actionFailure,
  actionSuccess,
  type ProductionActionResult,
} from "@/lib/produktionen/actions-helpers";
import { requireAuth } from "@/lib/rbac";
import {
  ANNOTATION_COLORS,
  ScriptAnnotationError,
  anchorAnnotation,
  createAnnotation,
  deleteAnnotation,
  scriptVersionScope,
  updateAnnotation,
  type AnnotationInput,
} from "@/lib/skript/annotations";
import { SCRIPT_MANAGE_PERMISSION, SCRIPT_READ_PERMISSION } from "@/lib/skript/service";

/**
 * Markierungen und Notizen im Skript-Leser (docs/Plan/skript-plan.md, Phase 8). Wer eine Fassung
 * lesen darf, darf darin eigene Notizen anlegen; ändern und löschen nur der Urheber.
 */
async function requireReader(versionId: string) {
  const session = await requireAuth();
  const userId = session.user?.id;
  const version = await scriptVersionScope(versionId);
  if (!userId || !version) throw new ScriptAnnotationError("Fassung nicht gefunden.");
  const scope = { showId: version.showId };
  const [canRead, canManage] = await Promise.all([
    hasPermission(session.user, SCRIPT_READ_PERMISSION, scope),
    hasPermission(session.user, SCRIPT_MANAGE_PERMISSION, scope),
  ]);
  if (!canManage && (!canRead || version.status !== "released")) {
    throw new ScriptAnnotationError("Keine Berechtigung.");
  }
  return userId;
}

async function run(
  task: () => Promise<unknown>,
  message?: string,
): Promise<ProductionActionResult> {
  try {
    await task();
    return actionSuccess(message);
  } catch (error) {
    if (error instanceof ScriptAnnotationError) return actionFailure(error, error.message);
    if (error instanceof z.ZodError) {
      return { ok: false, error: error.issues[0]?.message ?? "Ungültige Eingabe." };
    }
    console.error("[skript] Notiz-Aktion fehlgeschlagen", error);
    return { ok: false, error: "Das hat nicht geklappt." };
  }
}

export async function createAnnotationAction(input: AnnotationInput) {
  return run(async () => createAnnotation(await requireReader(input.versionId), input));
}

const updateSchema = z.object({
  body: z.string().max(4000).nullable().optional(),
  color: z.enum(ANNOTATION_COLORS).nullable().optional(),
});

export async function updateAnnotationAction(
  versionId: string,
  annotationId: string,
  patch: z.input<typeof updateSchema>,
) {
  return run(async () =>
    updateAnnotation(annotationId, await requireReader(versionId), updateSchema.parse(patch)),
  );
}

export async function anchorAnnotationAction(
  versionId: string,
  annotationId: string,
  blockId: string,
) {
  return run(async () =>
    anchorAnnotation(annotationId, await requireReader(versionId), versionId, blockId),
  );
}

export async function deleteAnnotationAction(versionId: string, annotationId: string) {
  return run(async () => deleteAnnotation(annotationId, await requireReader(versionId)));
}
