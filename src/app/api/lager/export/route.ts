import { NextResponse } from "next/server";

import {
  ASSET_KIND_LABELS,
  ASSET_STATUS_LABELS,
  assetDisplayName,
  CONDITION_LABELS,
  formatInventoryDate,
} from "@/lib/inventory/constants";
import { getInventoryAccess, loadLocationLabeler } from "@/lib/inventory/service";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/rbac";

function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const text = String(value);
  return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * Bestandsliste als CSV (Semikolon, für Excel/LibreOffice) – z. B. als Wertaufstellung für die
 * Versicherung. Enthält Preise, daher nur für die Lagerverwaltung.
 */
export async function GET() {
  const session = await getSession();
  const access = await getInventoryAccess(session?.user);
  if (!access.canManage) {
    return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });
  }
  const [assets, labeler] = await Promise.all([
    prisma.inventoryAsset.findMany({
      where: { status: { not: "retired" } },
      orderBy: { code: "asc" },
      select: {
        code: true,
        label: true,
        kind: true,
        status: true,
        condition: true,
        quantity: true,
        serialNumber: true,
        acquisitionCost: true,
        purchaseDate: true,
        ownership: true,
        nextInspectionAt: true,
        locationId: true,
        area: { select: { name: true } },
        product: {
          select: {
            name: true,
            unit: true,
            manufacturer: true,
            model: true,
            category: { select: { name: true } },
          },
        },
        container: { select: { code: true } },
      },
    }),
    loadLocationLabeler(),
  ]);
  const header = [
    "Code",
    "Name",
    "Bereich",
    "Kategorie",
    "Art",
    "Status",
    "Zustand",
    "Menge",
    "Einheit",
    "Ort",
    "Hersteller",
    "Modell",
    "Seriennummer",
    "Anschaffungspreis (EUR)",
    "Gesamtwert (EUR)",
    "Kaufdatum",
    "Eigentum",
    "Nächste Prüfung",
  ];
  const rows = assets.map((asset) => {
    const cost = asset.acquisitionCost ? Number(asset.acquisitionCost) : null;
    const quantity = asset.kind === "bulk" ? asset.quantity : 1;
    return [
      asset.code,
      assetDisplayName(asset),
      asset.area.name,
      asset.product.category?.name,
      ASSET_KIND_LABELS[asset.kind],
      ASSET_STATUS_LABELS[asset.status],
      CONDITION_LABELS[asset.condition],
      quantity,
      asset.product.unit,
      asset.container ? asset.container.code : labeler.label(asset.locationId),
      asset.product.manufacturer,
      asset.product.model,
      asset.serialNumber,
      cost?.toFixed(2).replace(".", ","),
      cost !== null ? (cost * quantity).toFixed(2).replace(".", ",") : null,
      asset.purchaseDate ? formatInventoryDate(asset.purchaseDate) : null,
      asset.ownership,
      asset.nextInspectionAt ? formatInventoryDate(asset.nextInspectionAt) : null,
    ]
      .map(csvCell)
      .join(";");
  });
  // BOM, damit Excel Umlaute richtig liest.
  const body = `﻿${[header.join(";"), ...rows].join("\r\n")}\r\n`;
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="lager-bestand.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
