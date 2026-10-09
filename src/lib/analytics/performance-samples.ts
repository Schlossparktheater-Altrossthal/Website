import { z } from "zod";

// Gemeinsame Logik für die echten Ladezeiten aus dem Browser (RUM): Validierung der
// Messungen, Zuordnung von User-Agent zu Browser/System und Auswertung für die Statistik.

// "interaction": einzelne langsame Reaktion auf Klick/Tippen/Taste (> 200 ms, wie INP)
export const PERFORMANCE_SAMPLE_KINDS = ["load", "navigation", "interaction"] as const;
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
  serverMs: durationSchema,
  requestCount: z.number().int().nonnegative().max(500).nullish(),
  ttfbMs: durationSchema,
  fcpMs: durationSchema,
  lcpMs: durationSchema,
  inpMs: durationSchema,
  cls: z.number().nonnegative().max(100).nullish(),
  interactionType: z.string().trim().max(32).nullish(),
  interactionTarget: z.string().trim().max(120).nullish(),
});

const sizeSchema = z.number().int().positive().max(20_000).nullish();

/** Bildschirm und Eingabe des Geräts – im Browser gemessen, der User-Agent reicht dafür nicht. */
export const deviceInfoSchema = z.object({
  viewportWidth: sizeSchema,
  viewportHeight: sizeSchema,
  screenWidth: sizeSchema,
  screenHeight: sizeSchema,
  pixelRatio: z.number().positive().max(10).nullish(),
  orientation: z.enum(["portrait", "landscape"]).nullish(),
  touch: z.boolean().nullish(),
  maxTouchPoints: z.number().int().nonnegative().max(50).nullish(),
});

export type DeviceInfo = z.infer<typeof deviceInfoSchema>;

