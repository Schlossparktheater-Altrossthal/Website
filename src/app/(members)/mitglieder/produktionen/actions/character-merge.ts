"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { mergeCharacters, previewCharacterMerge } from "@/lib/produktionen/character-merge";
import {
  actionFailure,
  actionSuccess,
  requireProductionManager,
  type ProductionActionResult,
} from "@/lib/produktionen/actions-helpers";

/** Rollen im Stück zusammenführen (docs/Plan/skript-uebernahme-plan.md, Phase 6). */

const id = z.string().min(1).max(64);

export async function previewCharacterMergeAction(sourceId: string, targetId: string) {
  try {
    await requireProductionManager();
    return {
      ok: true as const,
      preview: await previewCharacterMerge(id.parse(sourceId), id.parse(targetId)),
    };
  } catch (error) {
    return actionFailure(error, "Vorschau nicht möglich.");
  }
}

export async function mergeCharactersAction(
  sourceId: string,
  targetId: string,
): Promise<ProductionActionResult> {
  try {
    await requireProductionManager();
    const { sourceName, targetName } = await mergeCharacters(
      id.parse(sourceId),
      id.parse(targetId),
    );
    revalidatePath("/mitglieder/produktionen/stueck");
    revalidatePath("/mitglieder/produktionen/zuweisung");
    revalidatePath("/mitglieder/meine-gewerke", "layout");
    return actionSuccess(`„${sourceName}“ ist jetzt Teil von „${targetName}“`);
  } catch (error) {
    return actionFailure(error, "Rollen konnten nicht zusammengeführt werden.");
  }
}
