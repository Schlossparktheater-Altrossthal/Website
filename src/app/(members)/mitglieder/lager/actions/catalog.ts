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
import {
  DIMENSION_UNITS,
  FIELD_TYPES,
  fieldKeyFromLabel,
  hasOptions,
  MAX_CATEGORY_DEPTH,
  MEASURE_UNITS,
} from "@/lib/inventory/specs";
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

/** Ebene einer Kategorie (Hauptkategorie = 1) und Tiefe ihres Unterbaums (nur sie = 1). */
async function categoryDepths(areaId: string, id: string | null, parentId: string | null) {
  const categories = await prisma.inventoryCategory.findMany({
    where: { areaId },
    select: { id: true, parentId: true },
  });
  const byId = new Map(categories.map((category) => [category.id, category]));
  let parentLevel = 0;
  for (let current = parentId; current && parentLevel <= MAX_CATEGORY_DEPTH; parentLevel += 1) {
    current = byId.get(current)?.parentId ?? null;
  }
  const height = (nodeId: string): number =>
    1 +
    Math.max(
      0,
      ...categories.filter((entry) => entry.parentId === nodeId).map((entry) => height(entry.id)),
    );
  return parentLevel + (id ? height(id) : 1);
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
    if (id) await assertNoCategoryCycle(id, data.parentId);
    if ((await categoryDepths(areaId, id, data.parentId)) > MAX_CATEGORY_DEPTH) {
      throw new Error(`Kategorien können höchstens ${MAX_CATEGORY_DEPTH} Ebenen tief sein.`);
    }

    let category;
    if (id) {
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
  .refine((field) => !hasOptions(field.type) || field.options.length >= 2, {
    message: "Eine Auswahl braucht mindestens zwei Werte.",
    path: ["options"],
  })
  .refine(
    (field) =>
      field.type !== "measure" || (MEASURE_UNITS as readonly string[]).includes(field.unit ?? ""),
    { message: "Bitte eine Einheit für den Messwert wählen.", path: ["unit"] },
  )
  .transform((field) =>
    field.type === "dimensions"
      ? {
          ...field,
          unit: (DIMENSION_UNITS as readonly string[]).includes(field.unit ?? "")
            ? field.unit
            : "cm",
        }
      : field,
  );

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
    const options = hasOptions(data.type) ? [...new Set(data.options)] : [];
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

const overrideSchema = z.object({
  hidden: z.boolean(),
  required: z.boolean().nullable(),
});

/**
 * Ausnahme für ein geerbtes Merkmal ab einer Kategorie setzen (ausblenden, Pflicht ändern).
 * Ohne Abweichung wird die Ausnahme entfernt.
 */
export async function setFieldOverrideAction(
  categoryId: string,
  key: string,
  input: z.input<typeof overrideSchema>,
): Promise<InventoryActionResult> {
  try {
    await requireInventoryAccess("catalog");
    const data = overrideSchema.parse(input);
    const category = await prisma.inventoryCategory.findUniqueOrThrow({
      where: { id: categoryId },
      select: { areaId: true, parentId: true },
    });
    const field = await prisma.inventoryFieldDef.findFirst({
      where: { key, OR: [{ areaId: category.areaId }, { category: { areaId: category.areaId } }] },
      select: { id: true },
    });
    if (!field) throw new Error("Merkmal nicht gefunden.");
    // Ausblenden ist der Normalfall der Ausnahme; „sichtbar“ ohne Pflichtänderung braucht es nur,
    // wenn eine Oberkategorie das Merkmal ausgeblendet hat.
    const hiddenAbove = category.parentId ? await isHiddenAbove(category.parentId, key) : false;
    if (data.hidden === hiddenAbove && data.required === null) {
      await prisma.inventoryCategoryFieldOverride.deleteMany({ where: { categoryId, key } });
    } else {
      await prisma.inventoryCategoryFieldOverride.upsert({
        where: { categoryId_key: { categoryId, key } },
        create: { categoryId, key, ...data },
        update: data,
      });
    }
    revalidateInventory(CATALOG_PATH);
    return {
      ok: true,
      message: data.hidden ? "Merkmal hier ausgeblendet." : "Merkmal angepasst.",
    };
  } catch (error) {
    console.error("setFieldOverrideAction", error);
    return failure(error, "Ausnahme konnte nicht gespeichert werden.");
  }
}

/** Ob ein Merkmal in einer Kategorie (über ihre eigenen Ausnahmen und Eltern) ausgeblendet ist. */
async function isHiddenAbove(categoryId: string, key: string): Promise<boolean> {
  for (let current: string | null = categoryId, depth = 0; current && depth < 10; depth += 1) {
    const category: {
      parentId: string | null;
      overrides: { hidden: boolean }[];
      fields: { id: string }[];
    } | null = await prisma.inventoryCategory.findUnique({
      where: { id: current },
      select: {
        parentId: true,
        overrides: { where: { key }, select: { hidden: true } },
        fields: { where: { key }, select: { id: true } },
      },
    });
    if (!category) return false;
    if (category.overrides[0]) return category.overrides[0].hidden;
    if (category.fields.length) return false;
    current = category.parentId;
  }
  return false;
}
