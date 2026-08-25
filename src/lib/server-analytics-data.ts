import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

import type { DeviceStat, PagePerformanceEntry } from "@/lib/server-analytics";

export type PagePerformanceMetricOverride = {
  path: string;
  avgPageLoadMs: number;
  loadTimeMs?: number;
  lcpMs?: number | null;
  avgTimeOnPageSeconds?: number | null;
  scope?: "public" | "members" | null;
  weight?: number;
};

type TableColumnRef = {
  original: string;
  lower: string;
};

type TableMetadata = {
  schema: string;
  table: string;
  schemaLower: string;
  tableLower: string;
  columns: TableColumnRef[];
};

type DeviceTableMatch = {
  schema: string;
  table: string;
  columns: {
    device: string;
    sessions: string;
    load: string;
    share: string | null;
  };
};

type PageTableMatch = {
  schema: string;
  table: string;
  columns: {
    path: string;
    load: string;
    scope: string | null;
    lcp: string | null;
    timeOnPage: string | null;
    count: string | null;
  };
};

const globalForAnalytics = globalThis as typeof globalThis & Record<symbol, unknown>;

const DEVICE_PATTERNS = [
  "device",
  "client",
  "form_factor",
  "formfactor",
  "plattform",
  "platform",
  "geraet",
  "gerät",
  "hardware",
];
const SESSION_PATTERNS = [
  "session",
  "sessions",
  "visit",
  "visits",
  "traffic",
  "hits",
  "requests",
  "aufrufe",
  "aufruf",
  "zugriffe",
  "zugriff",
];
const LOAD_PATTERNS = [
  "load",
  "lade",
  "generation",
  "render",
  "response",
  "speed",
  "dauer",
  "zeit",
  "perf",
];
const SHARE_PATTERNS = ["share", "ratio", "percent", "anteil", "quote", "quota", "prozent"];
const PATH_PATTERNS = ["path", "pfad", "url", "page", "seite", "slug", "route"];
const SCOPE_PATTERNS = [
  "scope",
  "section",
  "area",
  "segment",
  "audience",
  "bereich",
  "gruppe",
  "zone",
  "domain",
  "portal",
  "context",
  "scope",
];
const LCP_PATTERNS = ["lcp", "largest", "hero"];
const DWELL_PATTERNS = [
  "time_on_page",
  "time-on-page",
  "time_spent",
  "timespent",
  "verweildauer",
  "dwell",
  "avg_time",
  "avg_duration",
  "time_per",
  "duration",
];
const COUNT_PATTERNS = [
  "session",
  "visit",
  "view",
  "views",
  "count",
  "hits",
  "requests",
  "samples",
  "events",
  "aufrufe",
  "zugriffe",
];

function getAnalyticsPrisma(): PrismaClient | null {
  if (!process.env.DATABASE_URL) {
    return null;
  }

  const globalKey = Symbol.for("__analytics_prisma");
  if (!globalForAnalytics[globalKey]) {
    const poolKey = Symbol.for("__analytics_pg_pool");
    if (!globalForAnalytics[poolKey]) {
      globalForAnalytics[poolKey] = new Pool({ connectionString: process.env.DATABASE_URL });
    }
    const adapter = new PrismaPg(globalForAnalytics[poolKey] as Pool);
    globalForAnalytics[globalKey] = new PrismaClient({
      adapter,
      log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    });
  }

  return globalForAnalytics[globalKey] as PrismaClient;
}

const metadataCache: {
  tables: TableMetadata[] | null;
  promise: Promise<TableMetadata[]> | null;
} = {
  tables: null,
  promise: null,
};
let deviceTableCache: DeviceTableMatch | null | undefined;
let pageTableCache: PageTableMatch | null | undefined;

function quoteIdentifier(identifier: unknown): string {
  return `"${String(identifier).replace(/"/g, '""')}"`;
}

function formatTableName(schema: unknown, table: unknown): string {
  return `${quoteIdentifier(schema)}.${quoteIdentifier(table)}`;
}

function isTableMissingError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }
  const candidate = error as { code?: unknown };
  const code = (candidate.code as { code?: unknown } | undefined)?.code ?? candidate.code;
  return typeof code === "string" && code.toUpperCase() === "42P01";
}

