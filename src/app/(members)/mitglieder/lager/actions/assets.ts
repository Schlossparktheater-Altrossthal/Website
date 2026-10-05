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
  assetSchema,
  costData,
  createAssetInTx,
  productData,
  productSchema,
  setAssetRetiredInTx,
  tagsData,
} from "@/lib/inventory/asset-write";
import {
  addMonths,
  CONDITIONS,
  inventoryAssetPath,
  inventoryProductPath,
  MAX_BULK_ROWS,
} from "@/lib/inventory/constants";
import { searchInventoryProducts, type ProductSearchHit } from "@/lib/inventory/queries";
import { recordEvent, requireInventoryAccess } from "@/lib/inventory/service";
import { prisma } from "@/lib/prisma";

export async function createAssetAction(
  formData: FormData,
): Promise<InventoryActionResult<{ codes: string[]; product: ProductSearchHit | null }>> {
  try {
    const { access, userId } = await requireInventoryAccess("use");
    const input = readJsonField(formData, "asset", assetSchema);
    const photo = await readPhotoFile(formData);

    const { codes, productId } = await prisma.$transaction((tx) =>
      createAssetInTx(tx, input, { userId, canManage: access.canManage, photo }),
    );
    // Für „weitere Exemplare zu diesem Typ“ direkt im Anschluss.
    const [product] = await searchInventoryProducts("", 1, { id: productId });

    revalidateInventory();
    const message =
      codes.length === 1 ? `${codes[0]} angelegt.` : `${codes.length} Exemplare angelegt.`;
    return { ok: true, message, data: { codes, product: product ?? null } };
  } catch (error) {
    console.error("createAssetAction", error);
    return failure(error, "Objekt konnte nicht angelegt werden.");
  }
}

export type BulkCreateRowResult =
  { index: number; ok: true; codes: string[] } | { index: number; ok: false; error: string };

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
        const { codes } = await prisma.$transaction((tx) =>
          createAssetInTx(tx, input, {
            userId,
            canManage: access.canManage,
            eventMessage: "Erfasst (Sammelerfassung)",
          }),
        );
        results.push({ index, ok: true, codes });
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

/** Typ-Suche beim Erfassen. */
export async function searchProductsAction(
  query: string,
): Promise<InventoryActionResult<ProductSearchHit[]>> {
  try {
    await requireInventoryAccess("use");
    const text = z
      .string()
      .max(120)
      .parse(query ?? "");
    return { ok: true, data: await searchInventoryProducts(text) };
  } catch (error) {
    return failure(error, "Suche fehlgeschlagen.");
  }
}

/** Tags ohne Artikel räumen sich selbst weg – sonst wüchse die Vorschlagsliste endlos. */
async function deleteUnusedTags(tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]) {
  await tx.inventoryTag.deleteMany({ where: { products: { none: {} } } });
}

/** Tag-Vorschläge beim Tippen: häufig genutzte zuerst. */
export async function searchTagsAction(
  query: string,
): Promise<InventoryActionResult<{ name: string; count: number }[]>> {
  try {
    await requireInventoryAccess("use");
    const text = z
      .string()
      .max(40)
      .parse(query ?? "")
      .trim();
    const tags = await prisma.inventoryTag.findMany({
      where: text ? { name: { contains: text, mode: "insensitive" } } : {},
      select: { name: true, _count: { select: { products: true } } },
      orderBy: { products: { _count: "desc" } },
      take: 12,
    });
    return {
      ok: true,
      data: tags.map((tag) => ({ name: tag.name, count: tag._count.products })),
    };
  } catch (error) {
    return failure(error, "Tags konnten nicht geladen werden.");
  }
}

/**
 * Kategorie-Vorschläge aus dem Typnamen: Typen mit ähnlichen Wörtern im Namen → deren häufigste
 * Kategorien (höchstens drei).
 */
export async function suggestCategoriesAction(
  name: string,
): Promise<InventoryActionResult<string[]>> {
  try {
    await requireInventoryAccess("use");
    const words = z
      .string()
      .max(120)
      .parse(name ?? "")
      .split(/[^\p{L}\p{N}]+/u)
      .filter((word) => word.length >= 3 && !/^\d+$/.test(word))
      .slice(0, 6);
    if (!words.length) return { ok: true, data: [] };
    const products = await prisma.inventoryProduct.findMany({
      where: {
        categoryId: { not: null },
        OR: words.map((word) => ({ name: { contains: word, mode: "insensitive" as const } })),
      },
      select: { name: true, categoryId: true },
      take: 200,
    });
    // Das erste Wort ist meist die Art („PAR 64 schwarz“) und zählt doppelt; Treffer nur über
    // Farbe o. Ä. sollen keine Kategorie vorschlagen, wenn es bessere gibt.
    const scores = new Map<string, number>();
    for (const product of products) {
      const lower = product.name.toLowerCase();
      const score = words.reduce(
        (sum, word, index) => sum + (lower.includes(word.toLowerCase()) ? (index ? 1 : 2) : 0),
        0,
      );
      scores.set(product.categoryId!, Math.max(scores.get(product.categoryId!) ?? 0, score));
    }
    const best = Math.max(0, ...scores.values());
    const data = [...scores.entries()]
      .filter(([, score]) => score === best)
      .slice(0, 3)
      .map(([id]) => id);
    return { ok: true, data };
  } catch (error) {
    return failure(error, "Vorschläge fehlgeschlagen.");
  }
}

