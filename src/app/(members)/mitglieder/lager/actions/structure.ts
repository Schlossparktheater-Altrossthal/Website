"use server";

import { z } from "zod";

import {
  failure,
  optionalId,
  optionalText,
  revalidateInventory,
  type InventoryActionResult,
} from "@/lib/inventory/actions-helpers";
import { LOCATION_CODE_PREFIX } from "@/lib/inventory/constants";
import { allocateLocationCode, requireInventoryAccess } from "@/lib/inventory/service";
import { createPublicId } from "@/lib/inventory/public-id";
import { prisma } from "@/lib/prisma";

const locationSchema = z.object({
  name: z.string().trim().min(1, "Bitte einen Namen angeben.").max(120),
  description: optionalText(500),
  parentId: optionalId,
});

async function assertNoLocationCycle(id: string, parentId: string | null) {
  let current = parentId;
  const seen = new Set<string>();
  while (current) {
    if (current === id) throw new Error("Ein Ort kann nicht in sich selbst liegen.");
    if (seen.has(current)) break;
    seen.add(current);
    const parent = await prisma.inventoryLocation.findUnique({
      where: { id: current },
      select: { parentId: true },
    });
    current = parent?.parentId ?? null;
  }
}

export async function createLocationAction(
  input: z.input<typeof locationSchema>,
): Promise<InventoryActionResult<{ id: string; code: string }>> {
  try {
    await requireInventoryAccess("manage");
    const data = locationSchema.parse(input);
    const location = await prisma.$transaction(async (tx) => {
      const code = await allocateLocationCode(tx);
      const siblings = await tx.inventoryLocation.count({ where: { parentId: data.parentId } });
      return tx.inventoryLocation.create({
        data: { ...data, code, publicId: createPublicId(), sortOrder: siblings },
        select: { id: true, code: true },
      });
    });
    revalidateInventory();
    return { ok: true, message: `${location.code} angelegt.`, data: location };
  } catch (error) {
    console.error("createLocationAction", error);
    return failure(error, "Lagerort konnte nicht angelegt werden.");
  }
}

export async function updateLocationAction(
  id: string,
  input: z.input<typeof locationSchema>,
): Promise<InventoryActionResult> {
  try {
    await requireInventoryAccess("manage");
    const data = locationSchema.parse(input);
    await assertNoLocationCycle(id, data.parentId);
    await prisma.inventoryLocation.update({ where: { id }, data });
    revalidateInventory();
    return { ok: true, message: "Gespeichert." };
  } catch (error) {
    console.error("updateLocationAction", error);
    return failure(error, "Lagerort konnte nicht gespeichert werden.");
  }
}

export async function deleteLocationAction(id: string): Promise<InventoryActionResult> {
  try {
    await requireInventoryAccess("manage");
    const location = await prisma.inventoryLocation.findUnique({
      where: { id },
      select: {
        _count: { select: { children: true, assets: true, stocks: true } },
      },
    });
    if (!location) throw new Error("Lagerort nicht gefunden.");
    const { children, assets, stocks } = location._count;
    if (children || assets || stocks) {
      throw new Error("Der Ort ist nicht leer – bitte zuerst Inhalt und Unterorte verschieben.");
    }
    await prisma.inventoryLocation.delete({ where: { id } });
    revalidateInventory();
    return { ok: true, message: "Lagerort gelöscht." };
  } catch (error) {
    console.error("deleteLocationAction", error);
    return failure(error, "Lagerort konnte nicht gelöscht werden.");
  }
}

const areaSchema = z.object({
  name: z.string().trim().min(1, "Bitte einen Namen angeben.").max(60),
  prefix: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{1,3}$/, "Kürzel: 1–3 Buchstaben.")
    .refine((value) => value !== LOCATION_CODE_PREFIX, "„L“ ist für Lagerorte reserviert."),
  description: optionalText(300),
  inspectionDefault: z.boolean().default(false),
});

export async function saveAreaAction(
  id: string | null,
  input: z.input<typeof areaSchema>,
): Promise<InventoryActionResult> {
  try {
    await requireInventoryAccess("manage");
    const data = areaSchema.parse(input);
    if (id) {
      const existing = await prisma.inventoryArea.findUnique({
        where: { id },
        select: { prefix: true, _count: { select: { assets: true } } },
      });
      if (!existing) throw new Error("Bereich nicht gefunden.");
      if (existing.prefix !== data.prefix && existing._count.assets > 0) {
        throw new Error("Das Kürzel steht schon auf Labels und lässt sich nicht mehr ändern.");
      }
      await prisma.inventoryArea.update({ where: { id }, data });
    } else {
      const count = await prisma.inventoryArea.count();
      await prisma.inventoryArea.create({ data: { ...data, sortOrder: count } });
    }
    revalidateInventory();
    return { ok: true, message: "Bereich gespeichert." };
  } catch (error) {
    if (error instanceof Error && error.message.includes("Unique constraint")) {
      return { ok: false, error: "Dieses Kürzel ist schon vergeben." };
    }
    console.error("saveAreaAction", error);
    return failure(error, "Bereich konnte nicht gespeichert werden.");
  }
}
