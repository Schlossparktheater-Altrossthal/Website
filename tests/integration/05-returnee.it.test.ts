import { beforeEach, describe, expect, it, vi } from "vitest";

import { inviteFormerMembersAction } from "@/app/(members)/mitglieder/produktionen/actions/ensemble";
import { GET as listInvites } from "@/app/api/member-invites/route";
import { POST as passwordEmail } from "@/app/api/auth/password-email/route";
import { POST as onboardingUpdate } from "@/app/api/onboarding/update/route";
import { canSignInAsReturnee, resolveActiveInvite } from "@/lib/onboarding/returnee";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";

import {
  createTestShow,
  createTestUser,
  form,
  itState,
  jsonRequest,
  multipartRequest,
  resetItState,
  returneeUpdatePayload,
  signIn,
  signInAsAdmin,
  tokenFromLink,
} from "./harness";

const authentik = vi.hoisted(() => ({ sendPasswordEmail: vi.fn() }));
vi.mock("@/lib/authentik/config", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/authentik/config")>()),
  isAuthentikProvisioningEnabled: () => true,
}));
vi.mock("@/lib/authentik/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/authentik/client")>()),
  sendAuthentikPasswordEmail: authentik.sendPasswordEmail,
}));
vi.mock("@/lib/authentik/sync", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/authentik/sync")>()),
  ensureAuthentikUserForMember: async () => ({ user: { pk: 1 }, created: false, claimed: false }),
}));

function submitUpdate(token: string, payload = returneeUpdatePayload()) {
  return onboardingUpdate(
    multipartRequest("/api/onboarding/update", {
      payload: JSON.stringify(payload),
      onboardingToken: token,
    }),
  );
}

