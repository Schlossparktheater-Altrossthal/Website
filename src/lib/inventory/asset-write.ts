import { Prisma } from "@prisma/client";
import { z } from "zod";

import { optionalId, optionalText } from "@/lib/inventory/actions-helpers";
import { loadEffectiveFields } from "@/lib/inventory/catalog";
import {
  CONDITIONS,
  DEFAULT_INSPECTION_INTERVAL_MONTHS,
  MAX_EXEMPLARS_PER_CAPTURE,
  PRODUCT_KINDS,
  type AssetKind,
} from "@/lib/inventory/constants";
import { createPublicId } from "@/lib/inventory/public-id";
import { parseSpecs } from "@/lib/inventory/specs";
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

/** Stammdaten eines Artikeltyps (gelten für alle Exemplare). */
export const productSchema = z.object({
  areaId: z.string().min(1, "Bitte einen Bereich wählen."),
  categoryId: optionalId,
  kind: z.enum(PRODUCT_KINDS),
  name: z.string().trim().min(1, "Bitte einen Namen angeben.").max(160),
  manufacturer: optionalText(120),
  model: optionalText(120),
  description: optionalText(4000),
  publicNote: optionalText(500),
  /** Rohwerte – geprüft gegen die Merkmale von Bereich und Kategorie (`parseSpecs`). */
  specs: z.record(z.string(), z.unknown()).default({}),
  unit: optionalText(30),
  minQuantity: z.coerce.number().int().min(0).optional().nullable(),
  inspectionRequired: z.boolean().default(false),
  inspectionIntervalMonths: z.coerce.number().int().min(1).max(120).optional().nullable(),
});

export type ProductInput = z.infer<typeof productSchema>;

/** Angaben je Exemplar. */
const exemplarShape = {
  label: optionalText(80),
  serialNumber: optionalText(120),
  internalNote: optionalText(4000),
  condition: z.enum(CONDITIONS).default("good"),
  /** Mengenartikel: Anfangsbestand am gewählten Ort. */
  quantity: z.coerce.number().int().min(0).max(100_000).optional().nullable(),
  /** Einzelstücke/Kisten: so viele Exemplare mit fortlaufenden Codes anlegen. */
  count: z.coerce.number().int().min(1).max(MAX_EXEMPLARS_PER_CAPTURE).default(1),
  placement: placementSchema.default({ type: "none" }),
  nextInspectionAt: dateString,
  acquisitionCost: z.coerce.number().min(0).max(10_000_000).optional().nullable(),
  purchaseDate: dateString,
  supplier: optionalText(160),
  ownership: optionalText(160),
};

/**
 * Erfassung: entweder ein bestehender Typ (`productId`) oder ein neuer Typ aus den
 * Stammdaten – plus die Angaben für die neuen Exemplare.
 */
export const assetSchema = productSchema
  .extend({ productId: optionalId, ...exemplarShape })
  .refine((input) => !(input.serialNumber && input.count > 1), {
    message: "Eine Seriennummer passt nur zu einem einzelnen Exemplar.",
    path: ["serialNumber"],
  });

export type AssetInput = z.infer<typeof assetSchema>;

export async function assertCategory(
  db: Prisma.TransactionClient | typeof prisma,
  areaId: string,
  categoryId: string | null,
) {
  if (!categoryId) return;
  const category = await db.inventoryCategory.findUnique({
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

/** Stammdaten für Anlegen/Ändern eines Typs inklusive geprüfter Merkmale. */
export async function productData(tx: Prisma.TransactionClient, input: ProductInput) {
  await assertCategory(tx, input.areaId, input.categoryId);
  const fields = await loadEffectiveFields(tx, input.areaId, input.categoryId);
  const bulk = input.kind === "bulk";
  const set = input.kind === "set";
  return {
    categoryId: input.categoryId,
    name: input.name,
    manufacturer: input.manufacturer,
    model: input.model,
    description: input.description,
    publicNote: input.publicNote,
    specs: parseSpecs(fields, input.specs),
    unit: bulk ? input.unit : null,
    minQuantity: bulk ? (input.minQuantity ?? null) : null,
    // Sets werden nicht selbst geprüft – ihre Bestandteile schon.
    inspectionRequired: set ? false : input.inspectionRequired,
    inspectionIntervalMonths:
      !set && input.inspectionRequired
        ? (input.inspectionIntervalMonths ?? DEFAULT_INSPECTION_INTERVAL_MONTHS)
        : null,
  };
}

export async function createProductInTx(tx: Prisma.TransactionClient, input: ProductInput) {
  return tx.inventoryProduct.create({
    data: {
      publicId: createPublicId(),
      areaId: input.areaId,
      kind: input.kind,
      ...(await productData(tx, input)),
    },
    select: { id: true, areaId: true, kind: true, inspectionRequired: true },
  });
}

/**
 * Legt Exemplare an – für einen bestehenden Typ oder zusammen mit einem neuen Typ – samt
 * Ort/Bestand, Verlauf und optionalem Foto. Gibt die neuen Codes zurück.
 */
export async function createAssetInTx(
  tx: Prisma.TransactionClient,
  input: AssetInput,
  options: {
    userId: string | null;
    canManage: boolean;
    photo?: { data: Uint8Array<ArrayBuffer>; mimeType: string } | null;
    eventMessage?: string;
  },
): Promise<{ productId: string; codes: string[] }> {
  let product;
  if (input.productId) {
    product = await tx.inventoryProduct.findUnique({
      where: { id: input.productId },
      select: {
        id: true,
        areaId: true,
        kind: true,
        inspectionRequired: true,
        _count: { select: { assets: true } },
      },
    });
    if (!product) throw new Error("Artikeltyp nicht gefunden.");
    if (product.kind === "bulk" && product._count.assets > 0) {
      throw new Error("Diesen Mengenartikel gibt es schon – bitte dort den Bestand anpassen.");
    }
  } else {
    product = await createProductInTx(tx, input);
  }
  if (options.photo) {
    // Fotos gehören zum Typ – alle Exemplare zeigen sie.
    const photos = await tx.inventoryPhoto.count({ where: { productId: product.id } });
    await tx.inventoryPhoto.create({
      data: {
        productId: product.id,
        data: options.photo.data,
        mimeType: options.photo.mimeType,
        sortOrder: photos,
      },
    });
  }

  if (product.kind === "set") {
    throw new Error("Sets haben keine eigenen Exemplare – bitte die Bestandteile erfassen.");
  }
  const kind = product.kind as AssetKind;
  const count = kind === "bulk" ? 1 : input.count;
  const codes: string[] = [];
  const { userId } = options;
  for (let index = 0; index < count; index += 1) {
    const code = await allocateAssetCode(tx, product.areaId);
    const asset = await tx.inventoryAsset.create({
      data: {
        code,
        publicId: createPublicId(),
        productId: product.id,
        areaId: product.areaId,
        kind,
        label: count > 1 ? null : input.label,
        serialNumber: count > 1 ? null : input.serialNumber,
        internalNote: input.internalNote,
        condition: input.condition,
        quantity: product.kind === "bulk" ? 0 : 1,
        // Ohne bekannte letzte Prüfung gilt das Exemplar als sofort zu prüfen.
        nextInspectionAt: product.inspectionRequired ? input.nextInspectionAt : null,
        lastSeenAt: new Date(),
        ...costData(input, options.canManage),
      },
    });
    codes.push(code);
    await recordEvent(tx, {
      assetId: asset.id,
      type: "created",
      message: options.eventMessage ?? "Erfasst",
      userId,
    });
    if (product.kind === "bulk") {
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
  }
  return { productId: product.id, codes };
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