function groupTableMetadata(rows: unknown): TableMetadata[] {
  const tableMap = new Map<string, TableMetadata>();

  if (!Array.isArray(rows)) {
    return [];
  }

  for (const raw of rows) {
    const row = raw as Record<string, unknown>;
    const schema = String(row.table_schema);
    const table = String(row.table_name);
    const column = String(row.column_name);
    const key = `${schema}.${table}`;
    if (!tableMap.has(key)) {
      tableMap.set(key, {
        schema,
        table,
        schemaLower: schema.toLowerCase(),
        tableLower: table.toLowerCase(),
        columns: [],
      });
    }
    tableMap.get(key)?.columns.push({
      original: column,
      lower: column.toLowerCase(),
    });
  }

  return Array.from(tableMap.values());
}

async function loadTableMetadata(prisma: PrismaClient): Promise<TableMetadata[]> {
  if (metadataCache.tables) {
    return metadataCache.tables;
  }
  if (metadataCache.promise) {
    return metadataCache.promise;
  }

  const query =
    "SELECT table_schema, table_name, column_name FROM information_schema.columns WHERE table_schema NOT IN ('pg_catalog','information_schema')";
  metadataCache.promise = prisma
    .$queryRawUnsafe(query)
    .then((rows) => {
      metadataCache.tables = groupTableMetadata(rows);
      return metadataCache.tables;
    })
    .catch((error: unknown) => {
      metadataCache.promise = null;
      throw error;
    });

  return metadataCache.promise;
}

function findColumn(
  table: TableMetadata,
  patterns: string[],
  exclude: Set<string> = new Set(),
): TableColumnRef | null {
  for (const column of table.columns) {
    if (exclude.has(column.original)) continue;
    const lower = column.lower;
    for (const pattern of patterns) {
      if (lower.includes(pattern)) {
        return column;
      }
    }
  }
  return null;
}

function computeScore(
  table: TableMetadata,
  {
    keywords = [],
    hasShare = false,
    hasScope = false,
    hasLcp = false,
    hasCount = false,
    hasTimeOnPage = false,
  }: {
    keywords?: string[];
    hasShare?: boolean;
    hasScope?: boolean;
    hasLcp?: boolean;
    hasCount?: boolean;
    hasTimeOnPage?: boolean;
  } = {},
): number {
  let score = 0;
  const name = table.tableLower;
  const schema = table.schemaLower;

  if (schema.includes("analytics")) score += 2.5;
  if (schema.includes("data")) score += 1;

  for (const keyword of keywords) {
    if (name.includes(keyword)) score += 3;
  }

  if (name.includes("analytics")) score += 2.5;
  if (name.includes("device")) score += 1.5;
  if (name.includes("page")) score += 1.5;
  if (name.includes("performance")) score += 1.5;
  if (name.includes("metric")) score += 1;
  if (name.includes("load")) score += 1;
  if (hasShare) score += 0.5;
  if (hasScope) score += 0.5;
  if (hasLcp) score += 0.5;
  if (hasCount) score += 0.5;
  if (hasTimeOnPage) score += 0.5;
  score += table.columns.length * 0.02;

  return score;
}

async function resolveDeviceTable(prisma: PrismaClient): Promise<DeviceTableMatch | null> {
  if (deviceTableCache !== undefined) {
    return deviceTableCache;
  }

  try {
    const tables = await loadTableMetadata(prisma);
    let bestMatch: DeviceTableMatch | null = null;
    let bestScore = -Infinity;

    for (const table of tables) {
      const deviceColumn = findColumn(table, DEVICE_PATTERNS);
      if (!deviceColumn) continue;

      const sessionsColumn = findColumn(table, SESSION_PATTERNS, new Set([deviceColumn.original]));
      if (!sessionsColumn) continue;

      const exclude = new Set([deviceColumn.original, sessionsColumn.original]);
      const loadColumn = findColumn(table, LOAD_PATTERNS, exclude);
      if (!loadColumn) continue;

      const shareColumn = findColumn(
        table,
        SHARE_PATTERNS,
        new Set([deviceColumn.original, sessionsColumn.original, loadColumn.original]),
      );
      const score = computeScore(table, {
        keywords: ["device", "analytics", "load", "performance"],
        hasShare: Boolean(shareColumn),
      });

      if (score > bestScore) {
        bestScore = score;
        bestMatch = {
          schema: table.schema,
          table: table.table,
          columns: {
            device: deviceColumn.original,
            sessions: sessionsColumn.original,
            load: loadColumn.original,
            share: shareColumn ? shareColumn.original : null,
          },
        };
      }
    }

    deviceTableCache = bestMatch;
  } catch (error) {
    deviceTableCache = null;
    throw error;
  }

  return deviceTableCache;
}

