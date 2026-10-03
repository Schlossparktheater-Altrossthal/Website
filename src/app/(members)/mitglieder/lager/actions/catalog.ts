"use server";

import { z } from "zod";

import {
  failure,
  optionalText,
  revalidateInventory,
  type InventoryActionResult,
} from "@/lib/inventory/actions-helpers";
import { INVENTORY_BASE_PATH } from "@/lib/inventory/constants";
import { requireInventoryAccess } from "@/lib/inventory/service";
import { FIELD_TYPES, fieldKeyFromLabel } from "@/lib/inventory/specs";
import { prisma } from "@/lib/prisma";

/** Katalogpflege: Kategorienbaum und Merkmale (docs/Plan/lager-typen-projekte-plan.md, Phase 5). */

const CATALOG_PATH = `${INVENTORY_BASE_PATH}/katalog`;

const categorySchema = z.object({
  name: z.string().trim().min(1, "Bitte einen Namen angeben.").max(60),
  parentId: z.string().trim().min(1).nullable().default(null),
});

/** Prüft, dass eine Kategorie nicht unter sich selbst oder ihre Unterkategorien gehängt wird. */
async function assertNoCategoryCycle(id: string, parentId: string | null) {
  let current = parentId;
  const seen = new Set<string>();
  while (current) {
    if (current === id) throw new Error("Eine Kategorie kann nicht unter sich selbst liegen.");
    if (seen.has(current)) break;
    seen.add(current);
    const parent: { parentId: string | null } | null = await prisma.inventoryCategory.findUnique({
      where: { id: current },
      select: { parentId: true },
    });
    current = parent?.parentId ?? null;
  }
}

export async function saveCategoryAction(
  areaId: string,
  id: string | null,
  input: z.input<typeof categorySchema>,
): Promise<InventoryActionResult<{ id: string }>> {
  try {
    await requireInventoryAccess("catalog");
    const data = categorySchema.parse(input);
    if (data.parentId) {
      const parent = await prisma.inventoryCategory.findUnique({
        where: { id: data.parentId },
        select: { areaId: true },
      });
      if (!parent || parent.areaId !== areaId) {
        throw new Error("Die Oberkategorie gehört zu einem anderen Bereich.");
      }
    }
    // Postgres behandelt NULL im Unique-Index als verschieden – Geschwister selbst prüfen.
    const sibling = await prisma.inventoryCategory.findFirst({
      where: {
        areaId,
        parentId: data.parentId,
        name: { equals: data.name, mode: "insensitive" },
        ...(id ? { id: { not: id } } : {}),
      },
      select: { id: true },
    });
    if (sibling) throw new Error(`„${data.name}“ gibt es auf dieser Ebene schon.`);

    let category;
    if (id) {
      await assertNoCategoryCycle(id, data.parentId);
      category = await prisma.inventoryCategory.update({
        where: { id },
        data,
        select: { id: true },
      });
    } else {
      const count = await prisma.inventoryCategory.count({
        where: { areaId, parentId: data.parentId },
      });
      category = await prisma.inventoryCategory.create({
        data: { areaId, ...data, sortOrder: count },
        select: { id: true },
      });
    }
    revalidateInventory(CATALOG_PATH);
    return { ok: true, message: "Kategorie gespeichert.", data: category };
  } catch (error) {
    console.error("saveCategoryAction", error);
    return failure(error, "Kategorie konnte nicht gespeichert werden.");
  }
}

export async function deleteCategoryAction(id: string): Promise<InventoryActionResult> {
  try {
    await requireInventoryAccess("catalog");
    const category = await prisma.inventoryCategory.findUnique({
      where: { id },
      select: { _count: { select: { children: true, products: true } } },
    });
    if (!category) throw new Error("Kategorie nicht gefunden.");
    if (category._count.children) {
      throw new Error("Die Kategorie hat Unterkategorien – bitte zuerst diese löschen.");
    }
    if (category._count.products) {
      throw new Error(
        `${category._count.products} Artikel nutzen diese Kategorie – bitte zuerst umsortieren.`,
      );
    }
    await prisma.inventoryCategory.delete({ where: { id } });
    revalidateInventory(CATALOG_PATH);
    return { ok: true, message: "Kategorie gelöscht." };
  } catch (error) {
    console.error("deleteCategoryAction", error);
    return failure(error, "Kategorie konnte nicht gelöscht werden.");
  }
}

