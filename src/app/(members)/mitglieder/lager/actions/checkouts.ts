"use server";

import { z } from "zod";

import {
  failure,
  optionalId,
  optionalText,
  revalidateInventory,
  type InventoryActionResult,
} from "@/lib/inventory/actions-helpers";
import { INVENTORY_BASE_PATH, inventoryAssetPath } from "@/lib/inventory/constants";
import { recordEvent, refreshAssetStatus, requireInventoryAccess } from "@/lib/inventory/service";
import { prisma } from "@/lib/prisma";

const checkoutPath = (id: string) => `${INVENTORY_BASE_PATH}/ausgaben/${id}`;

const checkoutSchema = z
  .object({
    title: z.string().trim().min(1, "Wofür wird ausgegeben?").max(160),
    showId: optionalId,
    borrowerId: optionalId,
    borrowerName: optionalText(160),
    dueAt: z
      .string()
      .optional()
      .nullable()
      .transform((value) => (value ? new Date(value) : null)),
    note: optionalText(2000),
  })
  .refine((value) => !value.dueAt || !Number.isNaN(value.dueAt.getTime()), "Ungültiges Datum.");

export async function createCheckoutAction(
  input: z.input<typeof checkoutSchema>,
): Promise<InventoryActionResult<{ id: string }>> {
  try {
    await requireInventoryAccess("use");
    const data = checkoutSchema.parse(input);
    const checkout = await prisma.inventoryCheckout.create({ data, select: { id: true } });
    revalidateInventory();
    return { ok: true, message: "Ausgabe angelegt.", data: checkout };
  } catch (error) {
    console.error("createCheckoutAction", error);
    return failure(error, "Ausgabe konnte nicht angelegt werden.");
  }
}

export async function updateCheckoutAction(
  id: string,
  input: z.input<typeof checkoutSchema>,
): Promise<InventoryActionResult> {
  try {
    await requireInventoryAccess("use");
    const data = checkoutSchema.parse(input);
    await prisma.inventoryCheckout.update({ where: { id }, data });
    revalidateInventory(checkoutPath(id));
    return { ok: true, message: "Gespeichert." };
  } catch (error) {
    console.error("updateCheckoutAction", error);
    return failure(error, "Ausgabe konnte nicht gespeichert werden.");
  }
}

export type CheckoutScanOutcome = {
  assetId: string;
  code: string;
  name: string;
  quantity: number;
  warning?: string;
};

