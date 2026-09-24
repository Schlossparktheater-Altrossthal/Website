import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  inviteFindMany: vi.fn(),
  inviteCount: vi.fn(),
  inviteCreate: vi.fn(),
  inviteFindUnique: vi.fn(),
  inviteUpdate: vi.fn(),
  showFindMany: vi.fn(),
  showFindUnique: vi.fn(),
  membershipFindMany: vi.fn(),
}));

vi.mock("@/lib/rbac", () => ({ requireAuth: async () => ({ user: { id: "admin-1" } }) }));
vi.mock("@/lib/permissions", () => ({ hasPermission: async () => true }));
vi.mock("@/lib/active-production", () => ({ getActiveProductionId: async () => null }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    memberInvite: {
      findMany: mocks.inviteFindMany,
      count: mocks.inviteCount,
      create: mocks.inviteCreate,
      findUnique: mocks.inviteFindUnique,
      update: mocks.inviteUpdate,
    },
    show: { findMany: mocks.showFindMany, findUnique: mocks.showFindUnique },
    productionMembership: { findMany: mocks.membershipFindMany },
  },
}));

import { GET, POST } from "../route";
import { PATCH } from "../[id]/route";

const jsonRequest = (body: unknown) => ({ json: async () => body }) as NextRequest;

describe("Einladungslinks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.inviteFindMany.mockResolvedValue([]);
    mocks.inviteCount.mockResolvedValue(3);
    mocks.membershipFindMany.mockResolvedValue([]);
    mocks.showFindMany.mockResolvedValue([
      { id: "neu", title: "???", year: 2027, meta: null, status: "planning" },
      { id: "alt", title: "Die unendliche Geschichte", year: 2026, meta: null, status: "finished" },
    ]);
  });

  it("blendet persönliche Einladungen aus und kennzeichnet Produktionen", async () => {
    const data = await (await GET()).json();

    expect(mocks.inviteFindMany.mock.calls[0][0].where).toEqual({ personalForUserId: null });
    expect(data.personalInviteCount).toBe(3);
    expect(
      data.productions.map((show: { id: string; acceptsNewInvites: boolean }) => [
        show.id,
        show.acceptsNewInvites,
      ]),
    ).toEqual([
      ["neu", true],
      ["alt", false],
    ]);
  });

  it("legt keine Links für beendete Produktionen an", async () => {
    mocks.showFindUnique.mockResolvedValue({
      id: "alt",
      title: "Die unendliche Geschichte",
      year: 2026,
      status: "finished",
    });

    const response = await POST(jsonRequest({ showId: "alt", roles: ["member"] }));

    expect(response.status).toBe(400);
    expect(mocks.inviteCreate).not.toHaveBeenCalled();
  });

  it("stellt Links nicht auf beendete Produktionen um", async () => {
    mocks.showFindUnique.mockResolvedValue({ id: "alt", status: "finished" });
    mocks.inviteFindUnique.mockResolvedValue({ showId: "neu" });

    const response = await PATCH(jsonRequest({ showId: "alt" }), {
      params: Promise.resolve({ id: "invite-1" }),
    });

    expect(response.status).toBe(400);
    expect(mocks.inviteUpdate).not.toHaveBeenCalled();
  });
});
