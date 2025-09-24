import type { NextWebVitalsMetric } from "next/app";

type WebVitalsScope = "public" | "members" | null;

type DeviceConnection = {
  type?: string | null;
  effectiveType?: string | null;
  rttMs?: number | null;
  downlinkMbps?: number | null;
};

type DeviceViewport = {
  width?: number | null;
  height?: number | null;
  pixelRatio?: number | null;
};

type DeviceHints = {
  userAgent: string;
  deviceHint?: string | null;
  platform?: string | null;
  hardwareConcurrency?: number | null;
  deviceMemoryGb?: number | null;
  touchSupport?: number | null;
  reducedMotion?: boolean | null;
  prefersDarkMode?: boolean | null;
  colorSchemePreference?: string | null;
  connection?: DeviceConnection | null;
  viewport?: DeviceViewport | null;
  language?: string | null;
  timezone?: string | null;
};

type NavigationInsights = {
  loadTimeMs?: number | null;
  navigationType?: string | null;
};

type WebVitalsContext = {
  path: string;
  scope: WebVitalsScope;
  weight: number;
  analyticsSessionId?: string | null;
  device: DeviceHints;
  navigation: NavigationInsights;
  updatedAt: number;
};

declare global {
  interface Window {
    __APP_WEB_VITALS__?: WebVitalsContext;
  }
}

type PendingMetrics = {
  id: string;
  loadTimeMs?: number | null;
  lcpMs?: number | null;
  timeoutId?: number;
  reported?: boolean;
};

const pending = new Map<string, PendingMetrics>();
const LOAD_METRIC_NAMES = new Set([
  "Next.js-route-change-to-render",
  "Next.js-hydration",
  "TTFB",
  "FCP",
]);

function ensureContext(): WebVitalsContext | null {
  if (typeof window === "undefined") {
    return null;
  }
  return window.__APP_WEB_VITALS__ ?? null;
}

function normalizeDuration(value: number | null | undefined): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return null;
  }
  return Math.round(value);
}

function extractTrafficAttribution(context: WebVitalsContext) {
  if (typeof window === "undefined") {
    return null;
  }

  const referrer = typeof document !== "undefined" && typeof document.referrer === "string"
    ? document.referrer.trim() || null
    : null;

  let searchParams: URLSearchParams | null = null;
  try {
    const url = new URL(window.location.href);
    searchParams = url.searchParams;
  } catch {
    searchParams = null;
  }

  const resolveParam = (key: string) => {
    if (!searchParams) return null;
    const value = searchParams.get(key);
    return value && value.trim() ? value.trim() : null;
  };

  const utm = {
    source: resolveParam("utm_source"),
    medium: resolveParam("utm_medium"),
    campaign: resolveParam("utm_campaign"),
    term: resolveParam("utm_term"),
    content: resolveParam("utm_content"),
  };

  return {
    path: context.path,
    referrer,
    utm,
  };
}

async function transmitMetrics(
  metricId: string,
  context: WebVitalsContext,
  loadTimeMs: number | null,
  lcpMs: number | null,
) {
  const traffic = extractTrafficAttribution(context);

  const payload = {
    sessionId: metricId,
    analyticsSessionId: context.analyticsSessionId ?? null,
    path: context.path,
    scope: context.scope,
    weight: Math.min(Math.max(Math.round(context.weight || 1), 1), 10_000),
    metrics: {
      loadTime: loadTimeMs,
      lcp: lcpMs,
    },
    device: {
      ...context.device,
      userAgent: context.device.userAgent || (typeof navigator !== "undefined" ? navigator.userAgent : "unknown"),
      connection: context.device.connection ?? null,
      viewport: context.device.viewport ?? null,
    },
    traffic,
  };

  const body = JSON.stringify(payload);
  if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
    try {
      const blob = new Blob([body], { type: "application/json" });
      const success = navigator.sendBeacon("/api/analytics/web-vitals", blob);
      if (success) {
        return;
      }
    } catch {
      // ignore beacon errors and fall back to fetch
    }
  }

  try {
    await fetch("/api/analytics/web-vitals", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      keepalive: true,
    });
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.debug("[analytics] Failed to report web vitals", error);
    }
  }
}

function finalizeMetric(metricId: string) {
  const entry = pending.get(metricId);
  if (!entry) {
    return;
  }
  if (entry.timeoutId) {
    clearTimeout(entry.timeoutId);
  }
  pending.delete(metricId);
}

function attemptSend(metricId: string) {
  const entry = pending.get(metricId);
  if (!entry || entry.reported) {
    return;
  }

  const context = ensureContext();
  if (!context) {
    return;
  }

  const normalizedLoad =
    entry.loadTimeMs !== null && entry.loadTimeMs !== undefined
      ? normalizeDuration(entry.loadTimeMs)
      : normalizeDuration(context.navigation.loadTimeMs);
  const normalizedLcp = normalizeDuration(entry.lcpMs ?? undefined);

  if (normalizedLoad === null && normalizedLcp === null) {
    return;
  }

  entry.reported = true;
  void transmitMetrics(metricId, context, normalizedLoad, normalizedLcp);
  finalizeMetric(metricId);
}

function scheduleFallback(metricId: string) {
  const entry = pending.get(metricId);
  if (!entry || entry.timeoutId) {
    return;
  }

  const timeoutId = window.setTimeout(() => {
    attemptSend(metricId);
    finalizeMetric(metricId);
  }, 3_000);

  entry.timeoutId = timeoutId;
}

function storeMetric(metric: NextWebVitalsMetric) {
  const existing = pending.get(metric.id) ?? { id: metric.id };

  if (metric.name === "LCP") {
    existing.lcpMs = metric.value;
  } else if (LOAD_METRIC_NAMES.has(metric.name)) {
    existing.loadTimeMs = existing.loadTimeMs ?? metric.value;
  }

  pending.set(metric.id, existing);
  scheduleFallback(metric.id);
  attemptSend(metric.id);
}

export function reportWebVitals(metric: NextWebVitalsMetric) {
  if (!metric || typeof metric.id !== "string") {
    return;
  }

  try {
    storeMetric(metric);
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.debug("[analytics] Failed to buffer web vitals metric", error);
    }
  }
}
