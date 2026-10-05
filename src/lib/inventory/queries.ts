import type { Prisma } from "@prisma/client";

import {
  INSPECTION_SOON_DAYS,
  inspectionState,
  assetDisplayName,
  type AssetKind,
  type ProductKind,
  type AssetStatus,
  type Condition,
  type InspectionState,
} from "@/lib/inventory/constants";
import {
  buildLocationLabeler,
  loadLocationLabeler,
  locationSubtreeIds,
} from "@/lib/inventory/service";
import { loadEffectiveFields } from "@/lib/inventory/catalog";
import { loadAvailability } from "@/lib/inventory/projects";
import { ASSET_CODE_ORDER, ASSET_NAME_SELECT, assetCodeOrder } from "@/lib/inventory/selects";
import type { FitsFilter, SpecCondition } from "@/lib/inventory/spec-filters";
import { categoryPathLabel, describeSpecs, readSpecs } from "@/lib/inventory/specs";
import { prisma } from "@/lib/prisma";

export const INVENTORY_PAGE_SIZE = 50;

export type InventoryListFilter = {
  query?: string;
  areaId?: string;
  /** Kategorie inklusive aller Unterkategorien. */
  categoryId?: string;
  /** Nur Exemplare eines Artikeltyps. */
  productId?: string;
  locationId?: string;
  /** Besondere Sichten der Übersicht. */
  view?:
    "all" | "defects" | "inspection" | "checked_out" | "missing" | "unlabeled" | "low" | "retired";
  page?: number;
  /** Tabellenansicht: Sortierung und größere Seiten. */
  sort?: InventorySort;
  pageSize?: number;
  /** Alle diese Tags (Groß-/Kleinschreibung egal). */
  tags?: string[];
  /** Merkmal-Bedingungen, Werte in Basiseinheiten. */
  specs?: SpecCondition[];
  /** Maße passen in diese Größe (Drehen erlaubt). */
  fits?: FitsFilter | null;
};

/** Merkmalschlüssel aller Maß-Merkmale – „passt in“ prüft jedes davon. */
async function dimensionKeys(): Promise<string[]> {
  const fields = await prisma.inventoryFieldDef.findMany({
    where: { type: "dimensions" },
    select: { key: true },
    distinct: ["key"],
  });
  return fields.map((field) => field.key);
}

/** Bedingungen an den Artikeltyp aus Tags, Merkmalen und „passt in“. */
function productConditions(
  filter: InventoryListFilter,
  dimsKeys: readonly string[],
): Prisma.InventoryProductWhereInput[] {
  const and: Prisma.InventoryProductWhereInput[] = [];
  for (const tag of filter.tags ?? []) {
    and.push({ tags: { some: { name: { equals: tag, mode: "insensitive" } } } });
  }
  for (const condition of filter.specs ?? []) {
    const path = [condition.key];
    switch (condition.op) {
      case "gte":
        and.push({ specs: { path, gte: condition.value } });
        break;
      case "lte":
        and.push({ specs: { path, lte: condition.value } });
        break;
      case "equals":
        and.push({ specs: { path, equals: condition.value } });
        break;
      case "contains":
        and.push({ specs: { path, string_contains: condition.value } });
        break;
      case "has":
        and.push({ specs: { path, array_contains: [condition.value] } });
        break;
    }
  }
  if (filter.fits) {
    const { min, mid, max } = filter.fits;
    and.push({
      OR: dimsKeys.length
        ? dimsKeys.map((key) => ({
            AND: [
              { specs: { path: [key, "min"], lte: min } },
              { specs: { path: [key, "mid"], lte: mid } },
              { specs: { path: [key, "max"], lte: max } },
            ],
          }))
        : [{ id: "__keine-masse__" }],
    });
  }
  return and;
}

export const INVENTORY_SORT_KEYS = [
  "code",
  "name",
  "area",
  "category",
  "condition",
  "status",
  "inspection",
  "updated",
] as const;
export type InventorySortKey = (typeof INVENTORY_SORT_KEYS)[number];
export type InventorySort = { key: InventorySortKey; dir: "asc" | "desc" };

/** Liest `?sortierung=name` bzw. `-name` (absteigend). */
export function parseInventorySort(value: string | undefined): InventorySort | undefined {
  if (!value) return undefined;
  const dir = value.startsWith("-") ? "desc" : "asc";
  const key = value.replace(/^-/, "");
  return INVENTORY_SORT_KEYS.some((entry) => entry === key)
    ? { key: key as InventorySortKey, dir }
    : undefined;
}

function sortOrder(sort: InventorySort): Prisma.InventoryAssetOrderByWithRelationInput[] {
  const { dir } = sort;
  const nulls = dir === "asc" ? "last" : "first";
  switch (sort.key) {
    case "code":
      return [...assetCodeOrder(dir)];
    case "name":
      return [{ product: { name: dir } }, ...ASSET_CODE_ORDER];
    case "area":
      return [{ area: { sortOrder: dir } }, ...ASSET_CODE_ORDER];
    case "category":
      return [{ product: { category: { name: dir } } }, { product: { name: "asc" } }];
    case "condition":
      return [{ condition: dir }, { product: { name: "asc" } }];
    case "status":
      return [{ status: dir }, { product: { name: "asc" } }];
    case "inspection":
      return [{ nextInspectionAt: { sort: dir, nulls } }, ...ASSET_CODE_ORDER];
    case "updated":
      return [{ updatedAt: dir }];
  }
}

