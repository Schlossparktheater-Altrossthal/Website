"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";
import {
  ScriptEditError,
  deleteBlock,
  editBlock,
  insertBlockAfter,
  startEditing,
  type BlockEdit,
} from "@/lib/skript/edit";
import { SCRIPT_MANAGE_PERMISSION } from "@/lib/skript/service";

/** Bearbeiten im Leser (docs/Plan/skript-plan.md, Phase 10) – nur mit `SCRIPT.MANAGE`. */

export type EditResult<T = undefined> = { ok: true; value: T } | { ok: false; error: string };

async function requireManager(versionId: string) {
  const session = await requireAuth();
  const userId = session.user?.id;
  const version = await prisma.scriptVersion.findUnique({
    where: { id: versionId },
    select: { showId: true },
  });
  if (!userId || !version) throw new ScriptEditError("Fassung nicht gefunden.");
  if (!(await hasPermission(session.user, SCRIPT_MANAGE_PERMISSION, { showId: version.showId }))) {
    throw new ScriptEditError("Keine Berechtigung.");
  }
  return userId;
}

async function run<T>(
  versionId: string,
  task: (userId: string) => Promise<T>,
): Promise<EditResult<T>> {
  try {
    const value = await task(await requireManager(versionId));
    revalidatePath(`/mitglieder/skript/${versionId}`);
    return { ok: true, value };
  } catch (error) {
    if (error instanceof ScriptEditError) return { ok: false, error: error.message };
    if (error instanceof z.ZodError) {
      return { ok: false, error: error.issues[0]?.message ?? "Ungültige Eingabe." };
    }
    console.error("[skript] Bearbeiten fehlgeschlagen", error);
    return { ok: false, error: "Das hat nicht geklappt." };
  }
}

/**
 * Fassung zum Bearbeiten (bei freigegebenen eine Kopie als Entwurf) und darin den Absatz mit
 * gleicher `lineageId` – so bleibt die Stelle auch nach dem Kopieren dieselbe.
 */
async function target(versionId: string, lineageId: string, userId: string) {
  const { id } = await startEditing(versionId, userId);
  const block = await prisma.scriptBlock.findFirst({
    where: { versionId: id, lineageId },
    select: { id: true },
  });
  if (!block) throw new ScriptEditError("Absatz nicht gefunden.");
  if (id !== versionId) revalidatePath("/mitglieder/produktionen/stueck");
  return { versionId: id, blockId: block.id };
}

/** Absatz ändern; gibt die Fassung zurück, in der geändert wurde. */
export async function saveBlockAction(versionId: string, lineageId: string, edit: BlockEdit) {
  return run(versionId, async (userId) => {
    const at = await target(versionId, lineageId, userId);
    await editBlock(at.versionId, at.blockId, userId, edit);
    return { versionId: at.versionId };
  });
}

export async function insertBlockAction(
  versionId: string,
  afterLineageId: string,
  edit: BlockEdit,
) {
  return run(versionId, async (userId) => {
    const at = await target(versionId, afterLineageId, userId);
    await insertBlockAfter(at.versionId, at.blockId, userId, edit);
    return { versionId: at.versionId };
  });
}

export async function deleteBlockAction(versionId: string, lineageId: string) {
  return run(versionId, async (userId) => {
    const at = await target(versionId, lineageId, userId);
    await deleteBlock(at.versionId, at.blockId);
    return { versionId: at.versionId };
  });
}
