import type { PrismaClient } from "@prisma/client";

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

export declare const DEFAULT_SERVER_ANALYTICS_SETTINGS: ServerAnalyticsSettings;
export declare const SERVER_ANALYTICS_SETTINGS_LIMITS: {
  httpWindowMinutes: { min: number; max: number };
  httpBucketMinutes: { min: number; max: number };
  sessionWindowDays: { min: number; max: number };
  sessionRetentionDays: { min: number; max: number };
  realtimeWindowHours: { min: number; max: number };
  pageWindowDays: { min: number; max: number };
  pageRetentionDays: { min: number; max: number };
};

export declare function getDefaultServerAnalyticsSettings(): ServerAnalyticsSettings;
export declare function ensureServerAnalyticsSettings(
  prisma?: PrismaClient,
): Promise<ServerAnalyticsSettings>;
export declare function loadServerAnalyticsSettings(
  prisma?: PrismaClient,
): Promise<ServerAnalyticsSettings>;
export declare function saveServerAnalyticsSettings(
  input: ServerAnalyticsSettingsInput,
  prisma?: PrismaClient,
): Promise<ServerAnalyticsSettings>;
