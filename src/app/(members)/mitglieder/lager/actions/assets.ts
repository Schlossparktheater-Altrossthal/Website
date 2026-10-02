"use server";

import { z } from "zod";

import {
  failure,
  readJsonField,
  readPhotoFile,
  revalidateInventory,
  type InventoryActionResult,
} from "@/lib/inventory/actions-helpers";
import {
  assertCategory,
  assetSchema,
  cleanAttributes,
  costData,
  createAssetInTx,
  setAssetRetiredInTx,
} from "@/lib/inventory/asset-write";
import {
  addMonths,
  DEFAULT_INSPECTION_INTERVAL_MONTHS,
  inventoryAssetPath,
  MAX_BULK_ROWS,
} from "@/lib/inventory/constants";
import { recordEvent, requireInventoryAccess } from "@/lib/inventory/service";
import { prisma } from "@/lib/prisma";

export async function createAssetAction(
  formData: FormData,
): Promise<InventoryActionResult<{ code: string }>> {
  try {
    const { access, userId } = await requireInventoryAccess("use");
    const input = readJsonField(formData, "asset", assetSchema);
    const photo = await readPhotoFile(formData);
    await assertCategory(input.areaId, input.categoryId);

    const { code } = await prisma.$transaction((tx) =>
      createAssetInTx(tx, input, { userId, canManage: access.canManage, photo }),
    );

    revalidateInventory();
    return { ok: true, message: `${code} angelegt.`, data: { code } };
  } catch (error) {
    console.error("createAssetAction", error);
    return failure(error, "Objekt konnte nicht angelegt werden.");
  }
}

export type BulkCreateRowResult =
  { index: number; ok: true; code: string } | { index: number; ok: false; error: string };

/**
 * Sammelerfassung: legt Zeile für Zeile an, jede in eigener Transaktion – eine fehlerhafte
 * Zeile hält die übrigen nicht auf. `index` verweist auf die Position in `rows`.
 */
export async function bulkCreateAssetsAction(
  rows: unknown[],
): Promise<InventoryActionResult<{ results: BulkCreateRowResult[] }>> {
  try {
    const { access, userId } = await requireInventoryAccess("use");
    if (!Array.isArray(rows) || rows.length === 0) throw new Error("Keine Zeilen zum Anlegen.");
    if (rows.length > MAX_BULK_ROWS) {
      throw new Error(`Höchstens ${MAX_BULK_ROWS} Zeilen auf einmal.`);
    }

    const validCategories = new Map<string, string>();
    const categoryIds = [
      ...new Set(
        rows
          .map((row) => (row as { categoryId?: unknown })?.categoryId)
          .filter((id): id is string => typeof id === "string" && id !== ""),
      ),
    ];
    if (categoryIds.length) {
      const categories = await prisma.inventoryCategory.findMany({
        where: { id: { in: categoryIds } },
        select: { id: true, areaId: true },
      });
      for (const category of categories) validCategories.set(category.id, category.areaId);
    }

    const results: BulkCreateRowResult[] = [];
    for (const [index, row] of rows.entries()) {
      const parsed = assetSchema.safeParse(row);
      if (!parsed.success) {
        results.push({ index, ok: false, error: failure(parsed.error, "Ungültige Zeile.").error });
        continue;
      }
      const input = parsed.data;
      if (input.categoryId && validCategories.get(input.categoryId) !== input.areaId) {
        results.push({ index, ok: false, error: "Die Kategorie gehört nicht zu diesem Bereich." });
        continue;
      }
      try {
        const { code } = await prisma.$transaction((tx) =>
          createAssetInTx(tx, input, {
            userId,
            canManage: access.canManage,
            eventMessage: "Erfasst (Sammelerfassung)",
          }),
        );
        results.push({ index, ok: true, code });
      } catch (error) {
        console.error("bulkCreateAssetsAction row", index, error);
        results.push({ index, ...failure(error, "Zeile konnte nicht angelegt werden.") });
      }
    }

    revalidateInventory();
    const created = results.filter((result) => result.ok).length;
    return {
      ok: true,
      message:
        created === results.length
          ? `${created} ${created === 1 ? "Objekt" : "Objekte"} angelegt.`
          : `${created} von ${results.length} angelegt.`,
      data: { results },
    };
  } catch (error) {
    console.error("bulkCreateAssetsAction", error);
    return failure(error, "Objekte konnten nicht angelegt werden.");
  }
}

const updateSchema = assetSchema.omit({ placement: true, quantity: true, kind: true });

