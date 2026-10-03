import {
  assetDisplayName,
  inspectionState,
  isLocationCode,
  type AssetKind,
  type AssetStatus,
  type InspectionState,
} from "@/lib/inventory/constants";
import { loadLocationLabeler } from "@/lib/inventory/service";
import { prisma } from "@/lib/prisma";

/** Kompakte Antwort auf einen Scan – genug für Liste, Banner und Folgeaktion. */
export type ScanResult =
  | {
      type: "asset";
      id: string;
      code: string;
      name: string;
      kind: AssetKind;
      status: AssetStatus;
      areaName: string;
      unit: string | null;
      quantity: number;
      place: string | null;
      photoId: string | null;
      openDefects: number;
      locked: boolean;
      inspection: InspectionState;
    }
  | { type: "location"; id: string; code: string; name: string; path: string };

export async function buildScanResult(code: string): Promise<ScanResult | null> {
  const { label } = await loadLocationLabeler();
  if (isLocationCode(code)) {
    const location = await prisma.inventoryLocation.findUnique({
      where: { code },
      select: { id: true, code: true, name: true },
    });
    if (!location) return null;
    return { type: "location", ...location, path: label(location.id) ?? location.name };
  }
  const asset = await prisma.inventoryAsset.findUnique({
    where: { code },
    select: {
      id: true,
      code: true,
      label: true,
      kind: true,
      status: true,
      quantity: true,
      locationId: true,
      product: {
        select: {
          name: true,
          unit: true,
          inspectionRequired: true,
          photos: { select: { id: true }, orderBy: { sortOrder: "asc" }, take: 1 },
        },
      },
      nextInspectionAt: true,
      area: { select: { name: true } },
      container: { select: { code: true, label: true, product: { select: { name: true } } } },
      photos: { select: { id: true }, orderBy: { sortOrder: "asc" }, take: 1 },
      inspections: { select: { result: true }, orderBy: { inspectedAt: "desc" }, take: 1 },
      defects: { where: { status: { not: "done" } }, select: { severity: true } },
    },
  });
  if (!asset) return null;
  return {
    type: "asset",
    id: asset.id,
    code: asset.code,
    name: assetDisplayName(asset),
    kind: asset.kind,
    status: asset.status,
    areaName: asset.area.name,
    unit: asset.product.unit,
    quantity: asset.quantity,
    place: asset.container
      ? `${asset.container.code} ${assetDisplayName(asset.container)}`
      : label(asset.locationId),
    photoId: asset.photos[0]?.id ?? asset.product.photos[0]?.id ?? null,
    openDefects: asset.defects.length,
    locked: asset.status === "locked" || asset.defects.some((d) => d.severity === "locked"),
    inspection: inspectionState({
      inspectionRequired: asset.product.inspectionRequired,
      nextInspectionAt: asset.nextInspectionAt,
      lastInspectionFailed: asset.inspections[0]?.result === "failed",
    }),
  };
}
