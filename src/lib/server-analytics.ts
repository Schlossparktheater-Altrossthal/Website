import fs from "node:fs/promises";
import os from "node:os";
import { setTimeout as wait } from "node:timers/promises";

import { unstable_cache } from "next/cache";

import type {
  AnalyticsHttpPeakHour,
  AnalyticsHttpSummary,
  AnalyticsRealtimeSummary,
  AnalyticsSessionInsight,
  AnalyticsTrafficSource,
} from "@prisma/client";

import staticAnalyticsData from "@/data/server-analytics-static.json" with { type: "json" };
import type { LoadedServerLog } from "@/lib/analytics/load-server-logs";
import { loadLatestCriticalServerLogs } from "@/lib/analytics/load-server-logs";
import { loadDeviceBreakdownFromDatabase, loadPagePerformanceMetrics } from "@/lib/server-analytics-data";
import type { PagePerformanceMetricOverride } from "@/lib/server-analytics-data";
import { prisma } from "@/lib/prisma";

export type OptimizationImpact = "Hoch" | "Mittel" | "Niedrig";
export type OptimizationArea = "Frontend" | "Mitgliederbereich" | "Infrastruktur";

type ServerLogEvent = LoadedServerLog;

export type {
  ServerLogSeverity,
  ServerLogStatus,
  LoadedServerLog as ServerLogEvent,
} from "@/lib/analytics/load-server-logs";

export type ServerAnalyticsMetadata = {
  source: "live" | "cached" | "fallback";
  attempts: number;
  lastUpdatedAt: string;
  staleSince?: string;
  fallbackReasons?: string[];
};

export type ServerSummary = {
  uptimePercentage: number;
  requestsLast24h: number;
  averageResponseTimeMs: number;
  p95ResponseTimeMs: number;
  errorRate: number;
  peakConcurrentUsers: number;
  cacheHitRate: number;
  realtimeEventsLast24h: number;
  slaTargetPercentage: number;
  slaViolationMinutes: number;
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
  serverLogs: ServerLogEvent[];
  metadata: ServerAnalyticsMetadata;
};

type StaticAnalyticsData = Omit<ServerAnalytics, "generatedAt" | "metadata"> & {
  metadata?: ServerAnalyticsMetadata;
};

const STATIC_ANALYTICS = staticAnalyticsData as StaticAnalyticsData;

const previousResourceUsage = new Map<string, number>();

const ANALYTICS_RETRY_DELAYS_MS = [0, 250, 1000];
const ANALYTICS_CACHE_KEY = ["server-analytics", "snapshot-v2"];
const ANALYTICS_CACHE_TAG = "server-analytics";
const ANALYTICS_REVALIDATE_SECONDS = 45;

let lastSuccessfulAnalytics: ServerAnalytics | null = null;
let lastFailureInfo: { reason: string; occurredAt: string } | null = null;

function clonePageEntries(entries: PagePerformanceEntry[]): PagePerformanceEntry[] {
  return entries.map((entry) => ({ ...entry }));
}

function cloneDeviceStats(entries: DeviceStat[]): DeviceStat[] {
  return entries.map((entry) => ({ ...entry }));
}

function determineMetricScope(metric: PagePerformanceMetricOverride): "public" | "members" {
  if (metric.scope === "members" || metric.scope === "public") {
    return metric.scope;
  }
  const lower = metric.path.toLowerCase();
  if (lower.startsWith("/mitglieder") || lower.startsWith("/members")) {
    return "members";
  }
  return "public";
}

