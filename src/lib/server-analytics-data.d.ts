import type { DeviceStat, PagePerformanceEntry } from "@/lib/server-analytics";

export type PagePerformanceMetricOverride = {
  path: string;
  avgPageLoadMs: number;
  lcpMs?: number | null;
  scope?: "public" | "members" | null;
};

export declare function loadDeviceBreakdownFromDatabase(): Promise<DeviceStat[] | null>;
export declare function loadPagePerformanceMetrics(): Promise<PagePerformanceMetricOverride[]>;
export declare function mergeDeviceBreakdown(
  base: DeviceStat[],
  overrides?: DeviceStat[] | null,
): DeviceStat[];
export declare function applyPagePerformanceMetrics(
  baseEntries: PagePerformanceEntry[],
  overrides: PagePerformanceMetricOverride[] | null | undefined,
  scope: "public" | "members",
): PagePerformanceEntry[];
export declare function resetAnalyticsMetadataCache(): void;
