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

describe("GET /api/dev/screenshot-session", () => {
  beforeEach(() => {
    prismaMock.userUpsert.mockReset();
    prismaMock.userRoleUpsert.mockReset();
    vi.stubEnv("NODE_ENV", "test");
    process.env.DATABASE_URL = "postgres://offline.example";
  });

  afterEach(() => {
    if (ORIGINAL_DATABASE_URL) {
      process.env.DATABASE_URL = ORIGINAL_DATABASE_URL;
    } else {
      vi.stubEnv("AUTH_SECRET", "test-auth-secret-".repeat(3));
      delete process.env.DATABASE_URL;
    }

    vi.unstubAllEnvs();
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

      const sessionCookie = response.cookies.get("authjs.session-token");
      expect(sessionCookie).toBeDefined();
      expect(sessionCookie?.value).toBeTruthy();
      expect(prismaMock.userRoleUpsert).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalled();
    } finally {
      warnSpy.mockRestore();
    }
  });

  describe("Production-Build (Staging-Test-Login)", () => {
    const SECRET = "a".repeat(40);

    function request(query: string, secret?: string) {
      return new NextRequest(`https://staging.example/api/dev/screenshot-session?${query}`, {
        headers: secret ? { "x-e2e-login-secret": secret } : {},
      });
    }

    beforeEach(() => {
      vi.stubEnv("NODE_ENV", "production");
      prismaMock.userUpsert.mockRejectedValue(new Error("connection refused"));
    });

    it("antwortet mit 404, wenn E2E_LOGIN_SECRET fehlt (Produktion)", async () => {
      vi.stubEnv("E2E_LOGIN_SECRET", "");
      const response = await GET(request("role=owner&mode=json", SECRET));
      expect(response.status).toBe(404);
    });

    it("ignoriert zu kurze Secrets", async () => {
      vi.stubEnv("E2E_LOGIN_SECRET", "kurz");
      vi.spyOn(console, "warn").mockImplementation(() => {});
      const response = await GET(request("role=owner&mode=json", "kurz"));
      expect(response.status).toBe(404);
    });

    it("lehnt fehlendes oder falsches Secret ab", async () => {
      vi.stubEnv("E2E_LOGIN_SECRET", SECRET);
      expect((await GET(request("role=owner&mode=json"))).status).toBe(401);
      expect((await GET(request("role=owner&mode=json", "b".repeat(40)))).status).toBe(401);
    });

    it("erlaubt keine beliebigen E-Mail-Adressen", async () => {
      vi.stubEnv("E2E_LOGIN_SECRET", SECRET);
      const response = await GET(
        request("role=owner&email=echtes.mitglied@example.org&mode=json", SECRET),
      );
      expect(response.status).toBe(400);
      expect(prismaMock.userUpsert).not.toHaveBeenCalled();
    });

    it("setzt mit gültigem Secret das __Secure-Cookie für einen Testnutzer", async () => {
      vi.stubEnv("E2E_LOGIN_SECRET", SECRET);
      vi.stubEnv("AUTH_SECRET", "test-auth-secret-".repeat(3));
      delete process.env.DATABASE_URL;
      vi.spyOn(console, "warn").mockImplementation(() => {});
      const response = await GET(request("role=admin&mode=json", SECRET));
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({ ok: true, email: "admin@example.com" });
      const cookie = response.cookies.get("__Secure-authjs.session-token");
      expect(cookie?.value).toBeTruthy();
      expect(cookie?.secure).toBe(true);
    });
  });
});