async function resolvePageTable(prisma: PrismaClient): Promise<PageTableMatch | null> {
  if (pageTableCache !== undefined) {
    return pageTableCache;
  }

  try {
    const tables = await loadTableMetadata(prisma);
    let bestMatch: PageTableMatch | null = null;
    let bestScore = -Infinity;

    for (const table of tables) {
      const pathColumn = findColumn(table, PATH_PATTERNS);
      if (!pathColumn) continue;

      const exclude = new Set([pathColumn.original]);
      const loadColumn = findColumn(table, LOAD_PATTERNS, exclude);
      if (!loadColumn) continue;

      exclude.add(loadColumn.original);
      const scopeColumn = findColumn(table, SCOPE_PATTERNS, exclude);
      if (scopeColumn) exclude.add(scopeColumn.original);

      const lcpColumn = findColumn(table, LCP_PATTERNS, exclude);
      if (lcpColumn) exclude.add(lcpColumn.original);

      const timeOnPageColumn = findColumn(table, DWELL_PATTERNS, exclude);
      if (timeOnPageColumn) exclude.add(timeOnPageColumn.original);

      let countColumn = findColumn(table, COUNT_PATTERNS, exclude);
      if (countColumn && countColumn.original === loadColumn.original) {
        countColumn = null;
      }

      const score = computeScore(table, {
        keywords: ["page", "performance", "analytics", "load", "speed", "metrics"],
        hasScope: Boolean(scopeColumn),
        hasLcp: Boolean(lcpColumn),
        hasCount: Boolean(countColumn),
        hasTimeOnPage: Boolean(timeOnPageColumn),
      });

      if (score > bestScore) {
        bestScore = score;
        bestMatch = {
          schema: table.schema,
          table: table.table,
          columns: {
            path: pathColumn.original,
            load: loadColumn.original,
            scope: scopeColumn ? scopeColumn.original : null,
            lcp: lcpColumn ? lcpColumn.original : null,
            timeOnPage: timeOnPageColumn ? timeOnPageColumn.original : null,
            count: countColumn ? countColumn.original : null,
          },
        };
      }
    }

    pageTableCache = bestMatch;
  } catch (error) {
    pageTableCache = null;
    throw error;
  }

  return pageTableCache;
}

function toNumber(value: unknown): number {
  if (value === null || value === undefined) return NaN;
  if (typeof value === "number") return value;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "string") {
    if (!value.trim()) return NaN;
    const cleaned = value.replace(/%/g, "").replace(/,/g, ".");
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : NaN;
  }
  if (typeof value === "object") {
    const candidate = value as {
      toNumber?: unknown;
      valueOf?: unknown;
      toString?: unknown;
    };
    if (typeof candidate.toNumber === "function") {
      try {
        return Number(candidate.toNumber());
      } catch {
        return NaN;
      }
    }
    if (typeof candidate.valueOf === "function") {
      const raw = candidate.valueOf();
      if (typeof raw === "number") return raw;
      if (typeof raw === "bigint") return Number(raw);
    }
    if (typeof candidate.toString === "function") {
      const parsed = Number(candidate.toString());
      return Number.isFinite(parsed) ? parsed : NaN;
    }
  }
  return NaN;
}

function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function normalizeDurationToMs(value: unknown): number {
  const numeric = toNumber(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return 0;
  }
  if (numeric > 10_000) {
    return Math.round(numeric);
  }
  if (numeric < 20) {
    return Math.round(numeric * 1000);
  }
  return Math.round(numeric);
}