function buildAggregatedPageEntries(
  metrics: PagePerformanceMetricOverride[],
  scope: "public" | "members",
  metadata: Map<string, PagePerformanceEntry>,
): PagePerformanceEntry[] {
  const entries: PagePerformanceEntry[] = [];

  for (const metric of metrics) {
    const resolvedScope = determineMetricScope(metric);
    if (scope === "members" && resolvedScope !== "members") {
      continue;
    }
    if (scope === "public" && resolvedScope === "members") {
      continue;
    }

    const base = metadata.get(metric.path);
    const weight = Number.isFinite(metric.weight) ? Math.max(0, Math.round(metric.weight ?? 0)) : 0;
    const views = weight > 0 ? weight : base?.views ?? 0;

    entries.push({
      path: metric.path,
      title: base?.title ?? metric.path,
      views,
      uniqueVisitors: base?.uniqueVisitors ?? views,
      avgTimeOnPageSeconds: base?.avgTimeOnPageSeconds ?? 0,
      loadTimeMs: metric.avgPageLoadMs,
      lcpMs: metric.lcpMs ?? base?.lcpMs ?? 0,
      bounceRate: base?.bounceRate ?? 0,
      exitRate: base?.exitRate ?? 0,
      avgScrollDepth: base?.avgScrollDepth ?? 0,
      goalCompletionRate: base?.goalCompletionRate ?? 0,
    });
  }

  return entries.sort((a, b) => {
    if (b.views !== a.views) {
      return b.views - a.views;
    }
    return a.path.localeCompare(b.path);
  });
}

type ResourceMeasurement = Pick<ServerResourceUsage, "id" | "label" | "usagePercent" | "capacity">;

type CpuTimesSnapshot = {
  idle: number;
  total: number;
};

type MemoryUsageSnapshot = {
  usagePercent: number;
  totalBytes: number;
  freeBytes: number;
};

type DiskUsageSnapshot = {
  usagePercent: number;
  totalBytes: number;
  freeBytes: number;
  path: string;
};

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.min(Math.max(value, min), max);
}

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB", "TB", "PB"];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  const decimals = value >= 100 ? 0 : value >= 10 ? 1 : 2;
  return `${value.toFixed(decimals)} ${units[unitIndex]}`;
}

function formatTime(value: Date | string | number) {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) {
    return "00:00";
  }
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  return `${hours}:${minutes}`;
}

function formatTimeRange(start: Date | string | number, end: Date | string | number) {
  return `${formatTime(start)} – ${formatTime(end)}`;
}

function applyHttpSummaryOverrides(base: ServerSummary, row: AnalyticsHttpSummary): ServerSummary {
  const totalRequests = Math.max(0, row.totalRequests);
  const totalErrors = Math.max(0, row.clientErrorRequests + row.serverErrorRequests);
  const averageResponse = Number.isFinite(row.averageDurationMs) ? Math.max(0, row.averageDurationMs) : base.averageResponseTimeMs;
  const uptime = Number.isFinite(row.uptimePercentage ?? NaN)
    ? clamp(Number(row.uptimePercentage), 0, 100)
    : base.uptimePercentage;
  const p95Value = row.p95DurationMs ?? Number.NaN;
  const p95 = Number.isFinite(p95Value) && p95Value >= 0 ? Math.round(p95Value) : base.p95ResponseTimeMs;
  const windowStart = row.windowStart instanceof Date ? row.windowStart : row.windowStart ? new Date(row.windowStart) : null;
  const windowEnd = row.windowEnd instanceof Date ? row.windowEnd : row.windowEnd ? new Date(row.windowEnd) : null;
  const windowMs =
    windowStart instanceof Date && windowEnd instanceof Date && Number.isFinite(windowStart.getTime()) && Number.isFinite(windowEnd.getTime())
      ? Math.max(0, windowEnd.getTime() - windowStart.getTime())
      : 24 * 60 * 60 * 1000;
  const windowMinutes = Math.max(1, Math.round(windowMs / 60_000));
  const slaTarget = Number.isFinite(base.slaTargetPercentage) ? base.slaTargetPercentage : 99.95;
  const downtimeMinutes = slaTarget > uptime ? Math.max(0, Math.round(((slaTarget - uptime) / 100) * windowMinutes * 10) / 10) : 0;

  return {
    ...base,
    uptimePercentage: uptime,
    requestsLast24h: totalRequests,
    averageResponseTimeMs: Math.round(averageResponse),
    p95ResponseTimeMs: p95,
    errorRate: totalRequests > 0 ? clamp(totalErrors / totalRequests, 0, 1) : 0,
    slaTargetPercentage: slaTarget,
    slaViolationMinutes: downtimeMinutes,
  };
}

