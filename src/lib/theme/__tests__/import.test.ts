import { afterEach, describe, expect, it, vi } from "vitest";

import { resolveThemeImport } from "@/lib/theme/import";
import { ThemeImportError } from "@/lib/theme/tweakcn";

const REGISTRY_ITEM = {
  name: "amethyst-haze",
  cssVars: {
    theme: { "font-sans": "Geist, sans-serif" },
    light: { primary: "oklch(0.61 0.08 300)" },
    dark: { primary: "oklch(0.7 0.08 300)" },
  },
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("resolveThemeImport", () => {
  it("lädt tweakcn-Links über die Registry-URL", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(REGISTRY_ITEM)));
    vi.stubGlobal("fetch", fetchMock);

    const result = await resolveThemeImport("https://tweakcn.com/themes/amethyst-haze");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://tweakcn.com/r/themes/amethyst-haze.json",
      expect.objectContaining({ redirect: "error" }),
    );
    expect(result.suggestedName).toBe("amethyst-haze");
    expect(result.theme.light.primary).toBe("oklch(0.61 0.08 300)");
  });

  it("ruft fremde URLs nicht ab", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(resolveThemeImport("https://evil.example/theme.json")).rejects.toThrow(
      ThemeImportError,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("meldet nicht gefundene Themes verständlich", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("not found", { status: 404 })),
    );
    await expect(resolveThemeImport("https://tweakcn.com/r/themes/x.json")).rejects.toThrow(
      /nicht gefunden/,
    );
  });

  it("verarbeitet eingefügtes JSON und CSS ohne Netzwerk", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const fromJson = await resolveThemeImport(JSON.stringify(REGISTRY_ITEM));
    expect(fromJson.suggestedName).toBe("amethyst-haze");

    const fromCss = await resolveThemeImport(":root { --primary: #e58a08; }");
    expect(fromCss.suggestedName).toBeNull();
    expect(fromCss.theme.light.primary).toBe("#e58a08");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