export type InventoryListItem = {
  id: string;
  code: string;
  name: string;
  kind: AssetKind;
  status: AssetStatus;
  areaName: string;
  areaPrefix: string;
  categoryName: string | null;
  place: string | null;
  quantity: number;
  unit: string | null;
  productId: string;
  productPublicId: string;
  photoId: string | null;
  openDefects: number;
  inspection: InspectionState;
  labelPrinted: boolean;
  areaId: string;
  categoryId: string | null;
  condition: Condition;
  nextInspectionAt: Date | null;
};

/** Mengenartikel unter Mindestbestand (Spaltenvergleich, daher in JS). */
export async function lowStockAssetIds(): Promise<string[]> {
  const candidates = await prisma.inventoryAsset.findMany({
    where: { kind: "bulk", product: { minQuantity: { not: null } }, status: { not: "retired" } },
    select: { id: true, quantity: true, product: { select: { minQuantity: true } } },
  });
  return candidates
    .filter(
      (asset) => asset.product.minQuantity !== null && asset.quantity < asset.product.minQuantity,
    )
    .map((asset) => asset.id);
}

/** Kategorie samt aller Unterkategorien. */
export async function categorySubtreeIds(categoryId: string): Promise<string[]> {
  const category = await prisma.inventoryCategory.findUnique({
    where: { id: categoryId },
    select: { areaId: true },
  });
  if (!category) return [categoryId];
  const all = await prisma.inventoryCategory.findMany({
    where: { areaId: category.areaId },
    select: { id: true, parentId: true },
  });
  const result = [categoryId];
  for (let index = 0; index < result.length; index += 1) {
    for (const entry of all) {
      if (entry.parentId === result[index] && !result.includes(entry.id)) result.push(entry.id);
    }
  }
  return result;
}

function buildWhere(
  filter: InventoryListFilter & { categoryIds?: string[]; dimsKeys?: string[] },
  locationIds: string[] | null,
  lowIds: string[] | null = null,
): Prisma.InventoryAssetWhereInput {
  const and: Prisma.InventoryAssetWhereInput[] = [];
  const productAnd = productConditions(filter, filter.dimsKeys ?? []);
  if (productAnd.length) and.push({ product: { AND: productAnd } });
  const view = filter.view ?? "all";
  if (view === "retired") {
    and.push({ status: "retired" });
  } else {
    and.push({ status: { not: "retired" } });
  }
  if (filter.areaId) and.push({ areaId: filter.areaId });
  if (filter.categoryIds?.length) {
    and.push({ product: { categoryId: { in: filter.categoryIds } } });
  }
  if (filter.productId) and.push({ productId: filter.productId });
  if (locationIds) {
    and.push({
      OR: [
        { locationId: { in: locationIds } },
        { container: { locationId: { in: locationIds } } },
        { stocks: { some: { locationId: { in: locationIds } } } },
      ],
    });
  }
  const query = filter.query?.trim();
  if (query) {
    const words = query.split(/\s+/).slice(0, 5);
    for (const word of words) {
      and.push({
        OR: [
          { code: { contains: word, mode: "insensitive" } },
          { label: { contains: word, mode: "insensitive" } },
          { serialNumber: { contains: word, mode: "insensitive" } },
          {
            product: {
              OR: [
                { name: { contains: word, mode: "insensitive" } },
                { manufacturer: { contains: word, mode: "insensitive" } },
                { model: { contains: word, mode: "insensitive" } },
                { description: { contains: word, mode: "insensitive" } },
                { category: { name: { contains: word, mode: "insensitive" } } },
                { tags: { some: { name: { contains: word, mode: "insensitive" } } } },
              ],
            },
          },
        ],
      });
    }
  }
  const soon = new Date(Date.now() + INSPECTION_SOON_DAYS * 86_400_000);
  switch (view) {
    case "defects":
      and.push({ defects: { some: { status: { not: "done" } } } });
      break;
    case "inspection":
      and.push({
        product: { inspectionRequired: true },
        OR: [{ nextInspectionAt: null }, { nextInspectionAt: { lte: soon } }],
      });
      break;
    case "checked_out":
      and.push({ status: "checked_out" });
      break;
    case "missing":
      and.push({ status: "missing" });
      break;
    case "unlabeled":
      and.push({ labelPrintedAt: null });
      break;
    case "low":
      and.push({ id: { in: lowIds ?? [] } });
      break;
    default:
      break;
  }
  return { AND: and };
}