function applyRequestBreakdownOverrides(base: RequestBreakdown, row: AnalyticsHttpSummary): RequestBreakdown {
  const frontendPayloadKb = row.frontendAvgPayloadBytes / 1024;
  const hasFrontendData = row.frontendRequests > 0;
  const hasMemberData = row.membersRequests > 0;
  const hasApiData = row.apiRequests > 0;
  return {
    frontend: {
      ...base.frontend,
      requests: Math.max(0, row.frontendRequests),
      avgResponseTimeMs:
        hasFrontendData && Number.isFinite(row.frontendAvgResponseMs) && row.frontendAvgResponseMs >= 0
          ? Math.round(row.frontendAvgResponseMs)
          : base.frontend.avgResponseTimeMs,
      avgPayloadKb:
        hasFrontendData && Number.isFinite(frontendPayloadKb) && frontendPayloadKb >= 0
          ? Math.round(frontendPayloadKb * 10) / 10
          : base.frontend.avgPayloadKb,
    },
    members: {
      ...base.members,
      requests: Math.max(0, row.membersRequests),
      avgResponseTimeMs:
        hasMemberData && Number.isFinite(row.membersAvgResponseMs) && row.membersAvgResponseMs >= 0
          ? Math.round(row.membersAvgResponseMs)
          : base.members.avgResponseTimeMs,
    },
    api: {
      ...base.api,
      requests: Math.max(0, row.apiRequests),
      avgResponseTimeMs:
        hasApiData && Number.isFinite(row.apiAvgResponseMs) && row.apiAvgResponseMs >= 0
          ? Math.round(row.apiAvgResponseMs)
          : base.api.avgResponseTimeMs,
      errorRate:
        hasApiData && Number.isFinite(row.apiErrorRate) && row.apiErrorRate >= 0
          ? clamp(Number(row.apiErrorRate), 0, 1)
          : base.api.errorRate,
    },
  };
}

function convertHttpPeakHours(rows: AnalyticsHttpPeakHour[]): PeakHour[] {
  return rows.map((row) => ({
    range: formatTimeRange(row.bucketStart, row.bucketEnd),
    requests: Math.max(0, row.requests),
    share: clamp(Number(row.share ?? 0), 0, 1),
  }));
}

function convertSessionInsightsFromDatabase(rows: AnalyticsSessionInsight[]): SessionInsight[] {
  return rows.map((row) => ({
    segment: row.segment,
    avgSessionDurationSeconds: Math.max(0, Math.round(Number(row.avgSessionDurationSeconds ?? 0))),
    pagesPerSession: Number.isFinite(row.pagesPerSession)
      ? Number(Number(row.pagesPerSession).toFixed(2))
      : 0,
    retentionRate: clamp(Number(row.retentionRate ?? 0), 0, 1),
    share: clamp(Number(row.share ?? 0), 0, 1),
    conversionRate: clamp(Number(row.conversionRate ?? 0), 0, 1),
  }));
}

function convertTrafficSourcesFromDatabase(rows: AnalyticsTrafficSource[]): TrafficSource[] {
  return rows
    .map((row) => ({
      channel: row.channel,
      sessions: Math.max(0, row.sessions),
      avgSessionDurationSeconds: Math.max(0, Math.round(Number(row.avgSessionDurationSeconds ?? 0))),
      conversionRate: clamp(Number(row.conversionRate ?? 0), 0, 1),
      changePercent: Number.isFinite(row.changePercent) ? Number(row.changePercent) : 0,
    }))
    .sort((a, b) => b.sessions - a.sessions || a.channel.localeCompare(b.channel));
}

