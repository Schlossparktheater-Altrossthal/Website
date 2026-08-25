import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

import {
  DEFAULT_SERVER_ANALYTICS_SETTINGS,
  SERVER_ANALYTICS_SETTINGS_LIMITS,
} from "./server-analytics-settings-constants";
export { DEFAULT_SERVER_ANALYTICS_SETTINGS, SERVER_ANALYTICS_SETTINGS_LIMITS };

export type ServerAnalyticsSettings = {
  httpWindowMinutes: number;
  httpBucketMinutes: number;
  sessionWindowDays: number;
  sessionRetentionDays: number;
  realtimeWindowHours: number;
  pageWindowDays: number;
  pageRetentionDays: number;
};

export type ServerAnalyticsSettingsInput = Partial<ServerAnalyticsSettings>;

const SETTINGS_ID = "default";
const globalForAnalyticsSettings = globalThis as typeof globalThis & Record<symbol, unknown>;

function cloneDefaultSettings(): ServerAnalyticsSettings {
  return JSON.parse(JSON.stringify(DEFAULT_SERVER_ANALYTICS_SETTINGS)) as ServerAnalyticsSettings;
}

function getAnalyticsPrisma(client?: PrismaClient): PrismaClient | null {
  if (client) {
    return client;
  }

  if (!process.env.DATABASE_URL) {
    return null;
  }

  const globalKey = Symbol.for("__analytics_settings_prisma");
  if (!globalForAnalyticsSettings[globalKey]) {
    const poolKey = Symbol.for("__analytics_settings_pg_pool");
    if (!globalForAnalyticsSettings[poolKey]) {
      globalForAnalyticsSettings[poolKey] = new Pool({
        connectionString: process.env.DATABASE_URL,
      });
    }
    const adapter = new PrismaPg(globalForAnalyticsSettings[poolKey] as Pool);
    globalForAnalyticsSettings[globalKey] = new PrismaClient({
      adapter,
      log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
    });
  }

  return globalForAnalyticsSettings[globalKey] as PrismaClient;
}

function isTableMissingError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const candidate = error as { code?: unknown; meta?: { cause?: unknown } };

  if (candidate.code === "P2021") {
    return true;
  }

  const cause = candidate.meta?.cause;
  if (typeof cause === "string" && cause.includes("does not exist")) {
    return true;
  }

  const sqlCode = (candidate.code as { code?: unknown } | undefined)?.code ?? candidate.code;
  if (typeof sqlCode === "string" && sqlCode.toUpperCase() === "42P01") {
    return true;
  }

  return false;
}

function normaliseSetting(value: unknown, key: keyof ServerAnalyticsSettings): number {
  const defaults = DEFAULT_SERVER_ANALYTICS_SETTINGS;
  const limits = SERVER_ANALYTICS_SETTINGS_LIMITS[key] ?? {};
  const fallback = defaults[key];
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }

  let normalised = Math.round(numeric);
  if (typeof limits.min === "number" && normalised < limits.min) {
    normalised = limits.min;
  }
  if (typeof limits.max === "number" && normalised > limits.max) {
    normalised = limits.max;
  }
  return normalised;
}

function normaliseSettings(record: unknown): ServerAnalyticsSettings {
  const defaults = cloneDefaultSettings();
  if (!record || typeof record !== "object") {
    return defaults;
  }

  const source = record as Record<string, unknown>;
  return {
    httpWindowMinutes: normaliseSetting(source.httpWindowMinutes, "httpWindowMinutes"),
    httpBucketMinutes: normaliseSetting(source.httpBucketMinutes, "httpBucketMinutes"),
    sessionWindowDays: normaliseSetting(source.sessionWindowDays, "sessionWindowDays"),
    sessionRetentionDays: normaliseSetting(source.sessionRetentionDays, "sessionRetentionDays"),
    realtimeWindowHours: normaliseSetting(source.realtimeWindowHours, "realtimeWindowHours"),
    pageWindowDays: normaliseSetting(source.pageWindowDays, "pageWindowDays"),
    pageRetentionDays: normaliseSetting(source.pageRetentionDays, "pageRetentionDays"),
  };
}

function buildUpdatePayload(input: unknown): Record<string, number> {
  if (!input || typeof input !== "object") {
    return {};
  }

  const source = input as Record<string, unknown>;
  const update: Record<string, number> = {};
  for (const key of Object.keys(SERVER_ANALYTICS_SETTINGS_LIMITS)) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      update[key] = normaliseSetting(source[key], key as keyof ServerAnalyticsSettings);
    }
  }

  return update;
}

export function getDefaultServerAnalyticsSettings(): ServerAnalyticsSettings {
  return cloneDefaultSettings();
}

export async function ensureServerAnalyticsSettings(
  prisma?: PrismaClient,
): Promise<ServerAnalyticsSettings> {
  return saveServerAnalyticsSettings({}, prisma);
}

export async function loadServerAnalyticsSettings(
  prisma?: PrismaClient,
): Promise<ServerAnalyticsSettings> {
  const client = getAnalyticsPrisma(prisma);
  if (!client) {
    return cloneDefaultSettings();
  }

  try {
    const record = await client.analyticsSettings.findUnique({ where: { id: SETTINGS_ID } });
    if (!record) {
      const created = await client.analyticsSettings.create({
        data: { id: SETTINGS_ID, ...cloneDefaultSettings() },
      });
      return normaliseSettings(created);
    }
    return normaliseSettings(record);
  } catch (error) {
    if (isTableMissingError(error)) {
      return cloneDefaultSettings();
    }
    throw error;
  }
}

export async function saveServerAnalyticsSettings(
  input: ServerAnalyticsSettingsInput = {},
  prisma?: PrismaClient,
): Promise<ServerAnalyticsSettings> {
  const client = getAnalyticsPrisma(prisma);
  if (!client) {
    return cloneDefaultSettings();
  }

  const update = buildUpdatePayload(input);
  const create = { id: SETTINGS_ID, ...cloneDefaultSettings(), ...update };

  try {
    const record = await client.analyticsSettings.upsert({
      where: { id: SETTINGS_ID },
      create,
      update,
    });
    return normaliseSettings(record);
  } catch (error) {
    if (isTableMissingError(error)) {
      return cloneDefaultSettings();
    }
    throw error;
  }
}
