import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  hasPermission: vi.fn(),
  getActiveProductionId: vi.fn(),
  userFindUnique: vi.fn(),
  userUpdate: vi.fn(),
  userFindUniqueOrThrow: vi.fn(),
  membershipUpsert: vi.fn(),
  syncRoles: vi.fn(),
}));

vi.mock("@/lib/rbac", async () => ({
  requireAuth: mocks.requireAuth,
  ROLES: (await import("@/lib/roles")).ROLES,
}));
vi.mock("@/lib/permissions", () => ({ hasPermission: mocks.hasPermission }));
vi.mock("@/lib/active-production", () => ({
  getActiveProductionId: mocks.getActiveProductionId,
}));
vi.mock("@/lib/authentik/service-groups", () => ({ requestServiceGroupSync: vi.fn() }));
vi.mock("@/lib/produktionen/production-roles", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/produktionen/production-roles")>()),
  syncProductionRoles: mocks.syncRoles,
}));
vi.mock("@/lib/prisma", () => {
  const tx = {
    user: { update: mocks.userUpdate, findUniqueOrThrow: mocks.userFindUniqueOrThrow },
    productionMembership: { upsert: mocks.membershipUpsert },
  };
  return {
    prisma: {
      user: { findUnique: mocks.userFindUnique },
      userRole: { count: vi.fn() },
      $transaction: async <T>(fn: (client: typeof tx) => Promise<T>) => fn(tx),
    },
  };
});

import { PUT } from "../route";

const request = (body: unknown) => ({ json: async () => body }) as NextRequest;

describe("Rollen-Editor: Ensemble/Technik pro Produktion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAuth.mockResolvedValue({ user: { id: "admin-1", roles: ["admin"] } });
    mocks.hasPermission.mockResolvedValue(true);
    mocks.getActiveProductionId.mockResolvedValue("show-2027");
    mocks.userFindUnique.mockResolvedValue({ id: "user-1", role: "member", roles: [] });
    mocks.userFindUniqueOrThrow.mockResolvedValue({
      id: "user-1",
      firstName: null,
      lastName: null,
      email: null,
      name: null,
      role: "tech",
      roles: [{ role: "member" }, { role: "cast" }, { role: "tech" }],
      appRoles: [],
    });
  });

  it("schreibt Technik in die Mitgliedschaft der ausgewählten Produktion", async () => {
    const response = await PUT(request({ userId: "user-1", roles: ["member", "tech"] }));

    expect(response.status).toBe(200);
    expect(mocks.membershipUpsert).toHaveBeenCalledWith({
      where: { showId_userId: { showId: "show-2027", userId: "user-1" } },
      update: { roles: ["tech"] },
      create: { showId: "show-2027", userId: "user-1", status: "active", roles: ["tech"] },
    });
    expect(mocks.syncRoles).toHaveBeenCalledWith(["user-1"], expect.anything());
  });

  it("verlangt eine ausgewählte Produktion für Ensemble/Technik", async () => {
    mocks.getActiveProductionId.mockResolvedValue(null);

    const response = await PUT(request({ userId: "user-1", roles: ["member", "cast"] }));

    expect(response.status).toBe(400);
    expect(mocks.userUpdate).not.toHaveBeenCalled();
  });

  it("fasst die Produktion nicht an, wenn sich nur andere Rollen ändern", async () => {
    mocks.userFindUnique.mockResolvedValue({
      id: "user-1",
      role: "cast",
      roles: [{ role: "member" }, { role: "cast" }],
    });

    await PUT(request({ userId: "user-1", roles: ["member", "cast", "finance"] }));

    expect(mocks.getActiveProductionId).not.toHaveBeenCalled();
    expect(mocks.membershipUpsert).not.toHaveBeenCalled();
    expect(mocks.userUpdate).toHaveBeenCalled();
  });
});