function normalizeDeviceKey(value: unknown): string | null {
  if (!value && value !== 0) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const lower = raw.toLowerCase();

  if (lower.includes("desktop") || lower.includes("pc") || lower.includes("laptop")) {
    return "desktop";
  }
  if (lower.includes("tablet") || lower.includes("ipad")) {
    return "tablet";
  }
  if (
    lower.includes("mobile") ||
    lower.includes("phone") ||
    lower.includes("smartphone") ||
    lower.includes("handy") ||
    lower.includes("android") ||
    lower.includes("iphone")
  ) {
    return "mobile";
  }
  if (lower.includes("tv") || lower.includes("smarttv") || lower.includes("fernseh")) {
    return "tv";
  }
  if (
    lower.includes("konsole") ||
    lower.includes("console") ||
    lower.includes("xbox") ||
    lower.includes("playstation")
  ) {
    return "console";
  }
  if (lower.includes("watch") || lower.includes("wearable")) {
    return "wearable";
  }
  if (
    lower.includes("sonst") ||
    lower.includes("other") ||
    lower.includes("unknown") ||
    lower.includes("unbekannt")
  ) {
    return "other";
  }
  return lower.replace(/\s+/g, "_");
}

function deviceDisplayName(key: string): string {
  switch (key) {
    case "desktop":
      return "Desktop";
    case "mobile":
      return "Mobil";
    case "tablet":
      return "Tablet";
    case "tv":
      return "TV & Streaming";
    case "console":
      return "Konsole";
    case "wearable":
      return "Wearable";
    case "other":
      return "Sonstige";
    case "unknown":
      return "Unbekannt";
    default:
      return key
        .split(/[_\-\s]/)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
  }
}

function normalizePath(value: unknown): string | null {
  if (!value && value !== 0) return null;
  let raw = String(value).trim();
  if (!raw) return null;

  try {
    const maybeUrl = new URL(raw, "http://localhost");
    raw = maybeUrl.pathname || raw;
  } catch {
    // Ignore parsing errors
  }

  raw = raw.split("?")[0] ?? raw;
  raw = raw.split("#")[0] ?? raw;
  if (!raw.startsWith("/")) {
    raw = `/${raw}`;
  }
  raw = raw.replace(/\/+/g, "/");
  if (raw.length > 1 && raw.endsWith("/")) {
    raw = raw.slice(0, -1);
  }
  raw = raw.replace(/\/index$/i, "/");

  return raw || "/";
}

function normalizeScope(value: unknown, path: string | null): "members" | "public" | null {
  if (value && value !== 0) {
    const lower = String(value).trim().toLowerCase();
    if (
      lower.includes("member") ||
      lower.includes("intern") ||
      lower.includes("protected") ||
      lower.includes("mitglieder")
    ) {
      return "members";
    }
    if (
      lower.includes("public") ||
      lower.includes("extern") ||
      lower.includes("marketing") ||
      lower.includes("landing")
    ) {
      return "public";
    }
    if (lower.includes("overall") || lower.includes("gesamt") || lower.includes("all")) {
      return null;
    }
  }

  if (path) {
    const normalized = path.toLowerCase();
    if (normalized.startsWith("/mitglieder") || normalized.startsWith("/members")) {
      return "members";
    }
  }

  return null;
}

async function loadDeviceMetricsFromDedicatedView(
  prisma: PrismaClient,
): Promise<DeviceStat[] | null> {
  try {
    const rows = (await prisma.$queryRawUnsafe(
      "SELECT device, sessions, avg_load, share FROM analytics_device_metrics",
    )) as readonly Record<string, unknown>[] | null;
    if (!Array.isArray(rows)) {
      return [];
    }

    const buckets: { key: string; sessions: number; avgLoadMs: number; share: number }[] = [];
    let totalSessions = 0;

    for (const row of rows) {
      const deviceKey = normalizeDeviceKey(row?.device ?? row?.DEVICE ?? row?.device_key);
      if (!deviceKey) continue;

      const sessions = Math.max(
        0,
        Math.round(toNumber(row?.sessions ?? row?.SESSIONS ?? row?.count)),
      );
      if (!Number.isFinite(sessions) || sessions <= 0) {
        continue;
      }

      const avgLoadMs = normalizeDurationToMs(row?.avg_load ?? row?.AVG_LOAD ?? row?.avgLoad);
      const share = Number(row?.share ?? row?.SHARE);
      buckets.push({ key: deviceKey, sessions, avgLoadMs, share });
      totalSessions += sessions;
    }

    return buckets.map((bucket) => ({
      device: deviceDisplayName(bucket.key),
      sessions: bucket.sessions,
      avgPageLoadMs: Math.max(0, Math.round(bucket.avgLoadMs)),
      share: clampNumber(
        Number.isFinite(bucket.share) && bucket.share > 0
          ? bucket.share
          : totalSessions > 0
            ? bucket.sessions / totalSessions
            : 0,
        0,
        1,
      ),
    }));
  } catch (error) {
    if (isTableMissingError(error)) {
      return null;
    }
    console.error("[server-analytics] Failed to query analytics_device_metrics", error);
    return null;
  }
}

