import { beforeEach, describe, expect, it } from "vitest";

import { setProductionStatusAction } from "@/app/(members)/mitglieder/produktionen/actions/status";
import { prisma } from "@/lib/prisma";
import { buildProductionHistory } from "@/lib/produktionen/production-history";
import { previewSeasonChangeDeactivation } from "@/lib/season-reset/deactivation";

import {
  createTestShow,
  createTestUser,
  effectiveRoles,
  form,
  legacyShow,
  resetItState,
  signInAsAdmin,
} from "./harness";

// Testplan Abschnitt 7: Produktion beenden.
describe("Produktion beenden", () => {
  beforeEach(resetItState);

  it("beendet Mitgliedschaften, nimmt Rollen weg und macht Nur-Test-Mitglieder zu Kandidaten", async () => {
    await signInAsAdmin();
    const legacy = await legacyShow();
    const show = await createTestShow("active");
    const onlyHere = await createTestUser();
    const alsoLegacy = await createTestUser();
    await prisma.productionMembership.createMany({
      data: [
        { showId: show.id, userId: onlyHere.id, status: "active", roles: ["tech"] },
        { showId: show.id, userId: alsoLegacy.id, status: "active", roles: ["cast"] },
        { showId: legacy.id, userId: alsoLegacy.id, status: "active", roles: ["cast"] },
      ],
    });
    await prisma.userRole.createMany({
      data: [
        { userId: onlyHere.id, role: "tech" },
        { userId: alsoLegacy.id, role: "cast" },
      ],
    });
    expect((await previewSeasonChangeDeactivation()).map((c) => c.id)).not.toContain(onlyHere.id);

    const result = await setProductionStatusAction(form({ showId: show.id, status: "finished" }));

    expect(result).toMatchObject({
      ok: true,
      message: expect.stringMatching(/2 Mitgliedschaften/),
    });
    const memberships = await prisma.productionMembership.findMany({ where: { showId: show.id } });
    expect(memberships.every((entry) => entry.status === "left" && entry.leftAt)).toBe(true);
    expect(await effectiveRoles(onlyHere.id)).not.toContain("tech");
    // Die laufende „Die unendliche Geschichte“ vergibt weiter „Ensemble“.
    expect(await effectiveRoles(alsoLegacy.id)).toContain("cast");

    const candidates = (await previewSeasonChangeDeactivation()).map((c) => c.id);
    expect(candidates).toContain(onlyHere.id);
    expect(candidates).not.toContain(alsoLegacy.id);
  });

  it("Historie zeigt beide Produktionen mit Status", async () => {
    await signInAsAdmin();
    const first = await createTestShow("active");
    const second = await createTestShow("planning");
    const user = await createTestUser();
    await prisma.productionMembership.createMany({
      data: [
        { showId: first.id, userId: user.id, status: "active", roles: ["cast"] },
        { showId: second.id, userId: user.id, status: "active" },
      ],
    });
    await setProductionStatusAction(form({ showId: first.id, status: "finished" }));

    const memberships = await prisma.productionMembership.findMany({
      where: { userId: user.id },
      include: { show: { select: { title: true, year: true, status: true } } },
    });
    const history = buildProductionHistory(memberships, [], []);

    expect(history).toHaveLength(2);
    expect(history.find((entry) => entry.showId === first.id)).toMatchObject({
      productionStatus: "finished",
      membershipStatus: "left",
      roles: ["cast"],
    });
    expect(history.find((entry) => entry.showId === second.id)).toMatchObject({
      productionStatus: "planning",
      membershipStatus: "active",
    });
  });
});
