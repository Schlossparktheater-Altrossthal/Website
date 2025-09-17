import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";

// GET: Hole alle Maße eines Benutzers
export async function GET() {
  try {
    const session = await requireAuth();
    const userId = session.user?.id;

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
    if (!userId) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }
    const data = await request.json();

    const measurement = await prisma.memberMeasurement.upsert({
      where: {
        userId_type: {
          userId,
          type: data.type,
        },
      },
      update: {
        value: data.value,
        unit: data.unit,
        note: data.note,
      },
      create: {
        userId,
        type: data.type,
        value: data.value,
        unit: data.unit,
        note: data.note,
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