export async function listInventoryAssets(filter: InventoryListFilter) {
  const { locations, label } = await loadLocationLabeler();
  const locationIds = filter.locationId ? locationSubtreeIds(locations, filter.locationId) : null;
  const categoryIds = filter.categoryId ? await categorySubtreeIds(filter.categoryId) : undefined;
  const lowIds = filter.view === "low" ? await lowStockAssetIds() : null;
  const dimsKeys = filter.fits ? await dimensionKeys() : [];
  const where = buildWhere({ ...filter, categoryIds, dimsKeys }, locationIds, lowIds);
  const page = Math.max(1, filter.page ?? 1);
  const pageSize = filter.pageSize ?? INVENTORY_PAGE_SIZE;
  const [total, assets] = await Promise.all([
    prisma.inventoryAsset.count({ where }),
    prisma.inventoryAsset.findMany({
      where,
      orderBy: filter.sort
        ? sortOrder(filter.sort)
        : filter.view === "inspection"
          ? [{ nextInspectionAt: { sort: "asc", nulls: "first" } }, ...ASSET_CODE_ORDER]
          : [{ updatedAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        code: true,
        label: true,
        kind: true,
        status: true,
        condition: true,
        areaId: true,
        quantity: true,
        locationId: true,
        labelPrintedAt: true,
        nextInspectionAt: true,
        area: { select: { name: true, prefix: true } },
        product: {
          select: {
            id: true,
            publicId: true,
            name: true,
            categoryId: true,
            unit: true,
            inspectionRequired: true,
            category: { select: { name: true } },
            photos: { select: { id: true }, orderBy: { sortOrder: "asc" }, take: 1 },
          },
        },
        container: { select: { code: true, ...ASSET_NAME_SELECT, locationId: true } },
        stocks: { select: { locationId: true, container: { select: { code: true } } } },
        photos: { select: { id: true }, orderBy: { sortOrder: "asc" }, take: 1 },
        inspections: { select: { result: true }, orderBy: { inspectedAt: "desc" }, take: 1 },
        _count: { select: { defects: { where: { status: { not: "done" } } } } },
      },
    }),
  ]);

  const items: InventoryListItem[] = assets.map((asset) => ({
    id: asset.id,
    code: asset.code,
    name: assetDisplayName(asset),
    kind: asset.kind as AssetKind,
    status: asset.status,
    areaName: asset.area.name,
    areaPrefix: asset.area.prefix,
    categoryName: asset.product.category?.name ?? null,
    place: describePlace({ ...asset, kind: asset.kind as AssetKind }, label),
    quantity: asset.quantity,
    unit: asset.product.unit,
    productId: asset.product.id,
    productPublicId: asset.product.publicId,
    photoId: asset.photos[0]?.id ?? asset.product.photos[0]?.id ?? null,
    openDefects: asset._count.defects,
    inspection: inspectionState({
      inspectionRequired: asset.product.inspectionRequired,
      nextInspectionAt: asset.nextInspectionAt,
      lastInspectionFailed: asset.inspections[0]?.result === "failed",
    }),
    labelPrinted: Boolean(asset.labelPrintedAt),
    areaId: asset.areaId,
    categoryId: asset.product.categoryId,
    condition: asset.condition,
    nextInspectionAt: asset.nextInspectionAt,
  }));

  return { items, total, page, pageCount: Math.max(1, Math.ceil(total / pageSize)) };
}

function describePlace(
  asset: {
    kind: AssetKind;
    locationId: string | null;
    container: {
      code: string;
      label: string | null;
      product: { name: string };
      locationId: string | null;
    } | null;
    stocks: { locationId: string | null; container: { code: string } | null }[];
  },
  label: (id: string | null | undefined) => string | null,
): string | null {
  if (asset.kind === "bulk") {
    if (!asset.stocks.length) return null;
    const first = asset.stocks[0]!;
    const text = first.container ? first.container.code : label(first.locationId);
    return asset.stocks.length > 1 ? `${text} + ${asset.stocks.length - 1} weitere` : text;
  }
  if (asset.container) {
    const parent = label(asset.container.locationId);
    return parent
      ? `${asset.container.code} ${assetDisplayName(asset.container)} · ${parent}`
      : `${asset.container.code} ${assetDisplayName(asset.container)}`;
  }
  return label(asset.locationId);
}

export async function getInventoryOverviewStats() {
  const soon = new Date(Date.now() + INSPECTION_SOON_DAYS * 86_400_000);
  const active = { status: { not: "retired" as const } };
  const [total, defects, inspections, checkedOut, unlabeled, stocktakes] = await Promise.all([
    prisma.inventoryAsset.count({ where: active }),
    prisma.inventoryAsset.count({
      where: { ...active, defects: { some: { status: { not: "done" } } } },
    }),
    prisma.inventoryAsset.count({
      where: {
        ...active,
        product: { inspectionRequired: true },
        OR: [{ nextInspectionAt: null }, { nextInspectionAt: { lte: soon } }],
      },
    }),
    prisma.inventoryAsset.count({ where: { status: "checked_out" } }),
    prisma.inventoryAsset.count({ where: { ...active, labelPrintedAt: null } }),
    prisma.inventoryStocktake.count({ where: { status: "open" } }),
  ]);
  const lowStock = (await lowStockAssetIds()).length;
  return {
    total,
    defects,
    inspections,
    checkedOut,
    unlabeled,
    lowStock,
    openStocktakes: stocktakes,
  };
}

export async function listInventoryAreas() {
  return prisma.inventoryArea.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      prefix: true,
      description: true,
      inspectionDefault: true,
      categories: {
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        select: { id: true, name: true, parentId: true },
      },
      _count: { select: { assets: true } },
    },
  });
}

