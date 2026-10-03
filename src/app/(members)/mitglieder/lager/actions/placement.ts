"use server";

import { z } from "zod";

import {
  failure,
  revalidateInventory,
  type InventoryActionResult,
} from "@/lib/inventory/actions-helpers";
import { inventoryAssetPath, parseScanToken } from "@/lib/inventory/constants";
import { buildScanResult, type ScanResult } from "@/lib/inventory/scan";
import {
  placeAsset,
  requireInventoryAccess,
  resolveScanToken,
  setBulkStock,
  type PlacementTarget,
} from "@/lib/inventory/service";
import { prisma } from "@/lib/prisma";

const targetSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("location"), id: z.string().min(1) }),
  z.object({ type: z.literal("container"), id: z.string().min(1) }),
  z.object({ type: z.literal("none") }),
]);

/** Schlägt einen gescannten oder eingetippten Code nach (Scanner, Schnellsuche). */
export async function lookupCodeAction(raw: string): Promise<InventoryActionResult<ScanResult>> {
  try {
    await requireInventoryAccess("use");
    const token = parseScanToken(raw);
    const code = token ? await resolveScanToken(token) : null;
    if (!code)
      throw new Error(token ? "Dieses Etikett ist nicht vergeben." : "Kein gültiger Lager-Code.");
    const result = await buildScanResult(code);
    if (!result) throw new Error(`${code} ist nicht vergeben.`);
    return { ok: true, data: result };
  } catch (error) {
    return failure(error, "Code konnte nicht gelesen werden.");
  }
}

export async function moveAssetAction(
  assetId: string,
  target: PlacementTarget,
): Promise<InventoryActionResult> {
  try {
    const { userId } = await requireInventoryAccess("use");
    const parsed = targetSchema.parse(target);
    const asset = await prisma.$transaction(async (tx) => {
      await placeAsset(tx, { assetId, target: parsed, userId });
      return tx.inventoryAsset.findUniqueOrThrow({
        where: { id: assetId },
        select: { code: true },
      });
    });
    revalidateInventory(inventoryAssetPath(asset.code));
    return { ok: true, message: "Umgelagert." };
  } catch (error) {
    console.error("moveAssetAction", error);
    return failure(error, "Umlagern fehlgeschlagen.");
  }
}

export async function setStockAction(
  assetId: string,
  target: PlacementTarget,
  quantity: number,
  mode: "set" | "add",
): Promise<InventoryActionResult> {
  try {
    const { userId } = await requireInventoryAccess("use");
    const parsedTarget = targetSchema.parse(target);
    const amount = z.number().int().min(-100_000).max(100_000).parse(quantity);
    const asset = await prisma.$transaction(async (tx) => {
      const asset = await tx.inventoryAsset.findUnique({
        where: { id: assetId },
        select: { code: true, kind: true },
      });
      if (!asset || asset.kind !== "bulk") throw new Error("Nur für Mengenartikel.");
      await setBulkStock(tx, { assetId, target: parsedTarget, quantity: amount, userId, mode });
      return asset;
    });
    revalidateInventory(inventoryAssetPath(asset.code));
    return { ok: true, message: "Bestand gespeichert." };
  } catch (error) {
    console.error("setStockAction", error);
    return failure(error, "Bestand konnte nicht gespeichert werden.");
  }
}

/** Bestand von einem Platz auf einen anderen verschieben. */
export async function transferStockAction(
  assetId: string,
  from: PlacementTarget,
  to: PlacementTarget,
  quantity: number,
): Promise<InventoryActionResult> {
  try {
    const { userId } = await requireInventoryAccess("use");
    const source = targetSchema.parse(from);
    const destination = targetSchema.parse(to);
    const amount = z.number().int().min(1).max(100_000).parse(quantity);
    const asset = await prisma.$transaction(async (tx) => {
      const asset = await tx.inventoryAsset.findUnique({
        where: { id: assetId },
        select: { code: true, kind: true },
      });
      if (!asset || asset.kind !== "bulk") throw new Error("Nur für Mengenartikel.");
      const { previous } = await setBulkStock(tx, {
        assetId,
        target: source,
        quantity: -amount,
        userId,
        mode: "add",
      });
      if (previous < amount) throw new Error(`Dort liegen nur ${previous}.`);
      await setBulkStock(tx, {
        assetId,
        target: destination,
        quantity: amount,
        userId,
        mode: "add",
      });
      return asset;
    });
    revalidateInventory(inventoryAssetPath(asset.code));
    return { ok: true, message: "Umgelagert." };
  } catch (error) {
    console.error("transferStockAction", error);
    return failure(error, "Umlagern fehlgeschlagen.");
  }
}

const batchSchema = z
  .array(
    z.object({
      assetId: z.string().min(1),
      quantity: z.number().int().min(1).max(100_000).optional(),
    }),
  )
  .min(1)
  .max(300);

export type BatchPlaceOutcome = { assetId: string; ok: boolean; error?: string };

/** Dauerscan „Einlagern“: alle gescannten Objekte an ein Ziel legen. */
export async function batchPlaceAction(
  target: PlacementTarget,
  items: { assetId: string; quantity?: number }[],
): Promise<InventoryActionResult<BatchPlaceOutcome[]>> {
  try {
    const { userId } = await requireInventoryAccess("use");
    const parsedTarget = targetSchema.parse(target);
    if (parsedTarget.type === "none") throw new Error("Bitte zuerst ein Ziel scannen.");
    const list = batchSchema.parse(items);
    const outcomes: BatchPlaceOutcome[] = [];
    for (const item of list) {
      try {
        await prisma.$transaction(async (tx) => {
          const asset = await tx.inventoryAsset.findUnique({
            where: { id: item.assetId },
            select: { kind: true },
          });
          if (!asset) throw new Error("Nicht gefunden.");
          if (asset.kind === "bulk") {
            await setBulkStock(tx, {
              assetId: item.assetId,
              target: parsedTarget,
              quantity: item.quantity ?? 1,
              userId,
              mode: "add",
            });
          } else {
            await placeAsset(tx, {
              assetId: item.assetId,
              target: parsedTarget,
              userId,
              via: "scan",
            });
          }
        });
        outcomes.push({ assetId: item.assetId, ok: true });
      } catch (error) {
        outcomes.push({
          assetId: item.assetId,
          ok: false,
          error: error instanceof Error ? error.message : "Fehler",
        });
      }
    }
    revalidateInventory();
    const okCount = outcomes.filter((outcome) => outcome.ok).length;
    return {
      ok: true,
      message: `${okCount} von ${outcomes.length} eingelagert.`,
      data: outcomes,
    };
  } catch (error) {
    console.error("batchPlaceAction", error);
    return failure(error, "Einlagern fehlgeschlagen.");
  }
}
