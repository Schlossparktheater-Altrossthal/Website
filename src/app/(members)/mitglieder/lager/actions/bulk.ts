"use server";

import { z } from "zod";

import {
  failure,
  revalidateInventory,
  type InventoryActionResult,
} from "@/lib/inventory/actions-helpers";
import { setAssetRetiredInTx } from "@/lib/inventory/asset-write";
import { CONDITION_LABELS, CONDITIONS, inventoryAssetPath } from "@/lib/inventory/constants";
import { placeAsset, recordEvent, requireInventoryAccess } from "@/lib/inventory/service";
import { ASSET_CODE_ORDER } from "@/lib/inventory/selects";
import { prisma } from "@/lib/prisma";

/** Bestand als Tabelle: Bearbeiten in der Zelle und Aktionen für mehrere Objekte. */

const MAX_SELECTION = 500;
const idsSchema = z.array(z.string().min(1)).min(1, "Nichts ausgewählt.").max(MAX_SELECTION);

export type BulkOutcome = { done: number; skipped: { code: string; reason: string }[] };

const FIELD_LABELS = {
  name: "Name",
  categoryId: "Kategorie",
  condition: "Zustand",
  manufacturer: "Hersteller",
  model: "Modell",
  serialNumber: "Seriennummer",
} as const;

export type InlineAssetField = keyof typeof FIELD_LABELS;

const fieldSchema = z.discriminatedUnion("field", [
  z.object({ field: z.literal("name"), value: z.string().trim().min(1, "Name fehlt.").max(160) }),
  z.object({ field: z.literal("condition"), value: z.enum(CONDITIONS) }),
  z.object({ field: z.literal("categoryId"), value: z.string().trim() }),
  ...(["manufacturer", "model", "serialNumber"] as const).map((field) =>
    z.object({ field: z.literal(field), value: z.string().trim().max(120) }),
  ),
]);

async function assertCategoryForAreas(categoryId: string, areaIds: string[]) {
  const category = await prisma.inventoryCategory.findUnique({
    where: { id: categoryId },
    select: { areaId: true },
  });
  if (!category || areaIds.some((areaId) => areaId !== category.areaId)) {
    throw new Error("Die Kategorie gehört nicht zum Bereich aller gewählten Objekte.");
  }
}

/** Ein Feld direkt in der Tabelle ändern. */
export async function updateAssetFieldAction(
  assetId: string,
  field: InlineAssetField,
  value: string,
): Promise<InventoryActionResult> {
  try {
    const { userId } = await requireInventoryAccess("use");
    const input = fieldSchema.parse({ field, value });
    const asset = await prisma.inventoryAsset.findUnique({
      where: { id: assetId },
      select: { code: true, areaId: true, status: true, productId: true },
    });
    if (!asset) throw new Error("Objekt nicht gefunden.");
    if (asset.status === "retired") throw new Error("Ausgemusterte Objekte sind nur zur Ansicht.");
    if (input.field === "categoryId" && input.value) {
      await assertCategoryForAreas(input.value, [asset.areaId]);
    }

    await prisma.$transaction(async (tx) => {
      // Name, Kategorie, Hersteller und Modell gehören zum Artikeltyp – gilt für alle Exemplare.
      switch (input.field) {
        case "name":
          await tx.inventoryProduct.update({
            where: { id: asset.productId },
            data: { name: input.value },
          });
          break;
        case "categoryId":
        case "manufacturer":
        case "model":
          await tx.inventoryProduct.update({
            where: { id: asset.productId },
            data: { [input.field]: input.value || null },
          });
          break;
        case "condition":
          await tx.inventoryAsset.update({
            where: { id: assetId },
            data: { condition: input.value },
          });
          break;
        case "serialNumber":
          await tx.inventoryAsset.update({
            where: { id: assetId },
            data: { serialNumber: input.value || null },
          });
          break;
      }
      await recordEvent(tx, {
        assetId,
        type: "updated",
        message: `${FIELD_LABELS[input.field]} geändert`,
        userId,
      });
    });
    revalidateInventory(inventoryAssetPath(asset.code));
    return { ok: true };
  } catch (error) {
    console.error("updateAssetFieldAction", error);
    return failure(error, "Änderung konnte nicht gespeichert werden.");
  }
}

const patchSchema = z
  .object({
    categoryId: z.string().trim().nullable().optional(),
    condition: z.enum(CONDITIONS).optional(),
  })
  .refine((patch) => patch.categoryId !== undefined || patch.condition, "Nichts zu ändern.");

