import { describe, expect, test } from "vitest";

import { sanitiseThemeTokens, toTweakcnTheme } from "@/lib/website-settings";

const PARAMETERS_PAYLOAD = {
  families: {
    neutral: {
      light: { l: 0.9, c: 0.02, h: 255 },
      dark: { l: 0.2, c: 0.02, h: 255 },
    },
    brand: {
      light: { l: 0.6, c: 0.1, h: 40 },
      dark: { l: 0.7, c: 0.12, h: 40 },
    },
  },
  tokens: {
    primary: {
      family: "brand",
      light: { deltaL: 0.02 },
      dark: { deltaL: 0.03 },
    },
    background: {
      family: "neutral",
      light: { deltaL: 0.05 },
      dark: { deltaL: -0.1 },
    },
  },
} as const;

describe("sanitiseThemeTokens", () => {
  test("derives theme modes from parameters when modes are omitted", () => {
    const tokens = sanitiseThemeTokens({
      radius: { base: "1rem" },
      parameters: JSON.parse(JSON.stringify(PARAMETERS_PAYLOAD)),
    });

    const modes = tokens.modes as Record<string, Record<string, string>>;
    expect(modes.light.primary).toBe("oklch(0.62 0.1 40)");
    expect(modes.dark.primary).toBe("oklch(0.73 0.12 40)");
    expect(modes.light.background).toBe("oklch(0.95 0.01 255)");
    expect(modes.dark.background).toBe("oklch(0.1 0.03 255)");
    expect(tokens.meta?.modes).toEqual(["light", "dark"]);
  });

  test("merges manual mode overrides on top of derived values", () => {
    const tokens = sanitiseThemeTokens({
      radius: { base: "1rem" },
      parameters: JSON.parse(JSON.stringify(PARAMETERS_PAYLOAD)),
      modes: {
        light: {
          primary: "#111111",
        },
        contrast: {
          special: "#ff00ff",
        },
      },
    });

    const modes = tokens.modes as Record<string, Record<string, string>>;
    expect(modes.light.primary).toBe("#111111");
    expect(modes.light.background).toBe("oklch(0.95 0.01 255)");
    expect(modes.dark.primary).toBe("oklch(0.73 0.12 40)");
    expect(modes.contrast.special).toBe("#ff00ff");
    expect(tokens.meta?.modes).toEqual(["light", "dark", "contrast"]);
  });
});

describe("toTweakcnTheme", () => {
  test("übernimmt alte Themes mit identischen Farbwerten", () => {
    const legacy = sanitiseThemeTokens({
      radius: { base: "0.75rem" },
      parameters: PARAMETERS_PAYLOAD,
    });
    const modes = legacy.modes as Record<string, Record<string, string>>;
    const theme = toTweakcnTheme({ radius: { base: "0.75rem" }, parameters: PARAMETERS_PAYLOAD });

    expect(theme.format).toBe("tweakcn");
    expect(theme.theme.radius).toBe("0.75rem");
    for (const scheme of ["light", "dark"] as const) {
      for (const [name, value] of Object.entries(modes[scheme])) {
        expect(theme[scheme][name]).toBe(value);
      }
    }
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
});
