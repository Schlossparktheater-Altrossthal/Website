import type { AttendanceStatus, PrismaClient } from "@prisma/client";
import { hasRole, Role } from "@/lib/rbac";

export const ATTENDANCE_STATUSES: readonly AttendanceStatus[] = ["yes", "no", "emergency", "maybe"];

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
  eventId: string;
  targetUserId: string;
  actorUserId: string;
  nextStatus: AttendanceStatus | null;
  comment?: string | null;
  /** Begründung, die an der Rückmeldung gespeichert wird (z. B. bei Absagen). */
  note?: string | null;
};

export type AttendanceUpdateResult = {
  response: AttendanceStatus | null;
  logId: string;
};

/** Zu-/Absage zu einem Termin setzen (oder zurücknehmen) und im Verlauf festhalten. */
export async function updateAttendanceWithLog({
  prisma,
  eventId,
  targetUserId,
  actorUserId,
  nextStatus,
  comment,
  note,
}: UpdateAttendanceArgs): Promise<AttendanceUpdateResult> {
  const cleanedComment = sanitizeComment(comment);
  const where = { eventId_userId: { eventId, userId: targetUserId } };

  return prisma.$transaction(async (tx) => {
    const existing = await tx.eventParticipant.findUnique({
      where,
      select: { invited: true, response: true },
    });

    if (nextStatus) {
      const respondedAt = new Date();
      await tx.eventParticipant.upsert({
        where,
        update: { response: nextStatus, responseNote: sanitizeComment(note), respondedAt },
        create: {
          eventId,
          userId: targetUserId,
          invited: false,
          response: nextStatus,
          responseNote: sanitizeComment(note),
          respondedAt,
        },
      });
    } else if (existing?.invited) {
      await tx.eventParticipant.update({
        where,
        data: { response: null, responseNote: null, respondedAt: null },
      });
    } else if (existing) {
      await tx.eventParticipant.delete({ where });
    }

    const log = await tx.eventResponseLog.create({
      data: {
        eventId,
        userId: targetUserId,
        previous: existing?.response ?? null,
        next: nextStatus,
        comment: cleanedComment,
        changedById: actorUserId,
      },
      select: { id: true },
    });

    return { response: nextStatus, logId: log.id };
  });
}
