import { Prisma, type InventoryAssetStatus, type PrismaClient } from "@prisma/client";

import {
  formatInventoryCode,
  isLocationCode,
  assetDisplayName,
  LOCATION_CODE_PREFIX,
  parseInventoryCode,
} from "@/lib/inventory/constants";
import { isPublicId } from "@/lib/inventory/public-id";
import {
  findUserIdsWithPermission,
  hasPermission,
  INVENTORY_PERMISSION_KEYS,
} from "@/lib/permissions";
import type { PlacementTarget } from "@/lib/inventory/service-types";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";

export type { PlacementTarget };

type Db = PrismaClient | Prisma.TransactionClient;
type UserLike = Parameters<typeof hasPermission>[0];

export type InventoryAccess = { canUse: boolean; canManage: boolean; canCatalog: boolean };

export async function getInventoryAccess(user: UserLike): Promise<InventoryAccess> {
  const [canUse, canManage, canCatalog] = await Promise.all([
    hasPermission(user, INVENTORY_PERMISSION_KEYS.use),
    hasPermission(user, INVENTORY_PERMISSION_KEYS.manage),
    hasPermission(user, INVENTORY_PERMISSION_KEYS.catalog),
  ]);
  // Verwalten schließt Nutzen und Katalogpflege ein; Katalogpflege setzt Lagerzugriff voraus.
  return {
    canUse: canUse || canManage || canCatalog,
    canManage,
    canCatalog: canCatalog || canManage,
  };
}

const ACCESS_ERRORS = {
  use: "Du hast keinen Zugriff auf das Lager.",
  manage: "Du darfst das Lager nicht verwalten.",
  catalog: "Du darfst Kategorien und Merkmale nicht pflegen.",
} as const;

export async function requireInventoryAccess(level: "use" | "manage" | "catalog" = "use") {
  const session = await requireAuth();
  const access = await getInventoryAccess(session.user);
  const allowed =
    level === "manage" ? access.canManage : level === "catalog" ? access.canCatalog : access.canUse;
  if (!allowed) {
    throw new Error(ACCESS_ERRORS[level]);
  }
  return { session, access, userId: session.user?.id ?? null };
}

/** Vergibt die nächste Typnummer eines Bereichs (zählt atomar hoch). */
export async function allocateProductNumber(db: Db, areaId: string): Promise<number> {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const area = await db.inventoryArea.update({
      where: { id: areaId },
      data: { nextNumber: { increment: 1 } },
      select: { nextNumber: true },
    });
    const number = area.nextNumber - 1;
    const taken = await db.inventoryProduct.findUnique({
      where: { areaId_number: { areaId, number } },
      select: { id: true },
    });
    if (!taken) return number;
  }
  throw new Error("Keine freie Typnummer gefunden.");
}

/**
 * Vergibt den nächsten Code eines Typs: `T-42-3`, bei Mengenartikeln `T-42` ohne Exemplarnummer.
 * Nummern werden nie wiederverwendet – auch nicht nach dem Ausmustern.
 */
export async function allocateAssetCode(
  db: Db,
  productId: string,
): Promise<{ code: string; unitNumber: number | null }> {
  const product = await db.inventoryProduct.findUniqueOrThrow({
    where: { id: productId },
    select: { kind: true, number: true, area: { select: { prefix: true } } },
  });
  if (product.kind === "bulk") {
    return { code: formatInventoryCode(product.area.prefix, product.number), unitNumber: null };
  }
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const { nextUnitNumber } = await db.inventoryProduct.update({
      where: { id: productId },
      data: { nextUnitNumber: { increment: 1 } },
      select: { nextUnitNumber: true },
    });
    const unitNumber = nextUnitNumber - 1;
    const code = formatInventoryCode(product.area.prefix, product.number, unitNumber);
    const taken = await db.inventoryAsset.findUnique({ where: { code }, select: { id: true } });
    if (!taken) return { code, unitNumber };
  }
  throw new Error("Kein freier Code gefunden.");
}

