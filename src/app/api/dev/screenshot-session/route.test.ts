import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  userUpsert: vi.fn(),
  userRoleUpsert: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      upsert: prismaMock.userUpsert,
    },
    userRole: {
      upsert: prismaMock.userRoleUpsert,
    },
  },
}));

import { GET } from "./route";

const ORIGINAL_DATABASE_URL = process.env.DATABASE_URL;
const ORIGINAL_NODE_ENV = process.env.NODE_ENV;

describe("GET /api/dev/screenshot-session", () => {
  beforeEach(() => {
    prismaMock.userUpsert.mockReset();
    prismaMock.userRoleUpsert.mockReset();
    process.env.NODE_ENV = "test";
    process.env.DATABASE_URL = "postgres://offline.example";
  });

  afterEach(() => {
    if (ORIGINAL_DATABASE_URL) {
      process.env.DATABASE_URL = ORIGINAL_DATABASE_URL;
    } else {
      delete process.env.DATABASE_URL;
    }

    if (ORIGINAL_NODE_ENV) {
      process.env.NODE_ENV = ORIGINAL_NODE_ENV;
    } else {
      delete process.env.NODE_ENV;
    }
  });

  it("returns a valid session cookie and JSON payload when falling back to the offline profile", async () => {
    prismaMock.userUpsert.mockRejectedValueOnce(new Error("connection refused"));

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    try {
      const request = new NextRequest(
        "http://localhost:3000/api/dev/screenshot-session?role=owner&mode=json",
      );

      const response = await GET(request);

      expect(response.status).toBe(200);
      const payload = await response.json();
      expect(payload).toEqual({
        ok: true,
        email: "owner@example.com",
        role: "owner",
        target: "/mitglieder",
        offlineProfile: true,
      });

      const sessionCookie = response.cookies.get("next-auth.session-token");
      expect(sessionCookie).toBeDefined();
      expect(sessionCookie?.value).toBeTruthy();
      expect(prismaMock.userRoleUpsert).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalled();
    } finally {
      warnSpy.mockRestore();
    }
  });
});
