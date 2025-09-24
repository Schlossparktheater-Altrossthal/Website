import { PrismaClient } from "@prisma/client";

const globalForAnalytics = globalThis;

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
const SHARE_PATTERNS = [
  "share",
  "ratio",
  "percent",
  "anteil",
  "quote",
  "quota",
  "prozent",
];
const PATH_PATTERNS = [
  "path",
  "pfad",
  "url",
  "page",
  "seite",
  "slug",
  "route",
];
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

function getAnalyticsPrisma() {
  if (!process.env.DATABASE_URL) {
    return null;
  }

  const globalKey = Symbol.for("__analytics_prisma");
  if (!globalForAnalytics[globalKey]) {
    globalForAnalytics[globalKey] = new PrismaClient({
      log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    });
  }

  return globalForAnalytics[globalKey];
}

const metadataCache = {
  tables: null,
  promise: null,
};
let deviceTableCache;
let pageTableCache;

function quoteIdentifier(identifier) {
  return `"${String(identifier).replace(/"/g, '""')}"`;
}

function formatTableName(schema, table) {
  return `${quoteIdentifier(schema)}.${quoteIdentifier(table)}`;
}

function isTableMissingError(error) {
  if (!error || typeof error !== "object") {
    return false;
  }
  const code = error.code || error.code?.code;
  return typeof code === "string" && code.toUpperCase() === "42P01";
}

function groupTableMetadata(rows) {
  const tableMap = new Map();

  for (const row of rows) {
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
    tableMap.get(key).columns.push({
      original: column,
      lower: column.toLowerCase(),
    });
  }

  return Array.from(tableMap.values());
}

async function loadTableMetadata(prisma) {
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
      metadataCache.tables = groupTableMetadata(rows ?? []);
      return metadataCache.tables;
    })
    .catch((error) => {
      metadataCache.promise = null;
      throw error;
    });

  return metadataCache.promise;
}

function findColumn(table, patterns, exclude = new Set()) {
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

function computeScore(table, { keywords = [], hasShare = false, hasScope = false, hasLcp = false, hasCount = false } = {}) {
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
  score += table.columns.length * 0.02;

  return score;
}

async function resolveDeviceTable(prisma) {
  if (deviceTableCache !== undefined) {
    return deviceTableCache;
  }

  try {
    const tables = await loadTableMetadata(prisma);
    let bestMatch = null;
    let bestScore = -Infinity;

    for (const table of tables) {
      const deviceColumn = findColumn(table, DEVICE_PATTERNS);
      if (!deviceColumn) continue;

      const sessionsColumn = findColumn(table, SESSION_PATTERNS, new Set([deviceColumn.original]));
      if (!sessionsColumn) continue;

      const exclude = new Set([deviceColumn.original, sessionsColumn.original]);
      const loadColumn = findColumn(table, LOAD_PATTERNS, exclude);
      if (!loadColumn) continue;

      const shareColumn = findColumn(table, SHARE_PATTERNS, new Set([deviceColumn.original, sessionsColumn.original, loadColumn.original]));
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

    deviceTableCache = bestMatch ?? null;
  } catch (error) {
    deviceTableCache = null;
    throw error;
  }

  return deviceTableCache;
}

async function resolvePageTable(prisma) {
  if (pageTableCache !== undefined) {
    return pageTableCache;
  }

  try {
    const tables = await loadTableMetadata(prisma);
    let bestMatch = null;
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

      let countColumn = findColumn(table, COUNT_PATTERNS, exclude);
      if (countColumn && countColumn.original === loadColumn.original) {
        countColumn = null;
      }

      const score = computeScore(table, {
        keywords: ["page", "performance", "analytics", "load", "speed", "metrics"],
        hasScope: Boolean(scopeColumn),
        hasLcp: Boolean(lcpColumn),
        hasCount: Boolean(countColumn),
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
            count: countColumn ? countColumn.original : null,
          },
        };
      }
    }

    pageTableCache = bestMatch ?? null;
  } catch (error) {
    pageTableCache = null;
    throw error;
  }

  return pageTableCache;
}

function toNumber(value) {
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
    if (typeof value.toNumber === "function") {
      try {
        return value.toNumber();
      } catch {
        return NaN;
      }
    }
    if (typeof value.valueOf === "function") {
      const raw = value.valueOf();
      if (typeof raw === "number") return raw;
      if (typeof raw === "bigint") return Number(raw);
    }
    if (typeof value.toString === "function") {
      const parsed = Number(value.toString());
      return Number.isFinite(parsed) ? parsed : NaN;
    }
  }
  return NaN;
}

