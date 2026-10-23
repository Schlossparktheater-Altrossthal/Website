import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  hasPermission: vi.fn(),
  logError: vi.fn(),
}));
vi.mock("@/lib/rbac", () => ({ getSession: mocks.getSession }));
vi.mock("@/lib/permissions", () => ({ hasPermission: mocks.hasPermission }));
vi.mock("@/lib/logger", () => ({ createLogger: () => ({ error: mocks.logError }) }));

import { HttpError, parseJson, withRoute } from "@/lib/api/route";

const request = (body?: unknown) =>
  new Request("http://localhost/api/x", {
    method: "POST",
    body: body === undefined ? undefined : JSON.stringify(body),
  });

describe("withRoute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSession.mockResolvedValue({ user: { id: "u1" } });
    mocks.hasPermission.mockResolvedValue(true);
  });

  it("antwortet 401 ohne Sitzung", async () => {
    mocks.getSession.mockResolvedValue(null);
    const route = withRoute({ name: "t" }, async () => ({ hi: 1 }));
    const response = await route(request());
    expect(response.status).toBe(401);
  });

  it("antwortet 403 ohne Recht oder bei deaktiviertem Konto", async () => {
    mocks.hasPermission.mockResolvedValue(false);
    const route = withRoute({ name: "t", permission: "X" }, async () => ({}));
    expect((await route(request())).status).toBe(403);
    mocks.getSession.mockResolvedValue({ user: { id: "u1", isDeactivated: true } });
    expect((await withRoute({ name: "t" }, async () => ({}))(request())).status).toBe(403);
  });

  it("gibt Daten als JSON zurück und reicht Parameter durch", async () => {
    const route = withRoute<{ id: string }>({ name: "t" }, async ({ userId, params }) => ({
      userId,
      id: params.id,
    }));
    const response = await route(request(), { params: Promise.resolve({ id: "42" }) });
    expect(await response.json()).toEqual({ userId: "u1", id: "42" });
  });

  it("übersetzt HttpError und Validierungsfehler", async () => {
    const schema = z.object({ name: z.string({ error: "Name fehlt" }) });
    const route = withRoute({ name: "t" }, async ({ request: req }) => parseJson(req, schema));
    const response = await route(request({}));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Name fehlt" });

    const notFound = withRoute({ name: "t" }, async () => {
      throw new HttpError(404, "Weg");
    });
    expect((await notFound(request())).status).toBe(404);
  });

  it("protokolliert unerwartete Fehler und antwortet 500", async () => {
    const route = withRoute({ name: "t", errorMessage: "Kaputt" }, async () => {
      throw new Error("boom");
    });
    const response = await route(request());
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Kaputt" });
    expect(mocks.logError).toHaveBeenCalled();
  });
});
