import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";

type Scope = "public" | "members" | null;

const deviceSchema = z.object({
  userAgent: z.string().trim().min(1).max(1024),
  deviceHint: z.string().trim().min(1).max(120).optional().nullable(),
  platform: z.string().trim().min(1).max(120).optional().nullable(),
  hardwareConcurrency: z.number().int().positive().max(4096).optional(),
  deviceMemoryGb: z.number().positive().max(1024).optional(),
  touchSupport: z.number().int().nonnegative().max(64).optional(),
  reducedMotion: z.boolean().optional(),
  prefersDarkMode: z.boolean().optional(),
  colorSchemePreference: z.string().trim().min(1).max(32).optional().nullable(),
  connection: z
    .object({
      type: z.string().trim().min(1).max(48).optional(),
      effectiveType: z.string().trim().min(1).max(48).optional(),
      rttMs: z.number().nonnegative().max(120_000).optional(),
      downlinkMbps: z.number().nonnegative().max(10_000).optional(),
    })
    .partial()
    .optional()
    .nullable(),
  viewport: z
    .object({
      width: z.number().int().nonnegative().max(20_000).optional(),
      height: z.number().int().nonnegative().max(20_000).optional(),
      pixelRatio: z.number().positive().max(48).optional(),
    })
    .partial()
    .optional()
    .nullable(),
  language: z.string().trim().min(1).max(48).optional().nullable(),
  timezone: z.string().trim().min(1).max(96).optional().nullable(),
});

const metricsSchema = z
  .object({
    loadTime: z.number().nonnegative().max(900_000).optional().nullable(),
    lcp: z.number().nonnegative().max(900_000).optional().nullable(),
  })
  .refine((value) => {
    const hasLoad = typeof value.loadTime === "number" && value.loadTime > 0;
    const hasLcp = typeof value.lcp === "number" && value.lcp > 0;
    return hasLoad || hasLcp;
  }, "At least one metric must be provided");

const payloadSchema = z.object({
  sessionId: z.string().trim().min(3).max(64),
  path: z.string().trim().min(1).max(512),
  scope: z.enum(["public", "members"]).optional().nullable(),
  weight: z.number().int().positive().max(100_000).optional(),
  metrics: metricsSchema,
  device: deviceSchema,
});

function normalizePath(rawPath: string): string {
  let path = rawPath.trim();
  if (!path) {
    return "/";
  }
  try {
    const url = new URL(path, "http://localhost");
    path = url.pathname || path;
  } catch {
    // ignore
  }
  path = path.split("?")[0] ?? path;
  path = path.split("#")[0] ?? path;
  if (!path.startsWith("/")) {
    path = `/${path}`;
  }
  path = path.replace(/\\+/g, "/");
  if (path.length > 1 && path.endsWith("/")) {
    path = path.slice(0, -1);
  }
  path = path.replace(/\\index$/i, "/");
  return path || "/";
}

function inferScope(path: string, provided: Scope): Scope {
  if (provided === "public" || provided === "members") {
    return provided;
  }
  const lower = path.toLowerCase();
  if (lower.startsWith("/mitglieder") || lower.startsWith("/members")) {
    return "members";
  }
  return "public";
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function normalizeDurationMs(value: number | null | undefined): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return null;
  }
  const rounded = Math.round(value);
  if (rounded <= 0) {
    return null;
  }
  return clamp(rounded, 0, 900_000);
}

function sanitizeDeviceHint(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const trimmed = value.trim().slice(0, 120);
  if (!trimmed) {
    return null;
  }
  return trimmed.toLowerCase();
}

function sanitizeString(value: string | null | undefined, max = 255): string | null {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  return trimmed.slice(0, max);
}

