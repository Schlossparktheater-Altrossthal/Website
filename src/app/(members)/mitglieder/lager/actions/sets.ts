"use server";

import type { Prisma } from "@prisma/client";
import { z } from "zod";

import {
  failure,
  revalidateInventory,
  type InventoryActionResult,
} from "@/lib/inventory/actions-helpers";
import { createProductInTx, productSchema } from "@/lib/inventory/asset-write";
import { inventoryProductPath } from "@/lib/inventory/constants";
import { requireInventoryAccess } from "@/lib/inventory/service";
import { prisma } from "@/lib/prisma";

/** Sets aus Artikeltypen (docs/Plan/lager-typen-projekte-plan.md, Phase 8). */

const componentsSchema = z
  .array(
    z.object({
      productId: z.string().min(1),
      quantity: z.coerce.number().int().min(1).max(1000),
    }),
  )
  .min(1, "Ein Set braucht mindestens einen Bestandteil.")
  .max(50);

type Components = z.infer<typeof componentsSchema>;

async function writeComponents(
  tx: Prisma.TransactionClient,
  setId: string,
  components: Components,
) {
  const merged = new Map<string, number>();
  for (const entry of components) {
    if (entry.productId === setId) throw new Error("Ein Set kann sich nicht selbst enthalten.");
    merged.set(entry.productId, (merged.get(entry.productId) ?? 0) + entry.quantity);
  }
  const products = await tx.inventoryProduct.findMany({
    where: { id: { in: [...merged.keys()] } },
    select: { id: true, kind: true, name: true },
  });
  if (products.length !== merged.size) throw new Error("Ein Bestandteil existiert nicht mehr.");
  const nested = products.find((product) => product.kind === "set");
  if (nested)
    throw new Error(`„${nested.name}“ ist selbst ein Set – bitte die Teile einzeln wählen.`);
  await tx.inventoryProductComponent.deleteMany({ where: { setId } });
  await tx.inventoryProductComponent.createMany({
    data: [...merged.entries()].map(([componentId, quantity], sortOrder) => ({
      setId,
      componentId,
      quantity,
      sortOrder,
    })),
  });
}

export async function createSetAction(raw: {
  product: unknown;
  components: unknown;
}): Promise<InventoryActionResult<{ publicId: string }>> {
  try {
    await requireInventoryAccess("use");
    const product = productSchema.parse({ ...(raw.product as object), kind: "set" });
    const components = componentsSchema.parse(raw.components);
    const created = await prisma.$transaction(async (tx) => {
      const set = await createProductInTx(tx, product);
      await writeComponents(tx, set.id, components);
      return tx.inventoryProduct.findUniqueOrThrow({
        where: { id: set.id },
        select: { publicId: true },
      });
    });
    revalidateInventory();
    return { ok: true, message: "Set angelegt.", data: created };
  } catch (error) {
    console.error("createSetAction", error);
    return failure(error, "Set konnte nicht angelegt werden.");
  }
}

export async function updateSetComponentsAction(
  setId: string,
  raw: unknown,
): Promise<InventoryActionResult> {
  try {
    await requireInventoryAccess("use");
    const components = componentsSchema.parse(raw);
    const set = await prisma.inventoryProduct.findUniqueOrThrow({
      where: { id: setId },
      select: { kind: true, publicId: true },
    });
    if (set.kind !== "set") throw new Error("Das ist kein Set.");
    await prisma.$transaction((tx) => writeComponents(tx, setId, components));
    revalidateInventory(inventoryProductPath(set.publicId));
    return { ok: true, message: "Bestandteile gespeichert." };
  } catch (error) {
    console.error("updateSetComponentsAction", error);
    return failure(error, "Bestandteile konnten nicht gespeichert werden.");
  }
}