export async function allocateLocationCode(db: Db): Promise<string> {
  const rows = await db.inventoryLocation.findMany({ select: { code: true } });
  let max = 0;
  for (const row of rows) {
    const number = Number(row.code.split("-")[1]);
    if (Number.isFinite(number) && number > max) max = number;
  }
  return formatInventoryCode(LOCATION_CODE_PREFIX, max + 1);
}

export async function recordEvent(
  db: Db,
  input: {
    assetId: string;
    type: string;
    message?: string | null;
    data?: Prisma.InputJsonValue;
    userId?: string | null;
  },
) {
  await db.inventoryEvent.create({
    data: {
      assetId: input.assetId,
      type: input.type,
      message: input.message ?? null,
      data: input.data ?? Prisma.JsonNull,
      userId: input.userId ?? null,
    },
  });
}

/**
 * Leitet den Status aus offenen Mängeln und Ausgaben ab. „Ausgemustert“ und „Vermisst“ sind
 * manuelle Zustände; „Vermisst“ endet, sobald das Objekt wieder gescannt wird (`seen`).
 */
export async function refreshAssetStatus(
  db: Db,
  assetId: string,
  options: { seen?: boolean } = {},
): Promise<InventoryAssetStatus> {
  const asset = await db.inventoryAsset.findUnique({
    where: { id: assetId },
    select: {
      status: true,
      defects: { where: { status: { not: "done" } }, select: { severity: true, status: true } },
      checkoutLines: {
        where: { checkout: { status: "open" } },
        select: { quantity: true, returnedQuantity: true },
      },
    },
  });
  if (!asset) throw new Error("Objekt nicht gefunden.");
  if (asset.status === "retired") return asset.status;

  let next: InventoryAssetStatus = "available";
  if (asset.defects.some((defect) => defect.severity === "locked")) {
    next = "locked";
  } else if (asset.defects.some((defect) => defect.status === "repair")) {
    next = "repair";
  } else if (asset.checkoutLines.some((line) => line.returnedQuantity < line.quantity)) {
    next = "checked_out";
  } else if (asset.status === "missing" && !options.seen) {
    next = "missing";
  }

  if (next !== asset.status) {
    await db.inventoryAsset.update({ where: { id: assetId }, data: { status: next } });
  }
  return next;
}

export type ResolvedCode =
  | { type: "asset"; id: string; code: string; kind: string; name: string }
  | { type: "location"; id: string; code: string; name: string };

export async function resolveInventoryCode(code: string, db: Db = prisma) {
  if (isLocationCode(code)) {
    const location = await db.inventoryLocation.findUnique({
      where: { code },
      select: { id: true, code: true, name: true },
    });
    return location ? ({ type: "location", ...location } satisfies ResolvedCode) : null;
  }
  const asset = await db.inventoryAsset.findUnique({
    where: { code },
    select: { id: true, code: true, kind: true, label: true, product: { select: { name: true } } },
  });
  return asset
    ? ({
        type: "asset",
        id: asset.id,
        code: asset.code,
        kind: asset.kind,
        name: assetDisplayName(asset),
      } satisfies ResolvedCode)
    : null;
}

/**
 * Macht aus einem Scan-Token (`parseScanToken`) den lesbaren Code. Zufällige Kennungen werden
 * nachgeschlagen; unbekannte ergeben `null`.
 */
export async function resolveScanToken(token: string, db: Db = prisma): Promise<string | null> {
  if (!isPublicId(token)) return parseInventoryCode(token);
  const [asset, location] = await Promise.all([
    db.inventoryAsset.findUnique({ where: { publicId: token }, select: { code: true } }),
    db.inventoryLocation.findUnique({ where: { publicId: token }, select: { code: true } }),
  ]);
  return asset?.code ?? location?.code ?? null;
}

