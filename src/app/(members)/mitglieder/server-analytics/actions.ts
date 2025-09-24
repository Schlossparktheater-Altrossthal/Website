"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  loadLatestCriticalServerLogs,
  updateServerLogStatus,
  type LoadedServerLog,
  type ServerLogStatus,
} from "@/lib/analytics/load-server-logs";
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
