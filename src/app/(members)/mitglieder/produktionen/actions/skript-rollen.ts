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
import {
  ScriptRoleAdminError,
  mergeScriptRoles,
  renameScriptRole,
  resetScriptRoleLinks,
  setScriptGroupRules,
  setScriptRoleKind,
  setScriptRoleLinks,
  undoScriptRoleMerge,
} from "@/lib/skript/role-admin";
import { SCRIPT_MANAGE_PERMISSION } from "@/lib/skript/service";

/** Reiter „Rollen“ im Skript (docs/Plan/skript-uebernahme-plan.md). */

const PATH = "/mitglieder/produktionen/stueck";
const id = z.string().min(1).max(64);

async function requireManager(showId: string) {
  const session = await requireAuth();
  const userId = session.user?.id;
  if (!userId) throw new ScriptRoleAdminError("Nicht angemeldet.");
  if (!(await hasPermission(session.user, SCRIPT_MANAGE_PERMISSION, { showId }))) {
    throw new ScriptRoleAdminError("Keine Berechtigung.");
  }
  return userId;
}

async function run(
  showId: string,
  fallback: string,
  task: (userId: string) => Promise<unknown>,
  message?: string,
): Promise<ProductionActionResult> {
  try {
    const userId = await requireManager(id.parse(showId));
    await task(userId);
    revalidatePath(PATH);
    revalidatePath("/mitglieder/skript", "layout");
    revalidatePath("/mitglieder/lernen", "layout");
    return actionSuccess(message);
  } catch (error) {
    return actionFailure(error, fallback);
  }
}

const roleSchema = z.object({
  name: z.string().trim().min(1).max(80),
  kind: z.enum(["person", "group", "ignore"]),
  groupMode: z.enum(["cast", "present", "fixed"]).nullable(),
  /** `null` = Namensgleichheit (nicht verknüpft). */
  characterIds: z.array(id).max(50).nullable(),
});

export async function saveScriptRoleAction(
  showId: string,
  roleId: string,
  input: unknown,
): Promise<ProductionActionResult> {
  return run(
    showId,
    "Rolle konnte nicht gespeichert werden.",
    async (userId) => {
      const data = roleSchema.parse(input);
      const role = id.parse(roleId);
      await renameScriptRole(showId, role, data.name);
      await setScriptRoleKind(showId, role, data.kind, data.groupMode);
      if (data.characterIds) await setScriptRoleLinks(showId, role, data.characterIds, userId);
      else await resetScriptRoleLinks(showId, role);
    },
    "Rolle gespeichert",
  );
}

export async function mergeScriptRolesAction(
  showId: string,
  sourceId: string,
  targetId: string,
): Promise<ProductionActionResult> {
  return run(
    showId,
    "Rollen konnten nicht zusammengeführt werden.",
    (userId) => mergeScriptRoles(showId, id.parse(sourceId), id.parse(targetId), userId),
    "Zusammengeführt",
  );
}

export async function undoScriptRoleMergeAction(
  showId: string,
  mergeId: string,
): Promise<ProductionActionResult> {
  return run(
    showId,
    "Zusammenführung konnte nicht zurückgenommen werden.",
    () => undoScriptRoleMerge(showId, id.parse(mergeId)),
    "Zurückgenommen",
  );
}

const rulesSchema = z.object({
  groupRoleId: id,
  sceneKey: z.string().max(64).nullable(),
  lineageId: z.string().max(64).nullable(),
  include: z.array(id).max(200),
  exclude: z.array(id).max(200),
});

export async function saveScriptGroupRulesAction(
  showId: string,
  input: unknown,
): Promise<ProductionActionResult> {
  return run(
    showId,
    "Gruppe konnte nicht gespeichert werden.",
    (userId) => setScriptGroupRules({ showId, userId, ...rulesSchema.parse(input) }),
    "Gruppe gespeichert",
  );
}