function applyRealtimeSummaryOverride(
  summary: ServerSummary,
  row: AnalyticsRealtimeSummary | null,
): ServerSummary {
  if (!row) {
    return summary;
  }
  return {
    ...summary,
    realtimeEventsLast24h: Math.max(0, row.totalEvents),
  };
}

async function loadHttpAggregationsFromDatabase() {
  const [summary, peakHours] = await Promise.all([
    prisma.analyticsHttpSummary.findFirst({
      orderBy: { windowEnd: "desc" },
    }),
    prisma.analyticsHttpPeakHour.findMany({
      orderBy: [
        { requests: "desc" },
        { bucketStart: "desc" },
      ],
      take: 8,
    }),
  ]);

  return {
    summary: summary ?? null,
    peakHours,
  };
}

function readCpuTimes(): CpuTimesSnapshot {
  return os.cpus().reduce<CpuTimesSnapshot>(
    (accumulator, cpu) => {
      const times = cpu.times;
      const total = times.user + times.nice + times.sys + times.idle + times.irq;
      return {
        idle: accumulator.idle + times.idle,
        total: accumulator.total + total,
      };
    },
    { idle: 0, total: 0 },
  );
}

async function measureCpuUsagePercent(intervalMs = 200): Promise<number> {
  const start = readCpuTimes();
  if (start.total === 0) {
    return 0;
  }

  await wait(intervalMs);

  const end = readCpuTimes();
  const totalDelta = end.total - start.total;
  if (totalDelta <= 0) {
    return 0;
  }

  const idleDelta = end.idle - start.idle;
  const usage = 1 - idleDelta / totalDelta;
  if (!Number.isFinite(usage) || usage < 0) {
    return 0;
  }

  return clamp(usage * 100, 0, 100);
}

function getMemoryUsageSnapshot(): MemoryUsageSnapshot {
  const total = os.totalmem();
  const free = os.freemem();

  const totalBytes = clamp(total, 0, Number.MAX_SAFE_INTEGER);
  const freeBytes = clamp(Math.min(free, totalBytes), 0, totalBytes);
  const usedBytes = Math.max(totalBytes - freeBytes, 0);
  const usagePercent = totalBytes > 0 ? (usedBytes / totalBytes) * 100 : 0;

  return {
    usagePercent,
    totalBytes,
    freeBytes,
  };
}

async function getDiskUsageSnapshot(path: string): Promise<DiskUsageSnapshot> {
  const stats = await fs.statfs(path);

  const blockSize = clamp(stats.bsize ?? 0, 0, Number.MAX_SAFE_INTEGER);
  const totalBlocks = clamp(stats.blocks ?? 0, 0, Number.MAX_SAFE_INTEGER);
  const availableBlocksValue =
    typeof stats.bavail === "number" && stats.bavail >= 0 ? stats.bavail : stats.bfree ?? 0;
  const availableBlocks = clamp(availableBlocksValue, 0, totalBlocks);

  const totalBytes = blockSize * totalBlocks;
  const freeBytes = blockSize * availableBlocks;
  const usedBytes = Math.max(totalBytes - freeBytes, 0);
  const usagePercent = totalBytes > 0 ? (usedBytes / totalBytes) * 100 : 0;

  return {
    usagePercent,
    totalBytes,
    freeBytes,
    path,
  };
}

function calculateChangePercent(id: string, currentValue: number) {
  const previous = previousResourceUsage.get(id);
  previousResourceUsage.set(id, currentValue);

  if (previous === undefined || previous <= 0) {
    return 0;
  }

  const change = (currentValue - previous) / previous;
  if (!Number.isFinite(change)) {
    return 0;
  }

  return clamp(change, -5, 5);
}