// Testplan Abschnitt 5: Rückkehrer mit persönlichem Link.
describe("Rückkehrer", () => {
  beforeEach(() => {
    resetItState();
    authentik.sendPasswordEmail.mockReset();
  });

  /** Ehemaliges Mitglied B: war in einer beendeten Produktion (Technik), ist deaktiviert. */
  async function formerMember() {
    const old = await createTestShow("finished");
    const b = await createTestUser({ deactivated: true, firstName: "Bea" });
    await prisma.productionMembership.create({
      data: { showId: old.id, userId: b.id, status: "left", leftAt: new Date(), roles: ["tech"] },
    });
    await prisma.dietaryRestriction.create({
      data: { userId: b.id, allergen: "Erdnüsse", level: "SEVERE", isActive: true },
    });
    return b;
  }

  async function inviteB(showId: string, userId: string) {
    itState.mailEnabled = false; // Link statt Mail zurückbekommen
    const result = await inviteFormerMembersAction(form({ showId, userIds: userId }));
    if (!result.ok) throw new Error(result.error);
    return tokenFromLink(result.outcomes[0]?.link);
  }

  it("Einladung per Mail: B bekommt persönlichen Link, Mitgliedschaft „eingeladen“", async () => {
    await signInAsAdmin();
    const show = await createTestShow("planning");
    const b = await formerMember();

    const result = await inviteFormerMembersAction(form({ showId: show.id, userIds: b.id }));

    expect(result).toMatchObject({ ok: true, outcomes: [{ status: "sent" }] });
    expect(itState.mails).toHaveLength(1);
    expect(itState.mails[0]).toMatchObject({ to: b.email });
    expect(itState.mails[0]!.text).toMatch(/\/onboarding\/[^/\s]+\/update/);
    expect(
      await prisma.productionMembership.findUniqueOrThrow({
        where: { showId_userId: { showId: show.id, userId: b.id } },
      }),
    ).toMatchObject({ status: "invited" });
    expect(
      await prisma.memberInvite.findFirstOrThrow({ where: { personalForUserId: b.id } }),
    ).toMatchObject({ maxUses: 1, roles: ["member", "tech"] });
  });

  it("persönliche Links erscheinen nicht in der Liste der Einladungslinks", async () => {
    await signInAsAdmin();
    const show = await createTestShow("planning");
    const b = await formerMember();
    await inviteB(show.id, b.id);

    const list = (await (await listInvites()).json()) as {
      invites: { id: string }[];
      personalInviteCount: number;
    };
    const personal = await prisma.memberInvite.findMany({ where: { personalForUserId: b.id } });

    expect(list.personalInviteCount).toBeGreaterThanOrEqual(1);
    for (const invite of personal) {
      expect(list.invites.map((entry) => entry.id)).not.toContain(invite.id);
    }
  });

  it("Login: nur B mit eigenem Link, Konto bleibt bis zum Abschluss gesperrt", async () => {
    await signInAsAdmin();
    const show = await createTestShow("planning");
    const b = await formerMember();
    const a = await createTestUser({ deactivated: true });
    const token = await inviteB(show.id, b.id);

    const invite = await resolveActiveInvite(token);
    expect(invite).not.toBeNull();
    expect(canSignInAsReturnee(b, invite)).toBe(true);
    expect(canSignInAsReturnee(b, null)).toBe(false);
    // Fremder Link hilft einem anderen deaktivierten Konto nicht.
    expect(canSignInAsReturnee(a, invite)).toBe(false);

    await signIn(b.id);
    await expect(requireAuth()).rejects.toThrow(/REDIRECT:\/login\?error=AccessDenied/);
  });

  it("fremdes Konto kann den persönlichen Link nicht einlösen", async () => {
    await signInAsAdmin();
    const show = await createTestShow("planning");
    const b = await formerMember();
    const token = await inviteB(show.id, b.id);
    const a = await createTestUser();
    await signIn(a.id);

    const response = await submitUpdate(token);

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ error: expect.stringMatching(/andere Person/) });
  });

  it("Abschluss reaktiviert B, Ensemble aktiv, Allergien aktualisiert, Link verbraucht", async () => {
    await signInAsAdmin();
    const show = await createTestShow("planning");
    const b = await formerMember();
    const token = await inviteB(show.id, b.id);
    await signIn(b.id);

    const response = await submitUpdate(
      token,
      returneeUpdatePayload({
        dietary: [
          { allergen: "Laktose", level: "MILD", symptoms: null, treatment: null, note: null },
        ],
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ success: true, reactivated: true });
    expect((await prisma.user.findUniqueOrThrow({ where: { id: b.id } })).deactivatedAt).toBeNull();
    expect(
      await prisma.productionMembership.findUniqueOrThrow({
        where: { showId_userId: { showId: show.id, userId: b.id } },
      }),
    ).toMatchObject({ status: "active", leftAt: null });
    expect(
      await prisma.productionOnboarding.findUniqueOrThrow({
        where: { userId_showId: { userId: b.id, showId: show.id } },
      }),
    ).toMatchObject({ isReturning: true, completedAt: expect.any(Date) });
    const dietary = await prisma.dietaryRestriction.findMany({
      where: { userId: b.id },
      select: { allergen: true, isActive: true },
      orderBy: { allergen: "asc" },
    });
    expect(dietary).toEqual([
      { allergen: "Erdnüsse", isActive: false },
      { allergen: "Laktose", isActive: true },
    ]);

    // Einmal nutzbar: zweiter Aufruf findet keine aktive Einladung mehr.
    expect(await resolveActiveInvite(token)).toBeNull();

    // Nach erneutem Login ist der Mitgliederbereich erreichbar.
    await signIn(b.id);
    await expect(requireAuth()).resolves.toMatchObject({ user: { id: b.id } });
  });

  it("deaktiviert ohne Einladung: Update wird abgelehnt", async () => {
    const b = await formerMember();
    await signIn(b.id);

    const response = await onboardingUpdate(
      multipartRequest("/api/onboarding/update", {
        payload: JSON.stringify(returneeUpdatePayload()),
      }),
    );

    expect(response.status).toBe(403);
    expect(
      (await prisma.user.findUniqueOrThrow({ where: { id: b.id } })).deactivatedAt,
    ).not.toBeNull();
  });

  it("Passwort vergessen: deaktiviert nur mit eigenem Einladungslink", async () => {
    await signInAsAdmin();
    const show = await createTestShow("planning");
    const b = await formerMember();
    const token = await inviteB(show.id, b.id);

    await passwordEmail(jsonRequest("/api/auth/password-email", "POST", { email: b.email }));
    expect(authentik.sendPasswordEmail).not.toHaveBeenCalled();

    await passwordEmail(
      jsonRequest("/api/auth/password-email", "POST", { email: b.email, onboardingToken: token }),
    );
    expect(authentik.sendPasswordEmail).toHaveBeenCalledTimes(1);
  });
});
