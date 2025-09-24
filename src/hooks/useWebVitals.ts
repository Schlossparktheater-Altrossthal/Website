"use client";

import { useEffect, useMemo } from "react";
import { usePathname } from "next/navigation";

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
  device: DeviceHints;
  navigation: NavigationInsights;
  updatedAt: number;
};

declare global {
  interface Window {
    __APP_WEB_VITALS__?: WebVitalsContext;
  }
}

export type UseWebVitalsOptions = {
  scope?: WebVitalsScope;
  weight?: number;
};

function normalizePath(pathname: string | null): string {
  if (!pathname) {
    return "/";
  }

  let normalized = pathname.trim();
  if (!normalized) {
    return "/";
  }

  try {
    const url = new URL(normalized, "http://localhost");
    normalized = url.pathname || normalized;
  } catch {
    // ignore
  }

  normalized = normalized.split("?")[0] ?? normalized;
  normalized = normalized.split("#")[0] ?? normalized;
  if (!normalized.startsWith("/")) {
    normalized = `/${normalized}`;
  }
  normalized = normalized.replace(/\\+/g, "/");
  if (normalized.length > 1 && normalized.endsWith("/")) {
    normalized = normalized.slice(0, -1);
  }
  normalized = normalized.replace(/\\index$/i, "/");

  return normalized || "/";
}

function inferScope(path: string, override?: WebVitalsScope): WebVitalsScope {
  if (override === "public" || override === "members") {
    return override;
  }

  const lower = path.toLowerCase();
  if (lower.startsWith("/mitglieder") || lower.startsWith("/members")) {
    return "members";
  }
  return "public";
}

function clampInteger(value: number | undefined, min: number, max: number): number | null {
  if (!Number.isFinite(value ?? null)) {
    return null;
  }
  const numeric = Math.round(value as number);
  if (!Number.isFinite(numeric)) {
    return null;
  }
  if (numeric < min) return min;
  if (numeric > max) return max;
  return numeric;
}

function extractConnection(): DeviceConnection | null {
  if (typeof navigator === "undefined") {
    return null;
  }

  const anyNavigator = navigator as Navigator & {
    connection?: { type?: string; effectiveType?: string; rtt?: number; downlink?: number };
    mozConnection?: { type?: string; effectiveType?: string; rtt?: number; downlink?: number };
    webkitConnection?: { type?: string; effectiveType?: string; rtt?: number; downlink?: number };
  };

  const connection =
    anyNavigator.connection || anyNavigator.mozConnection || anyNavigator.webkitConnection;

  if (!connection) {
    return null;
  }

  const rtt = Number.isFinite(connection.rtt) ? Number(connection.rtt) : null;
  const downlink = Number.isFinite(connection.downlink) ? Number(connection.downlink) : null;

  return {
    type: connection.type ?? null,
    effectiveType: connection.effectiveType ?? null,
    rttMs: rtt !== null && rtt >= 0 ? rtt : null,
    downlinkMbps: downlink !== null && downlink >= 0 ? downlink : null,
  };
}

function detectDeviceHint(userAgent: string, isMobileFallback: boolean): string {
  const ua = userAgent.toLowerCase();

  if (typeof navigator !== "undefined") {
    const navData = (navigator as Navigator & { userAgentData?: { mobile?: boolean; platform?: string } })
      .userAgentData;
    if (navData?.mobile) {
      return "mobile";
    }
    if (navData?.platform) {
      const platform = navData.platform.toLowerCase();
      if (platform.includes("win") || platform.includes("mac") || platform.includes("linux")) {
        return "desktop";
      }
    }
  }

  if (ua.includes("tablet") || ua.includes("ipad") || ua.includes("sm-t")) {
    return "tablet";
  }
  if (ua.includes("iphone") || ua.includes("android") || ua.includes("mobile")) {
    return "mobile";
  }
  if (ua.includes("smarttv") || ua.includes("smart-tv") || ua.includes("hbbtv") || ua.includes("appletv")) {
    return "tv";
  }
  if (ua.includes("playstation") || ua.includes("xbox") || ua.includes("nintendo")) {
    return "console";
  }
  if (ua.includes("watch")) {
    return "wearable";
  }
  if (isMobileFallback) {
    return "mobile";
  }
  return "desktop";
}

