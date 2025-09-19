import { AttendanceStatus, PrismaClient, RehearsalAttendance } from "@prisma/client";
import { hasRole, Role } from "@/lib/rbac";

export const ATTENDANCE_STATUSES: readonly AttendanceStatus[] = [
  "yes",
  "no",
  "emergency",
  "maybe",
];

export function normalizeStatus(value: unknown): AttendanceStatus | null {
  if (typeof value !== "string") return null;
  return (ATTENDANCE_STATUSES as readonly string[]).includes(value)
    ? (value as AttendanceStatus)
    : null;
}

export function sanitizeComment(comment: unknown): string | null {
  if (typeof comment !== "string") return null;
  const trimmed = comment.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function canManageForeignAttendance(user: { role?: Role } | null | undefined) {
  return hasRole(user, "board", "admin", "tech");
}

type UpdateAttendanceArgs = {
  prisma: PrismaClient;
  rehearsalId: string;
  targetUserId: string;
  actorUserId: string;
  nextStatus: AttendanceStatus | null;
  comment?: string | null;
};

export type AttendanceUpdateResult = {
  attendance: RehearsalAttendance | null;
  logId: string;
};

export async function updateAttendanceWithLog({
  prisma,
  rehearsalId,
  targetUserId,
  actorUserId,
  nextStatus,
  comment,
}: UpdateAttendanceArgs): Promise<AttendanceUpdateResult> {
  const cleanedComment = sanitizeComment(comment);

  return prisma.$transaction(async (tx) => {
    const existing = await tx.rehearsalAttendance.findUnique({
      where: {
        rehearsalId_userId: {
          rehearsalId,
          userId: targetUserId,
        },
      },
    });

    let attendance: RehearsalAttendance | null = existing ?? null;

    if (nextStatus) {
      attendance = await tx.rehearsalAttendance.upsert({
        where: {
          rehearsalId_userId: {
            rehearsalId,
            userId: targetUserId,
          },
        },
        update: {
          status: nextStatus,
        },
        create: {
          rehearsalId,
          userId: targetUserId,
          status: nextStatus,
        },
      });
    } else if (existing) {
      await tx.rehearsalAttendance.delete({
        where: {
          rehearsalId_userId: {
            rehearsalId,
            userId: targetUserId,
          },
        },
      });
      attendance = null;
    }

    const log = await tx.rehearsalAttendanceLog.create({
      data: {
        rehearsalId,
        userId: targetUserId,
        previous: existing?.status ?? null,
        next: nextStatus,
        comment: cleanedComment,
        changedById: actorUserId,
      },
      select: {
        id: true,
      },
    });

    return {
      attendance,
      logId: log.id,
    };
  });
}

export async function fetchRecentAttendanceLogs(
  prisma: PrismaClient,
  rehearsalId: string,
  userId: string,
  limit = 10,
) {
  return prisma.rehearsalAttendanceLog.findMany({
    where: { rehearsalId, userId },
    orderBy: { changedAt: "desc" },
    take: limit,
    select: {
      id: true,
      previous: true,
      next: true,
      comment: true,
      changedAt: true,
      changedBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });
}
