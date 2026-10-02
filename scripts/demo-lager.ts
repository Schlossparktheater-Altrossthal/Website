// Demo-Lager für lokales Testen und Screenshots (docs/Plan/inventar-plan.md, docs/e2e-tests.md).
//
//   DATABASE_URL=… pnpm demo:lager          # anlegen bzw. neu anlegen
//   DATABASE_URL=… pnpm demo:lager --remove # wieder entfernen
//
// Legt den Lagerort „Demo-Lager“ mit zwei Regalen an, darin eine Kiste, Einzelstücke aus Technik
// und Kostüm, einen Mengenartikel unter Mindestbestand, einen gesperrten Scheinwerfer und
// überfällige Prüfungen. Alle Namen beginnen mit „Demo“. Nur für lokale/Test-DBs.

import { Prisma } from "@prisma/client";

import { addMonths } from "@/lib/inventory/constants";
import { allocateAssetCode, allocateLocationCode } from "@/lib/inventory/service";
import { prisma } from "@/lib/prisma";

const ROOT = "Demo-Lager";

async function remove() {
  const assets = await prisma.inventoryAsset.findMany({
    where: { name: { startsWith: "Demo" } },
    select: { id: true },
  });
  const ids = assets.map((asset) => asset.id);
  await prisma.inventoryCheckout.deleteMany({ where: { title: { startsWith: "Demo" } } });
  await prisma.inventoryAsset.updateMany({
    where: { id: { in: ids } },
    data: { containerId: null },
  });
  await prisma.inventoryAsset.deleteMany({ where: { id: { in: ids } } });
  const root = await prisma.inventoryLocation.findFirst({ where: { name: ROOT, parentId: null } });
  if (root) {
    await prisma.inventoryLocation.deleteMany({ where: { parentId: root.id } });
    await prisma.inventoryLocation.delete({ where: { id: root.id } });
  }
  return ids.length;
}

async function area(prefix: string) {
  return prisma.inventoryArea.findUniqueOrThrow({
    where: { prefix },
    select: { id: true, categories: { select: { id: true, name: true } } },
  });
}

async function location(name: string, parentId: string | null) {
  const code = await allocateLocationCode(prisma);
  return prisma.inventoryLocation.create({ data: { name, parentId, code }, select: { id: true } });
}

async function asset(data: Omit<Prisma.InventoryAssetUncheckedCreateInput, "code">) {
  const code = await allocateAssetCode(prisma, data.areaId);
  return prisma.inventoryAsset.create({
    data: { ...data, code },
    select: { id: true, code: true },
  });
}

async function main() {
  const url = process.env.DATABASE_URL ?? "";
  if (!/localhost|127\.0\.0\.1|mb-test-pg/.test(url)) {
    throw new Error("Nur gegen lokale Datenbanken (DATABASE_URL mit localhost).");
  }
  const removed = await remove();
  if (process.argv.includes("--remove")) {
    console.log(`${removed} Demo-Objekte entfernt.`);
    return;
  }

  const technik = await area("T");
  const kostuem = await area("K");
  const category = (entry: Awaited<ReturnType<typeof area>>, name: string) =>
    entry.categories.find((item) => item.name === name)?.id ?? null;

  const root = await location(ROOT, null);
  const regalA = await location("Regal A", root.id);
  const regalB = await location("Regal B", root.id);
  const fundus = await location("Kostümstange 1", root.id);

  const now = new Date();
  const box = await asset({
    areaId: technik.id,
    kind: "container",
    name: "Demo Kabelkiste 1",
    locationId: regalA.id,
    labelPrintedAt: now,
  });
  await asset({
    areaId: technik.id,
    categoryId: category(technik, "Licht"),
    name: "Demo LED-Scheinwerfer PAR 64",
    manufacturer: "Eurolite",
    model: "LED PAR-64 RGBW",
    locationId: regalA.id,
    inspectionRequired: true,
    inspectionIntervalMonths: 12,
    lastInspectionAt: addMonths(now, -10),
    nextInspectionAt: addMonths(now, 2),
    acquisitionCost: new Prisma.Decimal(89.9),
    attributes: { power: "180 W", connector: "Schuko" },
    labelPrintedAt: now,
  });
  const locked = await asset({
    areaId: technik.id,
    categoryId: category(technik, "Licht"),
    name: "Demo Stufenlinse 1 kW",
    locationId: regalA.id,
    status: "locked",
    inspectionRequired: true,
    nextInspectionAt: addMonths(now, -1),
  });
  await prisma.inventoryDefect.create({
    data: { assetId: locked.id, title: "Kabel am Stecker gebrochen", severity: "locked" },
  });
  await asset({
    areaId: technik.id,
    categoryId: category(technik, "Ton"),
    name: "Demo Funkmikrofon Sender 1",
    containerId: box.id,
    inspectionRequired: false,
  });
  const cable = await asset({
    areaId: technik.id,
    categoryId: category(technik, "Kabel"),
    kind: "bulk",
    name: "Demo XLR-Kabel 10 m",
    unit: "Stk.",
    minQuantity: 15,
    quantity: 12,
  });
  await prisma.inventoryStock.createMany({
    data: [
      { assetId: cable.id, containerId: box.id, quantity: 8 },
      { assetId: cable.id, locationId: regalB.id, quantity: 4 },
    ],
  });
  await asset({
    areaId: technik.id,
    categoryId: category(technik, "Strom"),
    name: "Demo Kabeltrommel 50 m",
    locationId: regalB.id,
    inspectionRequired: true,
    nextInspectionAt: null,
  });
  await asset({
    areaId: kostuem.id,
    categoryId: category(kostuem, "Kostüm"),
    name: "Demo Gehrock dunkelblau",
    locationId: fundus.id,
    attributes: { size: "52", era: "1880er", color: "dunkelblau", material: "Wolle" },
    publicNote: "Bitte nur mit Kleiderhülle transportieren.",
  });
  await asset({
    areaId: kostuem.id,
    categoryId: category(kostuem, "Hüte & Perücken"),
    name: "Demo Zylinder schwarz",
    locationId: fundus.id,
    attributes: { size: "58" },
  });
  console.log("Demo-Lager angelegt.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
