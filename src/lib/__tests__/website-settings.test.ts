import { describe, expect, test } from "vitest";

import { sanitiseThemeTokens } from "@/lib/website-settings";

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

    expect(tokens.modes.light.primary).toBe("oklch(0.62 0.1 40)");
    expect(tokens.modes.dark.primary).toBe("oklch(0.73 0.12 40)");
    expect(tokens.modes.light.background).toBe("oklch(0.95 0.01 255)");
    expect(tokens.modes.dark.background).toBe("oklch(0.1 0.03 255)");
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

    expect(tokens.modes.light.primary).toBe("#111111");
    expect(tokens.modes.light.background).toBe("oklch(0.95 0.01 255)");
    expect(tokens.modes.dark.primary).toBe("oklch(0.73 0.12 40)");
    expect(tokens.modes.contrast.special).toBe("#ff00ff");
    expect(tokens.meta?.modes).toEqual(["light", "dark", "contrast"]);
  });
});