export type InventoryAreaOption = Awaited<ReturnType<typeof listInventoryAreas>>[number];

export async function listLocationOptions() {
  const { locations, label } = await loadLocationLabeler();
  return locations
    .map((location) => ({
      id: location.id,
      code: location.code,
      name: location.name,
      parentId: location.parentId,
      path: label(location.id) ?? location.name,
    }))
    .sort((a, b) => a.path.localeCompare(b.path, "de"));
}

export type LocationOption = Awaited<ReturnType<typeof listLocationOptions>>[number];

export async function listContainerOptions() {
  const { label } = await loadLocationLabeler();
  const containers = await prisma.inventoryAsset.findMany({
    where: { kind: "container", status: { not: "retired" } },
    orderBy: [...ASSET_CODE_ORDER],
    select: { id: true, code: true, ...ASSET_NAME_SELECT, locationId: true },
  });
  return containers.map((container) => ({
    id: container.id,
    code: container.code,
    name: assetDisplayName(container),
    path: label(container.locationId),
  }));
}

export type ContainerOption = Awaited<ReturnType<typeof listContainerOptions>>[number];

export async function getInventoryAssetDetail(code: string, options: { includeCost: boolean }) {
  const asset = await prisma.inventoryAsset.findUnique({
    where: { code },
    include: {
      area: { select: { id: true, name: true, prefix: true } },
      product: {
        include: {
          photos: { select: { id: true }, orderBy: { sortOrder: "asc" } },
          _count: { select: { assets: { where: { status: { not: "retired" } } } } },
        },
      },
      location: { select: { id: true, code: true, name: true } },
      container: {
        select: { id: true, code: true, ...ASSET_NAME_SELECT, locationId: true },
      },
      photos: { select: { id: true }, orderBy: { sortOrder: "asc" } },
      contents: {
        orderBy: [...ASSET_CODE_ORDER],
        select: {
          id: true,
          code: true,
          ...ASSET_NAME_SELECT,
          kind: true,
          status: true,
          quantity: true,
        },
      },
      storedStocks: {
        select: {
          quantity: true,
          asset: {
            select: {
              id: true,
              code: true,
              ...ASSET_NAME_SELECT,
              product: { select: { name: true, unit: true } },
            },
          },
        },
      },
      stocks: {
        orderBy: { quantity: "desc" },
        select: {
          id: true,
          quantity: true,
          locationId: true,
          container: { select: { id: true, code: true, ...ASSET_NAME_SELECT } },
        },
      },
      defects: {
        orderBy: [{ status: "asc" }, { createdAt: "desc" }],
        select: {
          id: true,
          title: true,
          description: true,
          severity: true,
          status: true,
          resolutionNote: true,
          resolvedAt: true,
          createdAt: true,
          reportedBy: { select: { firstName: true, lastName: true, name: true } },
          photos: { select: { id: true } },
        },
      },
      inspections: {
        orderBy: { inspectedAt: "desc" },
        select: {
          id: true,
          kind: true,
          result: true,
          inspectedAt: true,
          nextDueAt: true,
          inspectorName: true,
          note: true,
          documentName: true,
        },
      },
      events: {
        orderBy: { createdAt: "desc" },
        take: 30,
        select: {
          id: true,
          type: true,
          message: true,
          createdAt: true,
          user: { select: { firstName: true, lastName: true, name: true } },
        },
      },
      checkoutLines: {
        where: { checkout: { status: "open" } },
        select: {
          quantity: true,
          returnedQuantity: true,
          checkout: { select: { id: true, title: true } },
        },
      },
    },
  });
  if (!asset) return null;
  const [{ label }, fields, categories] = await Promise.all([
    loadLocationLabeler(),
    loadEffectiveFields(prisma, asset.areaId, asset.product.categoryId),
    prisma.inventoryCategory.findMany({
      where: { areaId: asset.areaId },
      select: { id: true, parentId: true, name: true },
    }),
  ]);
  const { acquisitionCost, product, ...rest } = asset;
  const named = <T extends { label: string | null; product: { name: string } }>(entry: T) => ({
    ...entry,
    name: assetDisplayName(entry),
  });
  return {
    ...rest,
    name: assetDisplayName(asset),
    kind: asset.kind as AssetKind,
    status: asset.status as AssetStatus,
    condition: asset.condition as Condition,
    product: {
      id: product.id,
      publicId: product.publicId,
      name: product.name,
      categoryId: product.categoryId,
      manufacturer: product.manufacturer,
      model: product.model,
      description: product.description,
      publicNote: product.publicNote,
      unit: product.unit,
      minQuantity: product.minQuantity,
      inspectionRequired: product.inspectionRequired,
      inspectionIntervalMonths: product.inspectionIntervalMonths,
      specs: readSpecs(product.specs),
      photos: product.photos,
      exemplarCount: product._count.assets,
    },
    categoryPath: categoryPathLabel(categories, product.categoryId),
    fields,
    specRows: describeSpecs(fields, readSpecs(product.specs)),
    /** Eigene Fotos des Exemplars zuerst, danach die des Typs. */
    allPhotos: [...asset.photos, ...product.photos],
    container: asset.container ? named(asset.container) : null,
    contents: asset.contents.map(named),
    storedStocks: asset.storedStocks.map((stock) => ({
      ...stock,
      asset: { ...named(stock.asset), unit: stock.asset.product.unit },
    })),
    acquisitionCost: options.includeCost && acquisitionCost ? Number(acquisitionCost) : null,
    locationPath: label(asset.locationId),
    containerPath: asset.container ? label(asset.container.locationId) : null,
    stocks: asset.stocks.map((stock) => ({
      ...stock,
      container: stock.container ? named(stock.container) : null,
      locationPath: label(stock.locationId),
    })),
    inspectionState: inspectionState({
      inspectionRequired: product.inspectionRequired,
      nextInspectionAt: asset.nextInspectionAt,
      lastInspectionFailed: asset.inspections[0]?.result === "failed",
    }),
  };
}

