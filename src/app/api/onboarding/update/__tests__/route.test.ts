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
  profileUpsert: vi.fn(),
  restrictionUpsert: vi.fn(),
  restrictionUpdateMany: vi.fn(),
  userUpdate: vi.fn(),
  sync: vi.fn(),
  syncRoles: vi.fn(),
  inviteUpdate: vi.fn(),
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
      upsert: mocks.profileUpsert.mockResolvedValue({ id: "profile-1", focus: "tech" }),
    },
    productionOnboarding: { upsert: mocks.onboardingUpsert },
    memberRolePreference: { deleteMany: vi.fn(), createMany: vi.fn() },
    dietaryRestriction: {
      upsert: mocks.restrictionUpsert,
      updateMany: mocks.restrictionUpdateMany,
    },
    photoConsent: { upsert: mocks.consentUpsert },
    productionMembership: { upsert: mocks.membershipUpsert },
    user: { update: mocks.userUpdate },
    memberInvite: { update: mocks.inviteUpdate },
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

function request(onboardingToken?: string, overrides: Record<string, unknown> = {}) {
  const formData = new FormData();
  formData.set("payload", JSON.stringify({ ...payload, ...overrides }));
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
    expect(args.create).toMatchObject({ showId: "show-2027", status: "pending" });
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

describe("Rückkehrer-Onboarding: Einladung verbrauchen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({ user: { id: "user-1" } });
    mocks.inviteFindUnique.mockResolvedValue({ id: "invite-1", showId: "show-2027" });
    mocks.getActiveProductionId.mockResolvedValue("show-2026");
  });

  it("zählt die Nutzung der Einladung hoch", async () => {
    await POST(request("token-abc"));

    expect(mocks.inviteUpdate).toHaveBeenCalledWith({
      where: { id: "invite-1" },
      data: { usageCount: { increment: 1 } },
    });
  });

  it("zählt ohne Einladung nichts", async () => {
    await POST(request());

    expect(mocks.inviteUpdate).not.toHaveBeenCalled();
  });
});

describe("Rückkehrer-Onboarding: Ernährung und Allergien", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({ user: { id: "user-1" } });
    mocks.inviteFindUnique.mockResolvedValue({ id: "invite-1", showId: "show-2027" });
    mocks.getActiveProductionId.mockResolvedValue("show-2026");
  });

  it("übersetzt den strukturierten Stil in die gespeicherten Labels", async () => {
    await POST(
      request("token-abc", {
        dietaryPreference: {
          style: "vegetarian",
          variant: "lacto",
          customLabel: null,
          strictness: "strict",
        },
      }),
    );

    expect(mocks.profileUpsert.mock.calls[0][0].update).toMatchObject({
      dietaryPreference: "Vegetarisch",
      dietaryPreferenceVariant: "Nur Milch, kein Ei",
      dietaryPreferenceStrictness: "Strikt – keine Ausnahmen",
    });
    expect(mocks.onboardingUpsert.mock.calls[0][0].create.profileSnapshot).toMatchObject({
      dietaryPreference: "Vegetarisch",
      dietaryPreferenceVariant: "Nur Milch, kein Ei",
    });
  });

  it("nimmt weiterhin die alten Label-Felder an", async () => {
    await POST(
      request("token-abc", {
        dietaryPreference: "Vegan",
        dietaryPreferenceStrictness: "Situationsabhängig / nach Rücksprache",
      }),
    );

    expect(mocks.profileUpsert.mock.calls[0][0].update).toMatchObject({
      dietaryPreference: "Vegan",
      dietaryPreferenceVariant: null,
      dietaryPreferenceStrictness: "Situationsabhängig / nach Rücksprache",
    });
  });

  it("speichert Art, Spuren und Abklärung je Eintrag", async () => {
    await POST(
      request("token-abc", {
        dietary: [
          {
            allergen: "Erdnüsse",
            level: "SEVERE",
            kind: "ALLERGY",
            tracesOk: false,
            diagnosed: true,
            symptoms: null,
            treatment: null,
            note: null,
          },
        ],
      }),
    );

    expect(mocks.restrictionUpsert.mock.calls[0][0].create).toMatchObject({
      allergen: "Erdnüsse",
      level: "SEVERE",
      kind: "ALLERGY",
      tracesOk: false,
      diagnosed: true,
      isActive: true,
    });
  });

  it("weist einen unbekannten Schweregrad ab", async () => {
    const response = await POST(
      request("token-abc", {
        dietary: [
          {
            allergen: "Erdnüsse",
            level: "Stark",
            symptoms: null,
            treatment: null,
            note: null,
          },
        ],
      }),
    );

    expect(response.status).toBe(400);
    expect(mocks.restrictionUpsert).not.toHaveBeenCalled();
  });
});

describe("Rückkehrer-Onboarding: persönliche Einladungen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({ user: { id: "user-2" } });
    mocks.getActiveProductionId.mockResolvedValue("show-2026");
  });

  it("lehnt persönliche Links anderer Personen ab", async () => {
    mocks.inviteFindUnique.mockResolvedValue({
      id: "invite-1",
      showId: "show-2027",
      personalForUserId: "user-1",
    });

    const response = await POST(request("token-abc"));

    expect(response.status).toBe(403);
    expect(mocks.consentUpsert).not.toHaveBeenCalled();
    expect(mocks.inviteUpdate).not.toHaveBeenCalled();
  });

  it("akzeptiert den eigenen persönlichen Link", async () => {
    mocks.inviteFindUnique.mockResolvedValue({
      id: "invite-1",
      showId: "show-2027",
      personalForUserId: "user-2",
    });

    expect((await POST(request("token-abc"))).status).toBe(200);
  });
});
