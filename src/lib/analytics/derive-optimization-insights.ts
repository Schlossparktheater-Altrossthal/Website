import type { AnalyticsHttpSummary } from "@prisma/client";

import type {
  DeviceStat,
  OptimizationArea,
  OptimizationImpact,
  OptimizationInsight,
  PagePerformanceEntry,
  SessionInsight,
} from "@/lib/server-analytics";

const MS_FRONTEND_HIGH_THRESHOLD = 3200;
const MS_FRONTEND_MEDIUM_THRESHOLD = 1800;
const MS_MEMBER_THRESHOLD = 1700;
const MS_DEVICE_THRESHOLD = 1400;
const RETENTION_CRITICAL = 0.4;
const RETENTION_WARNING = 0.55;
const SHARE_MINIMUM = 0.12;
const DEVICE_SHARE_MINIMUM = 0.2;
const API_ERROR_WARNING = 0.05;
const CACHE_HIT_WARNING = 0.6;
const FRONTEND_PAYLOAD_WARNING = 450_000; // ~440 KB

function formatId(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "unknown";
}

function formatMilliseconds(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) {
    return "0 ms";
  }
  if (ms >= 1000) {
    const seconds = ms / 1000;
    return `${seconds.toLocaleString("de-DE", { maximumFractionDigits: 2, minimumFractionDigits: 1 })} s`;
  }
  return `${Math.round(ms).toLocaleString("de-DE")} ms`;
}

function formatShare(value: number): string {
  return `${(value * 100).toLocaleString("de-DE", { maximumFractionDigits: 1 })} %`;
}

function chooseImpact(value: number, high: number, medium: number): OptimizationImpact {
  if (value >= high) {
    return "Hoch";
  }
  if (value >= medium) {
    return "Mittel";
  }
  return "Niedrig";
}

function resolveAreaFromPath(path: string): OptimizationArea {
  const lower = path.toLowerCase();
  if (lower.startsWith("/mitglieder") || lower.startsWith("/members")) {
    return "Mitgliederbereich";
  }
  return "Frontend";
}

function cloneFallback(fallback: OptimizationInsight[]): OptimizationInsight[] {
  return fallback.map((entry) => ({ ...entry }));
}

export type DeriveOptimizationContext = {
  publicPages: PagePerformanceEntry[];
  memberPages: PagePerformanceEntry[];
  deviceStats: DeviceStat[];
  sessionInsights: SessionInsight[];
  httpSummary: AnalyticsHttpSummary | null;
  fallback: OptimizationInsight[];
  useFallbackOnly?: boolean;
};