async function loadPageMetricsFromDedicatedView(
  prisma: PrismaClient,
): Promise<PagePerformanceMetricOverride[] | null> {
  try {
    const rows = (await prisma.$queryRawUnsafe(
      "SELECT path, scope, avg_load, lcp, avg_time_on_page, weight FROM analytics_page_metrics",
    )) as readonly Record<string, unknown>[] | null;
    if (!Array.isArray(rows)) {
      return [];
    }

    const metrics: PagePerformanceMetricOverride[] = [];

    for (const row of rows) {
      const normalizedPath = normalizePath(row?.path ?? row?.PATH ?? row?.url);
      if (!normalizedPath) {
        continue;
      }

      const avgLoadMs = normalizeDurationToMs(
        row?.avg_load ?? row?.AVG_LOAD ?? row?.avgLoad ?? row?.avg_page_load,
      );
      if (!Number.isFinite(avgLoadMs) || avgLoadMs <= 0) {
        continue;
      }

      const scope = normalizeScope(row?.scope ?? row?.SCOPE ?? null, normalizedPath);
      const lcpMsRaw = normalizeDurationToMs(row?.lcp ?? row?.LCP ?? row?.largest_contentful_paint);
      const weight = Math.max(0, Math.round(toNumber(row?.weight ?? row?.WEIGHT ?? row?.samples)));
      const avgTimeOnPageSecondsRaw = toNumber(
        row?.avg_time_on_page ?? row?.AVG_TIME_ON_PAGE ?? row?.avg_time_on_page_seconds,
      );
      const avgTimeOnPageSeconds =
        Number.isFinite(avgTimeOnPageSecondsRaw) && avgTimeOnPageSecondsRaw > 0
          ? Math.max(0, Math.round(avgTimeOnPageSecondsRaw))
          : null;

      metrics.push({
        path: normalizedPath,
        avgPageLoadMs: Math.max(0, Math.round(avgLoadMs)),
        lcpMs: lcpMsRaw > 0 ? Math.max(0, Math.round(lcpMsRaw)) : null,
        avgTimeOnPageSeconds,
        scope,
        weight: weight > 0 ? weight : undefined,
      });
    }

    return metrics;
  } catch (error) {
    if (isTableMissingError(error)) {
      return null;
    }
    console.error("[server-analytics] Failed to query analytics_page_metrics", error);
    return null;
  }
}

