import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import {
  canManageForeignAttendance,
  fetchRecentAttendanceLogs,
  normalizeStatus,
  sanitizeComment,
  updateAttendanceWithLog,
} from "@/lib/rehearsals/attendance";

const MAX_COMMENT_LENGTH = 500;

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    const actor = session.user as { id?: string; role?: any };
    const actorId = actor?.id;

    if (!actorId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = await request.json().catch(() => null);

    if (!payload || typeof payload !== "object") {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const { rehearsalId, status, comment, userId } = payload as {
      rehearsalId?: string;
      status?: string | null;
      comment?: string | null;
      userId?: string;
    };

    if (!rehearsalId) {
      return NextResponse.json({ error: "Rehearsal ID required" }, { status: 400 });
    }

    if (typeof status === "undefined") {
      return NextResponse.json({ error: "Status is required" }, { status: 400 });
    }

    const normalizedStatus = status === null ? null : normalizeStatus(status);

    if (status !== null && !normalizedStatus) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const targetUserId = typeof userId === "string" && userId.length > 0 ? userId : actorId;

    if (targetUserId !== actorId && !canManageForeignAttendance(actor)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const trimmedComment = sanitizeComment(comment ?? null);

    if (trimmedComment && trimmedComment.length > MAX_COMMENT_LENGTH) {
      return NextResponse.json({ error: "Comment too long" }, { status: 400 });
    }

    const rehearsal = await prisma.rehearsal.findUnique({
      where: { id: rehearsalId },
      select: { 
        id: true,
        start: true,
        registrationDeadline: true 
      },
    });

    // Aktuelle Anmeldung prüfen
    const currentAttendance = await prisma.rehearsalAttendance.findUnique({
      where: {
        rehearsalId_userId: {
          rehearsalId: rehearsal.id,
          userId: targetUserId,
        }
      }
    });

    const now = new Date();
    if (rehearsal && now > rehearsal.registrationDeadline) {
      // Nach Anmeldefrist nur Emergency-Status erlauben, und nur wenn vorher zugesagt wurde
      if (normalizedStatus !== 'emergency') {
        return NextResponse.json({ 
          error: "Anmeldefrist abgelaufen. Nur noch Emergency-Absagen möglich." 
        }, { status: 400 });
      }
      
      // Prüfen ob vorher zugesagt wurde
      if (!currentAttendance || currentAttendance.status !== 'yes') {
        return NextResponse.json({ 
          error: "Emergency-Absagen sind nur möglich, wenn Sie vorher zugesagt hatten." 
        }, { status: 400 });
      }
    } else {
      // Während der Anmeldefrist kein Emergency-Status erlaubt
      if (normalizedStatus === 'emergency') {
        return NextResponse.json({ 
          error: "Emergency-Absagen sind erst nach Ablauf der Anmeldefrist möglich." 
        }, { status: 400 });
      }
    }

    // Bei Emergency-Status muss eine Begründung angegeben werden
    if (normalizedStatus === 'emergency' && !trimmedComment) {
      return NextResponse.json({ 
        error: "Für Emergency-Absagen muss eine Begründung angegeben werden." 
      }, { status: 400 });
    }

    if (!rehearsal) {
      return NextResponse.json({ error: "Rehearsal not found" }, { status: 404 });
    }

    const userExists = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true },
    });

    if (!userExists) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const result = await updateAttendanceWithLog({
      prisma,
      rehearsalId: rehearsal.id,
      targetUserId,
      actorUserId: actorId,
      nextStatus: normalizedStatus,
      comment: trimmedComment,
    });

    const latestLogs = await fetchRecentAttendanceLogs(
      prisma,
      rehearsal.id,
      targetUserId,
    );

    return NextResponse.json({
      success: true,
      status: result.attendance?.status ?? null,
      attendance: result.attendance,
      logs: latestLogs,
    });
  } catch (error) {
    console.error("Error updating attendance:", error);
    return NextResponse.json({ error: "Server Error" }, { status: 500 });
  }
}
