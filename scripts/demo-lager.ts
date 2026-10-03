// Demo-Lager für lokales Testen und Screenshots (docs/Plan/lager-typen-projekte-plan.md).
//
//   DATABASE_URL=… pnpm demo:lager          # anlegen bzw. neu anlegen
//   DATABASE_URL=… pnpm demo:lager --remove # wieder entfernen
//
// Legt den Lagerort „Demo-Lager“ mit Regalen an, darin eine Kiste, Artikeltypen mit mehreren
// Exemplaren an verschiedenen Orten (einer davon gesperrt), einen Mengenartikel unter
// Mindestbestand, überfällige Prüfungen und Kostüme. Alle Typnamen beginnen mit „Demo“.
// Nur für lokale/Test-DBs.

import { createAssetInTx, type AssetInput } from "@/lib/inventory/asset-write";
import { addMonths } from "@/lib/inventory/constants";
import { createPublicId } from "@/lib/inventory/public-id";
import { allocateLocationCode, refreshAssetStatus } from "@/lib/inventory/service";
import { prisma } from "@/lib/prisma";

const ROOT = "Demo-Lager";

async function remove() {
  const products = await prisma.inventoryProduct.findMany({
    where: { name: { startsWith: "Demo" } },
    select: { id: true },
  });
  const productIds = products.map((product) => product.id);
  await prisma.inventoryCheckout.deleteMany({ where: { title: { startsWith: "Demo" } } });
  await prisma.inventoryAsset.updateMany({
    where: { productId: { in: productIds } },
    data: { containerId: null },
  });
  await prisma.inventoryAsset.deleteMany({ where: { productId: { in: productIds } } });
  await prisma.inventoryProduct.deleteMany({ where: { id: { in: productIds } } });
  const root = await prisma.inventoryLocation.findFirst({ where: { name: ROOT, parentId: null } });
  if (root) {
    await prisma.inventoryLocation.deleteMany({ where: { parentId: root.id } });
    await prisma.inventoryLocation.delete({ where: { id: root.id } });
  }
  return productIds.length;
}

async function area(prefix: string) {
  return prisma.inventoryArea.findUniqueOrThrow({
    where: { prefix },
    select: { id: true, categories: { select: { id: true, name: true } } },
  });
}

async function location(name: string, parentId: string | null) {
  const code = await allocateLocationCode(prisma);
  return prisma.inventoryLocation.create({
    data: { name, parentId, code, publicId: createPublicId() },
    select: { id: true },
  });
}

type Draft = Partial<AssetInput> & Pick<AssetInput, "areaId" | "name">;

async function capture(draft: Draft) {
  const input: AssetInput = {
    kind: "unique",
    categoryId: null,
    productId: null,
    manufacturer: null,
    model: null,
    description: null,
    publicNote: null,
    specs: {},
    unit: null,
    minQuantity: null,
    inspectionRequired: false,
    inspectionIntervalMonths: null,
    label: null,
    serialNumber: null,
    internalNote: null,
    condition: "good",
    quantity: null,
    count: 1,
    placement: { type: "none" },
    nextInspectionAt: null,
    acquisitionCost: null,
    purchaseDate: null,
    supplier: null,
    ownership: null,
    ...draft,
  };
  return prisma.$transaction((tx) => createAssetInTx(tx, input, { userId: null, canManage: true }));
}

