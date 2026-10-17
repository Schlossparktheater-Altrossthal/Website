"use server";

import { z } from "zod";

import { hasPermission } from "@/lib/permissions";
import { requireAuth } from "@/lib/rbac";
import { saveReaderState } from "@/lib/skript/reader-state";
import { SCRIPT_MANAGE_PERMISSION, SCRIPT_READ_PERMISSION } from "@/lib/skript/service";

/** Persönlichen Leser-Stand speichern (docs/Plan/skript-ansicht-plan.md, Phase 5). */
export async function saveReaderStateAction(
  showId: string,
  state: unknown,
): Promise<{ ok: boolean }> {
  try {
    const session = await requireAuth();
    const userId = session.user?.id;
    if (!userId) return { ok: false };
    const scope = { showId: z.string().min(1).parse(showId) };
    const [canRead, canManage] = await Promise.all([
      hasPermission(session.user, SCRIPT_READ_PERMISSION, scope),
      hasPermission(session.user, SCRIPT_MANAGE_PERMISSION, scope),
    ]);
    if (!canRead && !canManage) return { ok: false };
    await saveReaderState(userId, scope.showId, state);
    return { ok: true };
  } catch (error) {
    console.warn("[skript] Leser-Stand nicht gespeichert", error);
    return { ok: false };
  }
}
