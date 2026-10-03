import { assetDisplayName } from "@/lib/inventory/constants";
import { ASSET_NAME_SELECT } from "@/lib/inventory/selects";
import { buildLocationLabeler, locationSubtreeIds } from "@/lib/inventory/service";
import { prisma } from "@/lib/prisma";

/**
 * Abgleich einer Inventur (docs/Plan/inventar-plan.md, Phase 6).
 *
 * Erwartet wird alles, was laut System im Umfang liegt (Bereich und/oder Ort samt Unterorten).
 * Gezählt wird, was gescannt wurde – mit dem Lagerplatz, der beim Scannen als „Zone“ galt.
 */

export type ReviewAsset = {
  id: string;
  code: string;
  name: string;
  kind: string;
  expectedPlace: string | null;
  foundPlace: string | null;
  foundLocationId: string | null;
  quantity?: number | null;
  expectedQuantity?: number | null;
  scannedBy?: string | null;
};

export type StocktakeReview = {
  found: ReviewAsset[];
  moved: ReviewAsset[];
  missing: ReviewAsset[];
  /** Nicht gescannt, aber die Kiste, in der es liegt, wurde gefunden. */
  inFoundContainer: ReviewAsset[];
  unexpected: ReviewAsset[];
  unknownCodes: { code: string; count: number }[];
  bulkCounts: ReviewAsset[];
  /** Erwartete Einzelstücke und Kisten (ohne Mengenartikel). */
  expectedCount: number;
  zones: { id: string; name: string; expected: number; found: number }[];
};

type ScopeAsset = {
  id: string;
  code: string;
  name: string;
  kind: string;
  locationId: string | null;
  containerId: string | null;
  container: { id: string; locationId: string | null } | null;
  quantity: number;
};

function personName(
  user: { firstName: string | null; lastName: string | null; name: string | null } | null,
) {
  if (!user) return null;
  return [user.firstName, user.lastName].filter(Boolean).join(" ") || user.name;
}

