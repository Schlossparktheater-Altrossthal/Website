import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DELETE } from "../route";

const {
  requireAuthMock,
  hasPermissionMock,
  findUniqueMock,
  countMock,
  deleteMock,
  anonymizeAccountMock,
  deactivateMock,
} = vi.hoisted(() => ({
  requireAuthMock: vi.fn(),
  hasPermissionMock: vi.fn(),
  findUniqueMock: vi.fn(),
  countMock: vi.fn(),
  deleteMock: vi.fn(),
  anonymizeAccountMock: vi.fn(),
  deactivateMock: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: findUniqueMock,
      count: countMock,
      delete: deleteMock,
    },
  },
}));

vi.mock("@/lib/rbac", () => ({ requireAuth: requireAuthMock }));
vi.mock("@/lib/permissions", () => ({ hasPermission: hasPermissionMock }));
vi.mock("@/lib/retention", () => ({ anonymizeAccount: anonymizeAccountMock }));
vi.mock("@/lib/password", () => ({ hashPassword: vi.fn() }));
vi.mock("@/lib/authentik/migration", () => ({ migratePasswordToAuthentik: vi.fn() }));
vi.mock("@/lib/authentik/sync", () => ({
  deactivateMemberInAuthentik: deactivateMock,
  syncMemberToAuthentik: vi.fn(),
}));

const callDelete = (id = "user-1") =>
  DELETE({} as NextRequest, { params: Promise.resolve({ id }) });

describe("members/[id] DELETE route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    requireAuthMock.mockResolvedValue({ user: { id: "admin-1" } });
    hasPermissionMock.mockResolvedValue(true);
    findUniqueMock.mockResolvedValue({ id: "user-1", role: "member", roles: [] });
    deleteMock.mockResolvedValue({ id: "user-1" });
    anonymizeAccountMock.mockResolvedValue(undefined);
    deactivateMock.mockResolvedValue(undefined);
  });

  it("hard-deletes a member without linked business data", async () => {
    const response = await callDelete();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, anonymized: false });
    expect(deactivateMock).toHaveBeenCalledWith("user-1");
    expect(deleteMock).toHaveBeenCalledWith({ where: { id: "user-1" } });
    expect(anonymizeAccountMock).not.toHaveBeenCalled();
  });

  it("anonymizes instead when a restrict foreign key blocks the delete (P2003)", async () => {
    deleteMock.mockRejectedValue(Object.assign(new Error("FK"), { code: "P2003" }));

    const response = await callDelete();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, anonymized: true });
    expect(anonymizeAccountMock).toHaveBeenCalledWith("user-1");
  });

  it("returns 500 and does not anonymize on other database errors", async () => {
    deleteMock.mockRejectedValue(Object.assign(new Error("boom"), { code: "P1001" }));

    const response = await callDelete();

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Löschen fehlgeschlagen" });
    expect(anonymizeAccountMock).not.toHaveBeenCalled();
  });

  it("returns 500 when the anonymization fallback fails", async () => {
    deleteMock.mockRejectedValue(Object.assign(new Error("FK"), { code: "P2003" }));
    anonymizeAccountMock.mockRejectedValue(new Error("tx failed"));

    const response = await callDelete();

    expect(response.status).toBe(500);
  });

  it("refuses to remove the last owner", async () => {
    findUniqueMock.mockResolvedValue({ id: "user-1", role: "owner", roles: [] });
    countMock.mockResolvedValue(0);

    const response = await callDelete();

    expect(response.status).toBe(400);
    expect(deleteMock).not.toHaveBeenCalled();
    expect(anonymizeAccountMock).not.toHaveBeenCalled();
  });

  it("rejects callers without the manage permission", async () => {
    hasPermissionMock.mockResolvedValue(false);

    const response = await callDelete();

    expect(response.status).toBe(403);
    expect(findUniqueMock).not.toHaveBeenCalled();
  });
});