function clampNumber(value, min, max) {
  if (!Number.isFinite(value)) {
    return min;
  }
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function normalizeDurationToMs(value) {
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

function normalizeDeviceKey(value) {
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
  if (lower.includes("konsole") || lower.includes("console") || lower.includes("xbox") || lower.includes("playstation")) {
    return "console";
  }
  if (lower.includes("watch") || lower.includes("wearable")) {
    return "wearable";
  }
  if (lower.includes("sonst") || lower.includes("other") || lower.includes("unknown") || lower.includes("unbekannt")) {
    return "other";
  }
  return lower.replace(/\s+/g, "_");
}

function deviceDisplayName(key) {
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

function normalizePath(value) {
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

function normalizeScope(value, path) {
  if (value && value !== 0) {
    const lower = String(value).trim().toLowerCase();
    if (lower.includes("member") || lower.includes("intern") || lower.includes("protected") || lower.includes("mitglieder")) {
      return "members";
    }
    if (lower.includes("public") || lower.includes("extern") || lower.includes("marketing") || lower.includes("landing")) {
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

async function loadDeviceMetricsFromDedicatedView(prisma) {
  try {
    const rows = await prisma.$queryRawUnsafe(
      "SELECT device, sessions, avg_load, share FROM analytics_device_metrics",
    );
    if (!Array.isArray(rows)) {
      return [];
    }

    const buckets = [];
    let totalSessions = 0;

    for (const row of rows) {
      const deviceKey = normalizeDeviceKey(row?.device ?? row?.DEVICE ?? row?.device_key);
      const sessions = Math.max(0, Math.round(toNumber(row?.sessions ?? row?.SESSIONS ?? row?.count)));
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
      avgPageLoadMs: Math.max(0, Math.round(bucket.avgLoadMs ?? 0)),
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

async function loadPageMetricsFromDedicatedView(prisma) {
  try {
    const rows = await prisma.$queryRawUnsafe(
      "SELECT path, scope, avg_load, lcp, weight FROM analytics_page_metrics",
    );
    if (!Array.isArray(rows)) {
      return [];
    }

    const metrics = [];

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

      metrics.push({
        path: normalizedPath,
        avgPageLoadMs: Math.max(0, Math.round(avgLoadMs)),
        lcpMs: lcpMsRaw > 0 ? Math.max(0, Math.round(lcpMsRaw)) : null,
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

export async function loadDeviceBreakdownFromDatabase() {
  const prisma = getAnalyticsPrisma();
  if (!prisma) {
    return null;
  }

  const dedicated = await loadDeviceMetricsFromDedicatedView(prisma);
  if (dedicated !== null) {
    return dedicated;
  }

  const match = await resolveDeviceTable(prisma).catch((error) => {
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

  let rows;
  try {
    rows = await prisma.$queryRawUnsafe(query);
  } catch (error) {
    console.error("[server-analytics] Failed to load device statistics", error);
    return null;
  }

  const buckets = new Map();

  for (const row of rows ?? []) {
    const deviceKey = normalizeDeviceKey(row.device ?? row.DEVICE ?? row.Device);
    if (!deviceKey) continue;

    const sessions = Math.max(0, Math.round(toNumber(row.sessions ?? row.SESSIONS ?? row.session_count)));
    if (!Number.isFinite(sessions) || sessions <= 0) continue;

    const loadMs = normalizeDurationToMs(row.avg_load ?? row.AVG_LOAD ?? row.avg_load_ms ?? row.average_load);

    if (!buckets.has(deviceKey)) {
      buckets.set(deviceKey, {
        key: deviceKey,
        device: deviceDisplayName(deviceKey),
        sessions: 0,
        weightedLoad: 0,
      });
    }
    const bucket = buckets.get(deviceKey);
    bucket.sessions += sessions;
    bucket.weightedLoad += loadMs * sessions;
  }

  const totals = Array.from(buckets.values());
  const totalSessions = totals.reduce((sum, entry) => sum + (Number.isFinite(entry.sessions) ? entry.sessions : 0), 0);
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

export async function loadPagePerformanceMetrics() {
  const prisma = getAnalyticsPrisma();
  if (!prisma) {
    return [];
  }

  const dedicated = await loadPageMetricsFromDedicatedView(prisma);
  if (dedicated !== null) {
    return dedicated;
  }

  const match = await resolvePageTable(prisma).catch((error) => {
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
  if (match.columns.count) {
    selectParts.push(`${quoteIdentifier(match.columns.count)} AS weight`);
  }

  const query = `SELECT ${selectParts.join(", ")} FROM ${formatTableName(match.schema, match.table)}`;

  let rows;
  try {
    rows = await prisma.$queryRawUnsafe(query);
  } catch (error) {
    console.error("[server-analytics] Failed to load page performance metrics", error);
    return [];
  }

  const aggregated = new Map();

  for (const row of rows ?? []) {
    const normalizedPath = normalizePath(row.path ?? row.PAGE ?? row.url);
    if (!normalizedPath) continue;

    const loadMs = normalizeDurationToMs(row.avg_load ?? row.load ?? row.avg_load_ms ?? row.average_load);
    if (!Number.isFinite(loadMs) || loadMs <= 0) continue;

    const scope = match.columns.scope ? normalizeScope(row.scope, normalizedPath) : normalizeScope(null, normalizedPath);

    let weight = 1;
    if (match.columns.count) {
      const parsedWeight = Math.max(0, Math.round(toNumber(row.weight)));
      if (Number.isFinite(parsedWeight) && parsedWeight > 0) {
        weight = parsedWeight;
      }
    }

    let lcpMs = null;
    if (match.columns.lcp) {
      const parsedLcp = normalizeDurationToMs(row.lcp ?? row.LCP ?? row.lcp_ms ?? row.largest_contentful_paint);
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
      });
    }

    const bucket = aggregated.get(key);
    bucket.totalWeight += weight;
    bucket.totalLoad += loadMs * weight;
    if (lcpMs !== null) {
      bucket.totalLcp += lcpMs * weight;
      bucket.lcpWeight += weight;
    }
  }

  const result = [];

  for (const bucket of aggregated.values()) {
    if (!Number.isFinite(bucket.totalWeight) || bucket.totalWeight <= 0) continue;
    const avgLoad = bucket.totalLoad / bucket.totalWeight;
    const avgLcp = bucket.lcpWeight > 0 ? bucket.totalLcp / bucket.lcpWeight : null;
    result.push({
      path: bucket.path,
      avgPageLoadMs: Math.max(0, Math.round(avgLoad)),
      lcpMs: avgLcp !== null ? Math.max(0, Math.round(avgLcp)) : null,
      scope: bucket.scope,
      weight: bucket.totalWeight,
    });
  }

  return result;
}

export function mergeDeviceBreakdown(base, overrides) {
  const result = [];
  const overrideMap = new Map();
  const orderedOverrides = [];

  if (Array.isArray(overrides)) {
    for (const entry of overrides) {
      const key = normalizeDeviceKey(entry?.device);
      if (!key) continue;
      const normalized = {
        device: deviceDisplayName(key),
        sessions: Math.max(0, Math.round(Number(entry.sessions ?? 0))),
        avgPageLoadMs: Math.max(0, Math.round(Number(entry.avgPageLoadMs ?? 0))),
        share: clampNumber(Number(entry.share ?? 0), 0, 1),
      };
      overrideMap.set(key, normalized);
      orderedOverrides.push({ key, data: normalized });
    }
  }

  const usedKeys = new Set();

  if (Array.isArray(base)) {
    for (const entry of base) {
      const key = normalizeDeviceKey(entry?.device);
      if (!key) {
        result.push({ ...entry });
        continue;
      }
      if (overrideMap.has(key)) {
        const override = overrideMap.get(key);
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

  const totalSessions = result.reduce((sum, entry) => sum + (Number.isFinite(entry.sessions) ? entry.sessions : 0), 0);
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

export function applyPagePerformanceMetrics(baseEntries, overrides, scope) {
  const normalizedOverrides = new Map();

  if (Array.isArray(overrides)) {
    for (const entry of overrides) {
      const normalizedPath = normalizePath(entry?.path);
      if (!normalizedPath) continue;
      const normalizedScope = entry?.scope === "members" || entry?.scope === "public" ? entry.scope : null;
      const scopeKey = normalizedScope ?? "all";
      if (!normalizedOverrides.has(normalizedPath)) {
        normalizedOverrides.set(normalizedPath, new Map());
      }
      normalizedOverrides.get(normalizedPath).set(scopeKey, {
        path: normalizedPath,
        avgPageLoadMs: Math.max(0, Math.round(Number(entry.avgPageLoadMs ?? entry.loadTimeMs ?? 0))),
        lcpMs:
          entry.lcpMs === null || entry.lcpMs === undefined
            ? null
            : Math.max(0, Math.round(Number(entry.lcpMs))),
      });
    }
  }

  const result = [];

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

    const updates = {};
    if (Number.isFinite(override.avgPageLoadMs) && override.avgPageLoadMs > 0) {
      updates.loadTimeMs = override.avgPageLoadMs;
    }
    if (override.lcpMs !== null && override.lcpMs !== undefined && Number.isFinite(override.lcpMs)) {
      updates.lcpMs = override.lcpMs;
    }

    result.push({ ...entry, ...updates });
  }

  return result;
}

export function resetAnalyticsMetadataCache() {
  metadataCache.tables = null;
  metadataCache.promise = null;
  deviceTableCache = undefined;
  pageTableCache = undefined;
}
