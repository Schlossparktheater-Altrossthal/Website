"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { hasPermission } from "@/lib/permissions";
import {
  actionFailure,
  actionSuccess,
  type ProductionActionResult,
} from "@/lib/produktionen/actions-helpers";
import { requireAuth } from "@/lib/rbac";
import { SCRIPT_MANAGE_PERMISSION } from "@/lib/skript/service";
import {
  TakeoverError,
  applyAppearanceTakeover,
  applyRoleTakeover,
  applySceneTakeover,
} from "@/lib/skript/takeover";

/** Übernahme-Assistent „Ins Stück übernehmen“ (docs/Plan/skript-uebernahme-plan.md, Phase 7). */

const id = z.string().min(1).max(64);

/** Schreibt ins Stück → braucht Skript- und Stück-Verwaltung. */
async function requireManager(showId: string) {
  const session = await requireAuth();
  const userId = session.user?.id;
  if (!userId) throw new TakeoverError("Nicht angemeldet.");
  const [script, show] = await Promise.all([
    hasPermission(session.user, SCRIPT_MANAGE_PERMISSION, { showId }),
    hasPermission(session.user, "PRIVATE.PRODUCTION.SHOW.MANAGE"),
  ]);
  if (!script || !show) throw new TakeoverError("Keine Berechtigung.");
  return userId;
}

function revalidate() {
  revalidatePath("/mitglieder/produktionen/stueck");
  revalidatePath("/mitglieder/produktionen/zuweisung");
  revalidatePath("/mitglieder/skript", "layout");
}

const scenesSchema = z
  .array(
    z.object({
      sceneKey: z.string().min(1).max(64),
      target: z.string().min(1).max(64),
      fields: z.array(z.enum(["title", "durationMinutes"])).max(2),
    }),
  )
  .max(300);

export async function applySceneTakeoverAction(
  showId: string,
  items: unknown,
): Promise<ProductionActionResult> {
  try {
    const userId = await requireManager(id.parse(showId));
    const { created, updated } = await applySceneTakeover(
      showId,
      userId,
      scenesSchema.parse(items),
    );
    revalidate();
    return actionSuccess(`Szenen übernommen – ${created} neu, ${updated} geändert`);
  } catch (error) {
    return actionFailure(error, "Szenen konnten nicht übernommen werden.");
  }
}

const rolesSchema = z
  .array(z.object({ scriptRoleId: id, target: z.string().min(1).max(64) }))
  .max(300);

export async function applyRoleTakeoverAction(
  showId: string,
  items: unknown,
): Promise<ProductionActionResult> {
  try {
    const userId = await requireManager(id.parse(showId));
    const { created } = await applyRoleTakeover(showId, userId, rolesSchema.parse(items));
    revalidate();
    return actionSuccess(`Rollen zugeordnet${created ? ` – ${created} neu angelegt` : ""}`);
  } catch (error) {
    return actionFailure(error, "Rollen konnten nicht übernommen werden.");
  }
}

const change = z.object({ sceneId: id, characterId: id });
const appearanceSchema = z.object({
  add: z.array(change).max(5000),
  remove: z.array(change).max(5000),
  includeMembers: z.boolean(),
});

export async function applyAppearanceTakeoverAction(
  showId: string,
  input: unknown,
): Promise<ProductionActionResult> {
  try {
    await requireManager(id.parse(showId));
    const { added, removed } = await applyAppearanceTakeover(showId, appearanceSchema.parse(input));
    revalidate();
    return actionSuccess(`Auftritte: ${added} neu, ${removed} entfernt`);
  } catch (error) {
    return actionFailure(error, "Auftritte konnten nicht übernommen werden.");
  }
}