/** Wie `resolveScanToken`, für viele Tokens auf einmal (Token → Code). */
export async function resolveScanTokens(
  tokens: readonly string[],
  db: Db = prisma,
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  const publicIds = tokens.filter(isPublicId);
  for (const token of tokens) {
    if (isPublicId(token)) continue;
    const code = parseInventoryCode(token);
    if (code) result.set(token, code);
  }
  if (publicIds.length) {
    const [assets, locations] = await Promise.all([
      db.inventoryAsset.findMany({
        where: { publicId: { in: publicIds } },
        select: { publicId: true, code: true },
      }),
      db.inventoryLocation.findMany({
        where: { publicId: { in: publicIds } },
        select: { publicId: true, code: true },
      }),
    ]);
    for (const entry of [...assets, ...locations]) result.set(entry.publicId, entry.code);
  }
  return result;
}

export type LocationNode = { id: string; code: string; name: string; parentId: string | null };

/** Pfad eines Lagerorts als Text, z. B. „Halle › Regal 3 › Fach B“. */
export function buildLocationLabeler(locations: readonly LocationNode[]) {
  const byId = new Map(locations.map((location) => [location.id, location]));
  const cache = new Map<string, string>();
  const label = (id: string | null | undefined): string | null => {
    if (!id) return null;
    const cached = cache.get(id);
    if (cached) return cached;
    const parts: string[] = [];
    const seen = new Set<string>();
    let current = byId.get(id);
    while (current && !seen.has(current.id)) {
      seen.add(current.id);
      parts.unshift(current.name);
      current = current.parentId ? byId.get(current.parentId) : undefined;
    }
    const text = parts.join(" › ");
    cache.set(id, text);
    return text || null;
  };
  return label;
}

export async function loadLocationLabeler(db: Db = prisma) {
  const locations = await db.inventoryLocation.findMany({
    select: { id: true, code: true, publicId: true, name: true, parentId: true },
  });
  return { locations, label: buildLocationLabeler(locations) };
}

/** Alle Lagerorte unterhalb (inklusive) eines Orts. */
export function locationSubtreeIds(locations: readonly LocationNode[], rootId: string): string[] {
  const children = new Map<string, string[]>();
  for (const location of locations) {
    if (!location.parentId) continue;
    const list = children.get(location.parentId) ?? [];
    list.push(location.id);
    children.set(location.parentId, list);
  }
  const result: string[] = [];
  const stack = [rootId];
  while (stack.length) {
    const id = stack.pop()!;
    if (result.includes(id)) continue;
    result.push(id);
    stack.push(...(children.get(id) ?? []));
  }
  return result;
}

/** Prüft, dass eine Kiste nicht in sich selbst oder in ihren eigenen Inhalt gelegt wird. */
async function assertNoContainerCycle(db: Db, assetId: string, containerId: string) {
  let current: string | null = containerId;
  const seen = new Set<string>();
  while (current) {
    if (current === assetId) {
      throw new Error("Eine Kiste kann nicht in sich selbst liegen.");
    }
    if (seen.has(current)) break;
    seen.add(current);
    const parent: { containerId: string | null } | null = await db.inventoryAsset.findUnique({
      where: { id: current },
      select: { containerId: true },
    });
    current = parent?.containerId ?? null;
  }
}

