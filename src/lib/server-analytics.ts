export type OptimizationImpact = "Hoch" | "Mittel" | "Niedrig";
export type OptimizationArea = "Frontend" | "Mitgliederbereich" | "Infrastruktur";

export type ServerSummary = {
  uptimePercentage: number;
  requestsLast24h: number;
  averageResponseTimeMs: number;
  errorRate: number;
  peakConcurrentUsers: number;
  cacheHitRate: number;
  realtimeEventsLast24h: number;
};

export type ServerResourceUsage = {
  id: string;
  label: string;
  usagePercent: number;
  changePercent: number;
  capacity: string;
};

export type RequestBreakdown = {
  frontend: {
    requests: number;
    avgResponseTimeMs: number;
    cacheHitRate: number;
    avgPayloadKb: number;
  };
  members: {
    requests: number;
    avgResponseTimeMs: number;
    realtimeEvents: number;
    avgSessionDurationSeconds: number;
  };
  api: {
    requests: number;
    avgResponseTimeMs: number;
    backgroundJobs: number;
    errorRate: number;
  };
};

export type PeakHour = {
  range: string;
  requests: number;
  share: number;
};

export type PagePerformanceEntry = {
  path: string;
  title: string;
  views: number;
  uniqueVisitors: number;
  avgTimeOnPageSeconds: number;
  loadTimeMs: number;
  lcpMs: number;
  bounceRate: number;
  exitRate: number;
  avgScrollDepth: number;
  goalCompletionRate: number;
};

export type TrafficSource = {
  channel: string;
  sessions: number;
  avgSessionDurationSeconds: number;
  conversionRate: number;
  changePercent: number;
};

export type DeviceStat = {
  device: string;
  sessions: number;
  avgPageLoadMs: number;
  share: number;
};

export type SessionInsight = {
  segment: string;
  avgSessionDurationSeconds: number;
  pagesPerSession: number;
  retentionRate: number;
  share: number;
};

export type OptimizationInsight = {
  id: string;
  area: OptimizationArea;
  title: string;
  description: string;
  impact: OptimizationImpact;
  metric: string;
};

export type ServerAnalytics = {
  generatedAt: string;
  summary: ServerSummary;
  resourceUsage: ServerResourceUsage[];
  requestBreakdown: RequestBreakdown;
  peakHours: PeakHour[];
  publicPages: PagePerformanceEntry[];
  memberPages: PagePerformanceEntry[];
  trafficSources: TrafficSource[];
  deviceBreakdown: DeviceStat[];
  sessionInsights: SessionInsight[];
  optimizationInsights: OptimizationInsight[];
};

