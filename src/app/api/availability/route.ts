import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    const userId = (session.user as any).id as string;
    const { date, kind, availableFromMin, availableToMin, note } = await request.json();
    
    if (!date || !kind || !["FULL_AVAILABLE", "FULL_UNAVAILABLE", "PARTIAL"].includes(kind)) {
      return NextResponse.json({ error: "Invalid data" }, { status: 400 });
    }
    
    const parsedDate = new Date(date);
    
    // Upsert availability day
    const availability = await prisma.availabilityDay.upsert({
      where: {
        userId_date: {
          userId,
          date: parsedDate
        }
      },
      update: {
        kind,
        availableFromMin: availableFromMin || null,
        availableToMin: availableToMin || null,
        note: note || null
      },
      create: {
        userId,
        date: parsedDate,
        kind,
        availableFromMin: availableFromMin || null,
        availableToMin: availableToMin || null,
        note: note || null
      }
    });
    
    return NextResponse.json({ success: true, availability });
    
  } catch (error) {
    console.error("Error updating availability:", error);
    return NextResponse.json({ error: "Server Error" }, { status: 500 });
  }
}
