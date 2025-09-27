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
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { requireAuth } from "@/lib/rbac";

const statusSchema = z.enum(["open", "monitoring", "resolved"] satisfies readonly ServerLogStatus[]);

const updateStatusSchema = z.object({
  logId: z.string().min(1, "Log-ID erforderlich"),
  status: statusSchema,
});

export type UpdateServerLogStatusInput = z.infer<typeof updateStatusSchema>;

export type UpdateServerLogStatusResult =
  | { success: true; log: LoadedServerLog }
  | { success: false; error: string };

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
  const allowed = await hasPermission(session.user, "mitglieder.server.analytics");
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
  const allowed = await hasPermission(session.user, "mitglieder.server.analytics");
  if (!allowed) {
    return [];
  }

  return loadLatestCriticalServerLogs({ limit: 25 });
}

type ResetServerAnalyticsError = "not_authorized" | "no_database" | "reset_failed";

export type ResetServerAnalyticsResult =
  | { success: true; analytics: Awaited<ReturnType<typeof collectServerAnalytics>> }
  | { success: false; error: ResetServerAnalyticsError };

export async function resetServerAnalyticsAction(): Promise<ResetServerAnalyticsResult> {
  const session = await requireAuth();
  const allowed = await hasPermission(session.user, "mitglieder.server.analytics");
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
