import fs from "node:fs/promises";
import os from "node:os";
import { setTimeout as wait } from "node:timers/promises";

import staticAnalyticsData from "@/data/server-analytics-static.json";

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

type StaticAnalyticsData = Omit<ServerAnalytics, "generatedAt">;

const STATIC_ANALYTICS = staticAnalyticsData as StaticAnalyticsData;

const previousResourceUsage = new Map<string, number>();

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

export async function collectServerAnalytics(): Promise<ServerAnalytics> {
  let resourceUsage = STATIC_ANALYTICS.resourceUsage;

  try {
    resourceUsage = await collectSystemResourceUsage();
  } catch (error) {
    console.error("[server-analytics] Verwende statische Ressourcenwerte", error);
  }

  return {
    generatedAt: new Date().toISOString(),
    ...STATIC_ANALYTICS,
    resourceUsage,
  };
}
