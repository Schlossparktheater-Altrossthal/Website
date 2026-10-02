import type { Prisma } from "@prisma/client";

import {
  INSPECTION_SOON_DAYS,
  inspectionState,
  readAttributes,
  type AssetKind,
  type AssetStatus,
  type Condition,
  type InspectionState,
} from "@/lib/inventory/constants";
import {
  buildLocationLabeler,
  loadLocationLabeler,
  locationSubtreeIds,
} from "@/lib/inventory/service";
import { prisma } from "@/lib/prisma";

export const INVENTORY_PAGE_SIZE = 50;

export type InventoryListFilter = {
  query?: string;
  areaId?: string;
  categoryId?: string;
  locationId?: string;
  /** Besondere Sichten der Übersicht. */
  view?: "all" | "defects" | "inspection" | "checked_out" | "missing" | "unlabeled" | "retired";
  page?: number;
};

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
  photoId: string | null;
  openDefects: number;
  inspection: InspectionState;
  labelPrinted: boolean;
};

function buildWhere(
  filter: InventoryListFilter,
  locationIds: string[] | null,
): Prisma.InventoryAssetWhereInput {
  const and: Prisma.InventoryAssetWhereInput[] = [];
  const view = filter.view ?? "all";
  if (view === "retired") {
    and.push({ status: "retired" });
  } else {
    and.push({ status: { not: "retired" } });
  }
  if (filter.areaId) and.push({ areaId: filter.areaId });
  if (filter.categoryId) and.push({ categoryId: filter.categoryId });
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
          { name: { contains: word, mode: "insensitive" } },
          { manufacturer: { contains: word, mode: "insensitive" } },
          { model: { contains: word, mode: "insensitive" } },
          { serialNumber: { contains: word, mode: "insensitive" } },
          { description: { contains: word, mode: "insensitive" } },
          { category: { name: { contains: word, mode: "insensitive" } } },
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
        inspectionRequired: true,
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
    default:
      break;
  }
  return { AND: and };
}

export async function listInventoryAssets(filter: InventoryListFilter) {
  const { locations, label } = await loadLocationLabeler();
  const locationIds = filter.locationId ? locationSubtreeIds(locations, filter.locationId) : null;
  const where = buildWhere(filter, locationIds);
  const page = Math.max(1, filter.page ?? 1);
  const [total, assets] = await Promise.all([
    prisma.inventoryAsset.count({ where }),
    prisma.inventoryAsset.findMany({
      where,
      orderBy:
        filter.view === "inspection"
          ? [{ nextInspectionAt: { sort: "asc", nulls: "first" } }, { code: "asc" }]
          : [{ updatedAt: "desc" }],
      skip: (page - 1) * INVENTORY_PAGE_SIZE,
      take: INVENTORY_PAGE_SIZE,
      select: {
        id: true,
        code: true,
        name: true,
        kind: true,
        status: true,
        quantity: true,
        unit: true,
        locationId: true,
        labelPrintedAt: true,
        inspectionRequired: true,
        nextInspectionAt: true,
        area: { select: { name: true, prefix: true } },
        category: { select: { name: true } },
        container: { select: { code: true, name: true, locationId: true } },
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
    name: asset.name,
    kind: asset.kind,
    status: asset.status,
    areaName: asset.area.name,
    areaPrefix: asset.area.prefix,
    categoryName: asset.category?.name ?? null,
    place: describePlace(asset, label),
    quantity: asset.quantity,
    unit: asset.unit,
    photoId: asset.photos[0]?.id ?? null,
    openDefects: asset._count.defects,
    inspection: inspectionState({
      inspectionRequired: asset.inspectionRequired,
      nextInspectionAt: asset.nextInspectionAt,
      lastInspectionFailed: asset.inspections[0]?.result === "failed",
    }),
    labelPrinted: Boolean(asset.labelPrintedAt),
  }));

  return { items, total, page, pageCount: Math.max(1, Math.ceil(total / INVENTORY_PAGE_SIZE)) };
}

function describePlace(
  asset: {
    kind: AssetKind;
    locationId: string | null;
    container: { code: string; name: string; locationId: string | null } | null;
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
      ? `${asset.container.code} ${asset.container.name} · ${parent}`
      : `${asset.container.code} ${asset.container.name}`;
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
        inspectionRequired: true,
        OR: [{ nextInspectionAt: null }, { nextInspectionAt: { lte: soon } }],
      },
    }),
    prisma.inventoryAsset.count({ where: { status: "checked_out" } }),
    prisma.inventoryAsset.count({ where: { ...active, labelPrintedAt: null } }),
    prisma.inventoryStocktake.count({ where: { status: "open" } }),
  ]);
  return { total, defects, inspections, checkedOut, unlabeled, openStocktakes: stocktakes };
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
        select: { id: true, name: true },
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
    orderBy: { code: "asc" },
    select: { id: true, code: true, name: true, locationId: true },
  });
  return containers.map((container) => ({
    id: container.id,
    code: container.code,
    name: container.name,
    path: label(container.locationId),
  }));
}

