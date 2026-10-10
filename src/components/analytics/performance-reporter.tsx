"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useReportWebVitals } from "next/web-vitals";
import { reloadOnVersionSkew } from "@/lib/analytics/version-skew";

// Misst echte Ladezeiten im Browser und schickt sie gesammelt an /api/analytics/performance:
// - "load": Erstaufruf/Reload bis die Seite ohne Ladeskelett dasteht (+ TTFB/FCP/LCP/INP/CLS)
// - "navigation": Seitenwechsel per Link/Zurück bis der neue Inhalt sichtbar ist
// Als „fertig“ gilt: kein Element mit `data-route-loading` (aus den loading.tsx) mehr im DOM.

type Sample = {
  path: string;
  kind: "load" | "navigation" | "interaction";
  durationMs: number;
  feedbackMs?: number | null;
  serverMs?: number | null;
  requestCount?: number | null;
  ttfbMs?: number | null;
  fcpMs?: number | null;
  lcpMs?: number | null;
  inpMs?: number | null;
  cls?: number | null;
  interactionType?: string | null;
  interactionTarget?: string | null;
};

type PendingNavigation = { start: number; fromPath: string };

const ENDPOINT = "/api/analytics/performance";
const LOADING_SELECTOR = "[data-route-loading]";
const MAX_WAIT_MS = 30_000;
const MAX_BATCH = 20;

function readEffectiveType(): string | null {
  const connection = (navigator as Navigator & { connection?: { effectiveType?: string } })
    .connection;
  return connection?.effectiveType ?? null;
}

function isStandalone(): boolean {
  try {
    return (
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true
    );
  } catch {
    return false;
  }
}

/** Bildschirm, Fenster und Eingabeart – unterscheidet Handy/Tablet/Desktop besser als der User-Agent. */
function readDeviceInfo() {
  const safe = (value: number) => (Number.isFinite(value) && value > 0 ? Math.round(value) : null);
  let touch: boolean | null = null;
  try {
    touch = window.matchMedia("(pointer: coarse)").matches;
  } catch {
    // ältere Browser
  }
  const viewportWidth = safe(window.innerWidth);
  const viewportHeight = safe(window.innerHeight);
  return {
    viewportWidth,
    viewportHeight,
    screenWidth: safe(window.screen?.width ?? 0),
    screenHeight: safe(window.screen?.height ?? 0),
    pixelRatio: Number.isFinite(window.devicePixelRatio) ? window.devicePixelRatio : null,
    orientation:
      viewportWidth && viewportHeight
        ? viewportWidth >= viewportHeight
          ? "landscape"
          : "portrait"
        : null,
    touch,
    maxTouchPoints: navigator.maxTouchPoints ?? null,
  };
}

const SLOW_INTERACTION_MS = 200;
const MAX_INTERACTIONS_PER_PAGE = 30;

/** Kurze, datenschutzfreundliche Beschreibung des bedienten Elements (keine Texte/Inhalte). */
function describeTarget(node: Node | null | undefined): string | null {
  const element = node instanceof Element ? node : node?.parentElement;
  if (!element) return null;
  const control =
    element.closest(
      "button, a, input, select, textarea, label, summary, [role], [data-slot], [data-testid]",
    ) ?? element;
  const tag = control.tagName.toLowerCase();
  const hint =
    control.getAttribute("data-testid") ??
    control.getAttribute("data-slot") ??
    control.getAttribute("role") ??
    (control instanceof HTMLInputElement ? control.type : null);
  return (hint ? `${tag}[${hint}]` : tag).slice(0, 120);
}

/** Wartet, bis kein Ladeskelett mehr angezeigt wird, und liefert den Zeitpunkt nach dem Zeichnen. */
function whenContentVisible(): Promise<number | null> {
  return new Promise((resolve) => {
    const finish = () => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve(performance.now())));
    };
    if (!document.querySelector(LOADING_SELECTOR)) {
      finish();
      return;
    }
    const observer = new MutationObserver(() => {
      if (!document.querySelector(LOADING_SELECTOR)) {
        observer.disconnect();
        clearTimeout(timeout);
        finish();
      }
    });
    const timeout = window.setTimeout(() => {
      observer.disconnect();
      resolve(null);
    }, MAX_WAIT_MS);
    observer.observe(document.body, { childList: true, subtree: true });
  });
}

