import { beforeEach, describe, expect, it } from "vitest";

import { bulkCreateAssetsAction } from "@/app/(members)/mitglieder/lager/actions/assets";
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
      data: { code: `L-9${String(Date.now()).slice(-5)}`, name: "IT-Regal" },
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
    const codes = results.flatMap((entry) => (entry.ok ? [entry.code] : []));
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

  it("lehnt zu viele Zeilen ab", async () => {
    await signInAsAdmin();
    const result = await bulkCreateAssetsAction(Array.from({ length: 201 }, () => ({})));
    expect(result).toMatchObject({ ok: false, error: expect.stringMatching(/200/) });
  });
});
