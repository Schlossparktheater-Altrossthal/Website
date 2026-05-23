"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  loadLatestCriticalServerLogs,
  updateServerLogStatus,
  type LoadedServerLog,
  type ServerLogStatus,
} from "@/lib/analytics/load-server-logs";
import { collectServerAnalytics } from "@/lib/server-analytics";
import { resetAnalyticsMetadataCache } from "@/lib/server-analytics-data";
import {
  SERVER_ANALYTICS_SETTINGS_LIMITS,
  saveServerAnalyticsSettings,
  type ServerAnalyticsSettings,
} from "@/lib/server-analytics-settings";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { requireAuth } from "@/lib/rbac";

const statusSchema = z.enum(["open", "monitoring", "resolved"] satisfies readonly ServerLogStatus[]);

const updateStatusSchema = z.object({
  logId: z.string().min(1, "Log-ID erforderlich"),
  status: statusSchema,
});

const settingsLimits = SERVER_ANALYTICS_SETTINGS_LIMITS;

const updateSettingsSchema = z.object({
  httpWindowMinutes: z
    .coerce
    .number()
    .int()
    .min(settingsLimits.httpWindowMinutes.min, "Mindestens 5 Minuten")
    .max(settingsLimits.httpWindowMinutes.max, "Maximal 7 Tage"),
  httpBucketMinutes: z
    .coerce
    .number()
    .int()
    .min(settingsLimits.httpBucketMinutes.min, "Mindestens 1 Minute")
    .max(settingsLimits.httpBucketMinutes.max, "Maximal 24 Stunden"),
  sessionWindowDays: z
    .coerce
    .number()
    .int()
    .min(settingsLimits.sessionWindowDays.min, "Mindestens 1 Tag")
    .max(settingsLimits.sessionWindowDays.max, "Maximal 365 Tage"),
  sessionRetentionDays: z
    .coerce
    .number()
    .int()
    .min(settingsLimits.sessionRetentionDays.min, "Mindestens 1 Tag")
    .max(settingsLimits.sessionRetentionDays.max, "Maximal 365 Tage"),
  realtimeWindowHours: z
    .coerce
    .number()
    .int()
    .min(settingsLimits.realtimeWindowHours.min, "Mindestens 1 Stunde")
    .max(settingsLimits.realtimeWindowHours.max, "Maximal 168 Stunden"),
  pageWindowDays: z
    .coerce
    .number()
    .int()
    .min(settingsLimits.pageWindowDays.min, "Mindestens 1 Tag")
    .max(settingsLimits.pageWindowDays.max, "Maximal 365 Tage"),
  pageRetentionDays: z
    .coerce
    .number()
    .int()
    .min(settingsLimits.pageRetentionDays.min, "Mindestens 1 Tag")
    .max(settingsLimits.pageRetentionDays.max, "Maximal 365 Tage"),
});

export type UpdateServerLogStatusInput = z.infer<typeof updateStatusSchema>;

export type UpdateServerLogStatusResult =
  | { success: true; log: LoadedServerLog }
  | { success: false; error: string };

export type UpdateServerAnalyticsSettingsInput = z.infer<typeof updateSettingsSchema>;

export type UpdateServerAnalyticsSettingsResult =
  | {
      success: true;
      settings: ServerAnalyticsSettings;
      analytics: Awaited<ReturnType<typeof collectServerAnalytics>>;
    }
  | {
      success: false;
      error: "not_authorized" | "no_database" | "validation_failed" | "update_failed";
      fieldErrors?: Record<string, string[]>;
    };

function hasOwnerRole(user: { role?: string | null; roles?: unknown } | null | undefined): boolean {
  if (!user) {
    return false;
  }

  if (user.role === "owner") {
    return true;
  }

  if (Array.isArray(user.roles)) {
    return user.roles.some((role) => {
      if (typeof role === "string") {
        return role === "owner";
      }
      if (role && typeof role === "object" && "role" in role) {
        return (role as { role?: string }).role === "owner";
      }
      return false;
    });
  }

  return false;
}

