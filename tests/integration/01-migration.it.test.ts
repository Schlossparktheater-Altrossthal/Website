import { describe, expect, it } from "vitest";

import { prisma } from "@/lib/prisma";
import { collectRetentionCandidates } from "@/lib/retention";

import { LEGACY_SHOW_TITLE, legacyShow, readPreMigrationSnapshot, teaserShow } from "./harness";

// Testplan Abschnitt 1: Zustand direkt nach allen Migrationen auf Prod-Daten (mit „???“ 2027).
describe("Migration auf Prod-Daten", () => {
  const before = readPreMigrationSnapshot();

  it("setzt „Die unendliche Geschichte“ aktiv und lässt „???“ in Planung", async () => {
    const shows = await prisma.show.findMany({ select: { title: true, status: true } });
    expect(shows).toEqual(
      expect.arrayContaining([
        { title: LEGACY_SHOW_TITLE, status: "active" },
        { title: "???", status: "planning" },
      ]),
    );
    expect(shows.filter((show) => show.status === "active")).toHaveLength(1);
  });

  it("hängt alle bisherigen Fotoerlaubnisse unverändert an „Die unendliche Geschichte“", async () => {
    const show = await legacyShow();
    const consents = await prisma.photoConsent.findMany({
      select: { userId: true, showId: true, status: true },
    });

    expect(before.consents).toBeGreaterThan(0);
    expect(consents).toHaveLength(before.consents);
    expect(consents.every((consent) => consent.showId === show.id)).toBe(true);
    for (const consent of consents) {
      expect(consent.status).toBe(before.consentStatus[consent.userId]);
    }
    expect(await prisma.photoConsent.count({ where: { showId: (await teaserShow()).id } })).toBe(0);
  });

  it("gibt allen aktiven Mitgliedern eine aktive Mitgliedschaft", async () => {
    const show = await legacyShow();
    const memberships = await prisma.productionMembership.findMany({
      where: { showId: show.id },
      select: { userId: true, status: true, leftAt: true },
    });
    const byUser = new Map(memberships.map((entry) => [entry.userId, entry]));

    expect(before.activeUsers.length).toBeGreaterThan(0);
    for (const userId of before.activeUsers) {
      expect(byUser.get(userId), userId).toMatchObject({ status: "active", leftAt: null });
    }
    // In „???“ bleibt es bei den Mitgliedschaften von vor der Migration.
    const teaser = await prisma.productionMembership.findMany({
      where: { showId: (await teaserShow()).id },
      select: { userId: true },
      orderBy: { userId: "asc" },
    });
    expect(teaser.map((entry) => entry.userId)).toEqual(before.teaserMembers);
  });

  it("übernimmt Ensemble/Technik in die Mitgliedschaft", async () => {
    const show = await legacyShow();
    const memberships = await prisma.productionMembership.findMany({
      where: { showId: show.id },
      select: { userId: true, roles: true },
    });
    for (const membership of memberships) {
      const expected = (before.roles[membership.userId] ?? [])
        .filter((role) => role === "cast" || role === "tech")
        .sort();
      expect([...membership.roles].sort(), membership.userId).toEqual(expected);
    }
  });

  it("verändert keine globalen Rollen (Vorstand/Finanzen/Owner bekommen kein „Ensemble“)", async () => {
    const users = await prisma.user.findMany({ include: { roles: true } });
    for (const user of users) {
      const after = Array.from(
        new Set([user.role, ...user.roles.map((entry) => entry.role)].map(String)),
      ).sort();
      expect(after, user.id).toEqual(before.roles[user.id]);
    }
  });

  it("ordnet jedes Onboarding einer Produktion zu, keins „???“", async () => {
    expect(
      await prisma.productionOnboarding.count({ where: { showId: (await teaserShow()).id } }),
    ).toBe(0);
    const profiles = await prisma.memberOnboardingProfile.count();
    const onboardings = await prisma.productionOnboarding.count();
    expect(onboardings).toBeGreaterThan(0);
    expect(onboardings).toBeLessThanOrEqual(profiles);
  });

  it("findet direkt nach der Migration keine Löschkandidaten", async () => {
    const candidates = await collectRetentionCandidates();
    for (const list of Object.values(candidates)) {
      expect(list).toEqual([]);
    }
  });
});