/** Lagert ein Einzelstück oder eine Kiste an einen Ort oder in eine Kiste ein. */
export async function placeAsset(
  db: Db,
  input: { assetId: string; target: PlacementTarget; userId: string | null; via?: string },
) {
  const asset = await db.inventoryAsset.findUnique({
    where: { id: input.assetId },
    select: { id: true, kind: true, locationId: true, containerId: true },
  });
  if (!asset) throw new Error("Objekt nicht gefunden.");
  if (asset.kind === "bulk") {
    throw new Error("Mengenartikel werden über ihre Bestände umgelagert.");
  }

  let locationId: string | null = null;
  let containerId: string | null = null;
  let targetLabel = "ohne Ort";
  if (input.target.type === "location") {
    const location = await db.inventoryLocation.findUnique({
      where: { id: input.target.id },
      select: { id: true, name: true },
    });
    if (!location) throw new Error("Lagerort nicht gefunden.");
    locationId = location.id;
    targetLabel = location.name;
  } else if (input.target.type === "container") {
    const container = await db.inventoryAsset.findUnique({
      where: { id: input.target.id },
      select: {
        id: true,
        kind: true,
        code: true,
        label: true,
        product: { select: { name: true } },
      },
    });
    if (!container || container.kind !== "container") throw new Error("Das ist keine Kiste.");
    await assertNoContainerCycle(db, asset.id, container.id);
    containerId = container.id;
    targetLabel = `${container.code} ${assetDisplayName(container)}`;
  }

  if (asset.locationId === locationId && asset.containerId === containerId) {
    await db.inventoryAsset.update({
      where: { id: asset.id },
      data: { lastSeenAt: new Date() },
    });
    return { changed: false };
  }

  await db.inventoryAsset.update({
    where: { id: asset.id },
    data: { locationId, containerId, lastSeenAt: new Date() },
  });
  await recordEvent(db, {
    assetId: asset.id,
    type: "moved",
    message: `Eingelagert: ${targetLabel}`,
    data: { locationId, containerId, via: input.via ?? null },
    userId: input.userId,
  });
  await refreshAssetStatus(db, asset.id, { seen: true });
  return { changed: true };
}

/** Summe der Bestände eines Mengenartikels neu berechnen. */
export async function syncBulkQuantity(db: Db, assetId: string) {
  const total = await db.inventoryStock.aggregate({
    where: { assetId },
    _sum: { quantity: true },
  });
  await db.inventoryAsset.update({
    where: { id: assetId },
    data: { quantity: total._sum.quantity ?? 0 },
  });
}

/** Setzt die Menge eines Mengenartikels an einem Ort (legt den Bestand bei Bedarf an). */
export async function setBulkStock(
  db: Db,
  input: {
    assetId: string;
    target: PlacementTarget;
    quantity: number;
    userId: string | null;
    mode: "set" | "add";
  },
) {
  if (input.target.type === "none") throw new Error("Bitte einen Ort oder eine Kiste wählen.");
  const where =
    input.target.type === "location"
      ? { assetId: input.assetId, locationId: input.target.id, containerId: null }
      : { assetId: input.assetId, containerId: input.target.id };
  const existing = await db.inventoryStock.findFirst({ where });
  const previous = existing?.quantity ?? 0;
  const next = Math.max(0, input.mode === "add" ? previous + input.quantity : input.quantity);
  if (existing) {
    if (next === 0) {
      await db.inventoryStock.delete({ where: { id: existing.id } });
    } else {
      await db.inventoryStock.update({ where: { id: existing.id }, data: { quantity: next } });
    }
  } else if (next > 0) {
    await db.inventoryStock.create({
      data: {
        assetId: input.assetId,
        locationId: input.target.type === "location" ? input.target.id : null,
        containerId: input.target.type === "container" ? input.target.id : null,
        quantity: next,
      },
    });
  }
  await syncBulkQuantity(db, input.assetId);
  await db.inventoryAsset.update({
    where: { id: input.assetId },
    data: { lastSeenAt: new Date() },
  });
  if (previous !== next) {
    await recordEvent(db, {
      assetId: input.assetId,
      type: "stock",
      message: `Bestand ${previous} → ${next}`,
      data: { target: input.target, previous, next },
      userId: input.userId,
    });
  }
  return { previous, next };
}

/** Ermittelt Empfänger für Lager-Hinweise: alle, die das Lager verwalten. */
export async function inventoryManagerIds(): Promise<string[]> {
  return findUserIdsWithPermission(INVENTORY_PERMISSION_KEYS.manage);
}
