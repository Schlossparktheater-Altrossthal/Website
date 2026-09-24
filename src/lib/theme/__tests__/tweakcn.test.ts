import { describe, expect, it } from "vitest";

import {
  ThemeImportError,
  createTweakcnThemeCss,
  parseThemeCss,
  parseThemeInput,
  parseThemeRegistryItem,
  sanitiseThemeValue,
  sanitiseTweakcnTheme,
  toThemeRegistryItem,
  toTweakcnRegistryUrl,
} from "@/lib/theme/tweakcn";

// Auszug aus Theme-Drupal-Sommertheater/src/theme.css
const DRUPAL_THEME_CSS = `
/**
 * @file theme.css
 */
:root {
  --paper-surface: #ebd6b4;
  --background: #ffe8d0;
  --foreground: #0d1715;
  --card: #f6e8d3;
  --card-foreground: #0d1715;
  --primary: #e58a08;
  --primary-foreground: #0d1715;
  --accent-foreground: var(--foreground);
  --border: #b68a45;
  --font-sans: "Outfit", "Helvetica Neue", Arial, Helvetica, sans-serif;
  --radius: 0.5rem;
  --shadow-sm: 0 0 3px 0 hsl(30 32% 27% / 0.2), 0 1px 2px -1px hsl(30 32% 27% / 0.2);
  --tracking-normal: 0.1em;
  --spacing: 0.25rem;
  --navbar-height: calc(var(--spacing) * 15);

  @media (min-width: 768px) {
    --navbar-height: calc(var(--spacing) * 18);
  }
}

.dark {
  --background: #0d1715;
  --foreground: #f6ebd3;
  --card: #182522;
  --primary: #e58a08;
  --font-sans: "Outfit", "Helvetica Neue", Arial, Helvetica, sans-serif;
  --radius: 0.5rem;
}
`;

const REGISTRY_ITEM = {
  $schema: "https://ui.shadcn.com/schema/registry-item.json",
  name: "amethyst-haze",
  type: "registry:style",
  cssVars: {
    theme: { "font-sans": "Geist, sans-serif", radius: "0.5rem" },
    light: {
      background: "oklch(0.9777 0.0041 301.4256)",
      primary: "oklch(0.6104 0.0767 299.7335)",
      radius: "0.5rem",
      "shadow-color": "hsl(0 0% 0%)",
    },
    dark: { background: "oklch(0.2166 0.0215 292.8474)", primary: "oklch(0.7 0.08 300)" },
  },
};

