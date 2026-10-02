"use server";

import { Prisma } from "@prisma/client";
import { z } from "zod";

import {
  failure,
  optionalId,
  optionalText,
  readJsonField,
  readPhotoFile,
  revalidateInventory,
  type InventoryActionResult,
} from "@/lib/inventory/actions-helpers";
import {
  addMonths,
  ASSET_KINDS,
  CONDITIONS,
  DEFAULT_INSPECTION_INTERVAL_MONTHS,
  inventoryAssetPath,
} from "@/lib/inventory/constants";
import {
  allocateAssetCode,
  placeAsset,
  recordEvent,
  refreshAssetStatus,
  requireInventoryAccess,
  setBulkStock,
  type PlacementTarget,
} from "@/lib/inventory/service";
import { prisma } from "@/lib/prisma";

const placementSchema = z
  .object({
    type: z.enum(["location", "container", "none"]),
    id: z.string().optional().nullable(),
  })
  .transform((value): PlacementTarget =>
    value.type !== "none" && value.id ? { type: value.type, id: value.id } : { type: "none" },
  );

const dateString = z
  .string()
  .trim()
  .optional()
  .nullable()
  .transform((value, ctx) => {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      ctx.addIssue({ code: "custom", message: "Ungültiges Datum." });
      return z.NEVER;
    }
    return date;
  });

const assetSchema = z.object({
  areaId: z.string().min(1, "Bitte einen Bereich wählen."),
  categoryId: optionalId,
  kind: z.enum(ASSET_KINDS),
  name: z.string().trim().min(1, "Bitte einen Namen angeben.").max(160),
  manufacturer: optionalText(120),
  model: optionalText(120),
  serialNumber: optionalText(120),
  description: optionalText(4000),
  publicNote: optionalText(500),
  internalNote: optionalText(4000),
  attributes: z.record(z.string(), z.string().trim().max(200)).default({}),
  condition: z.enum(CONDITIONS).default("good"),
  unit: optionalText(30),
  minQuantity: z.coerce.number().int().min(0).optional().nullable(),
  quantity: z.coerce.number().int().min(0).max(100_000).optional().nullable(),
  placement: placementSchema.default({ type: "none" }),
  inspectionRequired: z.boolean().default(false),
  inspectionIntervalMonths: z.coerce.number().int().min(1).max(120).optional().nullable(),
  nextInspectionAt: dateString,
  acquisitionCost: z.coerce.number().min(0).max(10_000_000).optional().nullable(),
  purchaseDate: dateString,
  supplier: optionalText(160),
  ownership: optionalText(160),
});

type AssetInput = z.infer<typeof assetSchema>;

function cleanAttributes(attributes: Record<string, string>) {
  return Object.fromEntries(Object.entries(attributes).filter(([, value]) => value.trim()));
}

async function assertCategory(areaId: string, categoryId: string | null) {
  if (!categoryId) return;
  const category = await prisma.inventoryCategory.findUnique({
    where: { id: categoryId },
    select: { areaId: true },
  });
  if (!category || category.areaId !== areaId) {
    throw new Error("Die Kategorie gehört nicht zu diesem Bereich.");
  }
}

function costData(
  input: Pick<AssetInput, "acquisitionCost" | "purchaseDate" | "supplier" | "ownership">,
  canManage: boolean,
) {
  if (!canManage) return {};
  return {
    acquisitionCost:
      input.acquisitionCost === null || input.acquisitionCost === undefined
        ? null
        : new Prisma.Decimal(input.acquisitionCost),
    purchaseDate: input.purchaseDate,
    supplier: input.supplier,
    ownership: input.ownership,
  };
}

export async function createAssetAction(
  formData: FormData,
): Promise<InventoryActionResult<{ code: string }>> {
  try {
    const { access, userId } = await requireInventoryAccess("use");
    const input = readJsonField(formData, "asset", assetSchema);
    const photo = await readPhotoFile(formData);
    await assertCategory(input.areaId, input.categoryId);

    const code = await prisma.$transaction(async (tx) => {
      const code = await allocateAssetCode(tx, input.areaId);
      const interval = input.inspectionRequired
        ? (input.inspectionIntervalMonths ?? DEFAULT_INSPECTION_INTERVAL_MONTHS)
        : null;
      const asset = await tx.inventoryAsset.create({
        data: {
          code,
          areaId: input.areaId,
          categoryId: input.categoryId,
          kind: input.kind,
          name: input.name,
          manufacturer: input.manufacturer,
          model: input.model,
          serialNumber: input.serialNumber,
          description: input.description,
          publicNote: input.publicNote,
          internalNote: input.internalNote,
          attributes: cleanAttributes(input.attributes),
          condition: input.condition,
          unit: input.kind === "bulk" ? input.unit : null,
          minQuantity: input.kind === "bulk" ? (input.minQuantity ?? null) : null,
          quantity: input.kind === "bulk" ? 0 : 1,
          inspectionRequired: input.inspectionRequired,
          inspectionIntervalMonths: interval,
          // Ohne bekannte letzte Prüfung gilt das Objekt als sofort zu prüfen.
          nextInspectionAt: input.inspectionRequired ? input.nextInspectionAt : null,
          lastSeenAt: new Date(),
          ...costData(input, access.canManage),
        },
      });
      await recordEvent(tx, { assetId: asset.id, type: "created", message: "Erfasst", userId });
      if (photo) {
        await tx.inventoryPhoto.create({
          data: { assetId: asset.id, data: photo.data, mimeType: photo.mimeType },
        });
      }
      if (input.kind === "bulk") {
        if (input.placement.type !== "none" && input.quantity) {
          await setBulkStock(tx, {
            assetId: asset.id,
            target: input.placement,
            quantity: input.quantity,
            userId,
            mode: "set",
          });
        }
      } else if (input.placement.type !== "none") {
        await placeAsset(tx, { assetId: asset.id, target: input.placement, userId });
      }
      return code;
    });

    revalidateInventory();
    return { ok: true, message: `${code} angelegt.`, data: { code } };
  } catch (error) {
    console.error("createAssetAction", error);
    return failure(error, "Objekt konnte nicht angelegt werden.");
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
    const asset = await prisma.$transaction(async (tx) => {
      const asset = await tx.inventoryAsset.update({
        where: { id: assetId },
        data: retired
          ? { status: "retired", locationId: null, containerId: null }
          : { status: "available" },
        select: { code: true },
      });
      if (retired) {
        await tx.inventoryStock.deleteMany({ where: { assetId } });
        await tx.inventoryAsset.update({
          where: { id: assetId },
          data: { quantity: 0 },
        });
        // Inhalt einer ausgemusterten Kiste bleibt am Ort der Kiste liegen.
        await tx.inventoryAsset.updateMany({
          where: { containerId: assetId },
          data: { containerId: null },
        });
      }
      await recordEvent(tx, {
        assetId,
        type: "status",
        message: retired ? `Ausgemustert${note ? `: ${note}` : ""}` : "Wieder aufgenommen",
        userId,
      });
      if (!retired) await refreshAssetStatus(tx, assetId, { seen: true });
      return asset;
    });
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
