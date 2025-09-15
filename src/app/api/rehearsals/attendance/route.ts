import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    const userId = (session.user as any).id as string;
    const { rehearsalId, status } = await request.json();
    
    if (!rehearsalId || !status || !["yes", "no", "maybe"].includes(status)) {
      return NextResponse.json({ error: "Invalid data" }, { status: 400 });
    }
    
    // Upsert attendance
    const attendance = await prisma.rehearsalAttendance.upsert({
      where: {
        rehearsalId_userId: {
          rehearsalId,
          userId
        }
      },
      update: {
        status
      },
      create: {
        rehearsalId,
        userId,
        status
      }
    });
    
    return NextResponse.json({ success: true, attendance });
    
  } catch (error) {
    console.error("Error updating attendance:", error);
    return NextResponse.json({ error: "Server Error" }, { status: 500 });
  }
}
