import { beforeEach, describe, expect, it } from "vitest";

import { setActiveProductionAction } from "@/app/(members)/mitglieder/produktionen/actions/production";
import { prisma } from "@/lib/prisma";
import {
  performSeasonChangeDeactivation,
  previewSeasonChangeDeactivation,
} from "@/lib/season-reset/deactivation";

import {
  createTestShow,
  createTestUser,
  form,
  itState,
  resetItState,
  signInAsAdmin,
} from "./harness";

// Testplan Abschnitt 2: Aktive Produktion wechseln & Saisonabschluss.
describe("Aktive Produktion & Saisonabschluss", () => {
  beforeEach(resetItState);

  it("Wechsel der aktiven Produktion deaktiviert niemanden", async () => {
    await signInAsAdmin();
    const activeBefore = await prisma.user.count({ where: { deactivatedAt: null } });

    const result = await setActiveProductionAction(form({ showId: "show2027" }));

    expect(result).toMatchObject({ ok: true });
    expect(itState.cookies.get("active-production")).toBe("show2027");
    expect(await prisma.user.count({ where: { deactivatedAt: null } })).toBe(activeBefore);
  });

  it("Vorschau listet nur Aktive ohne laufende Produktion und ohne geschützte Rolle", async () => {
    const withoutProduction = await createTestUser();
    const inPlanning = await createTestUser();
    const leftOnly = await createTestUser();
    const planning = await createTestShow("planning");
    const finished = await createTestShow("finished");
    await prisma.productionMembership.create({
      data: { showId: planning.id, userId: inPlanning.id, status: "active" },
    });
    await prisma.productionMembership.create({
      data: { showId: finished.id, userId: leftOnly.id, status: "left", leftAt: new Date() },
    });

    const ids = (await previewSeasonChangeDeactivation()).map((candidate) => candidate.id);

    expect(ids).toContain(withoutProduction.id);
    expect(ids).toContain(leftOnly.id);
    expect(ids).not.toContain(inPlanning.id);
    // Bestandsmitglieder sind nach der Migration in „Die unendliche Geschichte“ (aktiv).
    const legacyMembers = await prisma.productionMembership.findMany({
      where: { show: { title: "Die unendliche Geschichte" }, status: "active" },
      select: { userId: true },
    });
    for (const { userId } of legacyMembers) expect(ids).not.toContain(userId);
  });

  it("Abschluss deaktiviert genau die Vorschau abzüglich der Ausnahmen", async () => {
    const goes = await createTestUser();
    const stays = await createTestUser();
    const others = (await previewSeasonChangeDeactivation())
      .map((candidate) => candidate.id)
      .filter((id) => id !== goes.id);

    const count = await performSeasonChangeDeactivation(others);

    expect(count).toBe(1);
    expect(
      (await prisma.user.findUniqueOrThrow({ where: { id: goes.id } })).deactivatedAt,
    ).not.toBeNull();
    expect(others).toContain(stays.id);
    expect(
      (await prisma.user.findUniqueOrThrow({ where: { id: stays.id } })).deactivatedAt,
    ).toBeNull();
  });
});