async function main() {
  const url = process.env.DATABASE_URL ?? "";
  if (!/localhost|127\.0\.0\.1|mb-test-pg/.test(url)) {
    throw new Error("Nur gegen lokale Datenbanken (DATABASE_URL mit localhost).");
  }
  const removed = await remove();
  if (process.argv.includes("--remove")) {
    console.log(`${removed} Demo-Artikeltypen entfernt.`);
    return;
  }

  const technik = await area("T");
  const kostuem = await area("K");
  const category = (entry: Awaited<ReturnType<typeof area>>, name: string) =>
    entry.categories.find((item) => item.name === name)?.id ?? null;

  const root = await location(ROOT, null);
  const regalA = await location("Regal A", root.id);
  const regalB = await location("Regal B", root.id);
  const buehne = await location("Bühne Zug 3", root.id);
  const fundus = await location("Kostümstange 1", root.id);

  const now = new Date();
  const { codes: boxCodes } = await capture({
    areaId: technik.id,
    kind: "container",
    name: "Demo Kabelkiste",
    label: "1",
    placement: { type: "location", id: regalA.id },
  });
  const box = await prisma.inventoryAsset.findUniqueOrThrow({ where: { code: boxCodes[0] } });

  // Ein Typ, viele Exemplare an verschiedenen Orten – einer davon defekt.
  const par = await capture({
    areaId: technik.id,
    categoryId: category(technik, "PAR / LED-PAR"),
    name: "Demo LED-PAR 64 RGBW",
    manufacturer: "Eurolite",
    model: "LED PAR-64 RGBW",
    specs: { power: "180", connector: "Schuko", dmxChannels: "8" },
    inspectionRequired: true,
    inspectionIntervalMonths: 12,
    count: 6,
    nextInspectionAt: addMonths(now, 2),
    acquisitionCost: 89.9,
    placement: { type: "location", id: regalA.id },
  });
  const parAssets = await prisma.inventoryAsset.findMany({
    where: { code: { in: par.codes } },
    orderBy: { code: "asc" },
  });
  await prisma.inventoryAsset.updateMany({
    where: { id: { in: parAssets.slice(0, 4).map((asset) => asset.id) } },
    data: { locationId: buehne.id },
  });
  await prisma.inventoryDefect.create({
    data: {
      assetId: parAssets[5]!.id,
      title: "Lüfter klappert",
      severity: "limited",
      status: "repair",
    },
  });
  await refreshAssetStatus(prisma, parAssets[5]!.id);

  const profiler = await capture({
    areaId: technik.id,
    categoryId: category(technik, "Profilscheinwerfer"),
    name: "Demo Profilscheinwerfer 750 W",
    manufacturer: "ETC",
    model: "Source Four",
    specs: { power: "750", lamp: "HPL 750", beamAngle: "26" },
    inspectionRequired: true,
    count: 3,
    nextInspectionAt: addMonths(now, -1),
    placement: { type: "location", id: regalB.id },
  });
  const locked = await prisma.inventoryAsset.findUniqueOrThrow({
    where: { code: profiler.codes[0] },
  });
  await prisma.inventoryDefect.create({
    data: { assetId: locked.id, title: "Kabel am Stecker gebrochen", severity: "locked" },
  });
  await refreshAssetStatus(prisma, locked.id);

  await capture({
    areaId: technik.id,
    categoryId: category(technik, "Kondensator"),
    name: "Demo Kondensatormikrofon",
    manufacturer: "Rode",
    model: "NT5",
    specs: { pattern: "Niere", phantom: true },
    count: 2,
    placement: { type: "container", id: box.id },
  });
  await capture({
    areaId: technik.id,
    categoryId: category(technik, "Endstufen"),
    name: "Demo Endstufe 2×700 W",
    manufacturer: "the t.amp",
    model: "TSA 4-700",
    specs: { channels: "2", power4ohm: "700" },
    inspectionRequired: true,
    placement: { type: "location", id: regalB.id },
  });
  await capture({
    areaId: technik.id,
    categoryId: category(technik, "Kabel"),
    kind: "bulk",
    name: "Demo XLR-Kabel 10 m",
    unit: "Stk.",
    minQuantity: 15,
    quantity: 8,
    placement: { type: "container", id: box.id },
  });
  await capture({
    areaId: technik.id,
    categoryId: category(technik, "Strom"),
    name: "Demo Kabeltrommel 50 m",
    inspectionRequired: true,
    placement: { type: "location", id: regalB.id },
  });
  await capture({
    areaId: kostuem.id,
    categoryId: category(kostuem, "Kostüm"),
    name: "Demo Gehrock dunkelblau",
    specs: { size: "52", era: "1880er", color: "dunkelblau", material: "Wolle", gender: "Herren" },
    publicNote: "Bitte nur mit Kleiderhülle transportieren.",
    placement: { type: "location", id: fundus.id },
  });
  await capture({
    areaId: kostuem.id,
    categoryId: category(kostuem, "Hüte & Perücken"),
    name: "Demo Zylinder schwarz",
    specs: { size: "58" },
    count: 2,
    placement: { type: "location", id: fundus.id },
  });
  console.log("Demo-Lager angelegt.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
