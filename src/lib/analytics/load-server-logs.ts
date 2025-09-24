import type {
  AnalyticsServerLog,
  AnalyticsServerLogSeverity,
  AnalyticsServerLogStatus,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";

export type ServerLogSeverity = AnalyticsServerLogSeverity;
export type ServerLogStatus = AnalyticsServerLogStatus;

export type LoadedServerLog = {
  id: string;
  severity: ServerLogSeverity;
  service: string;
  message: string;
  description: string;
  occurrences: number;
  firstSeen: string;
  lastSeen: string;
  status: ServerLogStatus;
  recommendedAction?: string;
  affectedUsers?: number;
  tags: string[];
};

const CRITICAL_SEVERITIES: ServerLogSeverity[] = ["warning", "error"];

function normalizeTags(tags: AnalyticsServerLog["tags"]): string[] {
  if (!Array.isArray(tags)) {
    return [];
  }
  const normalized = tags
    .filter((tag): tag is string => typeof tag === "string" && tag.trim().length > 0)
    .map((tag) => tag.trim());

  return Array.from(new Set(normalized)).slice(0, 16);
}

function mapRowToLoadedLog(row: AnalyticsServerLog): LoadedServerLog {
  const description = typeof row.description === "string" && row.description.trim().length > 0
    ? row.description
    : row.message;
  return {
    id: row.id,
    severity: row.severity,
    service: row.service,
    message: row.message,
    description,
    occurrences: Math.max(1, row.occurrences ?? 1),
    firstSeen: row.firstSeenAt.toISOString(),
    lastSeen: row.lastSeenAt.toISOString(),
    status: row.status,
    recommendedAction: row.recommendedAction ?? undefined,
    affectedUsers: typeof row.affectedUsers === "number" ? row.affectedUsers : undefined,
    tags: normalizeTags(row.tags),
  };
}

export async function loadLatestCriticalServerLogs({
  limit = 20,
  withinHours = 48,
}: {
  limit?: number;
  withinHours?: number;
} = {}): Promise<LoadedServerLog[]> {
  if (!process.env.DATABASE_URL) {
    return [];
  }

  const since = withinHours > 0 ? new Date(Date.now() - withinHours * 60 * 60 * 1000) : undefined;

  const rows = await prisma.analyticsServerLog.findMany({
    where: {
      severity: { in: CRITICAL_SEVERITIES },
      ...(since ? { lastSeenAt: { gte: since } } : {}),
    },
    orderBy: [
      { lastSeenAt: "desc" },
      { occurrences: "desc" },
    ],
    take: Math.max(1, limit),
  });

  return rows.map(mapRowToLoadedLog);
}

export async function updateServerLogStatus(
  logId: string,
  status: ServerLogStatus,
): Promise<LoadedServerLog> {
  if (!process.env.DATABASE_URL) {
    throw new Error("Log store is not configured");
  }

  const updated = await prisma.analyticsServerLog.update({
    where: { id: logId },
    data: { status },
  });

  return mapRowToLoadedLog(updated);
}