export function deriveOptimizationInsights({
  publicPages,
  memberPages,
  deviceStats,
  sessionInsights,
  httpSummary,
  fallback,
  useFallbackOnly = false,
}: DeriveOptimizationContext): OptimizationInsight[] {
  if (useFallbackOnly) {
    return cloneFallback(fallback);
  }

  const insights: OptimizationInsight[] = [];
  const seen = new Set<string>();

  function pushInsight(insight: OptimizationInsight | null | undefined) {
    if (!insight) return;
    if (seen.has(insight.id)) return;
    insights.push(insight);
    seen.add(insight.id);
  }

  const pageCandidates: PagePerformanceEntry[] = [...publicPages, ...memberPages];

  const slowestPage = pageCandidates
    .filter((page) => Number.isFinite(page.loadTimeMs) && page.loadTimeMs >= MS_FRONTEND_MEDIUM_THRESHOLD)
    .sort((a, b) => b.loadTimeMs - a.loadTimeMs || b.views - a.views)[0];

  if (slowestPage) {
    const impact = chooseImpact(slowestPage.loadTimeMs, MS_FRONTEND_HIGH_THRESHOLD, MS_FRONTEND_MEDIUM_THRESHOLD);
    pushInsight({
      id: `page-speed-${formatId(slowestPage.path)}`,
      area: resolveAreaFromPath(slowestPage.path),
      title: `Antwortzeit von ${slowestPage.title ?? slowestPage.path} reduzieren`,
      description:
        "Die Seite lädt im Schnitt zu langsam. Komprimierte Assets und weniger blockierendes JavaScript reduzieren die Ladezeit.",
      impact,
      metric: `Durchschnittliche Ladezeit ${formatMilliseconds(slowestPage.loadTimeMs)}`,
    });
  }

  const lcpCandidate = pageCandidates
    .filter((page) => Number.isFinite(page.lcpMs) && (page.lcpMs ?? 0) >= MS_FRONTEND_MEDIUM_THRESHOLD)
    .sort((a, b) => (b.lcpMs ?? 0) - (a.lcpMs ?? 0) || b.views - a.views)
    .find((page) => !slowestPage || page.path !== slowestPage.path);

  if (lcpCandidate) {
    const impact = chooseImpact(lcpCandidate.lcpMs ?? 0, MS_FRONTEND_HIGH_THRESHOLD, MS_FRONTEND_MEDIUM_THRESHOLD);
    pushInsight({
      id: `lcp-${formatId(lcpCandidate.path)}`,
      area: resolveAreaFromPath(lcpCandidate.path),
      title: `LCP auf ${lcpCandidate.title ?? lcpCandidate.path} verbessern`,
      description:
        "Der Largest-Contentful-Paint liegt über dem Zielwert. Größere Hero-Elemente sollten verzögert oder komprimiert geladen werden.",
      impact,
      metric: `LCP ${formatMilliseconds(lcpCandidate.lcpMs ?? 0)}`,
    });
  }

  const memberLatency = memberPages
    .filter((page) => Number.isFinite(page.loadTimeMs) && page.loadTimeMs >= MS_MEMBER_THRESHOLD)
    .sort((a, b) => b.loadTimeMs - a.loadTimeMs || b.views - a.views)[0];

  if (memberLatency) {
    const impact = chooseImpact(memberLatency.loadTimeMs, MS_FRONTEND_HIGH_THRESHOLD, MS_MEMBER_THRESHOLD);
    pushInsight({
      id: `member-speed-${formatId(memberLatency.path)}`,
      area: "Mitgliederbereich",
      title: `${memberLatency.title ?? memberLatency.path} schneller laden`,
      description:
        "Die Seite im Mitgliederbereich reagiert spürbar träge. Caching für serverseitige Berechnungen oder Streaming kann helfen.",
      impact,
      metric: `Antwortzeit ${formatMilliseconds(memberLatency.loadTimeMs)}`,
    });
  }

  const strugglingSegment = sessionInsights
    .filter((segment) => segment.share >= SHARE_MINIMUM && segment.retentionRate <= RETENTION_WARNING)
    .sort((a, b) => a.retentionRate - b.retentionRate)[0];

  if (strugglingSegment) {
    const impact = strugglingSegment.retentionRate <= RETENTION_CRITICAL ? "Hoch" : "Mittel";
    pushInsight({
      id: `segment-${formatId(strugglingSegment.segment)}`,
      area: strugglingSegment.segment.toLowerCase().includes("mitglied") ? "Mitgliederbereich" : "Frontend",
      title: `${strugglingSegment.segment}: Rückkehrquote steigern`,
      description:
        "Dieses Segment springt früh ab. Angepasste Onboarding-Inhalte oder personalisierte Empfehlungen können die Bindung erhöhen.",
      impact,
      metric: `Retention ${formatShare(strugglingSegment.retentionRate)} bei ${formatShare(strugglingSegment.share)} Anteil`,
    });
  }

  const slowDevice = deviceStats
    .filter((device) => device.share >= DEVICE_SHARE_MINIMUM && device.avgPageLoadMs >= MS_DEVICE_THRESHOLD)
    .sort((a, b) => b.share - a.share || b.avgPageLoadMs - a.avgPageLoadMs)[0];

  if (slowDevice) {
    const impact = chooseImpact(slowDevice.avgPageLoadMs, MS_FRONTEND_HIGH_THRESHOLD, MS_DEVICE_THRESHOLD + 200);
    pushInsight({
      id: `device-${formatId(slowDevice.device)}`,
      area: "Frontend",
      title: `Performance auf ${slowDevice.device}-Geräten verbessern`,
      description:
        "Nutzer auf diesem Gerätetyp warten länger auf den First Paint. Adaptive Bildgrößen und Ressourcensplitting schaffen Abhilfe.",
      impact,
      metric: `Ladezeit ${formatMilliseconds(slowDevice.avgPageLoadMs)} bei ${formatShare(slowDevice.share)} Anteil`,
    });
  }

  if (httpSummary) {
    if (httpSummary.apiErrorRate >= API_ERROR_WARNING) {
      const impact = httpSummary.apiErrorRate >= API_ERROR_WARNING * 2 ? "Hoch" : "Mittel";
      pushInsight({
        id: "api-error-rate",
        area: "Infrastruktur",
        title: "API-Fehlerquote senken",
        description:
          "Mehrere API-Aufrufe schlagen fehl. Logs auf Zeitüberschreitungen prüfen und Timeout-Strategien bzw. Retries anpassen.",
        impact,
        metric: `API-Fehlerquote ${(httpSummary.apiErrorRate * 100).toLocaleString("de-DE", { maximumFractionDigits: 1 })} %`,
      });
    }

    if (httpSummary.cacheHitRate <= CACHE_HIT_WARNING) {
      pushInsight({
        id: "cache-hit-rate",
        area: "Infrastruktur",
        title: "Edge-Caching erweitern",
        description:
          "Der Cache greift zu selten. Zusätzliche Cache-Tags oder längere TTLs reduzieren Backend-Last und Antwortzeiten.",
        impact: httpSummary.cacheHitRate <= CACHE_HIT_WARNING / 2 ? "Hoch" : "Mittel",
        metric: `Cache-Hit-Rate ${(httpSummary.cacheHitRate * 100).toLocaleString("de-DE", { maximumFractionDigits: 1 })} %`,
      });
    }

    if (httpSummary.membersAvgResponseMs >= MS_MEMBER_THRESHOLD && !seen.has("member-api-latency")) {
      const impact = chooseImpact(httpSummary.membersAvgResponseMs, MS_FRONTEND_HIGH_THRESHOLD, MS_MEMBER_THRESHOLD);
      pushInsight({
        id: "member-api-latency",
        area: "Mitgliederbereich",
        title: "Mitglieder-Endpunkte beschleunigen",
        description:
          "Server-Antwortzeiten für eingeloggte Nutzer liegen über dem Zielwert. Datenbankabfragen prüfen und Caching einschalten.",
        impact,
        metric: `Antwortzeit Mitglieder-Endpunkte ${formatMilliseconds(httpSummary.membersAvgResponseMs)}`,
      });
    }

    if (httpSummary.frontendAvgPayloadBytes >= FRONTEND_PAYLOAD_WARNING) {
      pushInsight({
        id: "frontend-payload",
        area: "Frontend",
        title: "Frontend-Payload verkleinern",
        description:
          "Die durchschnittliche Antwortgröße ist hoch. Nicht kritische Skripte lazy laden und Assets stärker komprimieren.",
        impact: httpSummary.frontendAvgPayloadBytes >= FRONTEND_PAYLOAD_WARNING * 1.5 ? "Hoch" : "Mittel",
        metric: `Durchschnittliche Payload ${(httpSummary.frontendAvgPayloadBytes / 1024).toLocaleString("de-DE", {
          maximumFractionDigits: 0,
        })} KB`,
      });
    }
  }

  if (insights.length === 0) {
    return cloneFallback(fallback);
  }

  return insights.slice(0, 8).map((entry) => ({ ...entry }));
}
