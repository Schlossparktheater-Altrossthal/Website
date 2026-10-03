import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import {
  buildPerformanceRows,
  DEFAULT_PERFORMANCE_RETENTION_DAYS,
  isLikelyBot,
  performancePayloadSchema,
} from "@/lib/analytics/performance-samples";
import { prisma } from "@/lib/prisma";

// Alte Messungen nur gelegentlich aufräumen statt bei jedem Beacon.
const CLEANUP_PROBABILITY = 0.02;

function resolveRetentionDays(): number {
  const parsed = Number(process.env.ANALYTICS_PERFORMANCE_RETENTION_DAYS);
  return Number.isFinite(parsed) && parsed > 0
    ? Math.round(parsed)
    : DEFAULT_PERFORMANCE_RETENTION_DAYS;
}

export async function POST(request: NextRequest) {
  // Nur angemeldete Mitglieder messen – der Endpunkt ist sonst eine offene Schreibschnittstelle.
  const session = await auth();
  if (!session?.user) {
    return new NextResponse(null, { status: 204 });
  }

  const userAgent = request.headers.get("user-agent");
  if (isLikelyBot(userAgent)) {
    return new NextResponse(null, { status: 204 });
  }

  let payload;
  try {
    payload = performancePayloadSchema.parse(await request.json());
  } catch (error) {
    return NextResponse.json(
      { error: "Ungültige Messdaten" },
      { status: error instanceof z.ZodError ? 400 : 422 },
    );
  }

  const now = new Date();
  try {
    await prisma.analyticsPerformanceSample.createMany({
      data: buildPerformanceRows(payload, userAgent, now),
    });

    if (Math.random() < CLEANUP_PROBABILITY) {
      const cutoff = new Date(now.getTime() - resolveRetentionDays() * 24 * 60 * 60 * 1000);
      await prisma.analyticsPerformanceSample.deleteMany({ where: { createdAt: { lt: cutoff } } });
    }
  } catch (error) {
    console.error("[analytics] Failed to persist performance samples", error);
    return NextResponse.json(
      { error: "Messdaten konnten nicht gespeichert werden" },
      { status: 500 },
    );
  }

  return new NextResponse(null, { status: 204 });
}
