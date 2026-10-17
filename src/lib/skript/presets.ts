import { prisma } from "@/lib/prisma";

import {
  scriptExportConfigSchema,
  type ScriptExportConfig,
  type ScriptExportPresetItem,
} from "./export-options";

/** Eigene PDF-Vorlagen (docs/Plan/skript-auswertungen-plan.md, Phase 4). */

export class ScriptPresetError extends Error {}

export const PRESET_NAME_MAX = 40;
const PRESETS_PER_PERSON = 20;

/** Vorlagen fürs Stück und die eigenen, Stück-Vorlagen zuerst. */
export async function listScriptPresets(
  showId: string,
  userId: string | null,
  canManage: boolean,
): Promise<ScriptExportPresetItem[]> {
  const rows = await prisma.scriptExportPreset.findMany({
    where: { showId, OR: [{ shared: true }, ...(userId ? [{ ownerId: userId }] : [])] },
    orderBy: [{ shared: "desc" }, { name: "asc" }],
    select: { id: true, name: true, shared: true, ownerId: true, config: true },
  });
  return rows.flatMap((row) => {
    const config = scriptExportConfigSchema.safeParse(row.config);
    if (!config.success) return [];
    return [
      {
        id: row.id,
        name: row.name,
        shared: row.shared,
        deletable: row.ownerId === userId || (row.shared && canManage),
        config: config.data,
      },
    ];
  });
}

export async function createScriptPreset(input: {
  showId: string;
  ownerId: string;
  name: string;
  shared: boolean;
  config: ScriptExportConfig;
}) {
  const count = await prisma.scriptExportPreset.count({
    where: { showId: input.showId, ownerId: input.ownerId },
  });
  if (count >= PRESETS_PER_PERSON) {
    throw new ScriptPresetError(`Höchstens ${PRESETS_PER_PERSON} Vorlagen pro Person.`);
  }
  return prisma.scriptExportPreset.create({
    data: { ...input, name: input.name.trim().slice(0, PRESET_NAME_MAX) },
    select: { id: true },
  });
}

export async function deleteScriptPreset(
  id: string,
  userId: string,
  canManageShow: (showId: string) => Promise<boolean>,
) {
  const preset = await prisma.scriptExportPreset.findUnique({
    where: { id },
    select: { showId: true, ownerId: true, shared: true },
  });
  if (!preset) throw new ScriptPresetError("Vorlage nicht gefunden.");
  const allowed =
    preset.ownerId === userId || (preset.shared && (await canManageShow(preset.showId)));
  if (!allowed) throw new ScriptPresetError("Keine Berechtigung.");
  await prisma.scriptExportPreset.delete({ where: { id } });
}
