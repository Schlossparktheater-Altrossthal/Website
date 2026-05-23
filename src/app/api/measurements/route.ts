import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { requireAuth } from "@/lib/rbac";
import { measurementSchema } from "@/data/measurements";
import type { MeasurementType as PrismaMeasurementType, MeasurementUnit as PrismaMeasurementUnit } from "@prisma/client";

const measurementRequestSchema = measurementSchema.extend({
  userId: z.string().cuid().optional(),
});

// GET: Hole alle Maße eines Benutzers
export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth();
    const userId = session.user?.id;

    if (!userId) {
      return NextResponse.json(
        { error: "Nicht autorisiert" },
        { status: 401 },
      );
    }

    const canManageAll = await hasPermission(session.user, "PRIVATE.PROFILE.MEASUREMENTS.MANAGE");
    const requestedUserId = request.nextUrl.searchParams.get("userId");
    const targetUserId = requestedUserId ?? userId;

    if (targetUserId !== userId && !canManageAll) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 403 });
    }

    const measurements = await prisma.memberMeasurement.findMany({
      where: { userId: targetUserId },
      orderBy: { type: "asc" },
    });

    return NextResponse.json(measurements);
  } catch (error) {
    console.error("[Measurements] Failed to load measurements", error);
    return NextResponse.json(
      { error: "Nicht autorisiert" },
      { status: 401 },
    );
  }
}

// POST: Füge ein neues Maß hinzu oder aktualisiere ein bestehendes
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    const userId = session.user?.id;

    if (!userId) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }
    const rawPayload = await request.json();
    const payload = {
      ...rawPayload,
      note: typeof rawPayload?.note === "string" ? rawPayload.note : undefined,
    };

    const { userId: overrideUserId, ...data } = measurementRequestSchema.parse(payload);

    const targetUserId = overrideUserId ?? userId;

    if (!targetUserId) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }

    const canManageAll = await hasPermission(session.user, "PRIVATE.PROFILE.MEASUREMENTS.MANAGE");
    if (!canManageAll) {
      return NextResponse.json(
        { error: "Körpermaße können nur im Bereich Körpermaße gepflegt werden." },
        { status: 403 },
      );
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: {
        role: true,
        roles: { select: { role: true } },
        _count: { select: { characterCastings: true } },
      },
    });

    if (!targetUser) {
      return NextResponse.json({ error: "Mitglied nicht gefunden" }, { status: 404 });
    }

    const isTargetInEnsemble =
      targetUser.role === "cast" ||
      targetUser.roles.some((entry) => entry.role === "cast") ||
      targetUser._count.characterCastings > 0;

    if (!isTargetInEnsemble) {
      return NextResponse.json(
        { error: "Körpermaße können nur für Ensemble-Mitglieder gepflegt werden." },
        { status: 403 },
      );
    }

    const measurement = await prisma.memberMeasurement.upsert({
      where: {
        userId_type: {
          userId: targetUserId,
          type: data.type as PrismaMeasurementType,
        },
      },
      update: {
        value: data.value,
        unit: data.unit as PrismaMeasurementUnit,
        note: data.note ?? null,
      },
      create: {
        userId: targetUserId,
        type: data.type as PrismaMeasurementType,
        value: data.value,
        unit: data.unit as PrismaMeasurementUnit,
        note: data.note ?? null,
      },
    });

    return NextResponse.json(measurement);
  } catch (error) {
    console.error("[Measurements] Failed to save measurement", error);
    return NextResponse.json(
      { error: "Fehler beim Speichern der Maße" },
      { status: 500 },
    );
  }
}