const fieldSchema = z
  .object({
    label: z.string().trim().min(1, "Bitte eine Bezeichnung angeben.").max(60),
    type: z.enum(FIELD_TYPES),
    unit: optionalText(20),
    placeholder: optionalText(80),
    required: z.boolean().default(false),
    options: z.array(z.string().trim().min(1).max(60)).max(40).default([]),
  })
  .refine((field) => field.type !== "select" || field.options.length >= 2, {
    message: "Eine Auswahl braucht mindestens zwei Werte.",
    path: ["options"],
  });

export type FieldTarget = { type: "area"; id: string } | { type: "category"; id: string };

/** Alle Schlüssel, die für eine Ebene schon gelten (Bereich, Eltern, eigene, Unterkategorien). */
async function keysInScope(target: FieldTarget): Promise<Map<string, string>> {
  const areaId =
    target.type === "area"
      ? target.id
      : (
          await prisma.inventoryCategory.findUniqueOrThrow({
            where: { id: target.id },
            select: { areaId: true },
          })
        ).areaId;
  const fields = await prisma.inventoryFieldDef.findMany({
    where: { OR: [{ areaId }, { category: { areaId } }] },
    select: { id: true, key: true },
  });
  return new Map(fields.map((field) => [field.key, field.id]));
}

export async function saveFieldAction(
  target: FieldTarget,
  id: string | null,
  input: z.input<typeof fieldSchema>,
): Promise<InventoryActionResult> {
  try {
    await requireInventoryAccess("catalog");
    const data = fieldSchema.parse(input);
    const options = data.type === "select" ? [...new Set(data.options)] : [];
    if (id) {
      // Der Schlüssel bleibt fest – gespeicherte Werte hängen daran.
      await prisma.inventoryFieldDef.update({
        where: { id },
        data: { ...data, options },
      });
    } else {
      const taken = await keysInScope(target);
      const base = fieldKeyFromLabel(data.label);
      let key = base;
      for (let index = 2; taken.has(key); index += 1) key = `${base}${index}`;
      const count = await prisma.inventoryFieldDef.count({
        where: target.type === "area" ? { areaId: target.id } : { categoryId: target.id },
      });
      await prisma.inventoryFieldDef.create({
        data: {
          ...data,
          options,
          key,
          sortOrder: count,
          ...(target.type === "area" ? { areaId: target.id } : { categoryId: target.id }),
        },
      });
    }
    revalidateInventory(CATALOG_PATH);
    return { ok: true, message: "Merkmal gespeichert." };
  } catch (error) {
    console.error("saveFieldAction", error);
    return failure(error, "Merkmal konnte nicht gespeichert werden.");
  }
}

/** Löscht ein Merkmal. Gespeicherte Werte bleiben im Artikel, werden aber nicht mehr angezeigt. */
export async function deleteFieldAction(id: string): Promise<InventoryActionResult> {
  try {
    await requireInventoryAccess("catalog");
    await prisma.inventoryFieldDef.delete({ where: { id } });
    revalidateInventory(CATALOG_PATH);
    return { ok: true, message: "Merkmal gelöscht." };
  } catch (error) {
    console.error("deleteFieldAction", error);
    return failure(error, "Merkmal konnte nicht gelöscht werden.");
  }
}

export async function moveFieldAction(
  id: string,
  direction: "up" | "down",
): Promise<InventoryActionResult> {
  try {
    await requireInventoryAccess("catalog");
    const field = await prisma.inventoryFieldDef.findUniqueOrThrow({
      where: { id },
      select: { areaId: true, categoryId: true },
    });
    const siblings = await prisma.inventoryFieldDef.findMany({
      where: field.areaId ? { areaId: field.areaId } : { categoryId: field.categoryId },
      orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
      select: { id: true },
    });
    const index = siblings.findIndex((entry) => entry.id === id);
    const target = direction === "up" ? index - 1 : index + 1;
    if (index < 0 || target < 0 || target >= siblings.length) return { ok: true };
    const order = siblings.map((entry) => entry.id);
    [order[index], order[target]] = [order[target]!, order[index]!];
    await prisma.$transaction(
      order.map((fieldId, sortOrder) =>
        prisma.inventoryFieldDef.update({ where: { id: fieldId }, data: { sortOrder } }),
      ),
    );
    revalidateInventory(CATALOG_PATH);
    return { ok: true };
  } catch (error) {
    console.error("moveFieldAction", error);
    return failure(error, "Reihenfolge konnte nicht geändert werden.");
  }
}
