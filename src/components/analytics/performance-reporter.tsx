"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useReportWebVitals } from "next/web-vitals";

// Misst echte Ladezeiten im Browser und schickt sie gesammelt an /api/analytics/performance:
// - "load": Erstaufruf/Reload bis die Seite ohne Ladeskelett dasteht (+ TTFB/FCP/LCP/INP/CLS)
// - "navigation": Seitenwechsel per Link/Zurück bis der neue Inhalt sichtbar ist
// Als „fertig“ gilt: kein Element mit `data-route-loading` (aus den loading.tsx) mehr im DOM.

type Sample = {
  path: string;
  kind: "load" | "navigation";
  durationMs: number;
  feedbackMs?: number | null;
  ttfbMs?: number | null;
  fcpMs?: number | null;
  lcpMs?: number | null;
  inpMs?: number | null;
  cls?: number | null;
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

    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", onPopState);
    document.addEventListener("visibilitychange", onHidden);
    window.addEventListener("pagehide", onPageHide);
    return () => {
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
      });
      if (state.queue.length >= 10) flush(false);
    });
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  return null;
}
