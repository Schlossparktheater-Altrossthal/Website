import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  hasPermission: vi.fn(),
  showFindUnique: vi.fn(),
  load: vi.fn(),
  renderPdfTemplate: vi.fn(),
}));

vi.mock("@/lib/rbac", () => ({ requireAuth: async () => ({ user: { id: "u" } }) }));
vi.mock("@/lib/permissions", () => ({ hasPermission: mocks.hasPermission }));
vi.mock("@/lib/prisma", () => ({ prisma: { show: { findUnique: mocks.showFindUnique } } }));
vi.mock("@/lib/pdf/engine", () => ({ renderPdfTemplate: mocks.renderPdfTemplate }));
vi.mock("@/lib/produktionen/photo-consent-overview", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/produktionen/photo-consent-overview")>()),
  loadPhotoConsentOverview: mocks.load,
}));

import { GET } from "../route";

const request = (query: string) =>
  ({ nextUrl: new URL(`http://localhost/api/photo-consents/export${query}`) }) as NextRequest;

describe("Fotoerlaubnis-Export", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.hasPermission.mockResolvedValue(false);
    mocks.showFindUnique.mockResolvedValue({ title: "Die unendliche Geschichte", year: 2026 });
    mocks.load.mockResolvedValue({ purposes: [], rows: [] });
    mocks.renderPdfTemplate.mockResolvedValue({
      buffer: Buffer.from("pdf"),
      filename: "fotoerlaubnis-die-unendliche-geschichte.pdf",
    });
  });

  it("verweigert ohne Berechtigung", async () => {
    expect((await GET(request("?showId=s"))).status).toBe(403);
  });

  it("erlaubt Produktionsleitung und liefert eine CSV-Datei", async () => {
    mocks.hasPermission.mockImplementation(
      async (_user: unknown, key: string) => key === "PRIVATE.PRODUCTION.SHOW.MANAGE",
    );

    const response = await GET(request("?showId=s"));

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/csv; charset=utf-8");
    expect(response.headers.get("Content-Disposition")).toBe(
      'attachment; filename="fotoerlaubnis-die-unendliche-geschichte-2026.csv"',
    );
    expect(mocks.load).toHaveBeenCalledWith("s");
  });

  it("liefert auf Wunsch eine PDF-Datei", async () => {
    mocks.hasPermission.mockResolvedValue(true);

    const response = await GET(request("?showId=s&format=pdf"));

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/pdf");
    expect(mocks.renderPdfTemplate).toHaveBeenCalledWith(
      "photo-consent-list",
      expect.objectContaining({ showTitle: "Die unendliche Geschichte", purposes: [] }),
    );
  });

  it("verlangt eine Produktion", async () => {
    mocks.hasPermission.mockResolvedValue(true);
    expect((await GET(request(""))).status).toBe(400);
  });
});