/** Objekt zur Ausgabe hinzufügen (Scan oder Auswahl). Mengenartikel zählen hoch. */
export async function addToCheckoutAction(
  checkoutId: string,
  assetId: string,
  quantity = 1,
): Promise<InventoryActionResult<CheckoutScanOutcome>> {
  try {
    const { userId } = await requireInventoryAccess("use");
    const amount = z.number().int().min(1).max(100_000).parse(quantity);
    const outcome = await prisma.$transaction(async (tx) => {
      const checkout = await tx.inventoryCheckout.findUnique({
        where: { id: checkoutId },
        select: { status: true, title: true },
      });
      if (!checkout || checkout.status !== "open")
        throw new Error("Diese Ausgabe ist geschlossen.");
      const asset = await tx.inventoryAsset.findUnique({
        where: { id: assetId },
        select: {
          id: true,
          code: true,
          name: true,
          kind: true,
          status: true,
          quantity: true,
          checkoutLines: {
            where: { checkout: { status: "open" }, NOT: { checkoutId } },
            select: {
              quantity: true,
              returnedQuantity: true,
              checkout: { select: { title: true } },
            },
          },
        },
      });
      if (!asset) throw new Error("Objekt nicht gefunden.");
      if (asset.status === "retired") throw new Error("Ausgemustert.");
      let warning: string | undefined;
      if (asset.status === "locked") warning = "Gesperrt – Mangel beachten!";
      const elsewhere = asset.checkoutLines.find((line) => line.returnedQuantity < line.quantity);
      if (asset.kind !== "bulk" && elsewhere) {
        throw new Error(`Schon ausgegeben: ${elsewhere.checkout.title}`);
      }
      const existing = await tx.inventoryCheckoutLine.findUnique({
        where: { checkoutId_assetId: { checkoutId, assetId } },
      });
      let lineQuantity = amount;
      if (existing) {
        if (asset.kind !== "bulk" && existing.returnedQuantity < existing.quantity) {
          return {
            assetId,
            code: asset.code,
            name: asset.name,
            quantity: 1,
            warning: "Schon auf der Liste",
          };
        }
        lineQuantity =
          asset.kind === "bulk" ? existing.quantity - existing.returnedQuantity + amount : 1;
        await tx.inventoryCheckoutLine.update({
          where: { id: existing.id },
          data: {
            quantity: existing.returnedQuantity + lineQuantity,
            returnedAt: null,
          },
        });
      } else {
        lineQuantity = asset.kind === "bulk" ? amount : 1;
        await tx.inventoryCheckoutLine.create({
          data: { checkoutId, assetId, quantity: lineQuantity },
        });
      }
      await recordEvent(tx, {
        assetId,
        type: "checkout",
        message: `Ausgegeben: ${checkout.title}${asset.kind === "bulk" ? ` (${amount})` : ""}`,
        data: { checkoutId, quantity: amount },
        userId,
      });
      await tx.inventoryAsset.update({ where: { id: assetId }, data: { lastSeenAt: new Date() } });
      await refreshAssetStatus(tx, assetId, { seen: true });
      return { assetId, code: asset.code, name: asset.name, quantity: lineQuantity, warning };
    });
    revalidateInventory(checkoutPath(checkoutId), inventoryAssetPath(outcome.code));
    return { ok: true, data: outcome };
  } catch (error) {
    console.error("addToCheckoutAction", error);
    return failure(error, "Konnte nicht ausgegeben werden.");
  }
}

/** Rücknahme per Scan: findet die offene Ausgabe des Objekts selbst. */
export async function returnAssetAction(
  assetId: string,
  quantity?: number,
  checkoutId?: string,
): Promise<
  InventoryActionResult<{ code: string; name: string; checkoutTitle: string; open: number }>
> {
  try {
    const { userId } = await requireInventoryAccess("use");
    const result = await prisma.$transaction(async (tx) => {
      const lines = await tx.inventoryCheckoutLine.findMany({
        where: {
          assetId,
          checkout: { status: "open" },
          ...(checkoutId ? { checkoutId } : {}),
        },
        orderBy: { checkedOutAt: "asc" },
        select: {
          id: true,
          quantity: true,
          returnedQuantity: true,
          checkout: { select: { id: true, title: true } },
          asset: { select: { code: true, name: true, kind: true } },
        },
      });
      const line = lines.find((entry) => entry.returnedQuantity < entry.quantity);
      if (!line) throw new Error("Dieses Objekt ist nicht ausgegeben.");
      const outstanding = line.quantity - line.returnedQuantity;
      const amount =
        line.asset.kind === "bulk"
          ? Math.min(outstanding, Math.max(1, quantity ?? outstanding))
          : 1;
      const returned = line.returnedQuantity + amount;
      await tx.inventoryCheckoutLine.update({
        where: { id: line.id },
        data: {
          returnedQuantity: returned,
          returnedAt: returned >= line.quantity ? new Date() : null,
        },
      });
      await recordEvent(tx, {
        assetId,
        type: "return",
        message: `Zurück aus: ${line.checkout.title}${line.asset.kind === "bulk" ? ` (${amount})` : ""}`,
        data: { checkoutId: line.checkout.id, quantity: amount },
        userId,
      });
      await tx.inventoryAsset.update({ where: { id: assetId }, data: { lastSeenAt: new Date() } });
      await refreshAssetStatus(tx, assetId, { seen: true });
      return {
        code: line.asset.code,
        name: line.asset.name,
        checkoutTitle: line.checkout.title,
        checkoutId: line.checkout.id,
        open: line.quantity - returned,
      };
    });
    revalidateInventory(checkoutPath(result.checkoutId), inventoryAssetPath(result.code));
    return {
      ok: true,
      message: `${result.code} zurück`,
      data: {
        code: result.code,
        name: result.name,
        checkoutTitle: result.checkoutTitle,
        open: result.open,
      },
    };
  } catch (error) {
    console.error("returnAssetAction", error);
    return failure(error, "Rücknahme fehlgeschlagen.");
  }
}

