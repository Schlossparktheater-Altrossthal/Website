import crypto from "node:crypto";

import { Prisma } from "@prisma/client";
import type { AnalyticsServerLog, AnalyticsServerLogSeverity, AnalyticsServerLogStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export type StructuredLogSeverity = AnalyticsServerLogSeverity;
export type StructuredLogStatus = AnalyticsServerLogStatus;

export type StructuredLogMetadata = Record<string, unknown> & {
  fingerprint?: unknown;
  timestamp?: unknown;
  description?: unknown;
  tags?: unknown;
  status?: unknown;
  recommendedAction?: unknown;
  affectedUsers?: unknown;
  occurrences?: unknown;
};

export type StructuredLogEvent = {
  severity: StructuredLogSeverity;
  service: string;
  message: string;
  metadata?: StructuredLogMetadata;
};

type NormalizedLogEvent = {
  severity: StructuredLogSeverity;
  service: string;
  message: string;
  description?: string;
  tags: string[];
  status?: StructuredLogStatus;
  recommendedAction?: string;
  affectedUsers?: number;
  occurrences: number;
  metadata: Record<string, unknown> | null;
  fingerprint: string;
  timestamp: Date;
};

const SEVERITY_WEIGHT: Record<StructuredLogSeverity, number> = {
  info: 1,
  warning: 2,
  error: 3,
};

function isValidStatus(value: unknown): value is StructuredLogStatus {
  return value === "open" || value === "monitoring" || value === "resolved";
}

function sanitizeTimestamp(value: unknown): Date {
  if (value instanceof Date && Number.isFinite(value.getTime())) {
    return value;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    const parsed = new Date(value);
    if (Number.isFinite(parsed.getTime())) {
      return parsed;
    }
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = new Date(value);
    if (Number.isFinite(parsed.getTime())) {
      return parsed;
    }
  }

  return new Date();
}

function sanitizeTags(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const tags = value
    .filter((tag): tag is string => typeof tag === "string" && tag.trim().length > 0)
    .map((tag) => tag.trim());

  return Array.from(new Set(tags)).slice(0, 12);
}

function sanitizeNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }

  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return undefined;
}

function sanitizeOccurrences(value: unknown): number {
  const parsed = sanitizeNumber(value);
  if (!parsed || parsed < 1) {
    return 1;
  }

  return parsed;
}

function sanitizeDescription(value: unknown): string | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  return undefined;
}

function sanitizeMetadataContext(value: Record<string, unknown>): Record<string, unknown> | null {
  const entries = Object.entries(value);
  if (entries.length === 0) {
    return null;
  }

  const result: Record<string, unknown> = {};

  for (const [key, rawValue] of entries) {
    if (rawValue === undefined) {
      continue;
    }

    if (rawValue === null || typeof rawValue === "string" || typeof rawValue === "boolean") {
      result[key] = rawValue;
      continue;
    }

    if (typeof rawValue === "number") {
      result[key] = Number.isFinite(rawValue) ? rawValue : null;
      continue;
    }

    if (rawValue instanceof Date) {
      result[key] = rawValue.toISOString();
      continue;
    }

    if (Array.isArray(rawValue)) {
      const sanitizedArray = rawValue
        .map((item) => {
          if (item === undefined) return undefined;
          if (item === null || typeof item === "string" || typeof item === "boolean") return item;
          if (typeof item === "number") return Number.isFinite(item) ? item : null;
          if (item instanceof Date) return item.toISOString();
          if (typeof item === "object") {
            return sanitizeMetadataContext(item as Record<string, unknown>);
          }
          return String(item);
        })
        .filter((item) => item !== undefined);

      result[key] = sanitizedArray;
      continue;
    }

    if (typeof rawValue === "object") {
      result[key] = sanitizeMetadataContext(rawValue as Record<string, unknown>);
      continue;
    }

    result[key] = String(rawValue);
  }

  return Object.keys(result).length > 0 ? result : null;
}

function normalizeEvent(event: StructuredLogEvent): NormalizedLogEvent {
  const service = event.service.trim() || "application";
  const message = event.message.trim() || "(empty message)";
  const metadata = event.metadata ?? {};

  const {
    fingerprint: fingerprintValue,
    timestamp: timestampValue,
    description: descriptionValue,
    tags: tagsValue,
    status: statusValue,
    recommendedAction: recommendedActionValue,
    affectedUsers: affectedUsersValue,
    occurrences: occurrencesValue,
    ...context
  } = metadata;

  const description = sanitizeDescription(descriptionValue);
  const timestamp = sanitizeTimestamp(timestampValue);
  const tags = sanitizeTags(tagsValue);
  const status = isValidStatus(statusValue) ? statusValue : undefined;
  const recommendedAction = sanitizeDescription(recommendedActionValue);
  const affectedUsers = sanitizeNumber(affectedUsersValue);
  const occurrences = sanitizeOccurrences(occurrencesValue);

  const sanitizedContext = sanitizeMetadataContext(context);
  const fingerprintSource =
    typeof fingerprintValue === "string" && fingerprintValue.trim().length > 0
      ? fingerprintValue.trim()
      : `${service}|${message}|${description ?? ""}|${JSON.stringify(sanitizedContext ?? {})}|${tags.join(",")}`;

  const fingerprint = crypto.createHash("sha256").update(fingerprintSource).digest("hex");

  return {
    severity: event.severity,
    service,
    message,
    description,
    tags,
    status,
    recommendedAction,
    affectedUsers,
    occurrences,
    metadata: sanitizedContext,
    fingerprint,
    timestamp,
  };
}

