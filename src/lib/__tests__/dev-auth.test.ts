import { createHash } from "node:crypto";

import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

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

import { ensureDevTestUser } from "@/lib/dev-auth";

const ORIGINAL_DATABASE_URL = process.env.DATABASE_URL;

describe("ensureDevTestUser offline fallback", () => {
  beforeEach(() => {
    prismaMock.userUpsert.mockReset();
    prismaMock.userRoleUpsert.mockReset();
    process.env.NODE_ENV = "test";
  });

  afterEach(() => {
    if (ORIGINAL_DATABASE_URL) {
      process.env.DATABASE_URL = ORIGINAL_DATABASE_URL;
    } else {
      delete process.env.DATABASE_URL;
    }
  });

  it("returns a deterministic offline profile when the database rejects requests", async () => {
    process.env.DATABASE_URL = "postgres://offline.example";
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const rejection = new Error("connection refused");
    prismaMock.userUpsert.mockRejectedValueOnce(rejection);

    try {
      const profile = await ensureDevTestUser("Owner@Example.com", "owner");

      expect(profile.isOfflineProfile).toBe(true);
      expect(profile.id).toBe(
        createHash("sha256").update("owner@example.com").digest("hex").slice(0, 24),
      );
      expect(profile.firstName).toBe("Offline");
      expect(profile.lastName).toBe("Owner");
      expect(profile.name).toBe("Offline Owner");
      expect(profile.roles).toEqual(["owner"]);
      expect(profile.avatarSource).toBeNull();
      expect(profile.avatarImageUpdatedAt).toBeNull();
      expect(prismaMock.userRoleUpsert).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalled();
    } finally {
      warnSpy.mockRestore();
    }
  });
});
