import { beforeEach, describe, expect, it } from "vitest";

import { bulkCreateAssetsAction } from "@/app/(members)/mitglieder/lager/actions/assets";
import {
  bulkMoveAssetsAction,
  bulkRetireAssetsAction,
  bulkUpdateAssetsAction,
  updateAssetFieldAction,
} from "@/app/(members)/mitglieder/lager/actions/bulk";
import { createPublicId } from "@/lib/inventory/public-id";
import { prisma } from "@/lib/prisma";

import { resetItState, signInAsAdmin } from "./harness";

// Sammelerfassung im Lager (docs/Plan/lager-tabelle-plan.md, Phase 1).
describe("Lager: Sammelerfassung", () => {
  beforeEach(resetItState);

  it("legt gültige Zeilen mit fortlaufenden Codes an und meldet fehlerhafte einzeln", async () => {
    await signInAsAdmin();
    const technik = await prisma.inventoryArea.findUniqueOrThrow({ where: { prefix: "T" } });
    const kostuem = await prisma.inventoryArea.findUniqueOrThrow({ where: { prefix: "K" } });
    const fremdeKategorie = await prisma.inventoryCategory.create({
      data: { areaId: kostuem.id, name: `IT-Kleider-${Date.now()}` },
    });
    const ort = await prisma.inventoryLocation.create({
      data: {
        code: `L-9${String(Date.now()).slice(-5)}`,
        publicId: createPublicId(),
        name: "IT-Regal",
      },
    });
    const start = technik.nextNumber;

    const result = await bulkCreateAssetsAction([
      {
        areaId: technik.id,
        kind: "unique",
        name: "PAR 64",
        placement: { type: "location", id: ort.id },
      },
      { areaId: technik.id, kind: "unique", name: "" },
      {
        areaId: technik.id,
        kind: "bulk",
        name: "Schuko 5 m",
        unit: "Stk.",
        quantity: 24,
        placement: { type: "location", id: ort.id },
      },
      { areaId: technik.id, kind: "unique", name: "Falsch", categoryId: fremdeKategorie.id },
    ]);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const results = result.data.results;
    expect(results.map((entry) => entry.ok)).toEqual([true, false, true, false]);
    expect(result.message).toBe("2 von 4 angelegt.");
    const codes = results.flatMap((entry) => (entry.ok ? entry.codes : []));
    expect(codes).toEqual([
      `T-${String(start).padStart(4, "0")}`,
      `T-${String(start + 1).padStart(4, "0")}`,
    ]);

    const par = await prisma.inventoryAsset.findUniqueOrThrow({ where: { code: codes[0] } });
    expect(par.locationId).toBe(ort.id);
    const kabel = await prisma.inventoryAsset.findUniqueOrThrow({
      where: { code: codes[1] },
      include: { stocks: true },
    });
    expect(kabel.quantity).toBe(24);
    expect(kabel.stocks).toHaveLength(1);
  });

  it("legt mehrere Exemplare eines Typs an und erfasst später weitere zum selben Typ", async () => {
    await signInAsAdmin();
    const technik = await prisma.inventoryArea.findUniqueOrThrow({ where: { prefix: "T" } });
    const result = await bulkCreateAssetsAction([
      {
        areaId: technik.id,
        kind: "unique",
        name: "Source Four",
        count: 3,
        specs: { power: "750" },
      },
      { areaId: technik.id, kind: "unique", name: "Mit Nummer", count: 2, serialNumber: "X1" },
      { areaId: technik.id, kind: "unique", name: "Falsche Zahl", specs: { power: "viel" } },
    ]);
    if (!result.ok) throw new Error(result.error);
    const [first, second, third] = result.data.results;
    expect(first).toMatchObject({ ok: true });
    expect(second).toMatchObject({ ok: false });
    expect(third).toMatchObject({ ok: false, error: expect.stringMatching(/Zahl/) });
    if (!first?.ok) return;
    expect(first.codes).toHaveLength(3);
    const assets = await prisma.inventoryAsset.findMany({
      where: { code: { in: first.codes } },
      include: { product: true },
    });
    expect(new Set(assets.map((asset) => asset.productId)).size).toBe(1);
    expect(new Set(assets.map((asset) => asset.publicId)).size).toBe(3);
    expect(assets[0]!.product.specs).toEqual({ power: 750 });

    const more = await bulkCreateAssetsAction([
      {
        areaId: technik.id,
        kind: "unique",
        name: "egal",
        productId: assets[0]!.productId,
        count: 2,
      },
    ]);
    if (!more.ok) throw new Error(more.error);
    expect(more.data.results[0]).toMatchObject({ ok: true });
    expect(await prisma.inventoryAsset.count({ where: { productId: assets[0]!.productId } })).toBe(
      5,
    );
  });

  it("lehnt zu viele Zeilen ab", async () => {
    await signInAsAdmin();
    const result = await bulkCreateAssetsAction(Array.from({ length: 201 }, () => ({})));
    expect(result).toMatchObject({ ok: false, error: expect.stringMatching(/200/) });
  });

  it("ändert in der Zelle und für mehrere Objekte, lagert um und mustert aus", async () => {
    await signInAsAdmin();
    const technik = await prisma.inventoryArea.findUniqueOrThrow({ where: { prefix: "T" } });
    const kostuem = await prisma.inventoryArea.findUniqueOrThrow({ where: { prefix: "K" } });
    const ort = await prisma.inventoryLocation.create({
      data: {
        code: `L-8${String(Date.now()).slice(-5)}`,
        publicId: createPublicId(),
        name: "IT-Regal 2",
      },
    });
    const created = await bulkCreateAssetsAction([
      { areaId: technik.id, kind: "unique", name: "A" },
      { areaId: technik.id, kind: "unique", name: "B" },
      {
        areaId: technik.id,
        kind: "bulk",
        name: "C",
        quantity: 3,
        placement: { type: "location", id: ort.id },
      },
      { areaId: kostuem.id, kind: "unique", name: "D" },
    ]);
    if (!created.ok) throw new Error(created.error);
    const codes = created.data.results.flatMap((entry) => (entry.ok ? entry.codes : []));
    const assets = await prisma.inventoryAsset.findMany({
      where: { code: { in: codes } },
      orderBy: { code: "asc" },
      include: { product: true },
    });
    const byName = Object.fromEntries(assets.map((asset) => [asset.product.name, asset]));
    const [a, b, c, d] = ["A", "B", "C", "D"].map((name) => byName[name]!);

    expect(await updateAssetFieldAction(a!.id, "name", "A neu")).toMatchObject({ ok: true });
    expect(await updateAssetFieldAction(a!.id, "name", " ")).toMatchObject({ ok: false });

    const kategorie = await prisma.inventoryCategory.create({
      data: { areaId: technik.id, name: `IT-Licht-${Date.now()}` },
    });
    expect(
      await bulkUpdateAssetsAction([a!.id, d!.id], { categoryId: kategorie.id }),
    ).toMatchObject({ ok: false });
    expect(
      await bulkUpdateAssetsAction([a!.id, b!.id], { categoryId: kategorie.id, condition: "worn" }),
    ).toMatchObject({ ok: true, message: "2 geändert." });

    const moved = await bulkMoveAssetsAction([a!.id, b!.id, c!.id], {
      type: "location",
      id: ort.id,
    });
    expect(moved).toMatchObject({ ok: true, data: { done: 2 } });
    if (moved.ok) expect(moved.data.skipped.map((entry) => entry.code)).toEqual([c!.code]);

    expect(await bulkRetireAssetsAction([a!.id, b!.id, c!.id, d!.id])).toMatchObject({
      ok: true,
      message: "4 ausgemustert.",
    });

    const after = await prisma.inventoryAsset.findMany({
      where: { id: { in: [a!.id, b!.id, c!.id] } },
      include: { stocks: true, product: true },
      orderBy: { product: { name: "asc" } },
    });
    expect(after.map((asset) => [asset.product.name, asset.status, asset.locationId])).toEqual([
      ["A neu", "retired", null],
      ["B", "retired", null],
      ["C", "retired", null],
    ]);
    expect(after[1]!.condition).toBe("worn");
    expect(after[1]!.product.categoryId).toBe(kategorie.id);
    expect(after[2]!.stocks).toHaveLength(0);
  });
});