export type InventoryAssetDetail = NonNullable<Awaited<ReturnType<typeof getInventoryAssetDetail>>>;

/**
 * Öffentliche Scan-Ansicht über die zufällige `publicId` – bewusst ohne Preise, Notizen,
 * Seriennummern oder Personen.
 */
export async function getPublicAssetView(publicId: string) {
  const asset = await prisma.inventoryAsset.findUnique({
    where: { publicId },
    select: {
      code: true,
      label: true,
      kind: true,
      status: true,
      areaId: true,
      nextInspectionAt: true,
      lastInspectionAt: true,
      area: { select: { name: true, prefix: true } },
      product: {
        select: {
          name: true,
          categoryId: true,
          manufacturer: true,
          model: true,
          description: true,
          publicNote: true,
          specs: true,
          inspectionRequired: true,
          category: { select: { name: true } },
          photos: { select: { id: true }, orderBy: { sortOrder: "asc" }, take: 1 },
        },
      },
      photos: { select: { id: true }, orderBy: { sortOrder: "asc" }, take: 1 },
      inspections: { select: { result: true }, orderBy: { inspectedAt: "desc" }, take: 1 },
      defects: {
        where: { status: { not: "done" } },
        select: { severity: true },
      },
    },
  });
  if (!asset) return null;
  const fields = await loadEffectiveFields(prisma, asset.areaId, asset.product.categoryId);
  return {
    code: asset.code,
    name: assetDisplayName(asset),
    kind: asset.kind as AssetKind,
    status: asset.status as AssetStatus,
    manufacturer: asset.product.manufacturer,
    model: asset.product.model,
    description: asset.product.description,
    publicNote: asset.product.publicNote,
    specRows: describeSpecs(fields, readSpecs(asset.product.specs)),
    areaName: asset.area.name,
    areaPrefix: asset.area.prefix,
    categoryName: asset.product.category?.name ?? null,
    photoId: asset.photos[0]?.id ?? asset.product.photos[0]?.id ?? null,
    nextInspectionAt: asset.nextInspectionAt,
    inspectionState: inspectionState({
      inspectionRequired: asset.product.inspectionRequired,
      nextInspectionAt: asset.nextInspectionAt,
      lastInspectionFailed: asset.inspections[0]?.result === "failed",
    }),
    locked: asset.status === "locked" || asset.defects.some((d) => d.severity === "locked"),
    hasDefects: asset.defects.length > 0,
  };
}

export type PublicAssetView = NonNullable<Awaited<ReturnType<typeof getPublicAssetView>>>;

export async function getLocationDetail(code: string) {
  const location = await prisma.inventoryLocation.findUnique({
    where: { code },
    select: {
      id: true,
      code: true,
      name: true,
      description: true,
      parentId: true,
      children: {
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        select: { id: true, code: true, name: true },
      },
    },
  });
  if (!location) return null;
  const all = await prisma.inventoryLocation.findMany({
    select: { id: true, code: true, name: true, parentId: true },
  });
  const label = buildLocationLabeler(all);
  const [assets, stocks] = await Promise.all([
    prisma.inventoryAsset.findMany({
      where: { locationId: location.id, status: { not: "retired" } },
      orderBy: [{ kind: "asc" }, ...ASSET_CODE_ORDER],
      select: {
        id: true,
        code: true,
        ...ASSET_NAME_SELECT,
        kind: true,
        status: true,
        _count: { select: { contents: true } },
      },
    }),
    prisma.inventoryStock.findMany({
      where: { locationId: location.id },
      select: {
        quantity: true,
        asset: {
          select: {
            id: true,
            code: true,
            ...ASSET_NAME_SELECT,
            product: { select: { name: true, unit: true } },
          },
        },
      },
    }),
  ]);
  return {
    ...location,
    path: label(location.id),
    parent: location.parentId
      ? (all.find((entry) => entry.id === location.parentId) ?? null)
      : null,
    assets: assets.map((asset) => ({ ...asset, name: assetDisplayName(asset) })),
    stocks: stocks.map((stock) => ({
      quantity: stock.quantity,
      asset: {
        id: stock.asset.id,
        code: stock.asset.code,
        name: assetDisplayName(stock.asset),
        unit: stock.asset.product.unit,
      },
    })),
  };
}