export async function loadDeviceBreakdownFromDatabase(): Promise<DeviceStat[] | null> {
  const prisma = getAnalyticsPrisma();
  if (!prisma) {
    return null;
  }

  const dedicated = await loadDeviceMetricsFromDedicatedView(prisma);
  if (dedicated !== null) {
    return dedicated;
  }

  const match = await resolveDeviceTable(prisma).catch((error: unknown) => {
    console.error("[server-analytics] Failed to resolve device analytics table", error);
    return null;
  });
  if (!match) {
    return null;
  }

  const selectParts = [
    `${quoteIdentifier(match.columns.device)} AS device`,
    `${quoteIdentifier(match.columns.sessions)} AS sessions`,
    `${quoteIdentifier(match.columns.load)} AS avg_load`,
  ];
  if (match.columns.share) {
    selectParts.push(`${quoteIdentifier(match.columns.share)} AS share`);
  }

  const query = `SELECT ${selectParts.join(", ")} FROM ${formatTableName(match.schema, match.table)}`;

  let rows: readonly Record<string, unknown>[] | null;
  try {
    rows = (await prisma.$queryRawUnsafe(query)) as readonly Record<string, unknown>[] | null;
  } catch (error) {
    console.error("[server-analytics] Failed to load device statistics", error);
    return null;
  }

  const buckets = new Map<
    string,
    { key: string; device: string; sessions: number; weightedLoad: number }
  >();

  for (const row of rows ?? []) {
    const deviceKey = normalizeDeviceKey(row.device ?? row.DEVICE ?? row.Device);
    if (!deviceKey) continue;

    const sessions = Math.max(
      0,
      Math.round(toNumber(row.sessions ?? row.SESSIONS ?? row.session_count)),
    );
    if (!Number.isFinite(sessions) || sessions <= 0) continue;

    const loadMs = normalizeDurationToMs(
      row.avg_load ?? row.AVG_LOAD ?? row.avg_load_ms ?? row.average_load,
    );

    if (!buckets.has(deviceKey)) {
      buckets.set(deviceKey, {
        key: deviceKey,
        device: deviceDisplayName(deviceKey),
        sessions: 0,
        weightedLoad: 0,
      });
    }
    const bucket = buckets.get(deviceKey);
    if (!bucket) continue;
    bucket.sessions += sessions;
    bucket.weightedLoad += loadMs * sessions;
  }

  const totals = Array.from(buckets.values());
  const totalSessions = totals.reduce(
    (sum, entry) => sum + (Number.isFinite(entry.sessions) ? entry.sessions : 0),
    0,
  );
  if (totalSessions <= 0) {
    return totals
      .map((entry) => ({
        device: entry.device,
        sessions: Math.max(0, Math.round(entry.sessions)),
        avgPageLoadMs: Math.max(0, Math.round(entry.weightedLoad)),
        share: 0,
      }))
      .sort((a, b) => b.sessions - a.sessions);
  }

  return totals
    .map((entry) => {
      const avgLoad = entry.sessions > 0 ? entry.weightedLoad / entry.sessions : 0;
      return {
        device: entry.device,
        sessions: Math.max(0, Math.round(entry.sessions)),
        avgPageLoadMs: Math.max(0, Math.round(avgLoad)),
        share: clampNumber(entry.sessions / totalSessions, 0, 1),
      };
    })
    .sort((a, b) => b.sessions - a.sessions);
}

