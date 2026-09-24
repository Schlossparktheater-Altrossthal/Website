import { beforeEach, describe, expect, it } from "vitest";

import {
  addProductionMemberAction,
  removeProductionMemberAction,
  updateProductionMemberAction,
} from "@/app/(members)/mitglieder/produktionen/actions/ensemble";
import { PUT as putRoles } from "@/app/api/members/roles/route";
import { prisma } from "@/lib/prisma";

import {
  createTestShow,
  createTestUser,
  effectiveRoles,
  form,
  itState,
  jsonRequest,
  resetItState,
  signInAsAdmin,
} from "./harness";

// Testplan Abschnitt 3: Ensemble & Rollen (Rollen pro Produktion, nur durch Admins).
describe("Ensemble & Rollen", () => {
  beforeEach(resetItState);

  async function memberIn(showId: string) {
    const user = await createTestUser();
    const membership = await prisma.productionMembership.create({
      data: { showId, userId: user.id, status: "active" },
    });
    return { user, membership };
  }

  it("Technik im Ensemble setzen und entfernen ändert die globale Rolle mit", async () => {
    await signInAsAdmin();
    const show = await createTestShow("active");
    const { user, membership } = await memberIn(show.id);

    await updateProductionMemberAction(
      form({ membershipId: membership.id, roles: "tech", function: "Licht" }),
    );
    expect(await effectiveRoles(user.id)).toContain("tech");

    await updateProductionMemberAction(form({ membershipId: membership.id, function: "Licht" }));
    expect(await effectiveRoles(user.id)).not.toContain("tech");
    expect(
      await prisma.productionMembership.findUniqueOrThrow({ where: { id: membership.id } }),
    ).toMatchObject({ roles: [], function: "Licht" });
  });

  it("behält Technik, solange eine andere laufende Produktion sie vergibt", async () => {
    await signInAsAdmin();
    const first = await createTestShow("active");
    const second = await createTestShow("planning");
    const { user, membership } = await memberIn(first.id);
    await prisma.productionMembership.create({
      data: { showId: second.id, userId: user.id, status: "active", roles: ["tech"] },
    });

    await updateProductionMemberAction(form({ membershipId: membership.id, roles: "tech" }));
    await updateProductionMemberAction(form({ membershipId: membership.id }));

    expect(await effectiveRoles(user.id)).toContain("tech");
  });

  it("Rollen-Editor legt „Ensemble“ in der ausgewählten Produktion ab", async () => {
    await signInAsAdmin();
    const show = await createTestShow("planning");
    const user = await createTestUser();
    itState.cookies.set("active-production", show.id);

    const response = await putRoles(
      jsonRequest("/api/members/roles", "PUT", { userId: user.id, roles: ["member", "cast"] }),
    );

    expect(response.status).toBe(200);
    expect(
      await prisma.productionMembership.findUniqueOrThrow({
        where: { showId_userId: { showId: show.id, userId: user.id } },
      }),
    ).toMatchObject({ roles: ["cast"], status: "active" });
    expect(await effectiveRoles(user.id)).toEqual(["cast", "member"]);
  });

  it("Aufnahme ohne Onboarding ist „eingeladen“, mit Onboarding „aktiv“", async () => {
    await signInAsAdmin();
    const show = await createTestShow("planning");
    const fresh = await createTestUser();
    const onboarded = await createTestUser();
    await prisma.productionOnboarding.create({
      data: { userId: onboarded.id, showId: show.id, focus: "both", completedAt: new Date() },
    });

    await addProductionMemberAction(form({ showId: show.id, userId: fresh.id }));
    await addProductionMemberAction(form({ showId: show.id, userId: onboarded.id }));

    const statusOf = async (userId: string) =>
      (
        await prisma.productionMembership.findUniqueOrThrow({
          where: { showId_userId: { showId: show.id, userId } },
        })
      ).status;
    expect(await statusOf(fresh.id)).toBe("invited");
    expect(await statusOf(onboarded.id)).toBe("active");
  });

  it("Entfernen beendet die Mitgliedschaft und nimmt Produktionsrollen weg", async () => {
    await signInAsAdmin();
    const show = await createTestShow("active");
    const { user, membership } = await memberIn(show.id);
    await updateProductionMemberAction(form({ membershipId: membership.id, roles: "cast" }));

    await removeProductionMemberAction(form({ membershipId: membership.id }));

    expect(
      await prisma.productionMembership.findUniqueOrThrow({ where: { id: membership.id } }),
    ).toMatchObject({ status: "left" });
    expect(await effectiveRoles(user.id)).not.toContain("cast");
  });

  it("Mitglieder ohne Verwaltungsrecht dürfen keine Rollen setzen", async () => {
    const show = await createTestShow("active");
    const { membership } = await memberIn(show.id);
    const plain = await createTestUser();
    const { signIn } = await import("./harness");
    await signIn(plain.id);

    const result = await updateProductionMemberAction(
      form({ membershipId: membership.id, roles: "tech" }),
    );

    expect(result.ok).toBe(false);
  });
});
