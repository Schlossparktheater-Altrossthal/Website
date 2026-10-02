"use server";

import { z } from "zod";

import {
  failure,
  optionalId,
  revalidateInventory,
  type InventoryActionResult,
} from "@/lib/inventory/actions-helpers";
import { INVENTORY_BASE_PATH, isLocationCode, parseInventoryCode } from "@/lib/inventory/constants";
import {
  placeAsset,
  recordEvent,
  refreshAssetStatus,
  requireInventoryAccess,
  setBulkStock,
} from "@/lib/inventory/service";
import {
  buildStocktakeReview,
  getStocktakeProgress,
  type StocktakeProgress,
} from "@/lib/inventory/stocktake";
import { prisma } from "@/lib/prisma";

const stocktakePath = (id: string) => `${INVENTORY_BASE_PATH}/inventur/${id}`;

const createSchema = z.object({
  title: z.string().trim().min(1, "Bitte einen Titel angeben.").max(120),
  areaId: optionalId,
  locationId: optionalId,
});

export async function createStocktakeAction(
  input: z.input<typeof createSchema>,
): Promise<InventoryActionResult<{ id: string }>> {
  try {
    await requireInventoryAccess("manage");
    const data = createSchema.parse(input);
    const stocktake = await prisma.inventoryStocktake.create({ data, select: { id: true } });
    revalidateInventory();
    return { ok: true, message: "Inventur gestartet.", data: stocktake };
  } catch (error) {
    console.error("createStocktakeAction", error);
    return failure(error, "Inventur konnte nicht angelegt werden.");
  }
}

const scanSchema = z.object({
  clientScanId: z.string().min(8).max(80),
  code: z.string().min(1).max(200),
  zoneLocationId: z.string().nullable(),
  quantity: z.number().int().min(0).max(100_000).nullable(),
  scannedAt: z.string().datetime(),
});

export type StocktakeScanInput = z.input<typeof scanSchema>;

export type StocktakeScanOutcome = {
  clientScanId: string;
  status: "ok" | "unknown" | "location" | "duplicate";
  code: string;
  name?: string;
  kind?: string;
  locationName?: string;
};

/**
 * Nimmt Scans an – auch nachträglich aus dem Offline-Puffer. Doppelte `clientScanId`s werden
 * ignoriert, damit ein erneutes Senden nichts doppelt zählt.
 */
export async function submitStocktakeScansAction(
  stocktakeId: string,
  scans: StocktakeScanInput[],
): Promise<InventoryActionResult<StocktakeScanOutcome[]>> {
  try {
    const { userId } = await requireInventoryAccess("use");
    const list = z.array(scanSchema).max(500).parse(scans);
    const stocktake = await prisma.inventoryStocktake.findUnique({
      where: { id: stocktakeId },
      select: { status: true },
    });
    if (!stocktake) throw new Error("Inventur nicht gefunden.");
    if (stocktake.status !== "open") throw new Error("Diese Inventur ist abgeschlossen.");

    const codes = [
      ...new Set(
        list.map((scan) => parseInventoryCode(scan.code)).filter((c): c is string => Boolean(c)),
      ),
    ];
    const [assets, locations, existing] = await Promise.all([
      prisma.inventoryAsset.findMany({
        where: { code: { in: codes } },
        select: { id: true, code: true, name: true, kind: true },
      }),
      prisma.inventoryLocation.findMany({
        where: { code: { in: codes.filter(isLocationCode) } },
        select: { id: true, code: true, name: true },
      }),
      prisma.inventoryStocktakeScan.findMany({
        where: { clientScanId: { in: list.map((scan) => scan.clientScanId) } },
        select: { clientScanId: true },
      }),
    ]);
    const assetByCode = new Map(assets.map((asset) => [asset.code, asset]));
    const locationByCode = new Map(locations.map((location) => [location.code, location]));
    const seen = new Set(existing.map((entry) => entry.clientScanId));

    const outcomes: StocktakeScanOutcome[] = [];
    const rows: {
      stocktakeId: string;
      clientScanId: string;
      code: string;
      assetId: string | null;
      quantity: number | null;
      locationId: string | null;
      userId: string | null;
      scannedAt: Date;
    }[] = [];
    for (const scan of list) {
      const code = parseInventoryCode(scan.code) ?? scan.code.slice(0, 40);
      if (seen.has(scan.clientScanId)) {
        outcomes.push({ clientScanId: scan.clientScanId, status: "duplicate", code });
        continue;
      }
      const location = locationByCode.get(code);
      if (location) {
        // Lagerplatz-Etiketten setzen nur die Zone – sie zählen nicht als Fund.
        outcomes.push({
          clientScanId: scan.clientScanId,
          status: "location",
          code,
          name: location.name,
          locationName: location.name,
        });
        continue;
      }
      const asset = assetByCode.get(code);
      rows.push({
        stocktakeId,
        clientScanId: scan.clientScanId,
        code,
        assetId: asset?.id ?? null,
        quantity: asset?.kind === "bulk" ? (scan.quantity ?? null) : null,
        locationId: scan.zoneLocationId,
        userId,
        scannedAt: new Date(scan.scannedAt),
      });
      outcomes.push({
        clientScanId: scan.clientScanId,
        status: asset ? "ok" : "unknown",
        code,
        name: asset?.name,
        kind: asset?.kind,
      });
    }
    if (rows.length) {
      await prisma.inventoryStocktakeScan.createMany({ data: rows, skipDuplicates: true });
    }
    return { ok: true, data: outcomes };
  } catch (error) {
    console.error("submitStocktakeScansAction", error);
    return failure(error, "Scans konnten nicht gespeichert werden.");
  }
}

