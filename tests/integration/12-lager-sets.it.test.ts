import { beforeEach, describe, expect, it } from "vitest";

import { bulkCreateAssetsAction } from "@/app/(members)/mitglieder/lager/actions/assets";
import {
  addProjectLineAction,
  saveProjectAction,
} from "@/app/(members)/mitglieder/lager/actions/projects";
import { createSetAction } from "@/app/(members)/mitglieder/lager/actions/sets";
import { getInventoryProjectDetail } from "@/lib/inventory/projects";
import { prisma } from "@/lib/prisma";

import { resetItState, signInAsAdmin } from "./harness";

// Sets und Projekt-Verfügbarkeit (docs/Plan/lager-typen-projekte-plan.md, Phase 6–8).
describe("Lager: Sets und Projekte", () => {
  beforeEach(resetItState);

  it("rechnet Sets auf Bestandteile herunter – auch über Projekte hinweg", async () => {
    await signInAsAdmin();
    const technik = await prisma.inventoryArea.findUniqueOrThrow({ where: { prefix: "T" } });
    const stamp = Date.now().toString(36);
    const created = await bulkCreateAssetsAction([
      { areaId: technik.id, kind: "unique", name: `IT Sender ${stamp}`, count: 4 },
      { areaId: technik.id, kind: "unique", name: `IT Empfänger ${stamp}`, count: 3 },
    ]);
    if (!created.ok) throw new Error(created.error);
    const [sender, receiver] = await Promise.all(
      [`IT Sender ${stamp}`, `IT Empfänger ${stamp}`].map((name) =>
        prisma.inventoryProduct.findFirstOrThrow({ where: { name } }),
      ),
    );

    // Verschachtelte Sets sind nicht erlaubt.
    const set = await createSetAction({
      product: { areaId: technik.id, name: `IT Funkstrecke ${stamp}` },
      components: [
        { productId: sender!.id, quantity: 1 },
        { productId: receiver!.id, quantity: 1 },
      ],
    });
    if (!set.ok) throw new Error(set.error);
    const setProduct = await prisma.inventoryProduct.findUniqueOrThrow({
      where: { publicId: set.data.publicId },
    });
    expect(setProduct.kind).toBe("set");
    const nested = await createSetAction({
      product: { areaId: technik.id, name: `IT Doppel ${stamp}` },
      components: [{ productId: setProduct.id, quantity: 2 }],
    });
    expect(nested).toMatchObject({ ok: false, error: expect.stringMatching(/selbst ein Set/) });

    const phases = [{ kind: "event" as const, startsOn: "2032-05-01", endsOn: "2032-05-02" }];
    const a = await saveProjectAction(null, {
      title: `IT A ${stamp}`,
      status: "confirmed",
      phases,
    });
    const b = await saveProjectAction(null, {
      title: `IT B ${stamp}`,
      status: "confirmed",
      phases,
    });
    if (!a.ok || !b.ok) throw new Error("Projekt");
    const projectA = await prisma.inventoryProject.findUniqueOrThrow({
      where: { publicId: a.data.publicId },
    });
    const projectB = await prisma.inventoryProject.findUniqueOrThrow({
      where: { publicId: b.data.publicId },
    });

    // A: 2 Funkstrecken (= 2 Sender, 2 Empfänger). B: 1 Empfänger direkt + 1 Funkstrecke.
    expect(
      await addProjectLineAction(projectA.id, { productId: setProduct.id, quantity: 2 }),
    ).toMatchObject({ ok: true });
    await addProjectLineAction(projectB.id, { productId: receiver!.id, quantity: 1 });
    await addProjectLineAction(projectB.id, { productId: setProduct.id, quantity: 1 });

    const detailB = await getInventoryProjectDetail(b.data.publicId);
    const setLine = detailB!.lines.find((line) => line.product.id === setProduct.id)!;
    // Empfänger: 3 da, 2 von A belegt → 1 frei, B braucht 1 (direkt) + 1 (Set) = 2 – beide fehlen.
    expect(setLine.availability?.capacity).toBe(3);
    expect(setLine.verdict).toBe("short");
    const receiverLine = detailB!.lines.find((line) => line.product.id === receiver!.id)!;
    expect(receiverLine.availability?.confirmed).toBe(2);
    expect(receiverLine.verdict).toBe("short");

    // A sieht umgekehrt B: Empfänger 3 − 2 (B) = 1 frei, A braucht 2 Funkstrecken.
    const detailA = await getInventoryProjectDetail(a.data.publicId);
    expect(detailA!.lines[0]!.verdict).toBe("short");
  });
});
