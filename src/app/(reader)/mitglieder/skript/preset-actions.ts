"use server";

import { z } from "zod";

import { hasPermission } from "@/lib/permissions";
import {
  actionFailure,
  actionSuccess,
  type ProductionActionResult,
} from "@/lib/produktionen/actions-helpers";
import { requireAuth } from "@/lib/rbac";
import { scriptVersionScope } from "@/lib/skript/annotations";
import { scriptExportConfigSchema } from "@/lib/skript/export-options";
import {
  PRESET_NAME_MAX,
  ScriptPresetError,
  createScriptPreset,
  deleteScriptPreset,
} from "@/lib/skript/presets";
import { SCRIPT_MANAGE_PERMISSION, SCRIPT_READ_PERMISSION } from "@/lib/skript/service";

/**
 * Eigene PDF-Vorlagen im Leser: wer die Fassung lesen darf, speichert eigene; Vorlagen für alle
 * im Stück nur mit Skript-Verwaltung (docs/Plan/skript-auswertungen-plan.md, Phase 4).
 */

const saveSchema = z.object({
  versionId: z.string().min(1),
  name: z.string().trim().min(1).max(PRESET_NAME_MAX),
  shared: z.boolean(),
  config: scriptExportConfigSchema,
});

export async function saveScriptPresetAction(input: unknown): Promise<ProductionActionResult> {
  try {
    const session = await requireAuth();
    const userId = session.user?.id;
    const { versionId, name, shared, config } = saveSchema.parse(input);
    const version = await scriptVersionScope(versionId);
    if (!userId || !version) throw new ScriptPresetError("Fassung nicht gefunden.");
    const scope = { showId: version.showId };
    const [canRead, canManage] = await Promise.all([
      hasPermission(session.user, SCRIPT_READ_PERMISSION, scope),
      hasPermission(session.user, SCRIPT_MANAGE_PERMISSION, scope),
    ]);
    if (!canRead && !canManage) throw new ScriptPresetError("Keine Berechtigung.");
    if (shared && !canManage) {
      throw new ScriptPresetError("Vorlagen für alle darf nur die Skript-Verwaltung anlegen.");
    }
    await createScriptPreset({ showId: version.showId, ownerId: userId, name, shared, config });
    return actionSuccess(shared ? "Vorlage für alle gespeichert" : "Vorlage gespeichert");
  } catch (error) {
    return actionFailure(error, "Vorlage konnte nicht gespeichert werden.");
  }
}

export async function deleteScriptPresetAction(id: string): Promise<ProductionActionResult> {
  try {
    const session = await requireAuth();
    const userId = session.user?.id;
    if (!userId) throw new ScriptPresetError("Nicht angemeldet.");
    await deleteScriptPreset(z.string().min(1).parse(id), userId, (showId) =>
      hasPermission(session.user, SCRIPT_MANAGE_PERMISSION, { showId }),
    );
    return actionSuccess("Vorlage gelöscht");
  } catch (error) {
    return actionFailure(error, "Vorlage konnte nicht gelöscht werden.");
  }
}
