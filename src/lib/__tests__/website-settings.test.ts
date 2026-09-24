import { describe, expect, test } from "vitest";

import { DEFAULT_WEBSITE_THEME } from "@/lib/theme/presets/builtin";
import { sanitiseTweakcnTheme } from "@/lib/theme/tweakcn";
import { toTweakcnTheme } from "@/lib/website-settings";

// Frühere Speicherform: Farbfamilien + fertig berechnete `modes`.
const LEGACY_STORED_THEME = {
  radius: { base: "0.75rem" },
  parameters: { families: { brand: { light: { l: 0.6, c: 0.1, h: 40 } } }, tokens: {} },
  modes: {
    light: { primary: "oklch(0.62 0.1 40)", background: "oklch(0.95 0.01 255)" },
    dark: { primary: "oklch(0.73 0.12 40)", background: "oklch(0.1 0.03 255)" },
  },
  meta: { modes: ["light", "dark"] },
};

describe("toTweakcnTheme", () => {
  test("übernimmt die berechneten Werte alter Themes", () => {
    const theme = toTweakcnTheme(LEGACY_STORED_THEME);

    expect(theme.format).toBe("tweakcn");
    expect(theme.theme.radius).toBe("0.75rem");
    expect(theme.light.primary).toBe("oklch(0.62 0.1 40)");
    expect(theme.dark.background).toBe("oklch(0.1 0.03 255)");
    // Fehlende Farben kommen aus dem Standard-Theme.
    expect(theme.light.success).toBe(DEFAULT_WEBSITE_THEME.light.success);
  });

  test("lässt tweakcn-Themes unverändert und ist idempotent", () => {
    const theme = toTweakcnTheme({
      format: "tweakcn",
      theme: { "font-sans": "Outfit, sans-serif" },
      light: { primary: "#e58a08" },
      dark: { primary: "#e58a08" },
    });
    expect(theme.light.primary).toBe("#e58a08");
    expect(theme.theme["font-sans"]).toBe("Outfit, sans-serif");
    expect(toTweakcnTheme(theme)).toEqual(theme);
  });

  test("fällt bei unbrauchbaren Daten auf das Standard-Theme zurück", () => {
    expect(toTweakcnTheme(null)).toEqual(sanitiseTweakcnTheme(DEFAULT_WEBSITE_THEME));
    expect(toTweakcnTheme({ foo: 1 })).toEqual(sanitiseTweakcnTheme(DEFAULT_WEBSITE_THEME));
  });
});
