import { beforeEach, describe, expect, it, vi } from "vitest";

const { readWebsiteSettingsMock } = vi.hoisted(() => ({
  readWebsiteSettingsMock: vi.fn(),
}));

vi.mock("@/lib/website-settings", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/website-settings")>();
  return { ...actual, readWebsiteSettings: readWebsiteSettingsMock };
});

import { GET } from "../route";

describe("GET /api/website/theme.css", () => {
  beforeEach(() => {
    readWebsiteSettingsMock.mockReset();
    process.env.DATABASE_URL = "postgres://test";
  });

  it("liefert das aktive Theme als CSS", async () => {
    readWebsiteSettingsMock.mockResolvedValue({
      id: "public",
      siteTitle: "Sommertheater",
      colorMode: "dark",
      maintenanceMode: false,
      pageVisibility: null,
      themeId: "t1",
      createdAt: new Date(),
      updatedAt: new Date(),
      theme: {
        id: "t1",
        name: "Test */ Theme",
        description: null,
        isDefault: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        tokens: {
          format: "tweakcn",
          theme: { "font-sans": "Geist, sans-serif" },
          light: { primary: "#e58a08" },
          dark: { primary: "#ffaa00" },
        },
      },
    });

    const response = await GET();
    const css = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/css");
    expect(response.headers.get("cache-control")).toContain("max-age=300");
    expect(css).toContain("/* Sommertheater Website-Theme: Test  Theme */");
    expect(css).toContain("--primary: #e58a08;");
    expect(css).toContain("--primary: #ffaa00;");
    // Keine Mitgliederbereich-spezifischen Schrift-Aliase im öffentlichen CSS.
    expect(css).toContain("--font-sans: Geist, sans-serif;");
  });

  it("antwortet mit 503, wenn die Datenbank nicht erreichbar ist", async () => {
    readWebsiteSettingsMock.mockRejectedValue(new Error("db down"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await GET();
    expect(response.status).toBe(503);
  });
});
