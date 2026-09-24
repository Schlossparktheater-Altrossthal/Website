import { beforeEach, describe, expect, it, vi } from "vitest";

const { findUnique, cookieGet } = vi.hoisted(() => ({
  findUnique: vi.fn(),
  cookieGet: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ prisma: { memberInvite: { findUnique } } }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: cookieGet }) }));

import { hashInviteToken } from "@/lib/member-invites";

import {
  canSignInAsReturnee,
  isInviteForMember,
  normalizeInviteTokenHash,
  resolveActiveInvite,
  resolveReturneeOnboardingPath,
} from "../returnee";

const usableInvite = {
  id: "invite-1",
  showId: "show-2027",
  personalForUserId: null,
  expiresAt: null,
  maxUses: null,
  usageCount: 0,
  isDisabled: false,
};

describe("Rückkehrer-Einladungen", () => {
  beforeEach(() => vi.clearAllMocks());

  it("akzeptiert Klartext-Token und Hash", () => {
    const hash = hashInviteToken("klartext-token");
    expect(normalizeInviteTokenHash("  klartext-token ")).toBe(hash);
    expect(normalizeInviteTokenHash(hash.toUpperCase())).toBe(hash);
  });

  it("liefert nur benutzbare Einladungen", async () => {
    findUnique.mockResolvedValueOnce(usableInvite);
    expect(await resolveActiveInvite("token")).toEqual({
      id: "invite-1",
      showId: "show-2027",
      personalForUserId: null,
    });

    findUnique.mockResolvedValueOnce({ ...usableInvite, isDisabled: true });
    expect(await resolveActiveInvite("token")).toBeNull();

    findUnique.mockResolvedValueOnce({ ...usableInvite, expiresAt: new Date("2020-01-01") });
    expect(await resolveActiveInvite("token")).toBeNull();
  });

  it("fragt ohne Token nicht die Datenbank", async () => {
    expect(await resolveActiveInvite("  ")).toBeNull();
    expect(await resolveActiveInvite(undefined)).toBeNull();
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("lässt deaktivierte Konten nur mit Einladung zum Login", () => {
    const invite = { id: "invite-1", showId: "show-2027", personalForUserId: null };
    expect(canSignInAsReturnee({ id: "u1", deactivatedAt: null }, null)).toBe(true);
    expect(canSignInAsReturnee({ id: "u1", deactivatedAt: new Date() }, null)).toBe(false);
    expect(canSignInAsReturnee({ id: "u1", deactivatedAt: new Date() }, invite)).toBe(true);
  });

  it("bindet persönliche Einladungen an das eingeladene Konto", () => {
    const personal = { id: "invite-2", showId: "show-2027", personalForUserId: "u1" };
    expect(canSignInAsReturnee({ id: "u1", deactivatedAt: new Date() }, personal)).toBe(true);
    expect(canSignInAsReturnee({ id: "u2", deactivatedAt: new Date() }, personal)).toBe(false);
    expect(isInviteForMember(personal, "u2")).toBe(false);
    expect(isInviteForMember({ personalForUserId: null }, "u2")).toBe(true);
  });

  it("schickt Rückkehrer mit gemerkter Einladung zum Rückkehrer-Onboarding", async () => {
    cookieGet.mockReturnValue({ value: "token/mit sonderzeichen" });
    findUnique.mockResolvedValueOnce({ ...usableInvite, personalForUserId: "u1" });
    expect(await resolveReturneeOnboardingPath("u1")).toBe(
      "/onboarding/token%2Fmit%20sonderzeichen/update",
    );

    findUnique.mockResolvedValueOnce({ ...usableInvite, personalForUserId: "u1" });
    expect(await resolveReturneeOnboardingPath("u2")).toBeNull();

    findUnique.mockResolvedValueOnce({ ...usableInvite, isDisabled: true });
    expect(await resolveReturneeOnboardingPath("u1")).toBeNull();
  });

  it("leitet ohne gemerkte Einladung nicht um", async () => {
    cookieGet.mockReturnValue(undefined);
    expect(await resolveReturneeOnboardingPath("u1")).toBeNull();
    expect(findUnique).not.toHaveBeenCalled();
  });
});
