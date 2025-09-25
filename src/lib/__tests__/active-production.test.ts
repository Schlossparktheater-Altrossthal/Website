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

    expect(mockHasPermission).toHaveBeenCalledWith({ id: userId }, "mitglieder.produktionen");
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
});