function finalizeResourceMeasurement(measurement: ResourceMeasurement): ServerResourceUsage {
  const sanitizedUsage = clamp(measurement.usagePercent, 0, 100);
  const roundedUsage = Math.round(sanitizedUsage * 10) / 10;
  const changePercent = Math.round(calculateChangePercent(measurement.id, roundedUsage) * 100) / 100;

  return {
    ...measurement,
    usagePercent: roundedUsage,
    changePercent,
  };
}

async function collectSystemResourceUsage(): Promise<ServerResourceUsage[]> {
  const resources: ResourceMeasurement[] = [];

  const cpuCount = Math.max(os.cpus().length, 1);
  const loadAverages = os.loadavg();
  const loadOneMinuteRaw = loadAverages.length > 0 ? loadAverages[0] : 0;
  const loadOneMinute = Number.isFinite(loadOneMinuteRaw) ? loadOneMinuteRaw : 0;

  const diskPath = process.cwd();

  const [cpuUsagePercent, diskUsage] = await Promise.all([
    measureCpuUsagePercent().catch((error) => {
      console.error("[server-analytics] CPU usage probe failed", error);
      return null;
    }),
    getDiskUsageSnapshot(diskPath).catch((error) => {
      console.error(`[server-analytics] Disk usage probe failed for ${diskPath}`, error);
      return null;
    }),
  ]);

  if (cpuUsagePercent !== null) {
    resources.push({
      id: "app-cpu",
      label: "App-Server CPU",
      usagePercent: cpuUsagePercent,
      capacity: `${cpuCount} Kern${cpuCount === 1 ? "" : "e"} · Load 1m ${loadOneMinute.toFixed(2)}`,
    });
  }

  const memoryUsage = getMemoryUsageSnapshot();
  resources.push({
    id: "app-ram",
    label: "Arbeitsspeicher",
    usagePercent: memoryUsage.usagePercent,
    capacity: `${formatBytes(memoryUsage.totalBytes)} gesamt · ${formatBytes(memoryUsage.freeBytes)} frei`,
  });

  if (diskUsage !== null) {
    const normalizedPath = diskUsage.path === "" ? "/" : diskUsage.path;
    resources.push({
      id: "app-disk",
      label: `Dateisystem (${normalizedPath})`,
      usagePercent: diskUsage.usagePercent,
      capacity: `${formatBytes(diskUsage.totalBytes)} gesamt · ${formatBytes(diskUsage.freeBytes)} frei`,
    });
  }

  if (resources.length === 0) {
    throw new Error("Keine Systemressourcen konnten ermittelt werden");
  }

  return resources.map(finalizeResourceMeasurement);
}