export async function loadPagePerformanceMetrics(): Promise<PagePerformanceMetricOverride[]> {
  const prisma = getAnalyticsPrisma();
  if (!prisma) {
    return [];
  }

  const dedicated = await loadPageMetricsFromDedicatedView(prisma);
  if (dedicated !== null) {
    return dedicated;
  }

  const match = await resolvePageTable(prisma).catch((error: unknown) => {
    console.error("[server-analytics] Failed to resolve page analytics table", error);
    return null;
  });
  if (!match) {
    return [];
  }

  const selectParts = [
    `${quoteIdentifier(match.columns.path)} AS path`,
    `${quoteIdentifier(match.columns.load)} AS avg_load`,
  ];
  if (match.columns.scope) {
    selectParts.push(`${quoteIdentifier(match.columns.scope)} AS scope`);
  }
  if (match.columns.lcp) {
    selectParts.push(`${quoteIdentifier(match.columns.lcp)} AS lcp`);
  }
  if (match.columns.timeOnPage) {
    selectParts.push(`${quoteIdentifier(match.columns.timeOnPage)} AS time_on_page`);
  }
  if (match.columns.count) {
    selectParts.push(`${quoteIdentifier(match.columns.count)} AS weight`);
  }

  const query = `SELECT ${selectParts.join(", ")} FROM ${formatTableName(match.schema, match.table)}`;

  let rows: readonly Record<string, unknown>[] | null;
  try {
    rows = (await prisma.$queryRawUnsafe(query)) as readonly Record<string, unknown>[] | null;
  } catch (error) {
    console.error("[server-analytics] Failed to load page performance metrics", error);
    return [];
  }

  const aggregated = new Map<
    string,
    {
      path: string;
      scope: "members" | "public" | null;
      totalWeight: number;
      totalLoad: number;
      totalLcp: number;
      lcpWeight: number;
      totalTimeOnPageSeconds: number;
      timeOnPageWeight: number;
    }
  >();

  for (const row of rows ?? []) {
    const normalizedPath = normalizePath(row.path ?? row.PAGE ?? row.url);
    if (!normalizedPath) continue;

    const loadMs = normalizeDurationToMs(
      row.avg_load ?? row.load ?? row.avg_load_ms ?? row.average_load,
    );
    if (!Number.isFinite(loadMs) || loadMs <= 0) continue;

    const scope = match.columns.scope
      ? normalizeScope(row.scope, normalizedPath)
      : normalizeScope(null, normalizedPath);

    let weight = 1;
    if (match.columns.count) {
      const parsedWeight = Math.max(0, Math.round(toNumber(row.weight)));
      if (Number.isFinite(parsedWeight) && parsedWeight > 0) {
        weight = parsedWeight;
      }
    }

    let lcpMs: number | null = null;
    if (match.columns.lcp) {
      const parsedLcp = normalizeDurationToMs(
        row.lcp ?? row.LCP ?? row.lcp_ms ?? row.largest_contentful_paint,
      );
      if (Number.isFinite(parsedLcp) && parsedLcp > 0) {
        lcpMs = parsedLcp;
      }
    }

    const scopeKey = scope ?? "all";
    const key = `${normalizedPath}__${scopeKey}`;
    if (!aggregated.has(key)) {
      aggregated.set(key, {
        path: normalizedPath,
        scope,
        totalWeight: 0,
        totalLoad: 0,
        totalLcp: 0,
        lcpWeight: 0,
        totalTimeOnPageSeconds: 0,
        timeOnPageWeight: 0,
      });
    }

    const bucket = aggregated.get(key);
    if (!bucket) continue;
    bucket.totalWeight += weight;
    bucket.totalLoad += loadMs * weight;
    if (lcpMs !== null) {
      bucket.totalLcp += lcpMs * weight;
      bucket.lcpWeight += weight;
    }

    let timeOnPageSeconds: number | null = null;
    if (match.columns.timeOnPage) {
      const parsedTime = normalizeDurationToMs(
        row.time_on_page ?? row.TIME_ON_PAGE ?? row.avg_time_on_page ?? row.timeOnPage,
      );
      if (Number.isFinite(parsedTime) && parsedTime > 0) {
        timeOnPageSeconds = parsedTime / 1000;
      }
    }

    if (timeOnPageSeconds !== null) {
      bucket.totalTimeOnPageSeconds += timeOnPageSeconds * weight;
      bucket.timeOnPageWeight += weight;
    }
  }

  const result: PagePerformanceMetricOverride[] = [];

  for (const bucket of aggregated.values()) {
    if (!Number.isFinite(bucket.totalWeight) || bucket.totalWeight <= 0) continue;
    const avgLoad = bucket.totalLoad / bucket.totalWeight;
    const avgLcp = bucket.lcpWeight > 0 ? bucket.totalLcp / bucket.lcpWeight : null;
    const avgTimeOnPageSeconds =
      bucket.timeOnPageWeight > 0 ? bucket.totalTimeOnPageSeconds / bucket.timeOnPageWeight : null;
    result.push({
      path: bucket.path,
      avgPageLoadMs: Math.max(0, Math.round(avgLoad)),
      lcpMs: avgLcp !== null ? Math.max(0, Math.round(avgLcp)) : null,
      avgTimeOnPageSeconds:
        avgTimeOnPageSeconds !== null ? Math.max(0, Math.round(avgTimeOnPageSeconds)) : null,
      scope: bucket.scope,
      weight: bucket.totalWeight,
    });
  }

  return result;
}