export async function buildStocktakeReview(stocktakeId: string): Promise<StocktakeReview | null> {
  const stocktake = await prisma.inventoryStocktake.findUnique({
    where: { id: stocktakeId },
    select: {
      areaId: true,
      locationId: true,
      scans: {
        orderBy: { scannedAt: "asc" },
        select: {
          code: true,
          assetId: true,
          quantity: true,
          locationId: true,
          user: { select: { firstName: true, lastName: true, name: true } },
        },
      },
    },
  });
  if (!stocktake) return null;

  const locations = await prisma.inventoryLocation.findMany({
    select: { id: true, code: true, name: true, parentId: true },
  });
  const label = buildLocationLabeler(locations);
  const scopeLocationIds = stocktake.locationId
    ? new Set(locationSubtreeIds(locations, stocktake.locationId))
    : null;

  const scopeRows = await prisma.inventoryAsset.findMany({
    where: {
      status: { not: "retired" },
      ...(stocktake.areaId ? { areaId: stocktake.areaId } : {}),
    },
    select: {
      id: true,
      code: true,
      ...ASSET_NAME_SELECT,
      kind: true,
      locationId: true,
      containerId: true,
      quantity: true,
      container: { select: { id: true, locationId: true } },
    },
  });
  const assets: ScopeAsset[] = scopeRows.map(({ label, product, ...row }) => ({
    ...row,
    name: assetDisplayName({ label, product }),
  }));
  const stocks = await prisma.inventoryStock.findMany({
    where: { asset: { status: { not: "retired" } } },
    select: {
      assetId: true,
      locationId: true,
      quantity: true,
      container: { select: { locationId: true } },
    },
  });

  const effectiveLocation = (asset: ScopeAsset): string | null =>
    asset.container ? asset.container.locationId : asset.locationId;
  const inScope = (locationId: string | null) =>
    scopeLocationIds ? Boolean(locationId && scopeLocationIds.has(locationId)) : true;

  const expected = assets.filter((asset) => {
    if (asset.kind === "bulk") {
      return stocks.some(
        (stock) =>
          stock.assetId === asset.id &&
          inScope(stock.locationId ?? stock.container?.locationId ?? null),
      );
    }
    return inScope(effectiveLocation(asset));
  });
  const expectedIds = new Set(expected.map((asset) => asset.id));
  const byId = new Map(assets.map((asset) => [asset.id, asset]));

  // Letzter Scan je Objekt zählt (Ort und Menge).
  const lastScan = new Map<string, (typeof stocktake.scans)[number]>();
  const bulkTotals = new Map<string, number>();
  const unknown = new Map<string, number>();
  for (const scan of stocktake.scans) {
    if (!scan.assetId) {
      unknown.set(scan.code, (unknown.get(scan.code) ?? 0) + 1);
      continue;
    }
    lastScan.set(scan.assetId, scan);
    if (scan.quantity !== null) {
      bulkTotals.set(scan.assetId, (bulkTotals.get(scan.assetId) ?? 0) + scan.quantity);
    }
  }

  const describe = (asset: ScopeAsset): string | null => {
    if (asset.kind === "bulk") return null;
    if (asset.containerId) {
      const container = byId.get(asset.containerId);
      return container ? `${container.code} ${container.name}` : "in Kiste";
    }
    return label(asset.locationId);
  };

  const review: StocktakeReview = {
    found: [],
    moved: [],
    missing: [],
    inFoundContainer: [],
    unexpected: [],
    unknownCodes: [...unknown.entries()].map(([code, count]) => ({ code, count })),
    bulkCounts: [],
    expectedCount: expected.filter((asset) => asset.kind !== "bulk").length,
    zones: [],
  };

  for (const [assetId, scan] of lastScan) {
    const asset = byId.get(assetId);
    if (!asset) continue;
    const entry: ReviewAsset = {
      id: asset.id,
      code: asset.code,
      name: asset.name,
      kind: asset.kind,
      expectedPlace: describe(asset),
      foundPlace: label(scan.locationId),
      foundLocationId: scan.locationId,
      scannedBy: personName(scan.user),
    };
    if (asset.kind === "bulk") {
      review.bulkCounts.push({
        ...entry,
        quantity: bulkTotals.get(asset.id) ?? null,
        expectedQuantity: asset.quantity,
      });
      continue;
    }
    if (!expectedIds.has(asset.id)) {
      review.unexpected.push(entry);
      continue;
    }
    const expectedLocation = effectiveLocation(asset);
    if (scan.locationId && expectedLocation !== scan.locationId) {
      review.moved.push(entry);
    } else {
      review.found.push(entry);
    }
  }

  for (const asset of expected) {
    if (lastScan.has(asset.id) || asset.kind === "bulk") continue;
    const entry: ReviewAsset = {
      id: asset.id,
      code: asset.code,
      name: asset.name,
      kind: asset.kind,
      expectedPlace: describe(asset),
      foundPlace: null,
      foundLocationId: null,
    };
    if (asset.containerId && lastScan.has(asset.containerId)) {
      review.inFoundContainer.push(entry);
    } else {
      review.missing.push(entry);
    }
  }
  // Mengenartikel, die erwartet, aber gar nicht gezählt wurden.
  for (const asset of expected) {
    if (asset.kind !== "bulk" || lastScan.has(asset.id)) continue;
    review.bulkCounts.push({
      id: asset.id,
      code: asset.code,
      name: asset.name,
      kind: asset.kind,
      expectedPlace: null,
      foundPlace: null,
      foundLocationId: null,
      quantity: null,
      expectedQuantity: asset.quantity,
    });
  }

  // Fortschritt je Zone: direkte Unterorte des Umfangs (oder die obersten Orte).
  const zoneRoots = locations.filter((location) =>
    stocktake.locationId ? location.parentId === stocktake.locationId : location.parentId === null,
  );
  for (const zone of zoneRoots) {
    const ids = new Set(locationSubtreeIds(locations, zone.id));
    const zoneAssets = expected.filter(
      (asset) => asset.kind !== "bulk" && ids.has(effectiveLocation(asset) ?? ""),
    );
    if (!zoneAssets.length) continue;
    review.zones.push({
      id: zone.id,
      name: zone.name,
      expected: zoneAssets.length,
      found: zoneAssets.filter((asset) => lastScan.has(asset.id)).length,
    });
  }

  return review;
}

export type StocktakeProgress = {
  expected: number;
  found: number;
  scans: number;
  people: number;
  zones: StocktakeReview["zones"];
  recent: {
    code: string;
    name: string | null;
    by: string | null;
    at: string;
    place: string | null;
  }[];
};

export async function getStocktakeProgress(stocktakeId: string): Promise<StocktakeProgress | null> {
  const review = await buildStocktakeReview(stocktakeId);
  if (!review) return null;
  const [scans, people, recent, locations] = await Promise.all([
    prisma.inventoryStocktakeScan.count({ where: { stocktakeId } }),
    prisma.inventoryStocktakeScan.groupBy({ by: ["userId"], where: { stocktakeId } }),
    prisma.inventoryStocktakeScan.findMany({
      where: { stocktakeId },
      orderBy: { scannedAt: "desc" },
      take: 12,
      select: {
        code: true,
        scannedAt: true,
        locationId: true,
        asset: { select: ASSET_NAME_SELECT },
        user: { select: { firstName: true, lastName: true, name: true } },
      },
    }),
    prisma.inventoryLocation.findMany({
      select: { id: true, code: true, name: true, parentId: true },
    }),
  ]);
  const label = buildLocationLabeler(locations);
  return {
    expected: review.expectedCount,
    found: review.found.length + review.moved.length,
    scans,
    people: people.length,
    zones: review.zones,
    recent: recent.map((scan) => ({
      code: scan.code,
      name: scan.asset ? assetDisplayName(scan.asset) : null,
      by: personName(scan.user),
      at: scan.scannedAt.toISOString(),
      place: label(scan.locationId),
    })),
  };
}
