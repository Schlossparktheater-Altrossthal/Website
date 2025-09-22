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
export async function GET() {
  try {
    const session = await requireAuth();
    const userId = session.user?.id;

    const allowed = await hasPermission(session.user, "mitglieder.koerpermasse");
    if (!allowed) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 403 });
    }

    if (!userId) {
      return NextResponse.json(
        { error: "Nicht autorisiert" },
        { status: 401 },
      );
    }

    const measurements = await prisma.memberMeasurement.findMany({
      where: { userId },
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

    const allowed = await hasPermission(session.user, "mitglieder.koerpermasse");
    if (!allowed) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 403 });
    }
    if (!userId) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }
    const payload = await request.json();
    const { userId: overrideUserId, ...data } = measurementRequestSchema.parse(payload);

    const targetUserId = overrideUserId ?? userId;

    if (!targetUserId) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: {
        role: true,
        roles: { select: { role: true } },
      },
    });

    if (!targetUser) {
      return NextResponse.json({ error: "Mitglied nicht gefunden" }, { status: 404 });
    }

    const isTargetInEnsemble =
      targetUser.role === "cast" || targetUser.roles.some((entry) => entry.role === "cast");

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