export async function updateServerLogStatusAction(
  input: UpdateServerLogStatusInput,
): Promise<UpdateServerLogStatusResult> {
  const session = await requireAuth();
  const allowed = await hasPermission(session.user, "PRIVATE.ADMIN.SERVER.ANALYTICS");
  if (!allowed) {
    return { success: false, error: "not_authorized" };
  }

  const parsed = updateStatusSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "validation_failed" };
  }

  try {
    const updated = await updateServerLogStatus(parsed.data.logId, parsed.data.status);
    revalidatePath("/mitglieder/server-analytics");

    return { success: true, log: updated };
  } catch (error) {
    console.error("[server-analytics] Failed to update server log status", error);
    return { success: false, error: "update_failed" };
  }
}

export async function reloadCriticalServerLogs(): Promise<LoadedServerLog[]> {
  const session = await requireAuth();
  const allowed = await hasPermission(session.user, "PRIVATE.ADMIN.SERVER.ANALYTICS");
  if (!allowed) {
    return [];
  }

  return loadLatestCriticalServerLogs({ limit: 25 });
}

type ResetServerAnalyticsError = "not_authorized" | "no_database" | "reset_failed";

export type ResetServerAnalyticsResult =
  | { success: true; analytics: Awaited<ReturnType<typeof collectServerAnalytics>> }
  | { success: false; error: ResetServerAnalyticsError };

export async function updateServerAnalyticsSettingsAction(
  input: UpdateServerAnalyticsSettingsInput,
): Promise<UpdateServerAnalyticsSettingsResult> {
  const session = await requireAuth();
  const allowed = await hasPermission(session.user, "PRIVATE.ADMIN.SERVER.ANALYTICS");
  if (!allowed || !hasOwnerRole(session.user)) {
    return { success: false, error: "not_authorized" };
  }

  if (!process.env.DATABASE_URL) {
    return { success: false, error: "no_database" };
  }

  const parsed = updateSettingsSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    return { success: false, error: "validation_failed", fieldErrors };
  }

  try {
    const settings = await saveServerAnalyticsSettings(parsed.data, prisma);
    resetAnalyticsMetadataCache();
    revalidatePath("/mitglieder/server-analytics");
    const analytics = await collectServerAnalytics();
    return { success: true, settings, analytics };
  } catch (error) {
    console.error("[server-analytics] Failed to update analytics settings", error);
    return { success: false, error: "update_failed" };
  }
}

export async function resetServerAnalyticsAction(): Promise<ResetServerAnalyticsResult> {
  const session = await requireAuth();
  const allowed = await hasPermission(session.user, "PRIVATE.ADMIN.SERVER.ANALYTICS");
  if (!allowed || !hasOwnerRole(session.user)) {
    return { success: false, error: "not_authorized" };
  }

  if (!process.env.DATABASE_URL) {
    return { success: false, error: "no_database" };
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.analyticsHttpRequest.deleteMany();
      await tx.analyticsUptimeHeartbeat.deleteMany();
      await tx.analyticsRealtimeEvent.deleteMany();
      await tx.analyticsHttpSummary.deleteMany();
      await tx.analyticsHttpPeakHour.deleteMany();
      await tx.analyticsPageMetric.deleteMany();
      await tx.analyticsDeviceMetric.deleteMany();
      await tx.analyticsSessionInsight.deleteMany();
      await tx.analyticsTrafficSource.deleteMany();
      await tx.analyticsRealtimeSummary.deleteMany();
      await tx.analyticsSessionSummary.deleteMany();
      await tx.analyticsServerLog.deleteMany();
      await tx.analyticsPageView.deleteMany();
      await tx.analyticsDeviceSnapshot.deleteMany();
      await tx.analyticsTrafficAttribution.deleteMany();
      await tx.analyticsSession.deleteMany();
    });

    resetAnalyticsMetadataCache();
    revalidatePath("/mitglieder/server-analytics");

    const analytics = await collectServerAnalytics();
    return { success: true, analytics };
  } catch (error) {
    console.error("[server-analytics] Failed to reset analytics data", error);
    return { success: false, error: "reset_failed" };
  }
}
