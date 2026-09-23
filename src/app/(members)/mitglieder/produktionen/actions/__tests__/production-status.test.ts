import { beforeEach, describe, expect, it, vi } from "vitest";

import { setProductionStatusAction } from "../status";

const { hasPermissionMock, findUniqueMock, showUpdateMock, membershipUpdateManyMock, syncMock } =
  vi.hoisted(() => ({
    hasPermissionMock: vi.fn(),
    findUniqueMock: vi.fn(),
    showUpdateMock: vi.fn(),
    membershipUpdateManyMock: vi.fn(),
    syncMock: vi.fn(),
  }));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/rbac", () => ({ requireAuth: async () => ({ user: { id: "admin-1" } }) }));
vi.mock("@/lib/permissions", () => ({ hasPermission: hasPermissionMock }));
vi.mock("@/lib/authentik/service-groups", () => ({ requestServiceGroupSync: syncMock }));
vi.mock("@/lib/prisma", () => {
  const tx = {
    show: { update: showUpdateMock },
    productionMembership: { updateMany: membershipUpdateManyMock },
  };
  return {
    prisma: {
      show: { findUnique: findUniqueMock },
      $transaction: async <T>(fn: (client: typeof tx) => Promise<T>) => fn(tx),
    },
  };
});

function formData(entries: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.set(key, value);
  return data;
}

describe("setProductionStatusAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    hasPermissionMock.mockResolvedValue(true);
    findUniqueMock.mockResolvedValue({ id: "show-1", status: "active" });
    membershipUpdateManyMock.mockResolvedValue({ count: 12 });
  });

  it("verweigert ohne Berechtigung", async () => {
    hasPermissionMock.mockResolvedValue(false);

    const result = await setProductionStatusAction(
      formData({ showId: "show-1", status: "finished" }),
    );

    expect(result.ok).toBe(false);
    expect(showUpdateMock).not.toHaveBeenCalled();
  });

  it("lehnt unbekannte Status ab", async () => {
    const result = await setProductionStatusAction(formData({ showId: "show-1", status: "weg" }));

    expect(result).toEqual({ ok: false, error: "Unbekannter Produktionsstatus." });
    expect(showUpdateMock).not.toHaveBeenCalled();
  });

  it("beendet beim Abschluss alle offenen Mitgliedschaften", async () => {
    const result = await setProductionStatusAction(
      formData({ showId: "show-1", status: "finished" }),
    );

    expect(result).toEqual({
      ok: true,
      message: "Status: Beendet. 12 Mitgliedschaften wurden beendet.",
    });
    expect(showUpdateMock).toHaveBeenCalledWith({
      where: { id: "show-1" },
      data: expect.objectContaining({ status: "finished", archivedAt: null }),
    });
    expect(membershipUpdateManyMock).toHaveBeenCalledWith({
      where: { showId: "show-1", status: { not: "left" } },
      data: { status: "left", leftAt: expect.any(Date) },
    });
    expect(syncMock).toHaveBeenCalled();
  });

  it("lässt Mitgliedschaften beim Wechsel zwischen Planung und Aktiv unberührt", async () => {
    findUniqueMock.mockResolvedValue({ id: "show-1", status: "planning" });

    const result = await setProductionStatusAction(
      formData({ showId: "show-1", status: "active" }),
    );

    expect(result).toEqual({ ok: true, message: "Status: Aktiv." });
    expect(membershipUpdateManyMock).not.toHaveBeenCalled();
    expect(syncMock).not.toHaveBeenCalled();
  });
});
