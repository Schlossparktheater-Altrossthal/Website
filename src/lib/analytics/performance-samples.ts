import { z } from "zod";

// Gemeinsame Logik für die echten Ladezeiten aus dem Browser (RUM): Validierung der
// Messungen, Zuordnung von User-Agent zu Browser/System und Auswertung für die Statistik.

export const PERFORMANCE_SAMPLE_KINDS = ["load", "navigation"] as const;
export type PerformanceSampleKind = (typeof PERFORMANCE_SAMPLE_KINDS)[number];

const MAX_DURATION_MS = 120_000;
export const MAX_SAMPLES_PER_REQUEST = 25;
export const DEFAULT_PERFORMANCE_RETENTION_DAYS = 60;

const durationSchema = z.number().nonnegative().max(MAX_DURATION_MS).nullish();

export const performanceSampleSchema = z.object({
  path: z.string().trim().min(1).max(512),
  kind: z.enum(PERFORMANCE_SAMPLE_KINDS),
  durationMs: z.number().nonnegative().max(MAX_DURATION_MS),
  feedbackMs: durationSchema,
  ttfbMs: durationSchema,
  fcpMs: durationSchema,
  lcpMs: durationSchema,
  inpMs: durationSchema,
  cls: z.number().nonnegative().max(100).nullish(),
});

export const performancePayloadSchema = z.object({
  analyticsSessionId: z.string().trim().min(6).max(128).nullish(),
  effectiveType: z.string().trim().max(16).nullish(),
  standalone: z.boolean().nullish(),
  samples: z.array(performanceSampleSchema).min(1).max(MAX_SAMPLES_PER_REQUEST),
});

export type PerformancePayload = z.infer<typeof performancePayloadSchema>;

const ID_SEGMENT_PATTERNS = [
  /^c[a-z0-9]{20,}$/i, // cuid
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, // uuid
  /^\d+$/,
  /^[A-Za-z0-9_-]{24,}$/, // lange Tokens/Slugs mit IDs
];

/** Ersetzt IDs in Pfaden durch `[id]`, damit Detailseiten zusammengefasst ausgewertet werden. */
export function normalizePerformanceRoute(rawPath: string): string {
  let path = rawPath.trim();
  try {
    path = new URL(path, "http://localhost").pathname;
  } catch {
    // Pfad unverändert weiterverwenden
  }
  const segments = path
    .split("/")
    .filter(Boolean)
    .map((segment) => (ID_SEGMENT_PATTERNS.some((re) => re.test(segment)) ? "[id]" : segment));
  return `/${segments.join("/")}`.slice(0, 256);
}

export type ParsedUserAgent = {
  deviceType: "mobile" | "tablet" | "desktop";
  browser: string;
  browserVersion: string | null;
  os: string;
};

function majorVersion(ua: string, pattern: RegExp): string | null {
  const match = ua.match(pattern);
  return match?.[1] ?? null;
}