/**
 * Server-Anfragen (RSC) während eines Seitenwechsels aus der Resource-Timing-API: Anzahl inkl.
 * Vorab-Laden und Dauer der Anfrage für die Zielseite (fehlt, wenn sie aus dem Cache kam).
 */
function collectServerTiming(start: number, end: number, targetPath: string) {
  let requestCount = 0;
  let serverMs: number | null = null;
  let latestStart = -1;
  for (const entry of performance.getEntriesByType("resource") as PerformanceResourceTiming[]) {
    if (entry.startTime < start || entry.startTime > end || !entry.name.includes("_rsc=")) continue;
    requestCount += 1;
    try {
      const url = new URL(entry.name);
      if (url.pathname === targetPath && entry.startTime > latestStart) {
        latestStart = entry.startTime;
        serverMs = Math.round(entry.responseEnd - entry.startTime);
      }
    } catch {
      // ungültige URL ignorieren
    }
  }
  return { requestCount, serverMs };
}

// Zustand pro Seitenaufruf (ein harter Reload lädt das Modul neu). Bewusst außerhalb von React,
// damit Beacons beim Verlassen der Seite ohne Render-Abhängigkeiten verschickt werden können.
const state = {
  queue: [] as Sample[],
  loadSample: null as Sample | null,
  loadSent: false,
  vitals: {} as Partial<Sample>,
  pendingNavigation: null as PendingNavigation | null,
  lastPath: null as string | null,
  analyticsSessionId: null as string | null,
};

function flush(includeLoad: boolean) {
  const samples = state.queue.splice(0, MAX_BATCH);
  if (includeLoad && state.loadSample && !state.loadSent) {
    samples.push(state.loadSample);
    state.loadSent = true;
  }
  if (samples.length === 0) return;
  const body = JSON.stringify({
    analyticsSessionId: state.analyticsSessionId,
    effectiveType: readEffectiveType(),
    standalone: isStandalone(),
    device: readDeviceInfo(),
    samples,
  });
  try {
    if (navigator.sendBeacon?.(ENDPOINT, new Blob([body], { type: "application/json" }))) {
      return;
    }
  } catch {
    // auf fetch ausweichen
  }
  void fetch(ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => {});
}

const ERROR_ENDPOINT = "/api/analytics/errors";
const MAX_ERRORS_PER_PAGE = 5;
const reportedErrors = new Set<string>();

/** JS-Fehler im Browser melden – je Seitenaufruf höchstens 5 verschiedene. */
function reportClientError(message: string, detail: string | null) {
  const key = message.slice(0, 200);
  if (!key || reportedErrors.has(key) || reportedErrors.size >= MAX_ERRORS_PER_PAGE) return;
  reportedErrors.add(key);
  void fetch(ERROR_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ path: window.location.pathname, message: key, detail }),
    keepalive: true,
  }).catch(() => {});
}

