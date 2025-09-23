export type OklchColor = {
  l: number;
  c: number;
  h: number;
  alpha?: number;
};

const TAU = Math.PI * 2;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function normalizeHue(degrees: number) {
  if (!Number.isFinite(degrees)) {
    return 0;
  }
  const mod = degrees % 360;
  return mod < 0 ? mod + 360 : mod;
}

function srgbToLinear(value: number) {
  if (value <= 0.04045) {
    return value / 12.92;
  }
  return Math.pow((value + 0.055) / 1.055, 2.4);
}

function linearToSrgb(value: number) {
  if (value <= 0.0031308) {
    return 12.92 * value;
  }
  return 1.055 * Math.pow(value, 1 / 2.4) - 0.055;
}

function oklchToSrgb(color: OklchColor) {
  const l = clamp(color.l, 0, 1);
  const c = Math.max(color.c, 0);
  const hueRadians = normalizeHue(color.h) / 360 * TAU;
  const a = c * Math.cos(hueRadians);
  const b = c * Math.sin(hueRadians);

  const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = l - 0.0894841775 * a - 1.291485548 * b;

  const l3 = l_ ** 3;
  const m3 = m_ ** 3;
  const s3 = s_ ** 3;

  const rLinear = 4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3;
  const gLinear = -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3;
  const bLinear = -0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3;

  return {
    r: clamp(linearToSrgb(clamp(rLinear, 0, 1)), 0, 1),
    g: clamp(linearToSrgb(clamp(gLinear, 0, 1)), 0, 1),
    b: clamp(linearToSrgb(clamp(bLinear, 0, 1)), 0, 1),
    alpha: clamp(color.alpha ?? 1, 0, 1),
  };
}

function srgbToOklch(r: number, g: number, b: number) {
  const rLinear = srgbToLinear(r);
  const gLinear = srgbToLinear(g);
  const bLinear = srgbToLinear(b);

  const l = 0.4122214708 * rLinear + 0.5363325363 * gLinear + 0.0514459929 * bLinear;
  const m = 0.2119034982 * rLinear + 0.6806995451 * gLinear + 0.1073969566 * bLinear;
  const s = 0.0883024619 * rLinear + 0.2817188376 * gLinear + 0.6299787005 * bLinear;

  const l_ = Math.cbrt(l);
  const m_ = Math.cbrt(m);
  const s_ = Math.cbrt(s);

  const L = 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_;
  const a = 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_;
  const bVal = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_;

  const chroma = Math.sqrt(a * a + bVal * bVal);
  let hue = Math.atan2(bVal, a) * (180 / Math.PI);
  if (hue < 0) {
    hue += 360;
  }

  return {
    l: clamp(L, 0, 1),
    c: chroma,
    h: hue,
  };
}

function channelToHex(value: number) {
  const int = Math.round(clamp(value, 0, 1) * 255);
  return int.toString(16).padStart(2, "0").toUpperCase();
}

export function oklchToHex(color: OklchColor, options?: { includeAlpha?: boolean }) {
  const { r, g, b, alpha } = oklchToSrgb(color);
  const rgbHex = `#${channelToHex(r)}${channelToHex(g)}${channelToHex(b)}`;
  const shouldIncludeAlpha = options?.includeAlpha ?? (alpha < 1);
  if (shouldIncludeAlpha) {
    return `${rgbHex}${channelToHex(alpha)}`;
  }
  return rgbHex;
}

export function hexToOklch(input: string): (OklchColor & { alpha: number }) | null {
  if (!input) {
    return null;
  }
  let value = input.trim();
  if (!value) {
    return null;
  }
  if (value.startsWith("#")) {
    value = value.slice(1);
  }
  if (value.length === 3 || value.length === 4) {
    value = value
      .split("")
      .map((char) => char + char)
      .join("");
  }
  if (value.length !== 6 && value.length !== 8) {
    return null;
  }
  if (!/^[0-9a-fA-F]+$/.test(value)) {
    return null;
  }

  const hasAlpha = value.length === 8;
  const r = Number.parseInt(value.slice(0, 2), 16) / 255;
  const g = Number.parseInt(value.slice(2, 4), 16) / 255;
  const b = Number.parseInt(value.slice(4, 6), 16) / 255;
  const alpha = hasAlpha ? Number.parseInt(value.slice(6, 8), 16) / 255 : 1;

  const oklch = srgbToOklch(r, g, b);
  return { ...oklch, alpha: clamp(alpha, 0, 1) };
}
