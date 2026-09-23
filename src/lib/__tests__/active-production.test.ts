import { beforeEach, describe, expect, it, vi } from "vitest";

const mockCookies = vi.fn();
const mockShowFindFirst = vi.fn();
const mockMembershipFindFirst = vi.fn();
const mockMembershipFindMany = vi.fn();
const mockHasPermission = vi.fn();

vi.mock("next/headers", () => ({
  cookies: mockCookies,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    productionMembership: {
      findFirst: mockMembershipFindFirst,
      findMany: mockMembershipFindMany,
    },
    show: {
      findFirst: mockShowFindFirst,
    },
  },
}));

vi.mock("@/lib/permissions", () => ({
  hasPermission: mockHasPermission,
}));

describe("getActiveProduction", () => {
  beforeEach(async () => {
    await vi.resetModules();
    vi.clearAllMocks();
  });

  it("allows production managers to access active shows without memberships", async () => {
    const userId = "user-123";
    const showId = "show-456";
    const cookieStore = {
      get: vi.fn(() => ({ value: showId })),
    };

    mockCookies.mockResolvedValue(cookieStore);
    mockHasPermission.mockResolvedValue(true);
    mockShowFindFirst.mockResolvedValue({
      id: showId,
      title: "Neue Show",
      year: 2025,
      synopsis: "Test",
    });

    const { getActiveProduction } = await import("../active-production");

    const result = await getActiveProduction(userId);

    expect(mockHasPermission).toHaveBeenCalledWith(
      { id: userId },
      "PRIVATE.PRODUCTION.SHOW.MANAGE",
    );
    expect(mockMembershipFindFirst).not.toHaveBeenCalled();
    expect(mockShowFindFirst).toHaveBeenCalledWith({
      where: { id: showId },
      select: { id: true, title: true, year: true, synopsis: true },
    });
    expect(result).toEqual({
      id: showId,
      title: "Neue Show",
      year: 2025,
      synopsis: "Test",
    });
  });

  it("ignoriert beendete Produktionen beim Fallback für Mitglieder", async () => {
    mockCookies.mockResolvedValue({ get: vi.fn(() => undefined) });
    mockHasPermission.mockResolvedValue(false);
    mockMembershipFindMany.mockResolvedValue([]);

    const { getActiveProductionId } = await import("../active-production");

    const result = await getActiveProductionId("member-1");

    expect(result).toBeNull();
    expect(mockMembershipFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: "member-1",
          status: "active",
          show: { status: { in: ["planning", "active"] } },
        }),
      }),
    );
    expect(mockShowFindFirst).not.toHaveBeenCalled();
  });

  it("verwirft ein Cookie auf eine Produktion ohne aktuelle Mitgliedschaft", async () => {
    mockCookies.mockResolvedValue({ get: vi.fn(() => ({ value: "show-alt" })) });
    mockHasPermission.mockResolvedValue(false);
    mockMembershipFindFirst.mockResolvedValue(null);
    mockMembershipFindMany.mockResolvedValue([
      {
        showId: "show-neu",
        leftAt: null,
        show: {
          id: "show-neu",
          title: "Neu",
          year: 2027,
          finalRehearsalWeekStart: null,
          finalRehearsalWeekEnd: null,
        },
      },
    ]);

    const { getActiveProductionId } = await import("../active-production");

    expect(await getActiveProductionId("member-1")).toBe("show-neu");
    expect(mockMembershipFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ showId: "show-alt", status: "active" }),
      }),
    );
  });

  it("wählt für Produktionsleitung ohne Cookie die aktive Produktion aus der DB", async () => {
    mockCookies.mockResolvedValue({ get: vi.fn(() => undefined) });
    mockHasPermission.mockResolvedValue(true);
    mockMembershipFindMany.mockResolvedValue([]);
    mockShowFindFirst.mockResolvedValue({ id: "show-aktiv" });

    const { getActiveProductionId } = await import("../active-production");

    expect(await getActiveProductionId("admin-1")).toBe("show-aktiv");
    expect(mockShowFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: { in: ["active", "planning"] } } }),
    );
  });
});