const productUpdateSchema = productSchema.omit({ kind: true });

/** Stammdaten eines Artikeltyps ändern – gilt für alle Exemplare. */
export async function updateProductAction(
  productId: string,
  formData: FormData,
): Promise<InventoryActionResult> {
  try {
    const { userId } = await requireInventoryAccess("use");
    const input = readJsonField(formData, "product", productUpdateSchema);
    const existing = await prisma.inventoryProduct.findUnique({
      where: { id: productId },
      select: {
        areaId: true,
        kind: true,
        publicId: true,
        assets: { select: { id: true, lastInspectionAt: true, nextInspectionAt: true } },
      },
    });
    if (!existing) throw new Error("Artikeltyp nicht gefunden.");
    if (input.areaId !== existing.areaId) {
      throw new Error("Der Bereich bestimmt die Codes und lässt sich nicht mehr ändern.");
    }
    const photo = await readPhotoFile(formData);

    await prisma.$transaction(async (tx) => {
      const data = await productData(tx, { ...input, kind: existing.kind });
      await tx.inventoryProduct.update({
        where: { id: productId },
        data: { ...data, tags: { set: [], ...(await tagsData(tx, input.tags)) } },
      });
      await deleteUnusedTags(tx);
      // Prüftermine nachziehen: ohne Prüfpflicht keine, sonst aus der letzten Prüfung.
      for (const asset of existing.assets) {
        let nextInspectionAt: Date | null = null;
        if (data.inspectionRequired) {
          nextInspectionAt =
            asset.lastInspectionAt && data.inspectionIntervalMonths
              ? addMonths(asset.lastInspectionAt, data.inspectionIntervalMonths)
              : asset.nextInspectionAt;
        }
        if (nextInspectionAt?.getTime() !== asset.nextInspectionAt?.getTime()) {
          await tx.inventoryAsset.update({ where: { id: asset.id }, data: { nextInspectionAt } });
        }
      }
      if (photo) {
        const photos = await tx.inventoryPhoto.count({ where: { productId } });
        if (photos >= 8) throw new Error("Höchstens 8 Fotos je Artikel.");
        await tx.inventoryPhoto.create({
          data: { productId, data: photo.data, mimeType: photo.mimeType, sortOrder: photos },
        });
      }
      if (existing.assets.length) {
        await tx.inventoryEvent.createMany({
          data: existing.assets.map((asset) => ({
            assetId: asset.id,
            type: "updated",
            message: "Angaben des Artikeltyps geändert",
            userId,
          })),
        });
      }
    });

    revalidateInventory(inventoryProductPath(existing.publicId));
    return { ok: true, message: "Gespeichert." };
  } catch (error) {
    console.error("updateProductAction", error);
    return failure(error, "Änderungen konnten nicht gespeichert werden.");
  }
}

const exemplarUpdateSchema = z.object({
  label: z.string().trim().max(80).optional().nullable(),
  serialNumber: z.string().trim().max(120).optional().nullable(),
  internalNote: z.string().trim().max(4000).optional().nullable(),
  condition: z.enum(CONDITIONS),
  nextInspectionAt: z.coerce.date().optional().nullable(),
  acquisitionCost: z.coerce.number().min(0).max(10_000_000).optional().nullable(),
  purchaseDate: z.coerce.date().optional().nullable(),
  supplier: z.string().trim().max(160).optional().nullable(),
  ownership: z.string().trim().max(160).optional().nullable(),
});

/** Angaben eines einzelnen Exemplars ändern (Zusatz, Seriennummer, Zustand, Anschaffung …). */
export async function updateAssetAction(
  assetId: string,
  formData: FormData,
): Promise<InventoryActionResult> {
  try {
    const { access, userId } = await requireInventoryAccess("use");
    const input = readJsonField(formData, "asset", exemplarUpdateSchema);
    const existing = await prisma.inventoryAsset.findUnique({
      where: { id: assetId },
      select: { code: true, product: { select: { inspectionRequired: true } } },
    });
    if (!existing) throw new Error("Objekt nicht gefunden.");
    await prisma.$transaction(async (tx) => {
      await tx.inventoryAsset.update({
        where: { id: assetId },
        data: {
          label: input.label || null,
          serialNumber: input.serialNumber || null,
          internalNote: input.internalNote || null,
          condition: input.condition,
          ...(existing.product.inspectionRequired
            ? { nextInspectionAt: input.nextInspectionAt ?? null }
            : {}),
          ...costData(
            {
              acquisitionCost: input.acquisitionCost ?? null,
              purchaseDate: input.purchaseDate ?? null,
              supplier: input.supplier || null,
              ownership: input.ownership || null,
            },
            access.canManage,
          ),
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
      select: { asset: { select: { code: true } }, product: { select: { publicId: true } } },
    });
    revalidateInventory(
      photo.asset ? inventoryAssetPath(photo.asset.code) : null,
      photo.product ? inventoryProductPath(photo.product.publicId) : null,
    );
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