export async function updateAssetAction(
  assetId: string,
  formData: FormData,
): Promise<InventoryActionResult> {
  try {
    const { access, userId } = await requireInventoryAccess("use");
    const input = readJsonField(formData, "asset", updateSchema);
    const existing = await prisma.inventoryAsset.findUnique({
      where: { id: assetId },
      select: {
        code: true,
        kind: true,
        areaId: true,
        inspectionRequired: true,
        lastInspectionAt: true,
      },
    });
    if (!existing) throw new Error("Objekt nicht gefunden.");
    if (input.areaId !== existing.areaId) {
      throw new Error("Der Bereich bestimmt den Code und lässt sich nicht mehr ändern.");
    }
    await assertCategory(existing.areaId, input.categoryId);

    const interval = input.inspectionRequired
      ? (input.inspectionIntervalMonths ?? DEFAULT_INSPECTION_INTERVAL_MONTHS)
      : null;
    let nextInspectionAt = input.inspectionRequired ? input.nextInspectionAt : null;
    if (input.inspectionRequired && !nextInspectionAt && existing.lastInspectionAt && interval) {
      nextInspectionAt = addMonths(existing.lastInspectionAt, interval);
    }

    await prisma.$transaction(async (tx) => {
      await tx.inventoryAsset.update({
        where: { id: assetId },
        data: {
          categoryId: input.categoryId,
          name: input.name,
          manufacturer: input.manufacturer,
          model: input.model,
          serialNumber: input.serialNumber,
          description: input.description,
          publicNote: input.publicNote,
          internalNote: input.internalNote,
          attributes: cleanAttributes(input.attributes),
          condition: input.condition,
          unit: existing.kind === "bulk" ? input.unit : null,
          minQuantity: existing.kind === "bulk" ? (input.minQuantity ?? null) : null,
          inspectionRequired: input.inspectionRequired,
          inspectionIntervalMonths: interval,
          nextInspectionAt,
          ...costData(input, access.canManage),
        },
      });
      await recordEvent(tx, { assetId, type: "updated", message: "Angaben geändert", userId });
    });

    revalidateInventory(inventoryAssetPath(existing.code));
    return { ok: true, message: "Gespeichert." };
  } catch (error) {
    console.error("updateAssetAction", error);
    return failure(error, "Änderungen konnten nicht gespeichert werden.");
  }
}

export async function addAssetPhotoAction(
  assetId: string,
  formData: FormData,
): Promise<InventoryActionResult> {
  try {
    await requireInventoryAccess("use");
    const photo = await readPhotoFile(formData);
    if (!photo) throw new Error("Kein Foto ausgewählt.");
    const asset = await prisma.inventoryAsset.findUnique({
      where: { id: assetId },
      select: { code: true, _count: { select: { photos: true } } },
    });
    if (!asset) throw new Error("Objekt nicht gefunden.");
    if (asset._count.photos >= 8) throw new Error("Höchstens 8 Fotos je Objekt.");
    await prisma.inventoryPhoto.create({
      data: {
        assetId,
        data: photo.data,
        mimeType: photo.mimeType,
        sortOrder: asset._count.photos,
      },
    });
    revalidateInventory(inventoryAssetPath(asset.code));
    return { ok: true, message: "Foto hinzugefügt." };
  } catch (error) {
    console.error("addAssetPhotoAction", error);
    return failure(error, "Foto konnte nicht gespeichert werden.");
  }
}

export async function deleteAssetPhotoAction(photoId: string): Promise<InventoryActionResult> {
  try {
    await requireInventoryAccess("use");
    const photo = await prisma.inventoryPhoto.delete({
      where: { id: photoId },
      select: { asset: { select: { code: true } } },
    });
    revalidateInventory(photo.asset ? inventoryAssetPath(photo.asset.code) : null);
    return { ok: true, message: "Foto entfernt." };
  } catch (error) {
    console.error("deleteAssetPhotoAction", error);
    return failure(error, "Foto konnte nicht entfernt werden.");
  }
}

/** Ausmustern (verwalten) oder wieder aufnehmen. Der Code bleibt reserviert. */
export async function setAssetRetiredAction(
  assetId: string,
  retired: boolean,
  reason?: string,
): Promise<InventoryActionResult> {
  try {
    const { userId } = await requireInventoryAccess("manage");
    const note = z.string().trim().max(300).optional().parse(reason);
    const asset = await prisma.$transaction((tx) =>
      setAssetRetiredInTx(tx, assetId, retired, { note, userId }),
    );
    revalidateInventory(inventoryAssetPath(asset.code));
    return { ok: true, message: retired ? "Ausgemustert." : "Wieder aufgenommen." };
  } catch (error) {
    console.error("setAssetRetiredAction", error);
    return failure(error, "Status konnte nicht geändert werden.");
  }
}

export async function markAssetMissingAction(assetId: string): Promise<InventoryActionResult> {
  try {
    const { userId } = await requireInventoryAccess("use");
    const asset = await prisma.$transaction(async (tx) => {
      const asset = await tx.inventoryAsset.update({
        where: { id: assetId },
        data: { status: "missing" },
        select: { code: true },
      });
      await recordEvent(tx, { assetId, type: "status", message: "Als vermisst gemeldet", userId });
      return asset;
    });
    revalidateInventory(inventoryAssetPath(asset.code));
    return { ok: true, message: "Als vermisst markiert." };
  } catch (error) {
    console.error("markAssetMissingAction", error);
    return failure(error, "Status konnte nicht geändert werden.");
  }
}
