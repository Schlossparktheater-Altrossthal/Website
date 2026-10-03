import type { Prisma, PrismaClient } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import {
  categoryPath,
  effectiveFields,
  type FieldDef,
  type FieldType,
} from "@/lib/inventory/specs";

type Db = PrismaClient | Prisma.TransactionClient;

const FIELD_SELECT = {
  key: true,
  label: true,
  type: true,
  unit: true,
  options: true,
  placeholder: true,
  required: true,
} as const;

function toFieldDef(row: {
  key: string;
  label: string;
  type: string;
  unit: string | null;
  options: string[];
  placeholder: string | null;
  required: boolean;
}): FieldDef {
  return { ...row, type: row.type as FieldType };
}

/** Wirksame Merkmale für Bereich + Kategorie (mit allen Elternkategorien). */
export async function loadEffectiveFields(
  db: Db,
  areaId: string,
  categoryId: string | null,
): Promise<FieldDef[]> {
  const [areaFields, categories] = await Promise.all([
    db.inventoryFieldDef.findMany({
      where: { areaId },
      orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
      select: FIELD_SELECT,
    }),
    categoryId
      ? db.inventoryCategory.findMany({
          where: { areaId },
          select: { id: true, parentId: true, name: true },
        })
      : Promise.resolve([]),
  ]);
  const path = categoryPath(categories, categoryId);
  const pathFields = path.length
    ? await db.inventoryFieldDef.findMany({
        where: { categoryId: { in: path.map((category) => category.id) } },
        orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
        select: { ...FIELD_SELECT, categoryId: true },
      })
    : [];
  return effectiveFields(
    areaFields.map(toFieldDef),
    path.map((category) =>
      pathFields.filter((field) => field.categoryId === category.id).map(toFieldDef),
    ),
  );
}

/**
 * Katalog für Formulare: Bereiche mit Kategorienbaum und Merkmalen. Wirksame Merkmale je
 * Kategorie berechnet der Client mit `effectiveFields`.
 */
export async function loadInventoryCatalog(db: Db = prisma) {
  const areas = await db.inventoryArea.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      prefix: true,
      inspectionDefault: true,
      fields: { orderBy: [{ sortOrder: "asc" }, { label: "asc" }], select: FIELD_SELECT },
      categories: {
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        select: {
          id: true,
          parentId: true,
          name: true,
          fields: { orderBy: [{ sortOrder: "asc" }, { label: "asc" }], select: FIELD_SELECT },
        },
      },
    },
  });
  return areas.map((area) => ({
    ...area,
    fields: area.fields.map(toFieldDef),
    categories: area.categories.map((category) => ({
      ...category,
      fields: category.fields.map(toFieldDef),
    })),
  }));
}

export type InventoryCatalog = Awaited<ReturnType<typeof loadInventoryCatalog>>;
export type InventoryCatalogArea = InventoryCatalog[number];

/** Katalogpflege: wie `loadInventoryCatalog`, zusätzlich Feld-IDs und Artikelzahlen. */
export async function loadCatalogForEditing(db: Db = prisma) {
  const areas = await db.inventoryArea.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      prefix: true,
      fields: {
        orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
        select: { id: true, ...FIELD_SELECT },
      },
      categories: {
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        select: {
          id: true,
          parentId: true,
          name: true,
          fields: {
            orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
            select: { id: true, ...FIELD_SELECT },
          },
          _count: { select: { products: true } },
        },
      },
    },
  });
  return areas.map((area) => ({
    id: area.id,
    name: area.name,
    prefix: area.prefix,
    fields: area.fields.map((field) => ({ ...toFieldDef(field), id: field.id })),
    categories: area.categories.map((category) => ({
      id: category.id,
      parentId: category.parentId,
      name: category.name,
      productCount: category._count.products,
      fields: category.fields.map((field) => ({ ...toFieldDef(field), id: field.id })),
    })),
  }));
}