function collectDeviceHints(): DeviceHints {
  if (typeof navigator === "undefined") {
    return {
      userAgent: "unknown",
      deviceHint: "unknown",
      connection: null,
      viewport: null,
      language: null,
      timezone: null,
    };
  }

  const nav = navigator as Navigator & {
    userAgentData?: { mobile?: boolean; platform?: string };
    deviceMemory?: number;
    maxTouchPoints?: number;
  };

  const userAgent = nav.userAgent ?? "unknown";
  const isMobileFallback = Boolean(nav.userAgentData?.mobile);
  const deviceHint = detectDeviceHint(userAgent, isMobileFallback);
  const hardwareConcurrency =
    typeof nav.hardwareConcurrency === "number" && nav.hardwareConcurrency > 0
      ? Math.min(nav.hardwareConcurrency, 2048)
      : null;
  const deviceMemory =
    typeof nav.deviceMemory === "number" && nav.deviceMemory > 0
      ? Math.min(nav.deviceMemory, 1024)
      : null;
  const touchSupport =
    typeof nav.maxTouchPoints === "number" && nav.maxTouchPoints >= 0
      ? Math.min(nav.maxTouchPoints, 64)
      : null;

  let reducedMotion: boolean | null = null;
  let prefersDarkMode: boolean | null = null;
  let colorSchemePreference: string | null = null;

  if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
    try {
      const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
      if (typeof reducedMotionQuery.matches === "boolean") {
        reducedMotion = reducedMotionQuery.matches;
      }
    } catch {
      // ignore
    }

    try {
      const darkQuery = window.matchMedia("(prefers-color-scheme: dark)");
      const lightQuery = window.matchMedia("(prefers-color-scheme: light)");
      if (darkQuery.matches) {
        prefersDarkMode = true;
        colorSchemePreference = "dark";
      } else if (lightQuery.matches) {
        prefersDarkMode = false;
        colorSchemePreference = "light";
      } else {
        prefersDarkMode = null;
        colorSchemePreference = "no-preference";
      }
    } catch {
      // ignore
    }
  }

  let viewport: DeviceViewport | null = null;
  if (typeof window !== "undefined") {
    viewport = {
      width: clampInteger(window.innerWidth, 0, 16_000),
      height: clampInteger(window.innerHeight, 0, 16_000),
      pixelRatio:
        typeof window.devicePixelRatio === "number" && window.devicePixelRatio > 0
          ? Math.min(window.devicePixelRatio, 32)
          : null,
    };
  }

  let timezone: string | null = null;
  try {
    timezone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? null;
  } catch {
    timezone = null;
  }

  return {
    userAgent,
    deviceHint,
    platform: nav.userAgentData?.platform ?? nav.platform ?? null,
    hardwareConcurrency,
    deviceMemoryGb: deviceMemory,
    touchSupport,
    reducedMotion,
    prefersDarkMode,
    colorSchemePreference,
    connection: extractConnection(),
    viewport,
    language: nav.language ?? null,
    timezone,
  };
}

function collectNavigationInsights(): NavigationInsights {
  if (typeof performance === "undefined" || typeof performance.getEntriesByType !== "function") {
    return {};
  }

  try {
    const entries = performance.getEntriesByType("navigation");
    const entry = entries[entries.length - 1] as PerformanceNavigationTiming | undefined;
    if (!entry) {
      return {};
    }

    const loadTime = Number(entry.loadEventEnd || entry.domComplete || entry.duration);
    return {
      loadTimeMs: Number.isFinite(loadTime) && loadTime > 0 ? loadTime : null,
      navigationType: (entry as PerformanceNavigationTiming).type ?? null,
    };
  } catch {
    return {};
  }
}

export function useWebVitals(options?: UseWebVitalsOptions) {
  const pathname = usePathname();
  const normalizedPath = useMemo(() => normalizePath(pathname ?? null), [pathname]);

  const scope = useMemo(() => inferScope(normalizedPath, options?.scope), [normalizedPath, options?.scope]);

  const weight = useMemo(() => {
    if (typeof options?.weight !== "number" || !Number.isFinite(options.weight)) {
      return 1;
    }
    const rounded = Math.round(options.weight);
    return Math.min(Math.max(rounded, 1), 10_000);
  }, [options?.weight]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const context: WebVitalsContext = {
      path: normalizedPath,
      scope,
      weight,
      device: collectDeviceHints(),
      navigation: collectNavigationInsights(),
      updatedAt: Date.now(),
    };

    window.__APP_WEB_VITALS__ = context;

    const handleVisibilityChange = () => {
      if (window.__APP_WEB_VITALS__) {
        window.__APP_WEB_VITALS__.updatedAt = Date.now();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("resize", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("resize", handleVisibilityChange);
    };
  }, [normalizedPath, scope, weight]);
}