export function mergeDeviceBreakdown(
  base: DeviceStat[],
  overrides?: DeviceStat[] | null,
): DeviceStat[] {
  const result: DeviceStat[] = [];
  const overrideMap = new Map<string, DeviceStat>();
  const orderedOverrides: { key: string; data: DeviceStat }[] = [];

  if (Array.isArray(overrides)) {
    for (const entry of overrides) {
      const key = normalizeDeviceKey(entry?.device);
      if (!key) continue;
      const normalized: DeviceStat = {
        device: deviceDisplayName(key),
        sessions: Math.max(0, Math.round(Number(entry.sessions ?? 0))),
        avgPageLoadMs: Math.max(0, Math.round(Number(entry.avgPageLoadMs ?? 0))),
        share: clampNumber(Number(entry.share ?? 0), 0, 1),
      };
      overrideMap.set(key, normalized);
      orderedOverrides.push({ key, data: normalized });
    }
  }

  const usedKeys = new Set<string>();

  if (Array.isArray(base)) {
    for (const entry of base) {
      const key = normalizeDeviceKey(entry?.device);
      if (!key) {
        result.push({ ...entry });
        continue;
      }
      const override = overrideMap.get(key);
      if (override) {
        result.push({ ...override });
        usedKeys.add(key);
      } else {
        result.push({ ...entry });
      }
    }
  }

  for (const { key, data } of orderedOverrides) {
    if (!usedKeys.has(key)) {
      result.push({ ...data });
    }
  }

  const totalSessions = result.reduce(
    (sum, entry) => sum + (Number.isFinite(entry.sessions) ? entry.sessions : 0),
    0,
  );
  if (totalSessions > 0) {
    return result.map((entry) => ({
      device: entry.device,
      sessions: Math.max(0, Math.round(entry.sessions)),
      avgPageLoadMs: Math.max(0, Math.round(entry.avgPageLoadMs)),
      share: clampNumber(
        Number.isFinite(entry.share) && entry.share > 0
          ? entry.share
          : entry.sessions / totalSessions,
        0,
        1,
      ),
    }));
  }

  return result.map((entry) => ({
    device: entry.device,
    sessions: Math.max(0, Math.round(entry.sessions)),
    avgPageLoadMs: Math.max(0, Math.round(entry.avgPageLoadMs)),
    share: clampNumber(Number(entry.share ?? 0), 0, 1),
  }));
}

export function applyPagePerformanceMetrics(
  baseEntries: PagePerformanceEntry[],
  overrides: PagePerformanceMetricOverride[] | null | undefined,
  scope: "public" | "members",
): PagePerformanceEntry[] {
  const normalizedOverrides = new Map<string, Map<string, PagePerformanceMetricOverride>>();

  if (Array.isArray(overrides)) {
    for (const entry of overrides) {
      const normalizedPath = normalizePath(entry?.path);
      if (!normalizedPath) continue;
      const normalizedScope =
        entry?.scope === "members" || entry?.scope === "public" ? entry.scope : null;
      const scopeKey = normalizedScope ?? "all";
      if (!normalizedOverrides.has(normalizedPath)) {
        normalizedOverrides.set(normalizedPath, new Map());
      }
      normalizedOverrides.get(normalizedPath)?.set(scopeKey, {
        path: normalizedPath,
        avgPageLoadMs: Math.max(
          0,
          Math.round(Number(entry.avgPageLoadMs ?? entry.loadTimeMs ?? 0)),
        ),
        lcpMs:
          entry.lcpMs === null || entry.lcpMs === undefined
            ? null
            : Math.max(0, Math.round(Number(entry.lcpMs))),
        avgTimeOnPageSeconds:
          entry.avgTimeOnPageSeconds === null || entry.avgTimeOnPageSeconds === undefined
            ? null
            : Math.max(0, Math.round(Number(entry.avgTimeOnPageSeconds))),
      });
    }
  }

  const result: PagePerformanceEntry[] = [];

  for (const entry of baseEntries ?? []) {
    const normalizedPath = normalizePath(entry?.path);
    const scopeMap = normalizedOverrides.get(normalizedPath ?? "");
    if (!scopeMap) {
      result.push({ ...entry });
      continue;
    }

    const override = scopeMap.get(scope) ?? scopeMap.get("all");
    if (!override) {
      result.push({ ...entry });
      continue;
    }

    const updates: Partial<PagePerformanceEntry> = {};
    if (Number.isFinite(override.avgPageLoadMs) && override.avgPageLoadMs > 0) {
      updates.loadTimeMs = override.avgPageLoadMs;
    }
    if (
      override.lcpMs !== null &&
      override.lcpMs !== undefined &&
      Number.isFinite(override.lcpMs)
    ) {
      updates.lcpMs = override.lcpMs;
    }
    if (
      override.avgTimeOnPageSeconds !== null &&
      override.avgTimeOnPageSeconds !== undefined &&
      Number.isFinite(override.avgTimeOnPageSeconds)
    ) {
      updates.avgTimeOnPageSeconds = override.avgTimeOnPageSeconds;
    }

    result.push({ ...entry, ...updates });
  }

  return result;
}

export function resetAnalyticsMetadataCache(): void {
  metadataCache.tables = null;
  metadataCache.promise = null;
  deviceTableCache = undefined;
  pageTableCache = undefined;
}
