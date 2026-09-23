import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  addProductionMemberAction,
  inviteFormerMembersAction,
  removeProductionMemberAction,
  updateProductionMemberAction,
} from "../ensemble";

const mocks = vi.hoisted(() => ({
  hasPermission: vi.fn(),
  showFindUnique: vi.fn(),
  userFindUnique: vi.fn(),
  onboardingFindUnique: vi.fn(),
  membershipUpsert: vi.fn(),
  membershipUpdate: vi.fn(),
  syncRoles: vi.fn(),
  groupSync: vi.fn(),
  inviteFormerMembers: vi.fn(),
  createSender: vi.fn(),
}));

vi.mock("@/lib/produktionen/returnee-invites", () => ({
  inviteFormerMembers: mocks.inviteFormerMembers,
}));
vi.mock("@/lib/email/send", () => ({ createConfiguredMailSender: mocks.createSender }));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/rbac", () => ({ requireAuth: async () => ({ user: { id: "admin-1" } }) }));
vi.mock("@/lib/permissions", () => ({ hasPermission: mocks.hasPermission }));
vi.mock("@/lib/authentik/service-groups", () => ({ requestServiceGroupSync: mocks.groupSync }));
vi.mock("@/lib/produktionen/production-roles", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/produktionen/production-roles")>()),
  syncProductionRoles: mocks.syncRoles,
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    show: { findUnique: mocks.showFindUnique },
    user: { findUnique: mocks.userFindUnique },
    productionOnboarding: { findUnique: mocks.onboardingFindUnique },
    productionMembership: { upsert: mocks.membershipUpsert, update: mocks.membershipUpdate },
  },
}));

function formData(entries: Array<[string, string]>) {
  const data = new FormData();
  for (const [key, value] of entries) data.append(key, value);
  return data;
}

describe("Ensemble-Verwaltung", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.hasPermission.mockResolvedValue(true);
    mocks.showFindUnique.mockResolvedValue({ id: "show-1" });
    mocks.userFindUnique.mockResolvedValue({ id: "user-1" });
    mocks.membershipUpdate.mockResolvedValue({ showId: "show-1", userId: "user-1" });
    mocks.syncRoles.mockResolvedValue(["user-1"]);
  });

  it("verweigert ohne Berechtigung", async () => {
    mocks.hasPermission.mockResolvedValue(false);

    const result = await addProductionMemberAction(
      formData([
        ["showId", "show-1"],
        ["userId", "user-1"],
      ]),
    );

    expect(result.ok).toBe(false);
    expect(mocks.membershipUpsert).not.toHaveBeenCalled();
  });

  it("nimmt ongeboardete Personen direkt aktiv auf", async () => {
    mocks.onboardingFindUnique.mockResolvedValue({ completedAt: new Date() });

    await addProductionMemberAction(
      formData([
        ["showId", "show-1"],
        ["userId", "user-1"],
      ]),
    );

    expect(mocks.membershipUpsert).toHaveBeenCalledWith({
      where: { showId_userId: { showId: "show-1", userId: "user-1" } },
      update: { status: "active", leftAt: null },
      create: { showId: "show-1", userId: "user-1", status: "active" },
    });
  });

  it("lädt Personen ohne Onboarding nur ein (Zugriff erst nach Onboarding)", async () => {
    mocks.onboardingFindUnique.mockResolvedValue(null);

    const result = await addProductionMemberAction(
      formData([
        ["showId", "show-1"],
        ["userId", "user-1"],
      ]),
    );

    expect(mocks.membershipUpsert.mock.calls[0][0].create.status).toBe("invited");
    expect(result).toEqual({
      ok: true,
      message: "Mitglied wurde eingeladen und bekommt Zugriff nach dem Onboarding.",
    });
  });

  it("speichert nur Ensemble/Technik als Produktionsrollen und synchronisiert", async () => {
    await updateProductionMemberAction(
      formData([
        ["membershipId", "m-1"],
        ["roles", "tech"],
        ["roles", "admin"],
        ["function", " Licht "],
      ]),
    );

    expect(mocks.membershipUpdate).toHaveBeenCalledWith({
      where: { id: "m-1" },
      data: { roles: ["tech"], function: "Licht" },
      select: { showId: true, userId: true },
    });
    expect(mocks.syncRoles).toHaveBeenCalledWith(["user-1"]);
    expect(mocks.groupSync).toHaveBeenCalled();
  });

  it("beendet Mitgliedschaften statt sie zu löschen", async () => {
    await removeProductionMemberAction(formData([["membershipId", "m-1"]]));

    expect(mocks.membershipUpdate).toHaveBeenCalledWith({
      where: { id: "m-1" },
      data: { status: "left", leftAt: expect.any(Date) },
      select: { showId: true, userId: true },
    });
    expect(mocks.syncRoles).toHaveBeenCalledWith(["user-1"]);
  });
});

describe("Ehemalige einladen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.hasPermission.mockResolvedValue(true);
    mocks.createSender.mockResolvedValue(null);
  });

  it("verlangt eine Auswahl", async () => {
    const result = await inviteFormerMembersAction(formData([["showId", "show-1"]]));

    expect(result).toEqual({ ok: false, error: "Bitte wähle mindestens eine Person aus." });
    expect(mocks.inviteFormerMembers).not.toHaveBeenCalled();
  });

  it("lädt ein und fasst das Ergebnis zusammen", async () => {
    mocks.inviteFormerMembers.mockResolvedValue([
      { userId: "a", name: "A", status: "sent", link: null },
      { userId: "b", name: "B", status: "no-email", link: "https://x" },
    ]);

    const result = await inviteFormerMembersAction(
      formData([
        ["showId", "show-1"],
        ["userIds", "a"],
        ["userIds", "b"],
      ]),
    );

    expect(mocks.inviteFormerMembers).toHaveBeenCalledWith({
      showId: "show-1",
      userIds: ["a", "b"],
      createdById: "admin-1",
      sender: null,
    });
    expect(result).toMatchObject({
      ok: true,
      message: "1 Einladungen per Mail verschickt, 1 Links bitte selbst weitergeben.",
    });
  });

  it("verweigert ohne Berechtigung", async () => {
    mocks.hasPermission.mockResolvedValue(false);

    const result = await inviteFormerMembersAction(
      formData([
        ["showId", "show-1"],
        ["userIds", "a"],
      ]),
    );

    expect(result.ok).toBe(false);
    expect(mocks.inviteFormerMembers).not.toHaveBeenCalled();
  });
});
