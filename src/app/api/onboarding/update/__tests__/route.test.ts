import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "../route";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  getActiveProductionId: vi.fn(),
  inviteFindUnique: vi.fn(),
  consentUpsert: vi.fn(),
  membershipUpsert: vi.fn(),
  onboardingUpsert: vi.fn(),
  userUpdate: vi.fn(),
  sync: vi.fn(),
  syncRoles: vi.fn(),
}));

vi.mock("@/lib/authentik/service-groups", () => ({ requestServiceGroupSync: mocks.sync }));
vi.mock("@/lib/produktionen/production-roles", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/produktionen/production-roles")>()),
  syncProductionRoles: mocks.syncRoles,
}));

vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/active-production", () => ({
  getActiveProductionId: mocks.getActiveProductionId,
}));
vi.mock("@/lib/member-invites", () => ({
  calculateInviteStatus: () => ({ isActive: true }),
  hashInviteToken: (token: string) => `hash-${token}`,
}));
vi.mock("@/lib/prisma", () => {
  const tx = {
    memberOnboardingProfile: {
      upsert: vi.fn().mockResolvedValue({ id: "profile-1", focus: "tech" }),
    },
    productionOnboarding: { upsert: mocks.onboardingUpsert },
    memberRolePreference: { deleteMany: vi.fn(), createMany: vi.fn() },
    dietaryRestriction: { upsert: vi.fn(), updateMany: vi.fn() },
    photoConsent: { upsert: mocks.consentUpsert },
    productionMembership: { upsert: mocks.membershipUpsert },
    user: { update: mocks.userUpdate },
  };
  return {
    prisma: {
      memberInvite: { findUnique: mocks.inviteFindUnique },
      $transaction: async <T>(fn: (client: typeof tx) => Promise<T>) => fn(tx),
    },
  };
});

const payload = {
  educationCategory: "work",
  educationSchoolName: null,
  educationClassName: null,
  educationWorkDescription: "Büro",
  educationUniversityName: null,
  educationOtherDescription: null,
  preferences: [],
  dietaryPreference: null,
  dietaryPreferenceStrictness: null,
  dietary: [],
  notes: null,
  photoConsent: true,
};

function request(onboardingToken?: string) {
  const formData = new FormData();
  formData.set("payload", JSON.stringify(payload));
  if (onboardingToken) formData.set("onboardingToken", onboardingToken);
  return { formData: async () => formData } as NextRequest;
}

describe("Rückkehrer-Onboarding: Fotoerlaubnis", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({ user: { id: "user-1" } });
    mocks.inviteFindUnique.mockResolvedValue({
      id: "invite-1",
      showId: "show-2027",
      roles: ["member", "tech", "board"],
    });
    mocks.getActiveProductionId.mockResolvedValue("show-2026");
  });

  it("übernimmt Ensemble-/Technik-Rollen der Einladung nur für neue Mitgliedschaften", async () => {
    await POST(request("token-abc"));

    const args = mocks.membershipUpsert.mock.calls[0][0];
    expect(args.create.roles).toEqual(["tech"]);
    expect(args.update).toEqual({ leftAt: null, status: "active" });
    expect(mocks.syncRoles).toHaveBeenCalledWith(["user-1"], expect.anything());
  });

  it("legt die Erlaubnis für die Produktion der Einladung an und verlangt neue Freigabe", async () => {
    const response = await POST(request("token-abc"));

    expect(response.status).toBe(200);
    const args = mocks.consentUpsert.mock.calls[0][0];
    expect(args.where).toEqual({ userId_showId: { userId: "user-1", showId: "show-2027" } });
    expect(args.create).toMatchObject({ showId: "show-2027", consentGiven: true });
    expect(args.update).toMatchObject({
      status: "pending",
      approvedAt: null,
      approvedById: null,
      revokedAt: null,
    });
    expect(mocks.membershipUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: { leftAt: null, status: "active" },
      }),
    );
  });

  it("nutzt ohne Einladung die aktuelle Produktion", async () => {
    await POST(request());

    expect(mocks.consentUpsert.mock.calls[0][0].where).toEqual({
      userId_showId: { userId: "user-1", showId: "show-2026" },
    });
    expect(mocks.membershipUpsert).not.toHaveBeenCalled();
  });

  it("speichert ohne Produktion keine Fotoerlaubnis", async () => {
    mocks.getActiveProductionId.mockResolvedValue(null);

    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(mocks.consentUpsert).not.toHaveBeenCalled();
  });
});

describe("Rückkehrer-Onboarding: Onboarding pro Produktion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({ user: { id: "user-1" } });
    mocks.inviteFindUnique.mockResolvedValue({ id: "invite-1", showId: "show-2027" });
    mocks.getActiveProductionId.mockResolvedValue("show-2026");
  });

  it("legt ein Onboarding für die neue Produktion mit Snapshot an", async () => {
    await POST(request("token-abc"));

    const args = mocks.onboardingUpsert.mock.calls[0][0];
    expect(args.where).toEqual({ userId_showId: { userId: "user-1", showId: "show-2027" } });
    expect(args.create).toMatchObject({
      userId: "user-1",
      showId: "show-2027",
      inviteId: "invite-1",
      focus: "tech",
      isReturning: true,
      completedAt: expect.any(Date),
    });
    expect(args.create.profileSnapshot).toMatchObject({
      photoConsent: true,
      education: expect.objectContaining({ category: "work", workDescription: "Büro" }),
    });
    expect(args.update).toMatchObject({ inviteId: "invite-1", completedAt: expect.any(Date) });
  });

  it("legt ohne Produktion kein Onboarding an", async () => {
    mocks.getActiveProductionId.mockResolvedValue(null);

    await POST(request());

    expect(mocks.onboardingUpsert).not.toHaveBeenCalled();
  });
});

describe("Rückkehrer-Onboarding: Reaktivierung", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.inviteFindUnique.mockResolvedValue({ id: "invite-1", showId: "show-2027" });
    mocks.getActiveProductionId.mockResolvedValue("show-2026");
  });

  it("weist deaktivierte Mitglieder ohne gültigen Einladungslink ab", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "user-1", isDeactivated: true } });

    const response = await POST(request());

    expect(response.status).toBe(403);
    expect(mocks.consentUpsert).not.toHaveBeenCalled();
    expect(mocks.userUpdate).not.toHaveBeenCalled();
  });

  it("schaltet deaktivierte Rückkehrer erst beim Abschluss wieder frei", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "user-1", isDeactivated: true } });

    const response = await POST(request("token-abc"));

    expect(await response.json()).toEqual({ success: true, reactivated: true });
    expect(mocks.userUpdate).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { onboardingUpdatedAt: expect.any(Date), deactivatedAt: null },
    });
    expect(mocks.sync).toHaveBeenCalled();
  });

  it("ändert bei aktiven Mitgliedern nichts am Kontostatus", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "user-1" } });

    await POST(request("token-abc"));

    expect(mocks.userUpdate).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { onboardingUpdatedAt: expect.any(Date) },
    });
    expect(mocks.sync).not.toHaveBeenCalled();
  });
});
