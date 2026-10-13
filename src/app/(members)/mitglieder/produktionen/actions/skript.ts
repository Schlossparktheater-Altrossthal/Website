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
import {
  ScriptReviewError,
  deleteScriptDraft,
  releaseScriptVersion,
  resolveUncertainCue,
  saveRoleAssignments,
} from "@/lib/skript/review";
import { SCRIPT_MANAGE_PERMISSION } from "@/lib/skript/service";

const PATH = "/mitglieder/produktionen/stueck";

async function requireScriptManager(versionId: string) {
  const session = await requireAuth();
  const userId = session.user?.id;
  const version = await prisma.scriptVersion.findUnique({
    where: { id: versionId },
    select: { showId: true },
  });
  if (!userId || !version) throw new ScriptReviewError("Fassung nicht gefunden.");
  if (!(await hasPermission(session.user, SCRIPT_MANAGE_PERMISSION, { showId: version.showId }))) {
    throw new ScriptReviewError("Keine Berechtigung.");
  }
  return { userId };
}

const assignmentSchema = z.array(
  z.union([
    z.object({ name: z.string().min(1).max(80), roleId: z.string().min(1) }),
    z.object({ name: z.string().min(1).max(80), createName: z.string().trim().min(1).max(80) }),
  ]),
);

export async function saveScriptRolesAction(
  versionId: string,
  assignments: unknown,
): Promise<ProductionActionResult> {
  try {
    const { userId } = await requireScriptManager(versionId);
    await saveRoleAssignments(versionId, userId, assignmentSchema.parse(assignments));
    revalidatePath(PATH);
    return actionSuccess("Rollen gespeichert");
  } catch (error) {
    return actionFailure(error, "Rollen konnten nicht gespeichert werden.");
  }
}

export async function resolveScriptCueAction(
  versionId: string,
  blockId: string,
  partIndex: number,
  as: "cue" | "text" | "direction",
): Promise<ProductionActionResult> {
  try {
    await requireScriptManager(versionId);
    await resolveUncertainCue(
      versionId,
      blockId,
      z.number().int().min(0).parse(partIndex),
      z.enum(["cue", "text", "direction"]).parse(as),
    );
    revalidatePath(PATH);
    return actionSuccess();
  } catch (error) {
    return actionFailure(error, "Hinweis konnte nicht gespeichert werden.");
  }
}

export async function releaseScriptAction(versionId: string): Promise<ProductionActionResult> {
  try {
    const { userId } = await requireScriptManager(versionId);
    const { inherited } = await releaseScriptVersion(versionId, userId);
    revalidatePath(PATH);
    return actionSuccess(
      inherited ? `Freigegeben – ${inherited} Absätze mit der Vorfassung verknüpft` : "Freigegeben",
    );
  } catch (error) {
    return actionFailure(error, "Fassung konnte nicht freigegeben werden.");
  }
}

export async function deleteScriptDraftAction(versionId: string): Promise<ProductionActionResult> {
  try {
    await requireScriptManager(versionId);
    await deleteScriptDraft(versionId);
    revalidatePath(PATH);
    return actionSuccess("Entwurf verworfen");
  } catch (error) {
    return actionFailure(error, "Entwurf konnte nicht verworfen werden.");
  }
}