export type ContainerOption = Awaited<ReturnType<typeof listContainerOptions>>[number];

export async function getInventoryAssetDetail(code: string, options: { includeCost: boolean }) {
  const asset = await prisma.inventoryAsset.findUnique({
    where: { code },
    include: {
      area: { select: { id: true, name: true, prefix: true } },
      category: { select: { id: true, name: true } },
      location: { select: { id: true, code: true, name: true } },
      container: { select: { id: true, code: true, name: true, locationId: true } },
      photos: { select: { id: true }, orderBy: { sortOrder: "asc" } },
      contents: {
        orderBy: { code: "asc" },
        select: { id: true, code: true, name: true, kind: true, status: true, quantity: true },
      },
      storedStocks: {
        select: {
          quantity: true,
          asset: { select: { id: true, code: true, name: true, unit: true } },
        },
      },
      stocks: {
        orderBy: { quantity: "desc" },
        select: {
          id: true,
          quantity: true,
          locationId: true,
          container: { select: { id: true, code: true, name: true } },
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
  const { label } = await loadLocationLabeler();
  const { acquisitionCost, ...rest } = asset;
  return {
    ...rest,
    kind: asset.kind as AssetKind,
    status: asset.status as AssetStatus,
    condition: asset.condition as Condition,
    attributes: readAttributes(asset.attributes),
    acquisitionCost: options.includeCost && acquisitionCost ? Number(acquisitionCost) : null,
    locationPath: label(asset.locationId),
    containerPath: asset.container ? label(asset.container.locationId) : null,
    stocks: asset.stocks.map((stock) => ({
      ...stock,
      locationPath: label(stock.locationId),
    })),
    inspectionState: inspectionState({
      inspectionRequired: asset.inspectionRequired,
      nextInspectionAt: asset.nextInspectionAt,
      lastInspectionFailed: asset.inspections[0]?.result === "failed",
    }),
  };
}

export type InventoryAssetDetail = NonNullable<Awaited<ReturnType<typeof getInventoryAssetDetail>>>;

/** Öffentliche Scan-Ansicht: bewusst ohne Preise, Notizen, Seriennummern oder Personen. */
export async function getPublicAssetView(code: string) {
  const asset = await prisma.inventoryAsset.findUnique({
    where: { code },
    select: {
      code: true,
      name: true,
      kind: true,
      status: true,
      manufacturer: true,
      model: true,
      description: true,
      publicNote: true,
      attributes: true,
      inspectionRequired: true,
      nextInspectionAt: true,
      lastInspectionAt: true,
      area: { select: { name: true, prefix: true } },
      category: { select: { name: true } },
      photos: { select: { id: true }, orderBy: { sortOrder: "asc" }, take: 1 },
      inspections: { select: { result: true }, orderBy: { inspectedAt: "desc" }, take: 1 },
      defects: {
        where: { status: { not: "done" } },
        select: { severity: true },
      },
    },
  });
  if (!asset) return null;
  return {
    code: asset.code,
    name: asset.name,
    kind: asset.kind as AssetKind,
    status: asset.status as AssetStatus,
    manufacturer: asset.manufacturer,
    model: asset.model,
    description: asset.description,
    publicNote: asset.publicNote,
    attributes: readAttributes(asset.attributes),
    areaName: asset.area.name,
    areaPrefix: asset.area.prefix,
    categoryName: asset.category?.name ?? null,
    photoId: asset.photos[0]?.id ?? null,
    nextInspectionAt: asset.nextInspectionAt,
    inspectionState: inspectionState({
      inspectionRequired: asset.inspectionRequired,
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
      orderBy: [{ kind: "asc" }, { code: "asc" }],
      select: {
        id: true,
        code: true,
        name: true,
        kind: true,
        status: true,
        _count: { select: { contents: true } },
      },
    }),
    prisma.inventoryStock.findMany({
      where: { locationId: location.id },
      select: {
        quantity: true,
        asset: { select: { id: true, code: true, name: true, unit: true } },
      },
    }),
  ]);
  return {
    ...location,
    path: label(location.id),
    parent: location.parentId
      ? (all.find((entry) => entry.id === location.parentId) ?? null)
      : null,
    assets,
    stocks,
  };
}