async function buildServerAnalyticsSnapshot(): Promise<ServerAnalytics> {
  const fallbackReasons: string[] = [];
  let databaseUsed = false;

  if (!process.env.DATABASE_URL) {
    fallbackReasons.push("DATABASE_URL ist nicht gesetzt – verwende statische Kennzahlen");
  }

  let resourceUsage = STATIC_ANALYTICS.resourceUsage;
  let deviceBreakdown = cloneDeviceStats(STATIC_ANALYTICS.deviceBreakdown);
  let publicPages = clonePageEntries(STATIC_ANALYTICS.publicPages);
  let memberPages = clonePageEntries(STATIC_ANALYTICS.memberPages);
  let serverLogs: LoadedServerLog[] = (STATIC_ANALYTICS.serverLogs ?? []).map((entry) => ({
    ...entry,
    tags: Array.isArray(entry.tags) ? [...entry.tags] : [],
  }));
  let summary: ServerSummary = { ...STATIC_ANALYTICS.summary };
  let requestBreakdown: RequestBreakdown = {
    frontend: { ...STATIC_ANALYTICS.requestBreakdown.frontend },
    members: { ...STATIC_ANALYTICS.requestBreakdown.members },
    api: { ...STATIC_ANALYTICS.requestBreakdown.api },
  };
  let peakHours: PeakHour[] = (STATIC_ANALYTICS.peakHours ?? []).map((entry) => ({ ...entry }));
  let trafficSources: TrafficSource[] = STATIC_ANALYTICS.trafficSources.map((entry) => ({ ...entry }));
  let sessionInsights: SessionInsight[] = STATIC_ANALYTICS.sessionInsights.map((entry) => ({ ...entry }));

  const pageMetadata = new Map<string, PagePerformanceEntry>();
  for (const entry of STATIC_ANALYTICS.publicPages) {
    pageMetadata.set(entry.path, entry);
  }
  for (const entry of STATIC_ANALYTICS.memberPages) {
    pageMetadata.set(entry.path, entry);
  }

  try {
    resourceUsage = await collectSystemResourceUsage();
  } catch (error) {
    console.error("[server-analytics] Verwende statische Ressourcenwerte", error);
    fallbackReasons.push("Systemressourcen konnten nicht gemessen werden");
  }

  if (process.env.DATABASE_URL) {
    const [
      httpAggregates,
      deviceOverrides,
      pageMetricsResult,
      sessionInsightsRows,
      trafficSourceRows,
      realtimeSummaryRow,
      criticalLogs,
    ] = await Promise.all([
      loadHttpAggregationsFromDatabase().catch((error) => {
        console.error("[server-analytics] Failed to load HTTP analytics summary", error);
        fallbackReasons.push("HTTP-Kennzahlen aus der Datenbank nicht verfügbar");
        return null;
      }),
      loadDeviceBreakdownFromDatabase().catch((error) => {
        console.error("[server-analytics] Failed to load device analytics", error);
        fallbackReasons.push("Gerätekennzahlen aus der Datenbank nicht verfügbar");
        return null;
      }),
      loadPagePerformanceMetrics().catch((error) => {
        console.error("[server-analytics] Failed to load page performance metrics", error);
        fallbackReasons.push("Seitenmetriken konnten nicht geladen werden");
        return null;
      }),
      prisma.analyticsSessionInsight.findMany({
        orderBy: { generatedAt: "desc" },
      }).catch((error) => {
        console.error("[server-analytics] Failed to load session insights", error);
        fallbackReasons.push("Session-Insights aus der Datenbank nicht verfügbar");
        return null;
      }),
      prisma.analyticsTrafficSource.findMany({
        orderBy: { generatedAt: "desc" },
      }).catch((error) => {
        console.error("[server-analytics] Failed to load traffic sources", error);
        fallbackReasons.push("Traffic-Quellen konnten nicht geladen werden");
        return null;
      }),
      prisma.analyticsRealtimeSummary
        .findFirst({
          orderBy: { windowEnd: "desc" },
        })
        .catch((error) => {
          console.error("[server-analytics] Failed to load realtime analytics summary", error);
          fallbackReasons.push("Realtime-Kennzahlen konnten nicht geladen werden");
          return null;
        }),
      loadLatestCriticalServerLogs({ limit: 25 }).catch((error) => {
        console.error("[server-analytics] Failed to load critical server logs", error);
        fallbackReasons.push("Aktuelle Server-Logs nicht verfügbar");
        return null;
      }),
    ]);

    if (httpAggregates?.summary) {
      databaseUsed = true;
      summary = applyHttpSummaryOverrides(summary, httpAggregates.summary);
      requestBreakdown = applyRequestBreakdownOverrides(requestBreakdown, httpAggregates.summary);
    } else {
      fallbackReasons.push("Keine HTTP-Summary in der Datenbank gefunden");
    }

    if (httpAggregates?.peakHours && httpAggregates.peakHours.length > 0) {
      peakHours = convertHttpPeakHours(httpAggregates.peakHours);
      databaseUsed = true;
    }

    if (Array.isArray(deviceOverrides)) {
      deviceBreakdown = deviceOverrides.map((entry) => ({ ...entry }));
      databaseUsed = true;
    }

    if (Array.isArray(pageMetricsResult)) {
      if (pageMetricsResult.length > 0) {
        publicPages = buildAggregatedPageEntries(pageMetricsResult, "public", pageMetadata);
        memberPages = buildAggregatedPageEntries(pageMetricsResult, "members", pageMetadata);
        databaseUsed = true;
      } else {
        publicPages = [];
        memberPages = [];
        fallbackReasons.push("Keine Seitenmetriken in der Datenbank gespeichert");
      }
    }

    if (Array.isArray(sessionInsightsRows) && sessionInsightsRows.length > 0) {
      sessionInsights = convertSessionInsightsFromDatabase(sessionInsightsRows);
      databaseUsed = true;
    }

    if (Array.isArray(sessionInsightsRows) && sessionInsightsRows.length === 0) {
      fallbackReasons.push("Keine Session-Insights in der Datenbank gefunden");
    }

    if (Array.isArray(trafficSourceRows) && trafficSourceRows.length > 0) {
      trafficSources = convertTrafficSourcesFromDatabase(trafficSourceRows);
      databaseUsed = true;
    }

    if (Array.isArray(trafficSourceRows) && trafficSourceRows.length === 0) {
      fallbackReasons.push("Keine Traffic-Quellen in der Datenbank gefunden");
    }

    if (realtimeSummaryRow) {
      summary = applyRealtimeSummaryOverride(summary, realtimeSummaryRow);
      databaseUsed = true;
    }

    if (Array.isArray(criticalLogs) && criticalLogs.length > 0) {
      serverLogs = criticalLogs.map((entry) => ({
        ...entry,
        tags: Array.isArray(entry.tags) ? [...entry.tags] : [],
      }));
      databaseUsed = true;
    } else {
      serverLogs = serverLogs.map((entry) => ({
        ...entry,
        tags: Array.isArray(entry.tags) ? [...entry.tags] : [],
      }));
    }
  } else {
    deviceBreakdown = cloneDeviceStats(deviceBreakdown);
    publicPages = clonePageEntries(publicPages);
    memberPages = clonePageEntries(memberPages);
    serverLogs = serverLogs.map((entry) => ({
      ...entry,
      tags: Array.isArray(entry.tags) ? [...entry.tags] : [],
    }));
  }

  const generatedAt = new Date().toISOString();
  const uniqueFallbackReasons = Array.from(new Set(fallbackReasons.filter(Boolean)));
  const metadata: ServerAnalyticsMetadata = {
    source: databaseUsed ? "live" : "fallback",
    attempts: 1,
    lastUpdatedAt: generatedAt,
    fallbackReasons: uniqueFallbackReasons.length > 0 ? uniqueFallbackReasons : undefined,
  };

  return {
    generatedAt,
    ...STATIC_ANALYTICS,
    summary,
    requestBreakdown,
    peakHours,
    resourceUsage,
    deviceBreakdown,
    publicPages,
    memberPages,
    trafficSources,
    sessionInsights,
    serverLogs,
    metadata,
  };
}

