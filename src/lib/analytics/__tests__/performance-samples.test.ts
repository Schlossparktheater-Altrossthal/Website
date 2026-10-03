import { describe, expect, it } from "vitest";

import {
  buildPerformanceRows,
  normalizePerformanceRoute,
  parseUserAgent,
  percentile,
  performancePayloadSchema,
  summarizePerformanceSamples,
  type PerformanceSampleRow,
} from "../performance-samples";

const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1";
const ANDROID_CHROME =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36";
const WINDOWS_EDGE =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 Edg/140.0.0.0";
const MAC_FIREFOX =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14.5; rv:141.0) Gecko/20100101 Firefox/141.0";

describe("parseUserAgent", () => {
  it("erkennt gängige Geräte und Browser", () => {
    expect(parseUserAgent(IPHONE)).toEqual({
      deviceType: "mobile",
      browser: "Safari",
      browserVersion: "18.5",
      os: "iOS",
    });
    expect(parseUserAgent(ANDROID_CHROME)).toMatchObject({
      deviceType: "mobile",
      browser: "Chrome",
      browserVersion: "140",
      os: "Android",
    });
    expect(parseUserAgent(WINDOWS_EDGE)).toMatchObject({
      deviceType: "desktop",
      browser: "Edge",
      os: "Windows",
    });
    expect(parseUserAgent(MAC_FIREFOX)).toMatchObject({ browser: "Firefox", os: "macOS" });
    expect(parseUserAgent(null)).toMatchObject({ browser: "Andere", os: "Andere" });
  });
});

describe("normalizePerformanceRoute", () => {
  it("fasst IDs in Detailseiten zusammen", () => {
    expect(
      normalizePerformanceRoute("/mitglieder/mitgliederverwaltung/cmg0w5wy6006oo32vjbinejpj"),
    ).toBe("/mitglieder/mitgliederverwaltung/[id]");
    expect(normalizePerformanceRoute("/mitglieder/lager/123?tab=x")).toBe("/mitglieder/lager/[id]");
    expect(normalizePerformanceRoute("/mitglieder/sperrliste/")).toBe("/mitglieder/sperrliste");
  });
});

describe("payload + rows", () => {
  it("validiert und baut Zeilen mit geparstem User-Agent", () => {
    const payload = performancePayloadSchema.parse({
      samples: [
        { path: "/mitglieder/profil", kind: "navigation", durationMs: 812.4, feedbackMs: 40 },
      ],
    });
    const [row] = buildPerformanceRows(payload, IPHONE, new Date(0));
    expect(row).toMatchObject({
      route: "/mitglieder/profil",
      durationMs: 812,
      feedbackMs: 40,
      deviceType: "mobile",
      browser: "Safari",
      standalone: false,
    });
  });

  it("lehnt leere oder zu große Batches ab", () => {
    expect(performancePayloadSchema.safeParse({ samples: [] }).success).toBe(false);
    const many = Array.from({ length: 26 }, () => ({ path: "/x", kind: "load", durationMs: 1 }));
    expect(performancePayloadSchema.safeParse({ samples: many }).success).toBe(false);
  });
});

describe("summarizePerformanceSamples", () => {
  const row = (overrides: Partial<PerformanceSampleRow>): PerformanceSampleRow => ({
    route: "/mitglieder/dashboard",
    kind: "navigation",
    durationMs: 500,
    feedbackMs: 50,
    ttfbMs: null,
    lcpMs: null,
    inpMs: null,
    deviceType: "mobile",
    browser: "Safari",
    os: "iOS",
    standalone: false,
    ...overrides,
  });

  it("berechnet Perzentile je Art und Gruppe", () => {
    expect(percentile([1, 2, 3, 4], 75)).toBe(3);
    const summary = summarizePerformanceSamples(
      [
        row({ durationMs: 100 }),
        row({ durationMs: 300 }),
        row({ durationMs: 900, route: "/mitglieder/sperrliste" }),
        row({ kind: "load", durationMs: 2000, ttfbMs: 300, deviceType: "desktop", os: "Windows" }),
      ],
      14,
    );
    expect(summary.total).toBe(4);
    expect(summary.navigation).toMatchObject({ count: 3, p50: 300, p95: 900 });
    expect(summary.load).toMatchObject({ count: 1, p75: 2000, ttfbP75: 300 });
    expect(
      summary.routes.find((g) => g.key === "/mitglieder/dashboard" && g.kind === "navigation"),
    ).toMatchObject({ count: 2, p50: 100, p75: 300 });
    expect(summary.devices.map((g) => g.key)).toContain("Desktop · Windows");
  });
});