// ---------------------------------------------------------------------------------------------
// Artikeltypen (docs/Plan/lager-typen-projekte-plan.md, Phase 3)

export type ProductStatusCounts = Record<AssetStatus, number>;

export type InventoryProductListItem = {
  id: string;
  publicId: string;
  name: string;
  kind: ProductKind;
  areaName: string;
  areaPrefix: string;
  categoryPath: string | null;
  tags: string[];
  manufacturer: string | null;
  model: string | null;
  photoId: string | null;
  unit: string | null;
  /** Aktive (nicht ausgemusterte) Exemplare bzw. Gesamtmenge bei Mengenartikeln. */
  total: number;
  counts: ProductStatusCounts;
  /** Mengenartikel unter Mindestbestand. */
  low: boolean;
  /** Sets: Anzahl Bestandteile. */
  componentCount: number;
  /** Einzelnes Exemplar – die Zeile führt dann direkt dorthin. */
  singleCode: string | null;
  places: string[];
};

function emptyCounts(): ProductStatusCounts {
  return { available: 0, checked_out: 0, repair: 0, locked: 0, missing: 0, retired: 0 };
}

/**
 * Bestand nach Artikeltyp: ein Eintrag je Typ, dessen aktive Exemplare zum Filter passen.
 * Gezählt werden alle aktiven Exemplare des Typs (nicht nur die gefilterten).
 */
