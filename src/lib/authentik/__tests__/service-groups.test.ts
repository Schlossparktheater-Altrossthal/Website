import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthentikServiceGroup, AuthentikUser } from "@/lib/authentik/client";

const client = vi.hoisted(() => ({
  listAuthentikServiceGroups: vi.fn(),
  listManagedAuthentikUsers: vi.fn(),
  setAuthentikGroupMembership: vi.fn(),
}));
const findMany = vi.hoisted(() => vi.fn());
const getUserPermissionKeys = vi.hoisted(() => vi.fn());

vi.mock("@/lib/authentik/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/authentik/client")>()),
  ...client,
}));
vi.mock("@/lib/prisma", () => ({ prisma: { user: { findMany } } }));
vi.mock("@/lib/permissions", () => ({
  getUserPermissionKeys,
  isKnownPermissionKey: (key: string) => key.startsWith("SSO."),
}));
vi.mock("@/lib/logger", () => ({ createLogger: () => ({ error: vi.fn() }) }));

import { reconcileServiceGroups } from "@/lib/authentik/service-groups";

function account(pk: number, memberId: string | null): AuthentikUser {
  return {
    pk,
    uid: `uid-${pk}`,
    username: `user${pk}@example.org`,
    name: `User ${pk}`,
    email: `user${pk}@example.org`,
    is_active: true,
    path: "mitgliederbereich",
    date_joined: "2026-09-01T10:00:00Z",
    password_change_date: null,
    attributes: memberId ? { mitgliederbereich: { userId: memberId } } : {},
  };
}

const nextcloud: AuthentikServiceGroup = {
  pk: "g-nc",
  name: "Sommertheater Nextcloud",
  permission: "SSO.NEXTCLOUD.ACCESS",
  userPks: [],
};

describe("reconcileServiceGroups", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Profil u3 ist deaktiviert und fehlt deshalb in der Abfrage.
    findMany.mockResolvedValue([{ id: "u1" }, { id: "u2" }]);
    getUserPermissionKeys.mockImplementation(async ({ id }: { id: string }) =>
      id === "u1" ? ["SSO.NEXTCLOUD.ACCESS"] : [],
    );
  });

  it("adds members with the permission and removes everyone else", async () => {
    const [allowed, withoutPermission, deactivated, orphan] = [
      account(1, "u1"),
      account(2, "u2"),
      account(3, "u3"),
      account(4, null),
    ];
    client.listAuthentikServiceGroups.mockResolvedValue([{ ...nextcloud, userPks: [2, 3, 4, 99] }]);
    client.listManagedAuthentikUsers.mockResolvedValue([
      allowed,
      withoutPermission,
      deactivated,
      orphan,
    ]);

    const result = await reconcileServiceGroups();

    expect(result).toEqual({ added: 1, removed: 3, failed: 0 });
    const calls = client.setAuthentikGroupMembership.mock.calls.map(([, user, member]) => [
      (user as AuthentikUser).pk,
      member,
    ]);
    // pk 99 liegt außerhalb des Mitgliederbereich-Pfads und bleibt unberührt.
    expect(calls).toEqual([
      [1, true],
      [2, false],
      [3, false],
      [4, false],
    ]);
  });

  it("does nothing when memberships already match", async () => {
    client.listAuthentikServiceGroups.mockResolvedValue([{ ...nextcloud, userPks: [1] }]);
    client.listManagedAuthentikUsers.mockResolvedValue([account(1, "u1"), account(2, "u2")]);

    await expect(reconcileServiceGroups()).resolves.toEqual({ added: 0, removed: 0, failed: 0 });
    expect(client.setAuthentikGroupMembership).not.toHaveBeenCalled();
  });

  it("ignores groups that point to an unknown permission", async () => {
    client.listAuthentikServiceGroups.mockResolvedValue([
      { ...nextcloud, permission: "PRIVATE.UNKNOWN" },
    ]);

    await reconcileServiceGroups();

    expect(client.listManagedAuthentikUsers).not.toHaveBeenCalled();
  });

  it("counts failures and continues with the next account", async () => {
    client.listAuthentikServiceGroups.mockResolvedValue([{ ...nextcloud, userPks: [2] }]);
    client.listManagedAuthentikUsers.mockResolvedValue([account(1, "u1"), account(2, "u2")]);
    client.setAuthentikGroupMembership.mockRejectedValueOnce(new Error("boom"));

    await expect(reconcileServiceGroups()).resolves.toEqual({ added: 0, removed: 1, failed: 1 });
  });
});
