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
  rereadCreditsFromSource,
  resolveUncertainCue,
  saveRoleAssignments,
  saveShowCredits,
} from "@/lib/skript/review";
import { scriptCreditsSchema } from "@/lib/skript/credits";
import {
  SCRIPT_MANAGE_PERMISSION,
  deletePendingImport,
  retryPendingImport,
} from "@/lib/skript/service";

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
  return { userId, showId: version.showId };
}

const assignmentSchema = z.array(
  z.union([
    z.object({
      name: z.string().min(1).max(80),
      roleId: z.string().min(1),
      mergeRoleIds: z.array(z.string().min(1).max(64)).max(20).optional(),
      renameTo: z.string().trim().min(1).max(80).optional(),
    }),
    z.object({
      name: z.string().min(1).max(80),
      createName: z.string().trim().min(1).max(80),
      inheritFromRoleId: z.string().min(1).max(64).optional(),
    }),
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

/** Mitwirkende (Autor, Fassung, Regie …) der Produktion fürs Deckblatt speichern. */
export async function saveScriptCreditsAction(
  versionId: string,
  credits: unknown,
): Promise<ProductionActionResult> {
  try {
    const { showId } = await requireScriptManager(versionId);
    await saveShowCredits(showId, scriptCreditsSchema.parse(credits));
    revalidatePath(PATH);
    return actionSuccess("Mitwirkende gespeichert");
  } catch (error) {
    return actionFailure(error, "Mitwirkende konnten nicht gespeichert werden.");
  }
}

/** Mitwirkende aus dem gespeicherten Original-PDF nachlesen. */
export async function rereadScriptCreditsAction(
  versionId: string,
): Promise<ProductionActionResult> {
  try {
    await requireScriptManager(versionId);
    const credits = await rereadCreditsFromSource(versionId);
    revalidatePath(PATH);
    return actionSuccess(
      credits.length
        ? `${credits.reduce((sum, c) => sum + c.names.length, 0)} Namen im PDF gefunden`
        : "Im Vorspann wurden keine Namen gefunden",
    );
  } catch (error) {
    return actionFailure(error, "Das Original-PDF konnte nicht gelesen werden.");
  }
}

async function requirePendingManager(pendingId: string) {
  const session = await requireAuth();
  const userId = session.user?.id;
  const pending = await prisma.scriptPendingImport.findUnique({
    where: { id: pendingId },
    select: { showId: true },
  });
  if (!userId || !pending) throw new ScriptReviewError("Upload nicht gefunden.");
  if (!(await hasPermission(session.user, SCRIPT_MANAGE_PERMISSION, { showId: pending.showId }))) {
    throw new ScriptReviewError("Keine Berechtigung.");
  }
  return { userId };
}

/** Aufgehobenes PDF nach einer Parser-Anpassung erneut einlesen. */
export async function retryPendingScriptAction(
  pendingId: string,
): Promise<ProductionActionResult & { id?: string }> {
  try {
    const { userId } = await requirePendingManager(pendingId);
    const { id } = await retryPendingImport(pendingId, userId);
    revalidatePath(PATH);
    return { ...actionSuccess("Endlich lesbar – Entwurf angelegt"), id };
  } catch (error) {
    return actionFailure(error, "Das PDF konnte nicht erneut eingelesen werden.");
  }
}

/** Aufgehobenes PDF verwerfen. */
export async function deletePendingScriptAction(
  pendingId: string,
): Promise<ProductionActionResult> {
  try {
    await requirePendingManager(pendingId);
    await deletePendingImport(pendingId);
    revalidatePath(PATH);
    return actionSuccess("Upload verworfen");
  } catch (error) {
    return actionFailure(error, "Upload konnte nicht verworfen werden.");
  }
}