function mergeMetadata(
  existing: Prisma.JsonValue | null | undefined,
  nextMetadata: Record<string, unknown> | null,
): Prisma.NullableJsonNullValueInput | Prisma.InputJsonValue {
  if (!nextMetadata || Object.keys(nextMetadata).length === 0) {
    if (existing === null || existing === undefined) {
      return Prisma.JsonNull;
    }
    return existing as Prisma.InputJsonValue;
  }

  if (!existing || typeof existing !== "object" || Array.isArray(existing)) {
    return nextMetadata as Prisma.InputJsonValue;
  }

  const merged: Record<string, unknown> = { ...(existing as Record<string, unknown>) };
  for (const [key, value] of Object.entries(nextMetadata)) {
    merged[key] = value;
  }
  return merged as Prisma.InputJsonValue;
}

function mergeTags(existing: string[] | null | undefined, next: string[]): string[] {
  const tagSet = new Set<string>();
  for (const tag of existing ?? []) {
    if (typeof tag === "string" && tag.trim().length > 0) {
      tagSet.add(tag.trim());
    }
  }
  for (const tag of next) {
    tagSet.add(tag);
  }
  return Array.from(tagSet).slice(0, 16);
}

async function persistLogEvent(event: NormalizedLogEvent) {
  if (!process.env.DATABASE_URL) {
    return;
  }

  try {
    await prisma.$transaction(async (tx) => {
      const existing = await tx.analyticsServerLog.findUnique({
        where: { fingerprint: event.fingerprint },
      });

      if (existing) {
        const severityWeightExisting = SEVERITY_WEIGHT[existing.severity as StructuredLogSeverity] ?? 0;
        const severityWeightNext = SEVERITY_WEIGHT[event.severity];
        const severity: StructuredLogSeverity =
          severityWeightNext >= severityWeightExisting ? event.severity : (existing.severity as StructuredLogSeverity);

        const nextLastSeenAt = event.timestamp > existing.lastSeenAt ? event.timestamp : existing.lastSeenAt;

        const nextStatus = event.status ?? (existing.status as StructuredLogStatus);
        const nextDescription = event.description ?? existing.description ?? undefined;
        const nextRecommendedAction = event.recommendedAction ?? existing.recommendedAction ?? undefined;
        const nextAffectedUsers =
          event.affectedUsers ?? (typeof existing.affectedUsers === "number" ? existing.affectedUsers : undefined);

        await tx.analyticsServerLog.update({
          where: { id: existing.id },
          data: {
            severity,
            service: event.service,
            message: event.message,
            description: nextDescription ?? null,
            recommendedAction: nextRecommendedAction ?? null,
            affectedUsers: typeof nextAffectedUsers === "number" ? nextAffectedUsers : null,
            status: nextStatus,
            tags: mergeTags(existing.tags, event.tags),
            metadata: mergeMetadata(existing.metadata, event.metadata),
            occurrences: { increment: event.occurrences },
            lastSeenAt: nextLastSeenAt,
          },
        });
      } else {
        await tx.analyticsServerLog.create({
          data: {
            severity: event.severity,
            service: event.service,
            message: event.message,
            description: event.description ?? null,
            recommendedAction: event.recommendedAction ?? null,
            affectedUsers: typeof event.affectedUsers === "number" ? event.affectedUsers : null,
            status: event.status ?? "open",
            tags: event.tags,
            metadata: event.metadata ? (event.metadata as Prisma.InputJsonValue) : Prisma.JsonNull,
            occurrences: event.occurrences,
            firstSeenAt: event.timestamp,
            lastSeenAt: event.timestamp,
            fingerprint: event.fingerprint,
          },
        });
      }
    });
  } catch (error) {
    console.error("[logger] Failed to persist structured log event", error);
  }
}

export async function logStructuredEvent(event: StructuredLogEvent): Promise<void> {
  const normalized = normalizeEvent(event);

  const consolePayload = {
    timestamp: normalized.timestamp.toISOString(),
    severity: normalized.severity,
    service: normalized.service,
    message: normalized.message,
    metadata: {
      description: normalized.description,
      tags: normalized.tags,
      status: normalized.status,
      recommendedAction: normalized.recommendedAction,
      affectedUsers: normalized.affectedUsers,
      occurrences: normalized.occurrences,
      context: normalized.metadata,
    },
  };

  console.log(JSON.stringify(consolePayload));

  await persistLogEvent(normalized);
}

export function createLogger(service: string) {
  const normalizedService = service.trim() || "application";
  return {
    info(message: string, metadata?: StructuredLogMetadata) {
      return logStructuredEvent({ severity: "info", service: normalizedService, message, metadata });
    },
    warn(message: string, metadata?: StructuredLogMetadata) {
      return logStructuredEvent({ severity: "warning", service: normalizedService, message, metadata });
    },
    error(message: string, metadata?: StructuredLogMetadata) {
      return logStructuredEvent({ severity: "error", service: normalizedService, message, metadata });
    },
  };
}

export type PersistedServerLog = AnalyticsServerLog;
