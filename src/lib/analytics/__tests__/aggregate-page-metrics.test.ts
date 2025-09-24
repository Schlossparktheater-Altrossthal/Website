import { describe, expect, it } from "vitest";

import { aggregatePageMetrics } from "@/lib/analytics/aggregate-page-metrics";

describe("aggregatePageMetrics", () => {
  it("aggregates page metrics and device breakdown", () => {
    const result = aggregatePageMetrics([
      {
        path: "/chronik",
        scope: "public",
        loadTimeMs: 1_200,
        lcpMs: 900,
        weight: 2,
        deviceHint: "Desktop",
      },
      {
        path: "/chronik?utm=1",
        scope: "Public",
        loadTimeMs: 1_500,
        lcpMs: null,
        weight: 1,
        deviceHint: "desktop",
      },
      {
        path: "/mitglieder/dashboard",
        scope: null,
        loadTimeMs: 820,
        lcpMs: 640,
        weight: 3,
        deviceHint: "iPhone",
      },
      {
        path: "/mitglieder/dashboard#top",
        scope: "members",
        loadTimeMs: 780,
        lcpMs: 610,
        weight: 1,
        deviceHint: "iphone",
      },
      {
        path: "/blog",
        scope: "unknown",
        loadTimeMs: 950,
        lcpMs: null,
        weight: 0,
        deviceHint: "SmartTV",
      },
    ]);

    expect(result.pages).toEqual([
      {
        path: "/mitglieder/dashboard",
        scope: "members",
        avgLoadMs: 810,
        lcpMs: 633,
        weight: 4,
      },
      {
        path: "/chronik",
        scope: "public",
        avgLoadMs: 1300,
        lcpMs: 900,
        weight: 3,
      },
    ]);

    expect(result.devices).toHaveLength(2);
    const desktop = result.devices.find((entry) => entry.device === "desktop");
    const mobile = result.devices.find((entry) => entry.device === "mobile");

    expect(desktop).toBeDefined();
    expect(desktop?.sessions).toBe(3);
    expect(desktop?.avgLoadMs).toBe(1300);
    expect(desktop?.share).toBeCloseTo(0.429, 3);

    expect(mobile).toBeDefined();
    expect(mobile?.sessions).toBe(4);
    expect(mobile?.avgLoadMs).toBe(810);
    expect(mobile?.share).toBeCloseTo(0.571, 3);
  });

  it("ignores entries without metrics", () => {
    const result = aggregatePageMetrics([
      { path: "/foo", scope: "public", loadTimeMs: null, lcpMs: null, weight: 3 },
      { path: "/bar", scope: "public", weight: 2 },
    ]);

    expect(result.pages).toEqual([]);
    expect(result.devices).toEqual([]);
  });
});
