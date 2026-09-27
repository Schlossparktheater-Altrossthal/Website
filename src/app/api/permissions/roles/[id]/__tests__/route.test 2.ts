import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  hasPermission: vi.fn(),
  appRoleFindUnique: vi.fn(),
  appRoleDelete: vi.fn(),
  appRoleUpdate: vi.fn(),
}));

vi.mock("@/lib/rbac", () => ({ requireAuth: mocks.requireAuth }));
vi.mock("@/lib/permissions", () => ({ hasPermission: mocks.hasPermission }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    appRole: {
      findUnique: mocks.appRoleFindUnique,
      delete: mocks.appRoleDelete,
      update: mocks.appRoleUpdate,
    },
  },
}));

import { DELETE, PATCH } from "../route";

const params = (id: string) => ({ params: Promise.resolve({ id }) });
const renameRequest = (body: unknown) => ({ json: async () => body }) as NextRequest;
// DELETE wertet den Request nicht aus.
const deleteRequest = () => ({}) as NextRequest;

describe("Rollenverwaltung: Löschen und Umbenennen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAuth.mockResolvedValue({ user: { id: "admin-1", roles: ["admin"] } });
    mocks.hasPermission.mockResolvedValue(true);
    mocks.appRoleDelete.mockResolvedValue({});
    mocks.appRoleUpdate.mockResolvedValue({ id: "role-1", name: "Regie" });
  });

  it("verweigert beides ohne Berechtigung", async () => {
    mocks.hasPermission.mockResolvedValue(false);

    expect((await DELETE(deleteRequest(), params("role-1"))).status).toBe(403);
    expect((await PATCH(renameRequest({ name: "Regie" }), params("role-1"))).status).toBe(403);
    expect(mocks.appRoleDelete).not.toHaveBeenCalled();
  });

  it("meldet unbekannte Rollen mit 404", async () => {
    mocks.appRoleFindUnique.mockResolvedValue(null);

    expect((await DELETE(deleteRequest(), params("weg"))).status).toBe(404);
  });

  it("löscht eingebaute Rollen wie Vorstand, Ensemble, Technik und Finanzen", async () => {
    mocks.appRoleFindUnique.mockResolvedValue({
      id: "role-board",
      name: "board",
      systemRole: "board",
      isSystem: false,
    });

    const response = await DELETE(deleteRequest(), params("role-board"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(mocks.appRoleDelete).toHaveBeenCalledWith({ where: { id: "role-board" } });
  });

  it("schützt Mitglied, Admin und Owner", async () => {
    for (const role of [
      { id: "role-member", name: "member", systemRole: "member", isSystem: false },
      { id: "role-admin", name: "admin", systemRole: "admin", isSystem: true },
      { id: "role-owner", name: "owner", systemRole: "owner", isSystem: true },
    ]) {
      vi.mocked(mocks.appRoleFindUnique).mockResolvedValue(role);

      const response = await DELETE(deleteRequest(), params(role.id));

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({
        error: "Mitglied, Admin und Owner können nicht gelöscht werden",
      });
    }
    expect(mocks.appRoleDelete).not.toHaveBeenCalled();
  });

  it("meldet einen Löschfehler als { error } mit Status 500", async () => {
    mocks.appRoleFindUnique.mockResolvedValue({
      id: "role-1",
      name: "Regie",
      systemRole: null,
      isSystem: false,
    });
    mocks.appRoleDelete.mockRejectedValue(new Error("db down"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await DELETE(deleteRequest(), params("role-1"));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Löschen fehlgeschlagen" });
  });

  it("benennt nur selbst angelegte Rollen um", async () => {
    mocks.appRoleFindUnique.mockResolvedValue({
      id: "role-tech",
      name: "tech",
      systemRole: "tech",
      isSystem: false,
    });

    const blocked = await PATCH(renameRequest({ name: "Bühnentechnik" }), params("role-tech"));

    expect(blocked.status).toBe(400);
    expect(mocks.appRoleUpdate).not.toHaveBeenCalled();

    mocks.appRoleFindUnique.mockResolvedValue({
      id: "role-1",
      name: "Regie",
      systemRole: null,
      isSystem: false,
    });

    const renamed = await PATCH(renameRequest({ name: "Produktionsleitung" }), params("role-1"));

    expect(renamed.status).toBe(200);
    expect(mocks.appRoleUpdate).toHaveBeenCalledWith({
      where: { id: "role-1" },
      data: { name: "Produktionsleitung" },
    });
  });
});
