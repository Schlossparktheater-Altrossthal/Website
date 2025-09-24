export type RawPageView = {
  path?: string | null;
  scope?: string | null;
  deviceHint?: string | null;
  loadTimeMs?: number | null;
  lcpMs?: number | null;
  weight?: number | null;
};

export type AggregatedPageMetric = {
  path: string;
  scope: "public" | "members" | null;
  avgLoadMs: number;
  lcpMs: number | null;
  weight: number;
};

export type AggregatedDeviceMetric = {
  device: string;
  sessions: number;
  avgLoadMs: number;
  share: number;
};

type PageBucket = {
  path: string;
  scope: "public" | "members" | null;
  loadSum: number;
  loadWeight: number;
  lcpSum: number;
  lcpWeight: number;
  totalWeight: number;
};

type DeviceBucket = {
  key: string;
  sessions: number;
  loadSum: number;
  loadWeight: number;
};

function normalizePath(raw?: string | null): string | null {
  if (!raw) {
    return null;
  }
  let path = String(raw).trim();
  if (!path) {
    return null;
  }
  try {
    const url = new URL(path, "http://localhost");
    path = url.pathname || path;
  } catch {
    // ignore
  }
  path = path.split("?")[0] ?? path;
  path = path.split("#")[0] ?? path;
  if (!path.startsWith("/")) {
    path = `/${path}`;
  }
  path = path.replace(/\\+/g, "/");
  if (path.length > 1 && path.endsWith("/")) {
    path = path.slice(0, -1);
  }
  path = path.replace(/\\index$/i, "/");
  return path || "/";
}

function normalizeScope(scope: string | null | undefined, path: string): "public" | "members" | null {
  if (scope === "public" || scope === "members") {
    return scope;
  }
  if (!scope && path) {
    const lower = path.toLowerCase();
    if (lower.startsWith("/mitglieder") || lower.startsWith("/members")) {
      return "members";
    }
    return "public";
  }
  if (typeof scope === "string") {
    const lower = scope.toLowerCase();
    if (lower.includes("member") || lower.includes("intern")) {
      return "members";
    }
    if (lower.includes("public") || lower.includes("extern")) {
      return "public";
    }
  }
  return null;
}

function normalizeDeviceKey(raw: string | null | undefined): string {
  if (!raw) {
    return "unknown";
  }
  const value = raw.trim().toLowerCase();
  if (!value) {
    return "unknown";
  }
  if (value.includes("desktop") || value.includes("pc") || value.includes("laptop")) {
    return "desktop";
  }
  if (value.includes("tablet") || value.includes("ipad")) {
    return "tablet";
  }
  if (
    value.includes("mobile") ||
    value.includes("phone") ||
    value.includes("smartphone") ||
    value.includes("handy") ||
    value.includes("android") ||
    value.includes("iphone")
  ) {
    return "mobile";
  }
  if (value.includes("smarttv") || value.includes("tv") || value.includes("hbbtv")) {
    return "tv";
  }
  if (value.includes("playstation") || value.includes("xbox") || value.includes("nintendo")) {
    return "console";
  }
  if (value.includes("watch")) {
    return "wearable";
  }
  if (value.includes("other") || value.includes("unknown")) {
    return "other";
  }
  return value.replace(/\s+/g, "_");
}

function normalizeDuration(value: number | null | undefined): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return null;
  }
  const rounded = Math.round(value);
  if (rounded <= 0) {
    return null;
  }
  return Math.min(rounded, 900_000);
}

function normalizeWeight(value: number | null | undefined): number {
  if (value === null || value === undefined) {
    return 1;
  }
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 1;
  }
  const rounded = Math.round(value);
  if (rounded <= 0) {
    return 0;
  }
  return Math.min(rounded, 10_000);
}

export function aggregatePageMetrics(rawPageViews: RawPageView[]) {
  const pageBuckets = new Map<string, PageBucket>();
  const deviceBuckets = new Map<string, DeviceBucket>();

  for (const view of rawPageViews) {
    const path = normalizePath(view.path);
    if (!path) {
      continue;
    }

    const loadTime = normalizeDuration(view.loadTimeMs);
    const lcp = normalizeDuration(view.lcpMs);
    if (loadTime === null && lcp === null) {
      continue;
    }

    const scope = normalizeScope(view.scope ?? null, path);
    const weight = normalizeWeight(view.weight);
    if (weight <= 0) {
      continue;
    }
    const bucketKey = `${path}__${scope ?? "all"}`;

    if (!pageBuckets.has(bucketKey)) {
      pageBuckets.set(bucketKey, {
        path,
        scope,
        loadSum: 0,
        loadWeight: 0,
        lcpSum: 0,
        lcpWeight: 0,
        totalWeight: 0,
      });
    }

    const pageBucket = pageBuckets.get(bucketKey)!;
    pageBucket.totalWeight += weight;

    if (loadTime !== null) {
      pageBucket.loadSum += loadTime * weight;
      pageBucket.loadWeight += weight;
    }
    if (lcp !== null) {
      pageBucket.lcpSum += lcp * weight;
      pageBucket.lcpWeight += weight;
    }

    const deviceKey = normalizeDeviceKey(view.deviceHint ?? null);
    if (!deviceBuckets.has(deviceKey)) {
      deviceBuckets.set(deviceKey, {
        key: deviceKey,
        sessions: 0,
        loadSum: 0,
        loadWeight: 0,
      });
    }

    const deviceBucket = deviceBuckets.get(deviceKey)!;
    deviceBucket.sessions += weight;
    if (loadTime !== null) {
      deviceBucket.loadSum += loadTime * weight;
      deviceBucket.loadWeight += weight;
    }
  }

  const pages: AggregatedPageMetric[] = [];

  for (const bucket of pageBuckets.values()) {
    if (bucket.totalWeight <= 0) {
      continue;
    }
    const avgLoad = bucket.loadWeight > 0 ? bucket.loadSum / bucket.loadWeight : 0;
    const avgLcp = bucket.lcpWeight > 0 ? bucket.lcpSum / bucket.lcpWeight : null;
    pages.push({
      path: bucket.path,
      scope: bucket.scope,
      avgLoadMs: Math.max(0, Math.round(avgLoad)),
      lcpMs: avgLcp !== null ? Math.max(0, Math.round(avgLcp)) : null,
      weight: bucket.totalWeight,
    });
  }

  pages.sort((a, b) => {
    if (b.weight !== a.weight) {
      return b.weight - a.weight;
    }
    return a.path.localeCompare(b.path);
  });

  const devices: AggregatedDeviceMetric[] = [];
  const totalSessions = Array.from(deviceBuckets.values()).reduce(
    (sum, bucket) => sum + (Number.isFinite(bucket.sessions) ? bucket.sessions : 0),
    0,
  );

  for (const bucket of deviceBuckets.values()) {
    if (bucket.sessions <= 0) {
      continue;
    }
    const avgLoad = bucket.loadWeight > 0 ? bucket.loadSum / bucket.loadWeight : 0;
    const share = totalSessions > 0 ? bucket.sessions / totalSessions : 0;
    devices.push({
      device: bucket.key,
      sessions: Math.max(0, Math.round(bucket.sessions)),
      avgLoadMs: Math.max(0, Math.round(avgLoad)),
      share: Math.min(Math.max(share, 0), 1),
    });
  }

  devices.sort((a, b) => {
    if (b.sessions !== a.sessions) {
      return b.sessions - a.sessions;
    }
    return a.device.localeCompare(b.device);
  });

  return { pages, devices };
}