const STATIC_ANALYTICS: Omit<ServerAnalytics, "generatedAt"> = {
  summary: {
    uptimePercentage: 99.982,
    requestsLast24h: 19284,
    averageResponseTimeMs: 184,
    errorRate: 0.0035,
    peakConcurrentUsers: 312,
    cacheHitRate: 0.78,
    realtimeEventsLast24h: 4860,
  },
  resourceUsage: [
    {
      id: "api-cpu",
      label: "API-Server CPU",
      usagePercent: 64,
      changePercent: -0.03,
      capacity: "4 vCPUs",
    },
    {
      id: "api-ram",
      label: "API-Server RAM",
      usagePercent: 71,
      changePercent: 0.02,
      capacity: "16 GB",
    },
    {
      id: "db-cpu",
      label: "Datenbank CPU",
      usagePercent: 58,
      changePercent: -0.01,
      capacity: "6 vCPUs",
    },
    {
      id: "db-ram",
      label: "Datenbank RAM",
      usagePercent: 69,
      changePercent: 0.01,
      capacity: "24 GB",
    },
    {
      id: "object-storage",
      label: "Objektspeicher",
      usagePercent: 41,
      changePercent: 0.05,
      capacity: "250 GB",
    },
    {
      id: "cdn",
      label: "CDN Edge-Cache",
      usagePercent: 52,
      changePercent: 0.04,
      capacity: "40 Knoten",
    },
  ],
  requestBreakdown: {
    frontend: {
      requests: 11842,
      avgResponseTimeMs: 162,
      cacheHitRate: 0.76,
      avgPayloadKb: 312,
    },
    members: {
      requests: 8421,
      avgResponseTimeMs: 214,
      realtimeEvents: 3920,
      avgSessionDurationSeconds: 486,
    },
    api: {
      requests: 4972,
      avgResponseTimeMs: 188,
      backgroundJobs: 732,
      errorRate: 0.006,
    },
  },
  peakHours: [
    { range: "08:00 – 10:00", requests: 1820, share: 0.12 },
    { range: "12:00 – 14:00", requests: 2140, share: 0.14 },
    { range: "18:00 – 21:00", requests: 3680, share: 0.24 },
    { range: "21:00 – 23:00", requests: 1920, share: 0.13 },
  ],
  publicPages: [
    {
      path: "/",
      title: "Startseite",
      views: 5820,
      uniqueVisitors: 4760,
      avgTimeOnPageSeconds: 94,
      loadTimeMs: 1290,
      lcpMs: 1820,
      bounceRate: 0.42,
      exitRate: 0.31,
      avgScrollDepth: 0.68,
      goalCompletionRate: 0.14,
    },
    {
      path: "/ueber-uns",
      title: "Über uns",
      views: 2310,
      uniqueVisitors: 1980,
      avgTimeOnPageSeconds: 164,
      loadTimeMs: 1180,
      lcpMs: 1760,
      bounceRate: 0.38,
      exitRate: 0.22,
      avgScrollDepth: 0.74,
      goalCompletionRate: 0.09,
    },
    {
      path: "/chronik",
      title: "Chronik",
      views: 1640,
      uniqueVisitors: 1280,
      avgTimeOnPageSeconds: 312,
      loadTimeMs: 1420,
      lcpMs: 2140,
      bounceRate: 0.33,
      exitRate: 0.19,
      avgScrollDepth: 0.61,
      goalCompletionRate: 0.05,
    },
    {
      path: "/galerie",
      title: "Galerie",
      views: 1885,
      uniqueVisitors: 1532,
      avgTimeOnPageSeconds: 208,
      loadTimeMs: 1890,
      lcpMs: 2380,
      bounceRate: 0.46,
      exitRate: 0.28,
      avgScrollDepth: 0.57,
      goalCompletionRate: 0.07,
    },
    {
      path: "/mystery",
      title: "Mystery",
      views: 920,
      uniqueVisitors: 804,
      avgTimeOnPageSeconds: 256,
      loadTimeMs: 1340,
      lcpMs: 1930,
      bounceRate: 0.29,
      exitRate: 0.17,
      avgScrollDepth: 0.79,
      goalCompletionRate: 0.18,
    },
  ],
  memberPages: [
    {
      path: "/mitglieder",
      title: "Dashboard",
      views: 3120,
      uniqueVisitors: 812,
      avgTimeOnPageSeconds: 438,
      loadTimeMs: 980,
      lcpMs: 1420,
      bounceRate: 0.12,
      exitRate: 0.09,
      avgScrollDepth: 0.86,
      goalCompletionRate: 0.78,
    },
    {
      path: "/mitglieder/probenplanung",
      title: "Probenplanung",
      views: 1840,
      uniqueVisitors: 466,
      avgTimeOnPageSeconds: 512,
      loadTimeMs: 1040,
      lcpMs: 1580,
      bounceRate: 0.08,
      exitRate: 0.12,
      avgScrollDepth: 0.81,
      goalCompletionRate: 0.64,
    },
    {
      path: "/mitglieder/produktionen",
      title: "Produktionsübersicht",
      views: 1624,
      uniqueVisitors: 433,
      avgTimeOnPageSeconds: 486,
      loadTimeMs: 1120,
      lcpMs: 1640,
      bounceRate: 0.11,
      exitRate: 0.15,
      avgScrollDepth: 0.77,
      goalCompletionRate: 0.59,
    },
    {
      path: "/mitglieder/finanzen",
      title: "Finanz-Dashboard",
      views: 980,
      uniqueVisitors: 205,
      avgTimeOnPageSeconds: 420,
      loadTimeMs: 1220,
      lcpMs: 1780,
      bounceRate: 0.14,
      exitRate: 0.18,
      avgScrollDepth: 0.69,
      goalCompletionRate: 0.72,
    },
    {
      path: "/mitglieder/issues",
      title: "Feedback & Support",
      views: 560,
      uniqueVisitors: 182,
      avgTimeOnPageSeconds: 286,
      loadTimeMs: 880,
      lcpMs: 1360,
      bounceRate: 0.19,
      exitRate: 0.22,
      avgScrollDepth: 0.66,
      goalCompletionRate: 0.41,
    },
  ],
  trafficSources: [
    {
      channel: "Direkt",
      sessions: 4820,
      avgSessionDurationSeconds: 328,
      conversionRate: 0.21,
      changePercent: 0.04,
    },
    {
      channel: "Organische Suche",
      sessions: 3560,
      avgSessionDurationSeconds: 294,
      conversionRate: 0.17,
      changePercent: 0.07,
    },
    {
      channel: "Social Media",
      sessions: 2140,
      avgSessionDurationSeconds: 212,
      conversionRate: 0.11,
      changePercent: -0.03,
    },
    {
      channel: "Referral",
      sessions: 940,
      avgSessionDurationSeconds: 268,
      conversionRate: 0.15,
      changePercent: 0.02,
    },
    {
      channel: "Newsletter",
      sessions: 760,
      avgSessionDurationSeconds: 352,
      conversionRate: 0.26,
      changePercent: 0.11,
    },
  ],
  deviceBreakdown: [
    {
      device: "Desktop",
      sessions: 6540,
      avgPageLoadMs: 1380,
      share: 0.54,
    },
    {
      device: "Mobil",
      sessions: 4820,
      avgPageLoadMs: 1620,
      share: 0.39,
    },
    {
      device: "Tablet",
      sessions: 860,
      avgPageLoadMs: 1490,
      share: 0.07,
    },
  ],
  sessionInsights: [
    {
      segment: "Neue Besucher",
      avgSessionDurationSeconds: 286,
      pagesPerSession: 3.2,
      retentionRate: 0.36,
      share: 0.41,
    },
    {
      segment: "Wiederkehrende Besucher",
      avgSessionDurationSeconds: 412,
      pagesPerSession: 5.1,
      retentionRate: 0.68,
      share: 0.37,
    },
    {
      segment: "Mitglieder (eingeloggt)",
      avgSessionDurationSeconds: 538,
      pagesPerSession: 6.4,
      retentionRate: 0.82,
      share: 0.22,
    },
  ],
  optimizationInsights: [
    {
      id: "homepage-lcp",
      area: "Frontend",
      title: "Hero-Sektion der Startseite optimieren",
      description:
        "Das große Titelbild verursacht 220 ms LCP-Verzögerung. Eine WebP-Variante oder serverseitige Skalierung würde den Wert deutlich verbessern.",
      impact: "Hoch",
      metric: "LCP Startseite 1,82 s (Ziel < 1,5 s)",
    },
    {
      id: "gallery-images",
      area: "Frontend",
      title: "Galerie-Bilder stärker komprimieren",
      description:
        "49 % der Galerie-Aufrufe erfolgen mobil. Größere JPEG-Dateien bremsen das Laden – eine zusätzliche 1200px-Variante hilft.",
      impact: "Mittel",
      metric: "Durchschnittliche Bildgröße 1,8 MB",
    },
    {
      id: "members-cache",
      area: "Mitgliederbereich",
      title: "Produktionslisten stärker cachen",
      description:
        "Die Tabellen für Produktionen werden bei jedem Seitenaufruf neu berechnet. Eine Cache-Schicht reduziert die Antwortzeit um ~40 ms.",
      impact: "Hoch",
      metric: "Antwortzeit Produktionen 214 ms (Ziel < 180 ms)",
    },
    {
      id: "issues-index",
      area: "Infrastruktur",
      title: "Index für Feedback-Suche ergänzen",
      description:
        "Die Volltextsuche über das Issue-Board scannt aktuell 42k Einträge sequenziell. Ein GIN-Index verkürzt die Dauer deutlich.",
      impact: "Mittel",
      metric: "Suche im Issue-Board 420 ms (Ziel < 250 ms)",
    },
  ],
};

export async function collectServerAnalytics(): Promise<ServerAnalytics> {
  return {
    generatedAt: new Date().toISOString(),
    ...STATIC_ANALYTICS,
  };
}
