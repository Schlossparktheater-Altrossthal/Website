import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";

type SessionUser = { id?: string | null };

type NotificationResponse = {
  id: string;
  title: string;
  body?: string | null;
  createdAt: string;
  readAt: string | null;
  rehearsal: {
    id: string;
    title: string;
    start: string;
  } | null;
  attendanceStatus: "yes" | "no" | null;
};

export async function GET() {
  try {
    const session = await requireAuth();
    const userId = (session.user as SessionUser | undefined)?.id;
    if (!userId) {
      return NextResponse.json({ notifications: [] as NotificationResponse[] });
    }

    const records = await prisma.notificationRecipient.findMany({
      where: { userId },
      include: {
        notification: {
          include: {
            rehearsal: { select: { id: true, title: true, start: true } },
          },
        },
      },
      orderBy: { notification: { createdAt: "desc" } },
      take: 25,
    });

    const rehearsalIds = records
      .map((record) => record.notification.rehearsalId)
      .filter((id): id is string => Boolean(id));

    const attendance = rehearsalIds.length
      ? await prisma.rehearsalAttendance.findMany({
          where: { userId, rehearsalId: { in: rehearsalIds } },
          select: { rehearsalId: true, status: true },
        })
      : [];

    const attendanceMap = new Map(attendance.map((entry) => [entry.rehearsalId, entry.status]));

    const notifications: NotificationResponse[] = records.map((record) => ({
      id: record.id,
      title: record.notification.title,
      body: record.notification.body,
      createdAt: record.notification.createdAt.toISOString(),
      readAt: record.readAt ? record.readAt.toISOString() : null,
      rehearsal: record.notification.rehearsal
        ? {
            id: record.notification.rehearsal.id,
            title: record.notification.rehearsal.title,
            start: record.notification.rehearsal.start.toISOString(),
          }
        : null,
      attendanceStatus: record.notification.rehearsalId
        ? ((attendanceMap.get(record.notification.rehearsalId) as "yes" | "no" | null) ?? null)
        : null,
    }));

    return NextResponse.json({ notifications });
  } catch (error) {
    console.error("Error fetching notifications", error);
    return NextResponse.json({ notifications: [] as NotificationResponse[] }, { status: 200 });
  }
}
