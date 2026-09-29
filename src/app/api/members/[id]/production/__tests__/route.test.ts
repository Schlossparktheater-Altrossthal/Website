import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DELETE } from "../route";

const { requireAuthMock, hasPermissionMock, activeProductionMock, leaveMock, revalidatePathMock } =
  vi.hoisted(() => ({
    requireAuthMock: vi.fn(),
    hasPermissionMock: vi.fn(),
    activeProductionMock: vi.fn(),
    leaveMock: vi.fn(),
    revalidatePathMock: vi.fn(),
  }));

vi.mock("@/lib/rbac", () => ({ requireAuth: requireAuthMock }));
vi.mock("@/lib/permissions", () => ({ hasPermission: hasPermissionMock }));
vi.mock("@/lib/active-production", () => ({ getActiveProduction: activeProductionMock }));
vi.mock("@/lib/produktionen/memberships", () => ({ leaveProductionMembership: leaveMock }));
vi.mock("@/lib/produktionen/actions-helpers", () => ({
  revalidateShow: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));

const callDelete = (id = "user-1") =>
  DELETE({} as NextRequest, { params: Promise.resolve({ id }) });

describe("members/[id]/production DELETE route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    requireAuthMock.mockResolvedValue({ user: { id: "admin-1" } });
    hasPermissionMock.mockResolvedValue(true);
    activeProductionMock.mockResolvedValue({ id: "show-1", title: "In 80 Tagen um die Welt" });
    leaveMock.mockResolvedValue({ showId: "show-1", userId: "user-1" });
  });

  it("beendet die Mitgliedschaft der aktiven Produktion", async () => {
    const response = await callDelete();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, production: null });
    expect(leaveMock).toHaveBeenCalledWith({ showId: "show-1", userId: "user-1" });
    expect(revalidatePathMock).toHaveBeenCalledWith("/mitglieder", "layout");
  });

  it("verweigert ohne Berechtigung", async () => {
    hasPermissionMock.mockResolvedValue(false);

    const response = await callDelete();

    expect(response.status).toBe(403);
    expect(leaveMock).not.toHaveBeenCalled();
  });

  it("meldet fehlende aktive Produktion", async () => {
    activeProductionMock.mockResolvedValue(null);

    const response = await callDelete();

    expect(response.status).toBe(400);
    expect(leaveMock).not.toHaveBeenCalled();
  });

  it("meldet Mitglieder ohne offene Mitgliedschaft", async () => {
    leaveMock.mockResolvedValue(null);

    const response = await callDelete();

    expect(response.status).toBe(404);
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("antwortet mit 500, wenn das Beenden fehlschlägt", async () => {
    leaveMock.mockRejectedValue(new Error("boom"));

    const response = await callDelete();

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Entfernen fehlgeschlagen" });
  });
});
