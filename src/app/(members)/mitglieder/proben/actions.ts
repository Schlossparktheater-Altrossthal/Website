"use server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  fetchRecentAttendanceLogs,
  normalizeStatus,
  sanitizeComment,
  updateAttendanceWithLog,
} from "@/lib/rehearsals/attendance";

type SaveAttendanceInput = {
  rehearsalId: string;
  status: "yes" | "no" | "maybe" | null;
  comment?: string | null;
};

export async function saveAttendance({ rehearsalId, status, comment }: SaveAttendanceInput) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) throw new Error("Unauthorized");

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) throw new Error("User not found");

  const normalizedStatus = status === null ? null : normalizeStatus(status);
  if (status !== null && !normalizedStatus) {
    throw new Error("Invalid status");
  }

  const trimmedComment = sanitizeComment(comment);
  if (trimmedComment && trimmedComment.length > 500) {
    throw new Error("Comment too long");
  }

  await updateAttendanceWithLog({
    prisma,
    rehearsalId,
    targetUserId: user.id,
    actorUserId: user.id,
    nextStatus: normalizedStatus,
    comment: trimmedComment,
  });

  const logs = await fetchRecentAttendanceLogs(prisma, rehearsalId, user.id);

  return {
    ok: true as const,
    status: normalizedStatus,
    logs: logs.map((log) => ({
      ...log,
      changedAt: log.changedAt.toISOString(),
    })),
  };
}