const fetchCachedAnalytics = unstable_cache(
  async () => {
    const snapshot = await buildServerAnalyticsSnapshot();
    if (snapshot.metadata.source === "live") {
      lastSuccessfulAnalytics = cloneAnalyticsSnapshot(snapshot);
      lastFailureInfo = null;
    } else {
      const reason =
        snapshot.metadata.fallbackReasons?.[0] ??
        (process.env.DATABASE_URL
          ? "Statische Server-Analytics, da die Datenbank nicht erreichbar ist"
          : "Statische Server-Analytics");
      if (reason) {
        lastFailureInfo = {
          reason,
          occurredAt: snapshot.metadata.lastUpdatedAt,
        };
      } else {
        lastFailureInfo = null;
      }
    }
    return snapshot;
  },
  ANALYTICS_CACHE_KEY,
  {
    revalidate: ANALYTICS_REVALIDATE_SECONDS,
    tags: [ANALYTICS_CACHE_TAG],
  },
);

function cloneAnalyticsSnapshot(snapshot: ServerAnalytics): ServerAnalytics {
  if (typeof globalThis.structuredClone === "function") {
    return globalThis.structuredClone(snapshot);
  }
  return JSON.parse(JSON.stringify(snapshot)) as ServerAnalytics;
}

export async function collectServerAnalytics({
  forceRefresh = false,
}: { forceRefresh?: boolean } = {}): Promise<ServerAnalytics> {
  let useFresh = forceRefresh;
  let lastError: unknown = null;
  let lastSnapshot: ServerAnalytics | null = null;

  for (let attempt = 0; attempt < ANALYTICS_RETRY_DELAYS_MS.length; attempt += 1) {
    if (attempt > 0) {
      const delay = ANALYTICS_RETRY_DELAYS_MS[attempt];
      if (delay > 0) {
        await wait(delay);
      }
    }

    try {
      const snapshot = useFresh ? await buildServerAnalyticsSnapshot() : await fetchCachedAnalytics();
      const cloned = cloneAnalyticsSnapshot(snapshot);
      cloned.metadata = {
        ...cloned.metadata,
        attempts: attempt + 1,
      };

      if (cloned.metadata.source === "live" || !process.env.DATABASE_URL) {
        lastSuccessfulAnalytics = cloneAnalyticsSnapshot(cloned);
        if (cloned.metadata.source === "live") {
          lastFailureInfo = null;
        }
        return cloned;
      }

      lastSnapshot = cloned;
      useFresh = true;
      lastError = new Error(
        "Datenbank lieferte keine Live-Kennzahlen – verwende letzten bekannten Stand",
      );
    } catch (error) {
      useFresh = true;
      lastError = error;
    }
  }

  const fallbackReasons = new Set<string>();
  if (lastError instanceof Error && lastError.message) {
    fallbackReasons.add(lastError.message);
  }
  if (lastFailureInfo?.reason) {
    fallbackReasons.add(lastFailureInfo.reason);
  }

  if (lastSuccessfulAnalytics) {
    const cached = cloneAnalyticsSnapshot(lastSuccessfulAnalytics);
    const fallbackList = [
      ...fallbackReasons,
      ...(cached.metadata.fallbackReasons ?? []),
    ].filter(Boolean);
    const uniqueFallback = Array.from(new Set(fallbackList));
    cached.metadata = {
      ...cached.metadata,
      source: "cached",
      attempts: ANALYTICS_RETRY_DELAYS_MS.length,
      staleSince: cached.metadata.staleSince ?? new Date().toISOString(),
      fallbackReasons: uniqueFallback.length > 0 ? uniqueFallback : cached.metadata.fallbackReasons,
    };
    if (uniqueFallback.length > 0) {
      lastFailureInfo = {
        reason: uniqueFallback[0]!,
        occurredAt: new Date().toISOString(),
      };
    } else {
      lastFailureInfo = null;
    }
    return cached;
  }

  const snapshot = lastSnapshot ?? cloneAnalyticsSnapshot(await buildServerAnalyticsSnapshot());
  const fallbackList = [
    ...fallbackReasons,
    ...(snapshot.metadata.fallbackReasons ?? []),
  ].filter(Boolean);
  const uniqueFallback = Array.from(new Set(fallbackList));
  snapshot.metadata = {
    ...snapshot.metadata,
    source: "fallback",
    attempts: ANALYTICS_RETRY_DELAYS_MS.length,
    fallbackReasons: uniqueFallback.length > 0 ? uniqueFallback : snapshot.metadata.fallbackReasons,
  };

  if (uniqueFallback.length > 0) {
    lastFailureInfo = {
      reason: uniqueFallback[0]!,
      occurredAt: new Date().toISOString(),
    };
  } else {
    lastFailureInfo = null;
  }

  return snapshot;
}
