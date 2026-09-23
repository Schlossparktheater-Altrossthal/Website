import { beforeEach, describe, expect, it, vi } from "vitest";

const { findUnique } = vi.hoisted(() => ({ findUnique: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { memberInvite: { findUnique } } }));

import { hashInviteToken } from "@/lib/member-invites";

import { canSignInAsReturnee, normalizeInviteTokenHash, resolveActiveInvite } from "../returnee";

const usableInvite = {
  id: "invite-1",
  showId: "show-2027",
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
    expect(await resolveActiveInvite("token")).toEqual({ id: "invite-1", showId: "show-2027" });

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
    const invite = { id: "invite-1", showId: "show-2027" };
    expect(canSignInAsReturnee({ deactivatedAt: null }, null)).toBe(true);
    expect(canSignInAsReturnee({ deactivatedAt: new Date() }, null)).toBe(false);
    expect(canSignInAsReturnee({ deactivatedAt: new Date() }, invite)).toBe(true);
  });
});