export async function POST(request: NextRequest) {
  let parsed: z.infer<typeof payloadSchema>;
  try {
    const json = await request.json();
    parsed = payloadSchema.parse(json);
  } catch (error) {
    return NextResponse.json(
      { error: "Invalid analytics payload" },
      { status: error instanceof z.ZodError ? 400 : 422 },
    );
  }

  const path = normalizePath(parsed.path);
  const scope = inferScope(path, parsed.scope ?? null);
  const loadTimeMs = normalizeDurationMs(parsed.metrics.loadTime);
  const lcpMs = normalizeDurationMs(parsed.metrics.lcp);
  const weight = clamp(Math.round(parsed.weight ?? 1), 1, 10_000);
  const now = new Date();

  const pageViewData = {
    sessionId: parsed.sessionId,
    path,
    scope,
    userAgent: parsed.device.userAgent,
    deviceHint: sanitizeDeviceHint(parsed.device.deviceHint),
    lcpMs,
    loadTimeMs,
    weight,
    createdAt: now,
  } as const;

  const connection = parsed.device.connection ?? null;
  const viewport = parsed.device.viewport ?? null;

  const deviceSnapshotData = {
    sessionId: parsed.sessionId,
    deviceHint: sanitizeDeviceHint(parsed.device.deviceHint),
    userAgent: parsed.device.userAgent,
    platform: sanitizeString(parsed.device.platform, 120),
    hardwareConcurrency: parsed.device.hardwareConcurrency ?? null,
    deviceMemoryGb: parsed.device.deviceMemoryGb ?? null,
    touchSupport: parsed.device.touchSupport ?? null,
    reducedMotion: parsed.device.reducedMotion ?? null,
    prefersDarkMode: parsed.device.prefersDarkMode ?? null,
    colorScheme: sanitizeString(parsed.device.colorSchemePreference, 32),
    connectionType: sanitizeString(connection?.type ?? null, 48),
    connectionEffectiveType: sanitizeString(connection?.effectiveType ?? null, 48),
    connectionRttMs: connection?.rttMs ?? null,
    connectionDownlinkMbps: connection?.downlinkMbps ?? null,
    viewportWidth: viewport?.width ?? null,
    viewportHeight: viewport?.height ?? null,
    pixelRatio: viewport?.pixelRatio ?? null,
    language: sanitizeString(parsed.device.language, 48),
    timezone: sanitizeString(parsed.device.timezone, 96),
    createdAt: now,
  } as const;

  try {
    await prisma.$transaction(async (tx) => {
      await tx.analyticsPageView.upsert({
        where: { sessionId: parsed.sessionId },
        update: {
          path: pageViewData.path,
          scope: pageViewData.scope,
          userAgent: pageViewData.userAgent,
          deviceHint: pageViewData.deviceHint,
          lcpMs: pageViewData.lcpMs,
          loadTimeMs: pageViewData.loadTimeMs,
          weight: pageViewData.weight,
        },
        create: pageViewData,
      });

      await tx.analyticsDeviceSnapshot.upsert({
        where: { sessionId: parsed.sessionId },
        update: {
          deviceHint: deviceSnapshotData.deviceHint,
          userAgent: deviceSnapshotData.userAgent,
          platform: deviceSnapshotData.platform,
          hardwareConcurrency: deviceSnapshotData.hardwareConcurrency,
          deviceMemoryGb: deviceSnapshotData.deviceMemoryGb,
          touchSupport: deviceSnapshotData.touchSupport,
          reducedMotion: deviceSnapshotData.reducedMotion,
          prefersDarkMode: deviceSnapshotData.prefersDarkMode,
          colorScheme: deviceSnapshotData.colorScheme,
          connectionType: deviceSnapshotData.connectionType,
          connectionEffectiveType: deviceSnapshotData.connectionEffectiveType,
          connectionRttMs: deviceSnapshotData.connectionRttMs,
          connectionDownlinkMbps: deviceSnapshotData.connectionDownlinkMbps,
          viewportWidth: deviceSnapshotData.viewportWidth,
          viewportHeight: deviceSnapshotData.viewportHeight,
          pixelRatio: deviceSnapshotData.pixelRatio,
          language: deviceSnapshotData.language,
          timezone: deviceSnapshotData.timezone,
        },
        create: deviceSnapshotData,
      });
    });
  } catch (error) {
    console.error("[analytics] Failed to persist web vitals", error);
    return NextResponse.json({ error: "Failed to store analytics" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
