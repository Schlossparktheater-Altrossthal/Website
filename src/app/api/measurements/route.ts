import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { requireAuth } from "@/lib/rbac";
import { measurementSchema } from "@/data/measurements";
import type { MeasurementType as PrismaMeasurementType, MeasurementUnit as PrismaMeasurementUnit } from "@prisma/client";

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
    const data = measurementSchema.parse(payload);

    const measurement = await prisma.memberMeasurement.upsert({
      where: {
        userId_type: {
          userId,
          type: data.type as PrismaMeasurementType,
        },
      },
      update: {
        value: data.value,
        unit: data.unit as PrismaMeasurementUnit,
        note: data.note ?? null,
      },
      create: {
        userId,
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