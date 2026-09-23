import { beforeEach, describe, expect, it, vi } from "vitest";

import { clearActiveProductionAction, setActiveProductionAction } from "../production";

const { cookieStore, findUniqueMock, performMock } = vi.hoisted(() => ({
  cookieStore: { get: vi.fn(), set: vi.fn(), delete: vi.fn() },
  findUniqueMock: vi.fn(),
  performMock: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => cookieStore }));
vi.mock("@/lib/rbac", () => ({ requireAuth: async () => ({ user: { id: "admin-1" } }) }));
vi.mock("@/lib/permissions", () => ({ hasPermission: async () => true }));
vi.mock("@/lib/prisma", () => ({ prisma: { show: { findUnique: findUniqueMock } } }));
vi.mock("@/lib/season-reset/deactivation", () => ({
  performSeasonChangeDeactivation: performMock,
}));

function formData(entries: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.set(key, value);
  return data;
}

describe("aktive Produktion wechseln", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cookieStore.get.mockReturnValue({ value: "show-alt" });
    findUniqueMock.mockResolvedValue({ id: "show-neu" });
  });

  it("setzt nur das Cookie und deaktiviert niemanden", async () => {
    const result = await setActiveProductionAction(formData({ showId: "show-neu" }));

    expect(result.ok).toBe(true);
    expect(cookieStore.set).toHaveBeenCalledWith(
      "active-production",
      "show-neu",
      expect.any(Object),
    );
    expect(performMock).not.toHaveBeenCalled();
  });

  it("zurücksetzen deaktiviert niemanden", async () => {
    const result = await clearActiveProductionAction(formData({}));

    expect(result.ok).toBe(true);
    expect(cookieStore.delete).toHaveBeenCalledWith("active-production");
    expect(performMock).not.toHaveBeenCalled();
  });
});
