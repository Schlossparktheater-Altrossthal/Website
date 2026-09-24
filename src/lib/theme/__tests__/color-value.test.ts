import { describe, expect, it } from "vitest";

import { cssColorToHex, hexToOklchValue } from "@/lib/theme/color-value";

describe("cssColorToHex", () => {
  it("liest Hex- und OKLCH-Werte", () => {
    expect(cssColorToHex("#E58A08")).toBe("#e58a08");
    expect(cssColorToHex("#fff")).toBe("#ffffff");
    expect(cssColorToHex("oklch(1 0 0)")).toBe("#ffffff");
    expect(cssColorToHex("oklch(100% 0 0)")).toBe("#ffffff");
    expect(cssColorToHex("oklch(0 0 0 / 0.5)")).toBe("#000000");
  });

  it("gibt null für Werte ohne feste Farbe zurück", () => {
    expect(cssColorToHex("var(--foreground)")).toBeNull();
    expect(cssColorToHex("hsl(30 32% 27%)")).toBeNull();
    expect(cssColorToHex(undefined)).toBeNull();
  });
});

describe("hexToOklchValue", () => {
  it("erzeugt OKLCH, das wieder dieselbe Hex-Farbe ergibt", () => {
    for (const hex of ["#e58a08", "#0d1715", "#ffe8d0", "#ffffff", "#000000"]) {
      expect(cssColorToHex(hexToOklchValue(hex) ?? undefined)).toBe(hex);
    }
    expect(hexToOklchValue("nope")).toBeNull();
  });
});
