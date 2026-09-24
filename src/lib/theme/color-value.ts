import { hexToOklch, oklchToHex } from "@/lib/color";

const OKLCH_PATTERN =
  /^oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)(?:deg)?\s*(?:\/\s*([\d.]+)(%?))?\s*\)$/i;

/** Hex-Wert für `<input type="color">` oder `null`, wenn der CSS-Wert keine einfache Farbe ist. */
export function cssColorToHex(value: string | undefined): string | null {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(trimmed)) {
    const hex = trimmed.slice(1);
    const full = hex.length === 3 ? [...hex].map((char) => char + char).join("") : hex;
    return `#${full.toLowerCase()}`;
  }
  const match = OKLCH_PATTERN.exec(trimmed);
  if (!match) {
    return null;
  }
  const l = Number.parseFloat(match[1]) / (match[2] === "%" ? 100 : 1);
  const c = Number.parseFloat(match[3]);
  const h = Number.parseFloat(match[4]);
  if (![l, c, h].every(Number.isFinite)) {
    return null;
  }
  return oklchToHex({ l, c, h }, { includeAlpha: false }).toLowerCase();
}

/** Wandelt eine Hex-Farbe aus dem Farbwähler in `oklch(...)` wie bei tweakcn. */
export function hexToOklchValue(hex: string): string | null {
  const color = hexToOklch(hex);
  if (!color) {
    return null;
  }
  const l = Number.parseFloat(color.l.toFixed(4));
  const c = Number.parseFloat(color.c.toFixed(4));
  const h = Number.parseFloat((c < 0.0001 ? 0 : color.h).toFixed(4));
  return `oklch(${l} ${c} ${h})`;
}