/** Bewusst schlanke Erkennung der gängigen Browser – reicht für die Auswertung nach Geräten. */
export function parseUserAgent(ua: string | null | undefined): ParsedUserAgent {
  const value = ua ?? "";

  let os = "Andere";
  if (/iPhone|iPod/.test(value)) os = "iOS";
  else if (/iPad/.test(value) || (/Macintosh/.test(value) && /Mobile\//.test(value))) os = "iPadOS";
  else if (/Android/.test(value)) os = "Android";
  else if (/Windows/.test(value)) os = "Windows";
  else if (/Mac OS X|Macintosh/.test(value)) os = "macOS";
  else if (/CrOS/.test(value)) os = "ChromeOS";
  else if (/Linux/.test(value)) os = "Linux";

  let deviceType: ParsedUserAgent["deviceType"] = "desktop";
  if (os === "iPadOS" || /Tablet/.test(value) || (os === "Android" && !/Mobile/.test(value))) {
    deviceType = "tablet";
  } else if (os === "iOS" || /Mobile|Android/.test(value)) {
    deviceType = "mobile";
  }

  let browser = "Andere";
  let browserVersion: string | null = null;
  if (/Edg(A|iOS)?\//.test(value)) {
    browser = "Edge";
    browserVersion = majorVersion(value, /Edg(?:A|iOS)?\/(\d+)/);
  } else if (/SamsungBrowser\//.test(value)) {
    browser = "Samsung Internet";
    browserVersion = majorVersion(value, /SamsungBrowser\/(\d+)/);
  } else if (/OPR\/|Opera/.test(value)) {
    browser = "Opera";
    browserVersion = majorVersion(value, /OPR\/(\d+)/);
  } else if (/Firefox\/|FxiOS\//.test(value)) {
    browser = "Firefox";
    browserVersion = majorVersion(value, /(?:Firefox|FxiOS)\/(\d+)/);
  } else if (/Chrome\/|CriOS\//.test(value)) {
    browser = "Chrome";
    browserVersion = majorVersion(value, /(?:Chrome|CriOS)\/(\d+)/);
  } else if (/Safari\//.test(value) && /Version\//.test(value)) {
    browser = "Safari";
    browserVersion = majorVersion(value, /Version\/(\d+(?:\.\d+)?)/);
  } else if (/AppleWebKit/.test(value) && (os === "iOS" || os === "iPadOS")) {
    browser = "Safari (App)";
  }

  return { deviceType, browser, browserVersion, os };
}

export function isLikelyBot(ua: string | null | undefined): boolean {
  return /bot|crawler|spider|headless|lighthouse|pingdom|uptime/i.test(ua ?? "");
}

function roundOrNull(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? Math.round(value) : null;
}

export function buildPerformanceRows(
  payload: PerformancePayload,
  userAgent: string | null,
  now: Date,
) {
  const parsed = parseUserAgent(userAgent);
  return payload.samples.map((sample) => ({
    createdAt: now,
    route: normalizePerformanceRoute(sample.path),
    kind: sample.kind,
    durationMs: Math.round(sample.durationMs),
    feedbackMs: roundOrNull(sample.feedbackMs),
    ttfbMs: roundOrNull(sample.ttfbMs),
    fcpMs: roundOrNull(sample.fcpMs),
    lcpMs: roundOrNull(sample.lcpMs),
    inpMs: roundOrNull(sample.inpMs),
    cls: typeof sample.cls === "number" ? Math.round(sample.cls * 1000) / 1000 : null,
    deviceType: parsed.deviceType,
    browser: parsed.browser,
    browserVersion: parsed.browserVersion,
    os: parsed.os,
    userAgent: userAgent ? userAgent.slice(0, 512) : null,
    effectiveType: payload.effectiveType ?? null,
    standalone: payload.standalone ?? false,
    analyticsSessionId: payload.analyticsSessionId ?? null,
  }));
}

// ---------------------------------------------------------------------------
// Auswertung
// ---------------------------------------------------------------------------

export type PerformanceSampleRow = {
  route: string;
  kind: string;
  durationMs: number;
  feedbackMs: number | null;
  ttfbMs: number | null;
  lcpMs: number | null;
  inpMs: number | null;
  deviceType: string;
  browser: string;
  os: string;
  standalone: boolean;
};

export type PerformanceStats = {
  count: number;
  p50: number | null;
  p75: number | null;
  p95: number | null;
};

export type PerformanceGroup = PerformanceStats & {
  key: string;
  feedbackP75: number | null;
};

export type PerformanceSummary = {
  days: number;
  total: number;
  load: PerformanceStats & { ttfbP75: number | null; lcpP75: number | null; inpP75: number | null };
  navigation: PerformanceStats & { feedbackP75: number | null };
  routes: Array<PerformanceGroup & { kind: PerformanceSampleKind }>;
  devices: Array<PerformanceGroup & { kind: PerformanceSampleKind }>;
  browsers: Array<PerformanceGroup & { kind: PerformanceSampleKind }>;
};

export function percentile(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null;
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[index] ?? null;
}

function stats(values: number[]): PerformanceStats {
  const sorted = [...values].sort((a, b) => a - b);
  return {
    count: sorted.length,
    p50: percentile(sorted, 50),
    p75: percentile(sorted, 75),
    p95: percentile(sorted, 95),
  };
}

function p75Of(values: Array<number | null>): number | null {
  const filtered = values.filter((v): v is number => typeof v === "number");
  return percentile(
    filtered.sort((a, b) => a - b),
    75,
  );
}

function groupBy(
  rows: PerformanceSampleRow[],
  keyOf: (row: PerformanceSampleRow) => string,
): Array<PerformanceGroup & { kind: PerformanceSampleKind }> {
  const groups = new Map<string, PerformanceSampleRow[]>();
  for (const row of rows) {
    const key = `${row.kind}\u0000${keyOf(row)}`;
    const list = groups.get(key);
    if (list) list.push(row);
    else groups.set(key, [row]);
  }
  return [...groups.entries()]
    .map(([compound, list]) => {
      const [kind, key] = compound.split("\u0000") as [PerformanceSampleKind, string];
      return {
        kind,
        key,
        ...stats(list.map((row) => row.durationMs)),
        feedbackP75: p75Of(list.map((row) => row.feedbackMs)),
      };
    })
    .sort((a, b) => b.count - a.count);
}

export function summarizePerformanceSamples(
  rows: PerformanceSampleRow[],
  days: number,
): PerformanceSummary {
  const loads = rows.filter((row) => row.kind === "load");
  const navigations = rows.filter((row) => row.kind === "navigation");
  const deviceLabel = (row: PerformanceSampleRow) =>
    `${row.deviceType === "mobile" ? "Handy" : row.deviceType === "tablet" ? "Tablet" : "Desktop"} · ${row.os}${row.standalone ? " (App)" : ""}`;

  return {
    days,
    total: rows.length,
    load: {
      ...stats(loads.map((row) => row.durationMs)),
      ttfbP75: p75Of(loads.map((row) => row.ttfbMs)),
      lcpP75: p75Of(loads.map((row) => row.lcpMs)),
      inpP75: p75Of(rows.map((row) => row.inpMs)),
    },
    navigation: {
      ...stats(navigations.map((row) => row.durationMs)),
      feedbackP75: p75Of(navigations.map((row) => row.feedbackMs)),
    },
    routes: groupBy(rows, (row) => row.route),
    devices: groupBy(rows, deviceLabel),
    browsers: groupBy(rows, (row) => `${row.browser} · ${row.os}`),
  };
}
