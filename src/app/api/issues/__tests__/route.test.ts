import { describe, expect, it, beforeEach, vi } from "vitest";
import type { NextRequest } from "next/server";

import { GET } from "../route";
import { getSession } from "@/lib/rbac";
import { hasPermission } from "@/lib/permissions";

vi.mock("@/lib/rbac", () => ({
  getSession: vi.fn(),
}));

vi.mock("@/lib/permissions", () => ({
  hasPermission: vi.fn(),
}));

const prismaIssueMock = vi.hoisted(() => ({
  findMany: vi.fn(),
  groupBy: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    issue: prismaIssueMock,
  },
}));

vi.mock("@/app/api/issues/utils", () => ({
  mapIssueSummary: vi.fn((issue: unknown) => issue),
}));

describe("GET /api/issues", () => {
  const getSessionMock = vi.mocked(getSession);
  const hasPermissionMock = vi.mocked(hasPermission);
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when no session is present", async () => {
    getSessionMock.mockResolvedValue(null);
    const request = { url: "https://example.com/api/issues" } as NextRequest;

    const response = await GET(request);
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Nicht autorisiert" });
    expect(prismaIssueMock.findMany).not.toHaveBeenCalled();
  });

  it("returns 403 when the user is deactivated", async () => {
    getSessionMock.mockResolvedValue({ user: { id: "user-1", isDeactivated: true } });
    const request = { url: "https://example.com/api/issues" } as NextRequest;

    const response = await GET(request);
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "Kein Zugriff" });
  });

  it("returns issues and counts for authorized users", async () => {
    getSessionMock.mockResolvedValue({ user: { id: "user-1", isDeactivated: false } });
    hasPermissionMock.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    prismaIssueMock.findMany.mockResolvedValue([
      {
        id: "issue-1",
        title: "Test",
        description: "Description",
        category: "general",
        status: "open",
        priority: "medium",
        visibility: "public",
        createdAt: new Date(),
        updatedAt: new Date(),
        lastActivityAt: new Date(),
        resolvedAt: null,
        createdById: "user-1",
        updatedById: null,
        createdBy: null,
        updatedBy: null,
        _count: { comments: 0 },
      },
    ]);
    prismaIssueMock.groupBy.mockResolvedValue([
      { status: "open", _count: { _all: 1 } },
    ]);

    const request = { url: "https://example.com/api/issues" } as NextRequest;
    const response = await GET(request);
    expect(response.status).toBe(200);
    const body = await response.json();

    expect(Array.isArray(body.issues)).toBe(true);
    expect(body.issues).toHaveLength(1);
    expect(body.counts).toEqual({ open: 1, in_progress: 0, resolved: 0, closed: 0 });
  });
});