/** Zeile von der Packliste nehmen (falsch gescannt). */
export async function removeCheckoutLineAction(lineId: string): Promise<InventoryActionResult> {
  try {
    const { userId } = await requireInventoryAccess("use");
    const line = await prisma.$transaction(async (tx) => {
      const line = await tx.inventoryCheckoutLine.delete({
        where: { id: lineId },
        select: { assetId: true, checkoutId: true, checkout: { select: { title: true } } },
      });
      await recordEvent(tx, {
        assetId: line.assetId,
        type: "checkout",
        message: `Von Ausgabe entfernt: ${line.checkout.title}`,
        userId,
      });
      await refreshAssetStatus(tx, line.assetId);
      return line;
    });
    revalidateInventory(checkoutPath(line.checkoutId));
    return { ok: true, message: "Entfernt." };
  } catch (error) {
    console.error("removeCheckoutLineAction", error);
    return failure(error, "Konnte nicht entfernt werden.");
  }
}

/**
 * Ausgabe abschließen. Mit `markMissing` gilt alles, was nicht zurück ist, als vermisst –
 * sonst lässt sich nur eine vollständig zurückgegebene Ausgabe schließen.
 */
export async function closeCheckoutAction(
  id: string,
  markMissing = false,
): Promise<InventoryActionResult> {
  try {
    const { userId } = await requireInventoryAccess("use");
    await prisma.$transaction(async (tx) => {
      const checkout = await tx.inventoryCheckout.findUnique({
        where: { id },
        select: {
          title: true,
          lines: { select: { assetId: true, quantity: true, returnedQuantity: true } },
        },
      });
      if (!checkout) throw new Error("Ausgabe nicht gefunden.");
      const open = checkout.lines.filter((line) => line.returnedQuantity < line.quantity);
      if (open.length && !markMissing) {
        throw new Error(`${open.length} Positionen sind noch nicht zurück.`);
      }
      await tx.inventoryCheckout.update({
        where: { id },
        data: { status: "closed", closedAt: new Date() },
      });
      for (const line of checkout.lines) {
        const missing = line.returnedQuantity < line.quantity;
        if (missing) {
          await tx.inventoryAsset.update({
            where: { id: line.assetId },
            data: { status: "missing" },
          });
          await recordEvent(tx, {
            assetId: line.assetId,
            type: "status",
            message: `Nicht zurückgekommen aus: ${checkout.title}`,
            userId,
          });
        }
        await refreshAssetStatus(tx, line.assetId);
      }
    });
    revalidateInventory(checkoutPath(id));
    return { ok: true, message: "Ausgabe abgeschlossen." };
  } catch (error) {
    console.error("closeCheckoutAction", error);
    return failure(error, "Ausgabe konnte nicht abgeschlossen werden.");
  }
}

export async function reopenCheckoutAction(id: string): Promise<InventoryActionResult> {
  try {
    await requireInventoryAccess("use");
    const checkout = await prisma.inventoryCheckout.update({
      where: { id },
      data: { status: "open", closedAt: null },
      select: { lines: { select: { assetId: true } } },
    });
    await prisma.$transaction(async (tx) => {
      for (const line of checkout.lines) await refreshAssetStatus(tx, line.assetId);
    });
    revalidateInventory(checkoutPath(id));
    return { ok: true, message: "Wieder geöffnet." };
  } catch (error) {
    console.error("reopenCheckoutAction", error);
    return failure(error, "Konnte nicht geöffnet werden.");
  }
}