export async function listInventoryProducts(filter: InventoryListFilter) {
  const { locations, label } = await loadLocationLabeler();
  const locationIds = filter.locationId ? locationSubtreeIds(locations, filter.locationId) : null;
  const categoryIds = filter.categoryId ? await categorySubtreeIds(filter.categoryId) : undefined;
  const dimsKeys = filter.fits ? await dimensionKeys() : [];
  const where = buildWhere({ ...filter, view: "all", categoryIds, dimsKeys }, locationIds);
  const matching = await prisma.inventoryAsset.groupBy({ by: ["productId"], where });
  const productIds = matching.map((entry) => entry.productId);
  // Sets haben keine Exemplare und damit keinen Ort – sie erscheinen ohne Ortsfilter.
  if (!filter.locationId) {
    const words = filter.query?.trim().split(/\s+/).filter(Boolean).slice(0, 5) ?? [];
    const sets = await prisma.inventoryProduct.findMany({
      where: {
        kind: "set",
        ...(filter.areaId ? { areaId: filter.areaId } : {}),
        ...(categoryIds ? { categoryId: { in: categoryIds } } : {}),
        AND: [
          ...productConditions(filter, dimsKeys),
          ...words.map((word) => ({
            OR: [
              { name: { contains: word, mode: "insensitive" as const } },
              { manufacturer: { contains: word, mode: "insensitive" as const } },
              { model: { contains: word, mode: "insensitive" as const } },
              { category: { name: { contains: word, mode: "insensitive" as const } } },
              { tags: { some: { name: { contains: word, mode: "insensitive" as const } } } },
            ],
          })),
        ],
      },
      select: { id: true },
    });
    productIds.push(...sets.map((set) => set.id));
  }
  const page = Math.max(1, filter.page ?? 1);
  const pageSize = filter.pageSize ?? INVENTORY_PAGE_SIZE;

  const [products, categories] = await Promise.all([
    prisma.inventoryProduct.findMany({
      where: { id: { in: productIds } },
      orderBy: [{ name: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        publicId: true,
        name: true,
        kind: true,
        categoryId: true,
        manufacturer: true,
        model: true,
        unit: true,
        minQuantity: true,
        _count: { select: { components: true } },
        area: { select: { name: true, prefix: true } },
        tags: { select: { name: true }, orderBy: { name: "asc" } },
        photos: { select: { id: true }, orderBy: { sortOrder: "asc" }, take: 1 },
        assets: {
          where: { status: { not: "retired" } },
          orderBy: [...ASSET_CODE_ORDER],
          select: {
            code: true,
            status: true,
            quantity: true,
            locationId: true,
            container: { select: { code: true, locationId: true } },
            stocks: { select: { locationId: true, container: { select: { code: true } } } },
            photos: { select: { id: true }, orderBy: { sortOrder: "asc" }, take: 1 },
          },
        },
      },
    }),
    prisma.inventoryCategory.findMany({ select: { id: true, parentId: true, name: true } }),
  ]);

  const items: InventoryProductListItem[] = products.map((product) => {
    const counts = emptyCounts();
    const places = new Set<string>();
    for (const asset of product.assets) {
      counts[asset.status] += 1;
      if (product.kind === "bulk") {
        for (const stock of asset.stocks) {
          const text = stock.container ? stock.container.code : label(stock.locationId);
          if (text) places.add(text);
        }
      } else {
        const text = asset.container
          ? (label(asset.container.locationId) ?? asset.container.code)
          : label(asset.locationId);
        if (text) places.add(text);
      }
    }
    const total =
      product.kind === "bulk"
        ? product.assets.reduce((sum, asset) => sum + asset.quantity, 0)
        : product.assets.length;
    return {
      id: product.id,
      publicId: product.publicId,
      name: product.name,
      kind: product.kind as ProductKind,
      areaName: product.area.name,
      areaPrefix: product.area.prefix,
      categoryPath: categoryPathLabel(categories, product.categoryId),
      tags: product.tags.map((tag) => tag.name),
      manufacturer: product.manufacturer,
      model: product.model,
      photoId: product.photos[0]?.id ?? product.assets[0]?.photos[0]?.id ?? null,
      unit: product.unit,
      total,
      counts,
      low: product.kind === "bulk" && product.minQuantity !== null && total < product.minQuantity,
      componentCount: product._count.components,
      singleCode:
        product.kind !== "bulk" && product.assets.length === 1 ? product.assets[0]!.code : null,
      places: [...places],
    };
  });

  return {
    items,
    total: productIds.length,
    page,
    pageCount: Math.max(1, Math.ceil(productIds.length / pageSize)),
  };
}

/** Typ-Detailseite: Stammdaten, Merkmale und alle Exemplare gruppiert nach Ort. */
export async function getInventoryProductDetail(publicId: string) {
  const product = await prisma.inventoryProduct.findUnique({
    where: { publicId },
    include: {
      area: { select: { id: true, name: true, prefix: true } },
      tags: { select: { name: true }, orderBy: { name: "asc" } },
      photos: { select: { id: true }, orderBy: { sortOrder: "asc" } },
      assets: {
        orderBy: [...ASSET_CODE_ORDER],
        select: {
          id: true,
          code: true,
          label: true,
          status: true,
          condition: true,
          quantity: true,
          serialNumber: true,
          locationId: true,
          nextInspectionAt: true,
          labelPrintedAt: true,
          container: { select: { code: true, locationId: true, ...ASSET_NAME_SELECT } },
          stocks: {
            orderBy: { quantity: "desc" },
            select: {
              quantity: true,
              locationId: true,
              container: { select: { code: true, ...ASSET_NAME_SELECT } },
            },
          },
          inspections: { select: { result: true }, orderBy: { inspectedAt: "desc" }, take: 1 },
          _count: { select: { defects: { where: { status: { not: "done" } } } } },
        },
      },
    },
  });
  if (!product) return null;
  const [{ label }, fields, categories] = await Promise.all([
    loadLocationLabeler(),
    loadEffectiveFields(prisma, product.areaId, product.categoryId),
    prisma.inventoryCategory.findMany({
      where: { areaId: product.areaId },
      select: { id: true, parentId: true, name: true },
    }),
  ]);
  const active = product.assets.filter((asset) => asset.status !== "retired");
  // Sets: Bestandteile mit heutigem Bestand (ohne Projektzeitraum).
  const setAvailability =
    product.kind === "set"
      ? (await loadAvailability([product.id], { startsOn: null, endsOn: null })).get(product.id)
      : undefined;
  const components = await prisma.inventoryProductComponent.findMany({
    where: { setId: product.id },
    orderBy: { sortOrder: "asc" },
    select: {
      quantity: true,
      component: {
        select: {
          id: true,
          publicId: true,
          name: true,
          kind: true,
          photos: { select: { id: true }, orderBy: { sortOrder: "asc" }, take: 1 },
        },
      },
    },
  });
  const usedInSets = await prisma.inventoryProductComponent.findMany({
    where: { componentId: product.id },
    select: { quantity: true, set: { select: { publicId: true, name: true } } },
  });
  const counts = emptyCounts();
  for (const asset of product.assets) counts[asset.status] += 1;

  const exemplars = product.assets.map((asset) => ({
    id: asset.id,
    code: asset.code,
    label: asset.label,
    status: asset.status as AssetStatus,
    condition: asset.condition as Condition,
    serialNumber: asset.serialNumber,
    quantity: asset.quantity,
    openDefects: asset._count.defects,
    labelPrinted: Boolean(asset.labelPrintedAt),
    nextInspectionAt: asset.nextInspectionAt,
    inspection: inspectionState({
      inspectionRequired: product.inspectionRequired,
      nextInspectionAt: asset.nextInspectionAt,
      lastInspectionFailed: asset.inspections[0]?.result === "failed",
    }),
    place: asset.container
      ? `${asset.container.code} ${assetDisplayName(asset.container)}`
      : (label(asset.locationId) ?? "Ohne Ort"),
    stocks: asset.stocks.map((stock) => ({
      quantity: stock.quantity,
      place: stock.container
        ? `${stock.container.code} ${assetDisplayName(stock.container)}`
        : (label(stock.locationId) ?? "Ohne Ort"),
    })),
  }));

  // Exemplare nach Ort gruppiert (ausgemusterte zuletzt, eigene Gruppe).
  const groups = new Map<string, typeof exemplars>();
  for (const exemplar of exemplars) {
    const key = exemplar.status === "retired" ? "Ausgemustert" : exemplar.place;
    groups.set(key, [...(groups.get(key) ?? []), exemplar]);
  }
  const placeGroups = [...groups.entries()]
    .map(([place, entries]) => ({ place, exemplars: entries }))
    .sort((a, b) =>
      a.place === "Ausgemustert"
        ? 1
        : b.place === "Ausgemustert"
          ? -1
          : a.place.localeCompare(b.place, "de"),
    );

  return {
    id: product.id,
    publicId: product.publicId,
    name: product.name,
    kind: product.kind as ProductKind,
    area: product.area,
    categoryId: product.categoryId,
    categoryPath: categoryPathLabel(categories, product.categoryId),
    tags: product.tags.map((tag) => tag.name),
    manufacturer: product.manufacturer,
    model: product.model,
    description: product.description,
    publicNote: product.publicNote,
    unit: product.unit,
    minQuantity: product.minQuantity,
    inspectionRequired: product.inspectionRequired,
    inspectionIntervalMonths: product.inspectionIntervalMonths,
    specs: readSpecs(product.specs),
    specRows: describeSpecs(fields, readSpecs(product.specs)),
    photos: product.photos,
    counts,
    total:
      product.kind === "bulk"
        ? active.reduce((sum, asset) => sum + asset.quantity, 0)
        : active.length,
    activeCodes: active.map((asset) => asset.code),
    setCapacity: setAvailability?.capacity ?? 0,
    components: components.map((entry) => ({
      productId: entry.component.id,
      publicId: entry.component.publicId,
      name: entry.component.name,
      kind: entry.component.kind as ProductKind,
      photoId: entry.component.photos[0]?.id ?? null,
      quantity: entry.quantity,
      capacity:
        setAvailability?.components?.find((item) => item.productId === entry.component.id)
          ?.availability.capacity ?? 0,
    })),
    usedInSets: usedInSets.map((entry) => ({ ...entry.set, quantity: entry.quantity })),
    exemplars,
    placeGroups,
  };
}

export type InventoryProductDetail = NonNullable<
  Awaited<ReturnType<typeof getInventoryProductDetail>>
>;

export type ProductSearchHit = {
  id: string;
  publicId: string;
  name: string;
  kind: ProductKind;
  areaId: string;
  areaName: string;
  areaPrefix: string;
  categoryPath: string | null;
  manufacturer: string | null;
  model: string | null;
  photoId: string | null;
  inspectionRequired: boolean;
  unit: string | null;
  count: number;
};

/** Typ-Suche für die Erfassung: Name, Hersteller, Modell, Kategorie. */
export async function searchInventoryProducts(
  query: string,
  take = 12,
  where: Prisma.InventoryProductWhereInput = {},
): Promise<ProductSearchHit[]> {
  const words = query.trim().split(/\s+/).filter(Boolean).slice(0, 5);
  const [products, categories] = await Promise.all([
    prisma.inventoryProduct.findMany({
      where: {
        ...where,
        AND: words.map((word) => ({
          OR: [
            { name: { contains: word, mode: "insensitive" as const } },
            { manufacturer: { contains: word, mode: "insensitive" as const } },
            { model: { contains: word, mode: "insensitive" as const } },
            { category: { name: { contains: word, mode: "insensitive" as const } } },
            { tags: { some: { name: { contains: word, mode: "insensitive" as const } } } },
          ],
        })),
      },
      orderBy: words.length ? [{ name: "asc" }] : [{ updatedAt: "desc" }],
      take,
      select: {
        id: true,
        publicId: true,
        name: true,
        kind: true,
        areaId: true,
        categoryId: true,
        manufacturer: true,
        model: true,
        inspectionRequired: true,
        unit: true,
        area: { select: { name: true, prefix: true } },
        photos: { select: { id: true }, orderBy: { sortOrder: "asc" }, take: 1 },
        _count: { select: { assets: { where: { status: { not: "retired" } } } } },
      },
    }),
    prisma.inventoryCategory.findMany({ select: { id: true, parentId: true, name: true } }),
  ]);
  return products.map((product) => ({
    id: product.id,
    publicId: product.publicId,
    name: product.name,
    kind: product.kind as ProductKind,
    areaId: product.areaId,
    areaName: product.area.name,
    areaPrefix: product.area.prefix,
    categoryPath: categoryPathLabel(categories, product.categoryId),
    manufacturer: product.manufacturer,
    model: product.model,
    photoId: product.photos[0]?.id ?? null,
    inspectionRequired: product.inspectionRequired,
    unit: product.unit,
    count: product._count.assets,
  }));
}