describe("parseThemeCss", () => {
  it("liest :root und .dark aus einer Drupal-theme.css", () => {
    const theme = parseThemeCss(DRUPAL_THEME_CSS);

    expect(theme.light.background).toBe("#ffe8d0");
    expect(theme.light["accent-foreground"]).toBe("var(--foreground)");
    expect(theme.light["paper-surface"]).toBe("#ebd6b4");
    expect(theme.dark.background).toBe("#0d1715");
    expect(theme.theme["font-sans"]).toBe(
      '"Outfit", "Helvetica Neue", Arial, Helvetica, sans-serif',
    );
    expect(theme.theme.radius).toBe("0.5rem");
    expect(theme.theme["tracking-normal"]).toBe("0.1em");
    expect(theme.light.radius).toBeUndefined();
  });

  it("ignoriert verschachtelte @media-Regeln", () => {
    const theme = parseThemeCss(DRUPAL_THEME_CSS);
    expect(theme.light["navbar-height"]).toBe("calc(var(--spacing) * 15)");
  });

  it("ergänzt fehlende shadcn-, Status- und Sidebar-Variablen", () => {
    const theme = parseThemeCss(DRUPAL_THEME_CSS);

    expect(theme.light.popover).toBe("#f6e8d3");
    expect(theme.light.sidebar).toBe("#f6e8d3");
    expect(theme.light["sidebar-primary"]).toBe("#e58a08");
    expect(theme.light["chart-1"]).toBe("#e58a08");
    expect(theme.light.input).toBe("#b68a45");
    expect(theme.light.success).toMatch(/^oklch\(/);
    expect(theme.dark["warning-foreground"]).toMatch(/^oklch\(/);
    expect(theme.dark["card-foreground"]).toBe("#f6ebd3");
    expect(theme.light["shadow-sm"]).toContain("hsl(30 32% 27%");
    expect(theme.light["shadow-lg"]).toContain("rgb(0 0 0");
  });

  it("verarbeitet @layer base und Kommentare", () => {
    const theme = parseThemeCss(
      "@layer base { :root { --primary: red; /* x */ } .dark { --primary: blue; } }",
    );
    expect(theme.light.primary).toBe("red");
    expect(theme.dark.primary).toBe("blue");
  });

  it("nutzt :root auch für dark, wenn .dark fehlt", () => {
    const theme = parseThemeCss(":root { --primary: red; }");
    expect(theme.dark.primary).toBe("red");
  });

  it("wirft bei CSS ohne Variablen oder kaputten Klammern", () => {
    expect(() => parseThemeCss("body { color: red; }")).toThrow(ThemeImportError);
    expect(() => parseThemeCss(":root { --primary: red;")).toThrow(ThemeImportError);
  });
});

describe("parseThemeRegistryItem", () => {
  it("übernimmt cssVars aus der tweakcn-Registry", () => {
    const theme = parseThemeRegistryItem(REGISTRY_ITEM);
    expect(theme.theme["font-sans"]).toBe("Geist, sans-serif");
    expect(theme.light.primary).toBe("oklch(0.6104 0.0767 299.7335)");
    expect(theme.light["shadow-color"]).toBe("hsl(0 0% 0%)");
    expect(theme.light.radius).toBeUndefined();
    expect(theme.dark.primary).toBe("oklch(0.7 0.08 300)");
  });

  it("wirft ohne cssVars", () => {
    expect(() => parseThemeRegistryItem({ name: "x" })).toThrow(ThemeImportError);
  });
});

describe("parseThemeInput", () => {
  it("erkennt JSON und CSS", () => {
    expect(parseThemeInput(JSON.stringify(REGISTRY_ITEM)).light.primary).toContain("oklch");
    expect(parseThemeInput(":root { --primary: #fff; }").light.primary).toBe("#fff");
    expect(() => parseThemeInput("   ")).toThrow(ThemeImportError);
  });
});

describe("Sicherheit", () => {
  it("verwirft Werte, die aus der Deklaration oder dem style-Tag ausbrechen", () => {
    expect(sanitiseThemeValue("red; } body { display:none")).toBeNull();
    expect(sanitiseThemeValue("</style><script>alert(1)</script>")).toBeNull();
    expect(sanitiseThemeValue("url(https://evil.example/x.png)")).toBeNull();
    expect(sanitiseThemeValue('"Outfit", sans-serif')).toBe('"Outfit", sans-serif');
    expect(sanitiseThemeValue("calc(var(--tracking-normal) - 0.05em)")).toBe(
      "calc(var(--tracking-normal) - 0.05em)",
    );
  });

  it("verwirft ungültige Variablennamen", () => {
    const theme = sanitiseTweakcnTheme({
      light: { "Bad Name": "red", "--primary": "blue", "x;y": "red" },
    });
    expect(theme.light.primary).toBe("blue");
    expect(Object.keys(theme.light)).not.toContain("Bad Name");
    expect(Object.keys(theme.light)).not.toContain("x;y");
  });
});

describe("Export", () => {
  it("erzeugt CSS, das wieder identisch importiert wird", () => {
    const theme = parseThemeCss(DRUPAL_THEME_CSS);
    const css = createTweakcnThemeCss(theme);

    expect(css).toMatch(/^:root \{/);
    expect(css).toContain('--font-sans: "Outfit"');
    expect(css).toContain(".dark {");
    expect(parseThemeCss(css)).toEqual(theme);
  });

  it("erzeugt ein Registry-Item, das wieder identisch importiert wird", () => {
    const theme = parseThemeRegistryItem(REGISTRY_ITEM);
    const item = toThemeRegistryItem("mein-theme", theme);
    expect(item.name).toBe("mein-theme");
    expect(parseThemeRegistryItem(item)).toEqual(theme);
  });
});

describe("toTweakcnRegistryUrl", () => {
  it("akzeptiert nur tweakcn.com", () => {
    expect(toTweakcnRegistryUrl("https://tweakcn.com/r/themes/amethyst-haze.json")).toBe(
      "https://tweakcn.com/r/themes/amethyst-haze.json",
    );
    expect(toTweakcnRegistryUrl("https://tweakcn.com/themes/cmabc123")).toBe(
      "https://tweakcn.com/r/themes/cmabc123.json",
    );
    expect(toTweakcnRegistryUrl("https://evil.example/r/themes/x.json")).toBeNull();
    expect(toTweakcnRegistryUrl("https://tweakcn.com.evil.example/r/themes/x.json")).toBeNull();
    expect(toTweakcnRegistryUrl("http://tweakcn.com/r/themes/x.json")).toBeNull();
  });
});

describe("Schrift-Aliase", () => {
  it("bildet Geist nur bei resolveFonts auf next/font ab", () => {
    const theme = sanitiseTweakcnTheme({
      theme: { "font-sans": "Geist, sans-serif", "font-mono": '"Geist Mono", monospace' },
      light: { primary: "red" },
    });
    const resolved = createTweakcnThemeCss(theme, { resolveFonts: true });
    expect(resolved).toContain("--font-sans: var(--font-geist-sans), sans-serif;");
    expect(resolved).toContain("--font-mono: var(--font-geist-mono), monospace;");

    const exported = createTweakcnThemeCss(theme);
    expect(exported).toContain("--font-sans: Geist, sans-serif;");
  });

  it("lässt andere Schriften mit Geist im Namen unverändert", () => {
    const theme = sanitiseTweakcnTheme({ theme: { "font-sans": "Geisterbahn, serif" } });
    expect(createTweakcnThemeCss(theme, { resolveFonts: true })).toContain(
      "--font-sans: Geisterbahn, serif;",
    );
  });
});
