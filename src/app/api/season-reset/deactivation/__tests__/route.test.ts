import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET, POST } from "../route";

const { requireAuthMock, hasPermissionMock, previewMock, performMock } = vi.hoisted(() => ({
  requireAuthMock: vi.fn(),
  hasPermissionMock: vi.fn(),
  previewMock: vi.fn(),
  performMock: vi.fn(),
}));

vi.mock("@/lib/rbac", () => ({ requireAuth: requireAuthMock }));
vi.mock("@/lib/permissions", () => ({ hasPermission: hasPermissionMock }));
vi.mock("@/lib/season-reset/deactivation", () => ({
  previewSeasonChangeDeactivation: previewMock,
  performSeasonChangeDeactivation: performMock,
}));

const createRequest = (body: unknown) => ({ json: async () => body }) as NextRequest;

describe("season-reset deactivation route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAuthMock.mockResolvedValue({ user: { id: "admin-1" } });
    hasPermissionMock.mockResolvedValue(true);
  });

  it("verweigert ohne Berechtigung Vorschau und Ausführung", async () => {
    hasPermissionMock.mockResolvedValue(false);

    expect((await GET()).status).toBe(403);
    expect((await POST(createRequest({ confirm: true }))).status).toBe(403);
    expect(previewMock).not.toHaveBeenCalled();
    expect(performMock).not.toHaveBeenCalled();
  });

  it("liefert die Vorschau ohne zu deaktivieren", async () => {
    previewMock.mockResolvedValue([{ id: "u1", name: "Anna", email: "a@example.org" }]);

    const response = await GET();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      candidates: [{ id: "u1", name: "Anna", email: "a@example.org" }],
    });
    expect(performMock).not.toHaveBeenCalled();
  });

  it("verlangt eine explizite Bestätigung", async () => {
    const response = await POST(createRequest({ keepUserIds: [] }));

    expect(response.status).toBe(400);
    expect(performMock).not.toHaveBeenCalled();
  });

  it("deaktiviert mit Ausnahmen und meldet die Anzahl", async () => {
    performMock.mockResolvedValue(4);

    const response = await POST(createRequest({ confirm: true, keepUserIds: ["u1"] }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ deactivated: 4 });
    expect(performMock).toHaveBeenCalledWith(["u1"]);
  });

  it("meldet Fehler als { error } mit Status 500", async () => {
    performMock.mockRejectedValue(new Error("db down"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await POST(createRequest({ confirm: true }));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Saisonabschluss fehlgeschlagen" });
  });
});