export function PerformanceReporter({
  analyticsSessionId,
}: {
  analyticsSessionId?: string | null;
}) {
  const pathname = usePathname();

  useEffect(() => {
    state.analyticsSessionId = analyticsSessionId ?? null;
  }, [analyticsSessionId]);

  // Web Vitals des Erstaufrufs an die Lade-Messung hängen (LCP/INP/CLS stehen erst spät fest).
  useReportWebVitals((metric) => {
    const target = state.loadSample ?? state.vitals;
    if (metric.name === "TTFB") target.ttfbMs = Math.round(metric.value);
    else if (metric.name === "FCP") target.fcpMs = Math.round(metric.value);
    else if (metric.name === "LCP") target.lcpMs = Math.round(metric.value);
    else if (metric.name === "INP") target.inpMs = Math.round(metric.value);
    else if (metric.name === "CLS") target.cls = Math.round(metric.value * 1000) / 1000;
  });

  // Erstaufruf messen
  useEffect(() => {
    performance.setResourceTimingBufferSize?.(1000);
    const path = window.location.pathname;
    let cancelled = false;
    void whenContentVisible().then((end) => {
      if (cancelled || end === null || state.loadSample) return;
      state.loadSample = { path, kind: "load", durationMs: Math.round(end), ...state.vitals };
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Einzelne langsame Interaktionen (wie INP, aber jede für sich und mit Seite + Element)
  useEffect(() => {
    if (typeof PerformanceObserver === "undefined") return;
    let reported = 0;
    const seen = new Set<number>();
    let observer: PerformanceObserver;
    try {
      observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as Array<
          PerformanceEntry & { interactionId?: number; target?: Node | null }
        >) {
          const id = entry.interactionId;
          if (!id || seen.has(id) || entry.duration < SLOW_INTERACTION_MS) continue;
          if (reported >= MAX_INTERACTIONS_PER_PAGE) return;
          seen.add(id);
          reported += 1;
          state.queue.push({
            path: window.location.pathname,
            kind: "interaction",
            durationMs: Math.round(entry.duration),
            interactionType: entry.name,
            interactionTarget: describeTarget(entry.target),
          });
        }
      });
      observer.observe({
        type: "event",
        durationThreshold: SLOW_INTERACTION_MS,
        buffered: true,
      } as PerformanceObserverInit);
    } catch {
      return;
    }
    return () => observer.disconnect();
  }, []);

  // Klicks auf interne Links und Zurück/Vor als Start eines Seitenwechsels merken
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest?.("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.target && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname) return;
      state.pendingNavigation = { start: performance.now(), fromPath: window.location.pathname };
    };
    const onPopState = () => {
      state.pendingNavigation = {
        start: performance.now(),
        fromPath: state.lastPath ?? window.location.pathname,
      };
    };
    const onHidden = () => {
      if (document.visibilityState === "hidden") flush(true);
    };
    const onPageHide = () => flush(true);
    const onError = (event: ErrorEvent) => {
      // Fehler aus fremden Skripten/Erweiterungen liefern nur "Script error." ohne Details.
      if (!event.message || event.message === "Script error.") return;
      reportClientError(event.message, event.error?.stack?.slice(0, 600) ?? null);
      reloadOnVersionSkew(event.message);
    };
    const onRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const message = reason instanceof Error ? reason.message : String(reason ?? "");
      reportClientError(
        `Unbehandelt: ${message}`,
        reason instanceof Error ? (reason.stack?.slice(0, 600) ?? null) : null,
      );
      reloadOnVersionSkew(message);
    };

    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", onPopState);
    document.addEventListener("visibilitychange", onHidden);
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", onPopState);
      document.removeEventListener("visibilitychange", onHidden);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, []);

  // Neuer Pfad sichtbar: Zeit bis zur Reaktion festhalten und auf den fertigen Inhalt warten
  useEffect(() => {
    const previous = state.lastPath;
    state.lastPath = pathname;
    const pending = state.pendingNavigation;
    if (!pending || previous === null || previous === pathname) return;
    state.pendingNavigation = null;

    const feedback = performance.now() - pending.start;
    if (feedback > MAX_WAIT_MS) return;
    let cancelled = false;
    void whenContentVisible().then((end) => {
      if (cancelled || end === null) return;
      state.queue.push({
        path: pathname,
        kind: "navigation",
        durationMs: Math.round(end - pending.start),
        feedbackMs: Math.round(feedback),
        ...collectServerTiming(pending.start, end, pathname),
      });
      // Puffer klein halten, damit lange Sitzungen nicht an das Limit der Timing-API stoßen.
      performance.clearResourceTimings?.();
      if (state.queue.length >= 10) flush(false);
    });
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  return null;
}
