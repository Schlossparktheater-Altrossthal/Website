import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { canEditMeasurementsOf, isEnsembleMember } from "@/lib/measurements/access";
import { requireAuth } from "@/lib/rbac";
import { measurementSchema } from "@/data/measurements";
import type {
  MeasurementType as PrismaMeasurementType,
  MeasurementUnit as PrismaMeasurementUnit,
} from "@prisma/client";

const measurementRequestSchema = measurementSchema.extend({
  userId: z.string().min(1).optional(),
});

// GET: Hole alle Maße eines Benutzers
export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth();
    const userId = session.user?.id;

    if (!userId) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }

    const requestedUserId = request.nextUrl.searchParams.get("userId");
    const targetUserId = requestedUserId ?? userId;

    if (!(await canEditMeasurementsOf(session.user, targetUserId))) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 403 });
    }

    const measurements = await prisma.memberMeasurement.findMany({
      where: { userId: targetUserId },
      orderBy: { type: "asc" },
    });

    return NextResponse.json(measurements);
  } catch (error) {
    console.error("[Measurements] Failed to load measurements", error);
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
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

    if (!(await canEditMeasurementsOf(session.user, targetUserId))) {
      return NextResponse.json(
        { error: "Du darfst die Maße dieser Person nicht bearbeiten." },
        { status: 403 },
      );
    }

    if (!(await isEnsembleMember(targetUserId))) {
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
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message ?? "Ungültige Angaben" },
        { status: 400 },
      );
    }
    console.error("[Measurements] Failed to save measurement", error);
    return NextResponse.json({ error: "Fehler beim Speichern der Maße" }, { status: 500 });
  }
}

// DELETE: Entferne ein einzelnes Maß (?id=...)
export async function DELETE(request: NextRequest) {
  try {
    const session = await requireAuth();
    const id = request.nextUrl.searchParams.get("id");
    if (!session.user?.id || !id) {
      return NextResponse.json({ error: "Ungültige Anfrage" }, { status: 400 });
    }
    const measurement = await prisma.memberMeasurement.findUnique({
      where: { id },
      select: { userId: true },
    });
    if (!measurement) {
      return NextResponse.json({ error: "Maß nicht gefunden" }, { status: 404 });
    }
    if (!(await canEditMeasurementsOf(session.user, measurement.userId))) {
      return NextResponse.json(
        { error: "Du darfst die Maße dieser Person nicht bearbeiten." },
        { status: 403 },
      );
    }
    await prisma.memberMeasurement.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[Measurements] Failed to delete measurement", error);
    return NextResponse.json({ error: "Fehler beim Löschen des Maßes" }, { status: 500 });
  }
}