export const performancePayloadSchema = z.object({
  analyticsSessionId: z.string().trim().min(6).max(128).nullish(),
  effectiveType: z.string().trim().max(16).nullish(),
  standalone: z.boolean().nullish(),
  device: deviceInfoSchema.nullish(),
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

/**
 * Verfeinert die User-Agent-Erkennung mit den Messwerten aus dem Browser:
 * iPads melden sich in Safari standardmäßig als Mac – erkennbar nur am Touchscreen.
 * Touch-Geräte werden über die kürzere Bildschirmseite in Handy (< 600 px) und Tablet eingeteilt.
 */
export function refineDevice(parsed: ParsedUserAgent, device: DeviceInfo | null | undefined) {
  if (!device) return parsed;
  const touchPoints = device.maxTouchPoints ?? 0;
  let { os, deviceType } = parsed;
  if (os === "macOS" && touchPoints > 1) {
    os = "iPadOS";
    deviceType = "tablet";
  }
  const shortSide =
    device.screenWidth && device.screenHeight
      ? Math.min(device.screenWidth, device.screenHeight)
      : null;
  if (device.touch && shortSide !== null && (os === "Android" || deviceType !== "desktop")) {
    deviceType = shortSide >= 600 ? "tablet" : "mobile";
  }
  return { ...parsed, os, deviceType };
}

export const VIEWPORT_CLASSES = [
  { key: "xs", label: "< 640 px", max: 639 },
  { key: "sm", label: "640–767 px", max: 767 },
  { key: "md", label: "768–1023 px", max: 1023 },
  { key: "lg", label: "1024–1279 px", max: 1279 },
  { key: "xl", label: "≥ 1280 px", max: Number.POSITIVE_INFINITY },
] as const;

/** Fensterbreite in die Tailwind-Breakpoints der App einordnen. */
export function viewportClass(width: number | null | undefined): string | null {
  if (!width) return null;
  return VIEWPORT_CLASSES.find((entry) => width <= entry.max)?.label ?? null;
}

/** Seitenverhältnis des Fensters grob einordnen (Hochformat-Handy … Breitbild). */
export function aspectClass(
  width: number | null | undefined,
  height: number | null | undefined,
): string | null {
  if (!width || !height) return null;
  const ratio = width / height;
  if (ratio < 0.6) return "Hochformat schmal (< 3:5)";
  if (ratio < 0.9) return "Hochformat (3:5–9:10)";
  if (ratio <= 1.15) return "Quadratisch";
  if (ratio < 1.7) return "Querformat (4:3–16:10)";
  return "Breitbild (≥ 16:9)";
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
  const parsed = refineDevice(parseUserAgent(userAgent), payload.device);
  const device = payload.device ?? {};
  const buildId = process.env.VERCEL_GIT_COMMIT_SHA?.trim().slice(0, 7) || null;
  return payload.samples.map((sample) => ({
    createdAt: now,
    route: normalizePerformanceRoute(sample.path),
    kind: sample.kind,
    durationMs: Math.round(sample.durationMs),
    feedbackMs: roundOrNull(sample.feedbackMs),
    serverMs: roundOrNull(sample.serverMs),
    requestCount: sample.requestCount ?? null,
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
    viewportWidth: device.viewportWidth ?? null,
    viewportHeight: device.viewportHeight ?? null,
    screenWidth: device.screenWidth ?? null,
    screenHeight: device.screenHeight ?? null,
    pixelRatio:
      typeof device.pixelRatio === "number" ? Math.round(device.pixelRatio * 100) / 100 : null,
    orientation: device.orientation ?? null,
    touch: device.touch ?? null,
    buildId,
    interactionType: sample.interactionType ?? null,
    interactionTarget: sample.interactionTarget ?? null,
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
  serverMs: number | null;
  requestCount: number | null;
  ttfbMs: number | null;
  lcpMs: number | null;
  inpMs: number | null;
  deviceType: string;
  browser: string;
  browserVersion?: string | null;
  os: string;
  standalone: boolean;
  createdAt?: Date;
  viewportWidth?: number | null;
  viewportHeight?: number | null;
  orientation?: string | null;
  touch?: boolean | null;
  buildId?: string | null;
  interactionType?: string | null;
  interactionTarget?: string | null;
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
  /** Seitenwechsel: Server-Anfrage für die Zielseite (inkl. Netz), 75 % */
  serverP75: number | null;
  /** Seitenwechsel: Server-Anfragen je Wechsel (inkl. Vorab-Laden), Median */
  requestsMedian: number | null;
  /** Seitenwechsel: Anteil ohne eigene Server-Anfrage (vorab geladen/zwischengespeichert), 0–1 */
  cachedShare: number | null;
};

export const PERFORMANCE_GROUPINGS = [
  "routes",
  "devices",
  "browsers",
  "viewports",
  "aspects",
  "releases",
  "targets",
] as const;
export type PerformanceGrouping = (typeof PERFORMANCE_GROUPINGS)[number];

export const HISTOGRAM_BUCKETS_MS = [100, 200, 300, 500, 750, 1000, 1500, 2500, 4000] as const;

export type PerformanceHistogram = Array<{ label: string; count: number }>;

export type PerformanceSummary = {
  days: number;
  total: number;
  load: PerformanceStats & { ttfbP75: number | null; lcpP75: number | null; inpP75: number | null };
  navigation: PerformanceStats & {
    feedbackP75: number | null;
    serverP75: number | null;
    requestsMedian: number | null;
  };
  interaction: PerformanceStats;
  groups: Record<PerformanceGrouping, Array<PerformanceGroup & { kind: PerformanceSampleKind }>>;
  histograms: Record<PerformanceSampleKind, PerformanceHistogram>;
  /** 75 % je Tag (YYYY-MM-DD, Berliner Zeit) und Art */
  daily: Array<{ day: string } & Record<PerformanceSampleKind, number | null>>;
  /** Anteil der Messungen mit Bildschirmdaten (neu seit Oktober 2026) */
  withDeviceInfo: number;
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

function medianOf(values: Array<number | null>): number | null {
  const filtered = values.filter((v): v is number => typeof v === "number");
  return percentile(
    filtered.sort((a, b) => a - b),
    50,
  );
}

function groupBy(
  rows: PerformanceSampleRow[],
  keyOf: (row: PerformanceSampleRow) => string | null,
): Array<PerformanceGroup & { kind: PerformanceSampleKind }> {
  const groups = new Map<string, PerformanceSampleRow[]>();
  for (const row of rows) {
    const groupKey = keyOf(row);
    if (groupKey === null) continue;
    const key = `${row.kind}\u0000${groupKey}`;
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
        serverP75: p75Of(list.map((row) => row.serverMs)),
        requestsMedian: medianOf(list.map((row) => row.requestCount)),
        cachedShare:
          kind === "navigation" && list.length > 0
            ? list.filter((row) => row.serverMs === null).length / list.length
            : null,
      };
    })
    .sort((a, b) => b.count - a.count);
}

function histogram(values: number[]): PerformanceHistogram {
  const formatEdge = (ms: number) => (ms >= 1000 ? `${ms / 1000} s` : `${ms} ms`);
  const buckets = HISTOGRAM_BUCKETS_MS.map((edge, index) => ({
    label: `${index === 0 ? "≤" : `${formatEdge(HISTOGRAM_BUCKETS_MS[index - 1]!)}–`}${formatEdge(edge)}`,
    count: 0,
  }));
  buckets.push({ label: `> ${formatEdge(HISTOGRAM_BUCKETS_MS.at(-1)!)}`, count: 0 });
  for (const value of values) {
    const index = HISTOGRAM_BUCKETS_MS.findIndex((edge) => value <= edge);
    buckets[index === -1 ? buckets.length - 1 : index]!.count += 1;
  }
  return buckets;
}

const dayFormat = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin" });

function dailyP75(rows: PerformanceSampleRow[]): PerformanceSummary["daily"] {
  const byDay = new Map<string, Record<PerformanceSampleKind, number[]>>();
  for (const row of rows) {
    if (!row.createdAt) continue;
    const day = dayFormat.format(row.createdAt);
    let entry = byDay.get(day);
    if (!entry) {
      entry = { load: [], navigation: [], interaction: [] };
      byDay.set(day, entry);
    }
    entry[row.kind as PerformanceSampleKind]?.push(row.durationMs);
  }
  return [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, values]) => ({
      day,
      load: p75Of(values.load),
      navigation: p75Of(values.navigation),
      interaction: p75Of(values.interaction),
    }));
}

function deviceLabel(row: PerformanceSampleRow) {
  const type =
    row.deviceType === "mobile" ? "Handy" : row.deviceType === "tablet" ? "Tablet" : "Desktop";
  return `${type} · ${row.os}${row.standalone ? " (App)" : ""}`;
}

function browserLabel(row: PerformanceSampleRow) {
  const version = row.browserVersion ? ` ${row.browserVersion.split(".")[0]}` : "";
  return `${row.browser}${version} · ${row.os}`;
}

function aspectLabel(row: PerformanceSampleRow) {
  const aspect = aspectClass(row.viewportWidth, row.viewportHeight);
  if (!aspect) return null;
  const input = row.touch === true ? "Touch" : row.touch === false ? "Maus" : null;
  return input ? `${aspect} · ${input}` : aspect;
}

export function summarizePerformanceSamples(
  rows: PerformanceSampleRow[],
  days: number,
): PerformanceSummary {
  const loads = rows.filter((row) => row.kind === "load");
  const navigations = rows.filter((row) => row.kind === "navigation");
  const interactions = rows.filter((row) => row.kind === "interaction");

  return {
    days,
    total: rows.length,
    load: {
      ...stats(loads.map((row) => row.durationMs)),
      ttfbP75: p75Of(loads.map((row) => row.ttfbMs)),
      lcpP75: p75Of(loads.map((row) => row.lcpMs)),
      inpP75: p75Of(loads.map((row) => row.inpMs)),
    },
    navigation: {
      ...stats(navigations.map((row) => row.durationMs)),
      feedbackP75: p75Of(navigations.map((row) => row.feedbackMs)),
      serverP75: p75Of(navigations.map((row) => row.serverMs)),
      requestsMedian: medianOf(navigations.map((row) => row.requestCount)),
    },
    interaction: stats(interactions.map((row) => row.durationMs)),
    groups: {
      routes: groupBy(rows, (row) => row.route),
      devices: groupBy(rows, deviceLabel),
      browsers: groupBy(rows, browserLabel),
      viewports: groupBy(rows, (row) => viewportClass(row.viewportWidth)),
      aspects: groupBy(rows, aspectLabel),
      releases: groupBy(rows, (row) => row.buildId ?? null),
      targets: groupBy(interactions, (row) =>
        row.interactionTarget
          ? `${row.route} · ${row.interactionType ?? "?"} → ${row.interactionTarget}`
          : null,
      ),
    },
    histograms: {
      load: histogram(loads.map((row) => row.durationMs)),
      navigation: histogram(navigations.map((row) => row.durationMs)),
      interaction: histogram(interactions.map((row) => row.durationMs)),
    },
    daily: dailyP75(rows),
    withDeviceInfo: rows.filter((row) => row.viewportWidth != null).length,
  };
}
