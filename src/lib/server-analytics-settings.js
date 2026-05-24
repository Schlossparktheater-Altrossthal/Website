import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

export { DEFAULT_SERVER_ANALYTICS_SETTINGS, SERVER_ANALYTICS_SETTINGS_LIMITS } from "./server-analytics-settings-constants.js";

const SETTINGS_ID = "default";
const globalForAnalyticsSettings = globalThis;

function cloneDefaultSettings() {
  return JSON.parse(JSON.stringify(DEFAULT_SERVER_ANALYTICS_SETTINGS));
}

function getAnalyticsPrisma(client) {
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
      globalForAnalyticsSettings[poolKey] = new Pool({ connectionString: process.env.DATABASE_URL });
    }
    const adapter = new PrismaPg(globalForAnalyticsSettings[poolKey]);
    globalForAnalyticsSettings[globalKey] = new PrismaClient({
      adapter,
      log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
    });
  }

  return globalForAnalyticsSettings[globalKey];
}

function isTableMissingError(error) {
  if (!error || typeof error !== "object") {
    return false;
  }

  if (error.code === "P2021") {
    return true;
  }

  const cause = error.meta?.cause;
  if (typeof cause === "string" && cause.includes("does not exist")) {
    return true;
  }

  const sqlCode = error.code?.code ?? error.code;
  if (typeof sqlCode === "string" && sqlCode.toUpperCase() === "42P01") {
    return true;
  }

  return false;
}

function normaliseSetting(value, key) {
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

function normaliseSettings(record) {
  const defaults = cloneDefaultSettings();
  if (!record || typeof record !== "object") {
    return defaults;
  }

  return {
    httpWindowMinutes: normaliseSetting(record.httpWindowMinutes, "httpWindowMinutes"),
    httpBucketMinutes: normaliseSetting(record.httpBucketMinutes, "httpBucketMinutes"),
    sessionWindowDays: normaliseSetting(record.sessionWindowDays, "sessionWindowDays"),
    sessionRetentionDays: normaliseSetting(record.sessionRetentionDays, "sessionRetentionDays"),
    realtimeWindowHours: normaliseSetting(record.realtimeWindowHours, "realtimeWindowHours"),
    pageWindowDays: normaliseSetting(record.pageWindowDays, "pageWindowDays"),
    pageRetentionDays: normaliseSetting(record.pageRetentionDays, "pageRetentionDays"),
  };
}

function buildUpdatePayload(input) {
  if (!input || typeof input !== "object") {
    return {};
  }

  const update = {};
  for (const key of Object.keys(SERVER_ANALYTICS_SETTINGS_LIMITS)) {
    if (Object.prototype.hasOwnProperty.call(input, key)) {
      update[key] = normaliseSetting(input[key], key);
    }
  }

  return update;
}

export function getDefaultServerAnalyticsSettings() {
  return cloneDefaultSettings();
}

export async function ensureServerAnalyticsSettings(prisma) {
  return saveServerAnalyticsSettings({}, prisma);
}

export async function loadServerAnalyticsSettings(prisma) {
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

export async function saveServerAnalyticsSettings(input = {}, prisma) {
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