export async function stocktakeProgressAction(
  stocktakeId: string,
): Promise<InventoryActionResult<StocktakeProgress>> {
  try {
    await requireInventoryAccess("use");
    const progress = await getStocktakeProgress(stocktakeId);
    if (!progress) throw new Error("Inventur nicht gefunden.");
    return { ok: true, data: progress };
  } catch (error) {
    return failure(error, "Fortschritt nicht verfügbar.");
  }
}

const closeSchema = z.object({
  applyMoves: z.boolean(),
  markMissing: z.boolean(),
  applyBulkCounts: z.boolean(),
});

/** Inventur abschließen und den Abgleich übernehmen (verwalten). */
export async function closeStocktakeAction(
  stocktakeId: string,
  options: z.input<typeof closeSchema>,
): Promise<InventoryActionResult> {
  try {
    const { userId } = await requireInventoryAccess("manage");
    const settings = closeSchema.parse(options);
    const stocktake = await prisma.inventoryStocktake.findUnique({
      where: { id: stocktakeId },
      select: { title: true, status: true },
    });
    if (!stocktake) throw new Error("Inventur nicht gefunden.");
    if (stocktake.status !== "open") throw new Error("Schon abgeschlossen.");
    const review = await buildStocktakeReview(stocktakeId);
    if (!review) throw new Error("Inventur nicht gefunden.");
    const now = new Date();
    const note = `Inventur „${stocktake.title}“`;

    await prisma.$transaction(
      async (tx) => {
        for (const entry of [
          ...review.found,
          ...review.moved,
          ...review.unexpected,
          ...review.inFoundContainer,
        ]) {
          await tx.inventoryAsset.update({
            where: { id: entry.id },
            data: { lastSeenAt: now },
          });
          await refreshAssetStatus(tx, entry.id, { seen: true });
        }
        if (settings.applyMoves) {
          for (const entry of [...review.moved, ...review.unexpected]) {
            if (!entry.foundLocationId) continue;
            await placeAsset(tx, {
              assetId: entry.id,
              target: { type: "location", id: entry.foundLocationId },
              userId,
              via: "stocktake",
            });
          }
        }
        if (settings.markMissing) {
          for (const entry of review.missing) {
            await tx.inventoryAsset.update({
              where: { id: entry.id },
              data: { status: "missing" },
            });
            await recordEvent(tx, {
              assetId: entry.id,
              type: "status",
              message: `${note}: nicht gefunden`,
              userId,
            });
          }
        }
        if (settings.applyBulkCounts) {
          for (const entry of review.bulkCounts) {
            if (entry.quantity === null || entry.quantity === undefined || !entry.foundLocationId)
              continue;
            await setBulkStock(tx, {
              assetId: entry.id,
              target: { type: "location", id: entry.foundLocationId },
              quantity: entry.quantity,
              userId,
              mode: "set",
            });
          }
        }
        for (const entry of [...review.found, ...review.moved]) {
          await recordEvent(tx, {
            assetId: entry.id,
            type: "stocktake",
            message: `${note}: gefunden`,
            userId,
          });
        }
        await tx.inventoryStocktake.update({
          where: { id: stocktakeId },
          data: { status: "closed", closedAt: now },
        });
      },
      { timeout: 60_000 },
    );
    revalidateInventory(stocktakePath(stocktakeId));
    return { ok: true, message: "Inventur abgeschlossen." };
  } catch (error) {
    console.error("closeStocktakeAction", error);
    return failure(error, "Inventur konnte nicht abgeschlossen werden.");
  }
}
