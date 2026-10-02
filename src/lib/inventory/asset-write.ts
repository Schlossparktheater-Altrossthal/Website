import { Prisma } from "@prisma/client";
import { z } from "zod";

import { optionalId, optionalText } from "@/lib/inventory/actions-helpers";
import {
  ASSET_KINDS,
  CONDITIONS,
  DEFAULT_INSPECTION_INTERVAL_MONTHS,
} from "@/lib/inventory/constants";
import {
  allocateAssetCode,
  placeAsset,
  recordEvent,
  refreshAssetStatus,
  setBulkStock,
  type PlacementTarget,
} from "@/lib/inventory/service";
import { prisma } from "@/lib/prisma";

/** Gemeinsame Schreiblogik für Einzel- und Sammelerfassung. */

export const placementSchema = z
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

export const assetSchema = z.object({
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

export type AssetInput = z.infer<typeof assetSchema>;

export function cleanAttributes(attributes: Record<string, string>) {
  return Object.fromEntries(Object.entries(attributes).filter(([, value]) => value.trim()));
}

export async function assertCategory(areaId: string, categoryId: string | null) {
  if (!categoryId) return;
  const category = await prisma.inventoryCategory.findUnique({
    where: { id: categoryId },
    select: { areaId: true },
  });
  if (!category || category.areaId !== areaId) {
    throw new Error("Die Kategorie gehört nicht zu diesem Bereich.");
  }
}

export function costData(
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

/** Legt ein Objekt samt Ort/Bestand, Verlauf und optionalem Foto an. Gibt den neuen Code zurück. */
export async function createAssetInTx(
  tx: Prisma.TransactionClient,
  input: AssetInput,
  options: {
    userId: string | null;
    canManage: boolean;
    photo?: { data: Uint8Array<ArrayBuffer>; mimeType: string } | null;
    eventMessage?: string;
  },
): Promise<{ id: string; code: string }> {
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
      ...costData(input, options.canManage),
    },
  });
  const { userId } = options;
  await recordEvent(tx, {
    assetId: asset.id,
    type: "created",
    message: options.eventMessage ?? "Erfasst",
    userId,
  });
  if (options.photo) {
    await tx.inventoryPhoto.create({
      data: { assetId: asset.id, data: options.photo.data, mimeType: options.photo.mimeType },
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
  return { id: asset.id, code };
}

/** Mustert aus (Ort, Kiste und Bestand werden frei) oder nimmt wieder auf. */
export async function setAssetRetiredInTx(
  tx: Prisma.TransactionClient,
  assetId: string,
  retired: boolean,
  options: { note?: string; userId: string | null },
): Promise<{ code: string }> {
  const asset = await tx.inventoryAsset.update({
    where: { id: assetId },
    data: retired
      ? { status: "retired", locationId: null, containerId: null }
      : { status: "available" },
    select: { code: true },
  });
  if (retired) {
    await tx.inventoryStock.deleteMany({ where: { assetId } });
    await tx.inventoryAsset.update({ where: { id: assetId }, data: { quantity: 0 } });
    // Inhalt einer ausgemusterten Kiste bleibt am Ort der Kiste liegen.
    await tx.inventoryAsset.updateMany({
      where: { containerId: assetId },
      data: { containerId: null },
    });
  }
  await recordEvent(tx, {
    assetId,
    type: "status",
    message: retired
      ? `Ausgemustert${options.note ? `: ${options.note}` : ""}`
      : "Wieder aufgenommen",
    userId: options.userId,
  });
  if (!retired) await refreshAssetStatus(tx, assetId, { seen: true });
  return asset;
}