/** Kategorie und/oder Zustand für mehrere Objekte setzen. */
export async function bulkUpdateAssetsAction(
  assetIds: string[],
  patch: { categoryId?: string | null; condition?: string },
): Promise<InventoryActionResult<BulkOutcome>> {
  try {
    const { userId } = await requireInventoryAccess("use");
    const ids = idsSchema.parse(assetIds);
    const input = patchSchema.parse(patch);
    const assets = await prisma.inventoryAsset.findMany({
      where: { id: { in: ids }, status: { not: "retired" } },
      select: { id: true, areaId: true, productId: true },
    });
    if (input.categoryId) {
      await assertCategoryForAreas(
        input.categoryId,
        assets.map((asset) => asset.areaId),
      );
    }
    const message = [
      input.categoryId !== undefined ? "Kategorie" : null,
      input.condition ? `Zustand „${CONDITION_LABELS[input.condition]}“` : null,
    ]
      .filter(Boolean)
      .join(" und ");
    await prisma.$transaction(async (tx) => {
      if (input.categoryId !== undefined) {
        // Die Kategorie gehört zum Artikeltyp.
        await tx.inventoryProduct.updateMany({
          where: { id: { in: [...new Set(assets.map((asset) => asset.productId))] } },
          data: { categoryId: input.categoryId || null },
        });
      }
      if (input.condition) {
        await tx.inventoryAsset.updateMany({
          where: { id: { in: assets.map((asset) => asset.id) } },
          data: { condition: input.condition },
        });
      }
      await tx.inventoryEvent.createMany({
        data: assets.map((asset) => ({
          assetId: asset.id,
          type: "updated",
          message: `${message} gesetzt (Sammelaktion)`,
          userId,
        })),
      });
    });
    revalidateInventory();
    const skipped = ids.length - assets.length;
    return {
      ok: true,
      message: `${assets.length} geändert${skipped ? `, ${skipped} ausgemustert übersprungen` : ""}.`,
      data: { done: assets.length, skipped: [] },
    };
  } catch (error) {
    console.error("bulkUpdateAssetsAction", error);
    return failure(error, "Änderung fehlgeschlagen.");
  }
}

const targetSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("location"), id: z.string().min(1) }),
  z.object({ type: z.literal("container"), id: z.string().min(1) }),
]);

/** Mehrere Objekte an einen Ort oder in eine Kiste legen. Mengenartikel laufen über den Bestand. */
export async function bulkMoveAssetsAction(
  assetIds: string[],
  target: { type: "location" | "container"; id: string },
): Promise<InventoryActionResult<BulkOutcome>> {
  try {
    const { userId } = await requireInventoryAccess("use");
    const ids = idsSchema.parse(assetIds);
    const parsedTarget = targetSchema.parse(target);
    const assets = await prisma.inventoryAsset.findMany({
      where: { id: { in: ids } },
      select: { id: true, code: true, kind: true, status: true },
      orderBy: [...ASSET_CODE_ORDER],
    });
    const outcome: BulkOutcome = { done: 0, skipped: [] };
    for (const asset of assets) {
      if (asset.kind === "bulk") {
        outcome.skipped.push({ code: asset.code, reason: "Mengenartikel – Bestand umlagern" });
        continue;
      }
      if (asset.status === "retired") {
        outcome.skipped.push({ code: asset.code, reason: "ausgemustert" });
        continue;
      }
      try {
        await prisma.$transaction((tx) =>
          placeAsset(tx, { assetId: asset.id, target: parsedTarget, userId }),
        );
        outcome.done += 1;
      } catch (error) {
        outcome.skipped.push({
          code: asset.code,
          reason: error instanceof Error ? error.message : "Fehler",
        });
      }
    }
    revalidateInventory();
    return {
      ok: true,
      message: `${outcome.done} umgelagert${outcome.skipped.length ? `, ${outcome.skipped.length} übersprungen` : ""}.`,
      data: outcome,
    };
  } catch (error) {
    console.error("bulkMoveAssetsAction", error);
    return failure(error, "Umlagern fehlgeschlagen.");
  }
}

/** Mehrere Objekte ausmustern (nur Verwaltung). */
export async function bulkRetireAssetsAction(
  assetIds: string[],
  reason?: string,
): Promise<InventoryActionResult<BulkOutcome>> {
  try {
    const { userId } = await requireInventoryAccess("manage");
    const ids = idsSchema.parse(assetIds);
    const note = z.string().trim().max(300).optional().parse(reason);
    const assets = await prisma.inventoryAsset.findMany({
      where: { id: { in: ids }, status: { not: "retired" } },
      select: { id: true },
    });
    for (const asset of assets) {
      await prisma.$transaction((tx) =>
        setAssetRetiredInTx(tx, asset.id, true, { note: note || undefined, userId }),
      );
    }
    revalidateInventory();
    return {
      ok: true,
      message: `${assets.length} ausgemustert.`,
      data: { done: assets.length, skipped: [] },
    };
  } catch (error) {
    console.error("bulkRetireAssetsAction", error);
    return failure(error, "Ausmustern fehlgeschlagen.");
  }
}
