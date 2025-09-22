import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";

function sanitizeAvailabilityMinute(value: unknown): number | null | undefined {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    return undefined;
  }

  return value;
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    const userId = session.user?.id;
    if (!userId) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }
    const { date, kind, availableFromMin, availableToMin, note } = await request.json();

    if (!date || !kind || !["FULL_AVAILABLE", "FULL_UNAVAILABLE", "PARTIAL"].includes(kind)) {
      return NextResponse.json({ error: "Invalid data" }, { status: 400 });
    }

    const parsedDate = new Date(date);

    const sanitizedAvailableFromMin = sanitizeAvailabilityMinute(availableFromMin);
    if (sanitizedAvailableFromMin === undefined) {
      return NextResponse.json(
        { error: "availableFromMin must be a non-negative integer or null" },
        { status: 400 },
      );
    }

    const sanitizedAvailableToMin = sanitizeAvailabilityMinute(availableToMin);
    if (sanitizedAvailableToMin === undefined) {
      return NextResponse.json(
        { error: "availableToMin must be a non-negative integer or null" },
        { status: 400 },
      );
    }

    // Upsert availability day
    const availability = await prisma.availabilityDay.upsert({
      where: {
        userId_date: {
          userId,
          date: parsedDate,
        },
      },
      update: {
        kind,
        availableFromMin: sanitizedAvailableFromMin ?? null,
        availableToMin: sanitizedAvailableToMin ?? null,
        note: note || null,
      },
      create: {
        userId,
        date: parsedDate,
        kind,
        availableFromMin: sanitizedAvailableFromMin ?? null,
        availableToMin: sanitizedAvailableToMin ?? null,
        note: note || null,
      },
    });

    return NextResponse.json({ success: true, availability });

  } catch (error) {
    console.error("Error updating availability:", error);
    return NextResponse.json({ error: "Server Error" }, { status: 500 });
  }
}
