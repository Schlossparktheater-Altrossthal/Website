import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";

// Lokaler Typ synchron zu prisma.schema (AttendanceStatus: yes | no | emergency | maybe)
type AttendanceStatus = "yes" | "no" | "emergency" | "maybe";

type NotificationResponse = {
  id: string;
  title: string;
  body?: string | null;
  createdAt: string;
  readAt: string | null;
  type?: string | null;
  rehearsal: {
    id: string;
    title: string;
    start: string;
  } | null;
  attendanceStatus: AttendanceStatus | null;
};

export async function GET() {
  try {
    const session = await requireAuth();
    const userId = session.user?.id;
    if (!userId) {
      return NextResponse.json({ notifications: [] as NotificationResponse[] });
    }

    type RecipientRecord = {
      id: string;
      readAt: Date | null;
      notification: {
        id: string;
        title: string;
        body: string | null;
        type: string | null;
        createdAt: Date;
        eventId: string | null;
        event: {
          id: string;
          title: string;
          start: Date;
        } | null;
      };
    };

    const records: RecipientRecord[] = await prisma.notificationRecipient.findMany({
      where: { userId },
      include: {
        notification: {
          include: {
            event: { select: { id: true, title: true, start: true } },
          },
        },
      },
      orderBy: { notification: { createdAt: "desc" } },
      take: 25,
    });

    const rehearsalIds = records
      .map((record) => record.notification.eventId)
      .filter((id): id is string => Boolean(id));

    const attendance = rehearsalIds.length
      ? await prisma.eventParticipant.findMany({
          where: { userId, eventId: { in: rehearsalIds }, response: { not: null } },
          select: { eventId: true, response: true },
        })
      : [];

    const attendanceMap = new Map<string, AttendanceStatus>(
      attendance.flatMap((entry) => (entry.response ? [[entry.eventId, entry.response]] : [])),
    );

    const notifications: NotificationResponse[] = records.map((record: RecipientRecord) => ({
      id: record.id,
      title: record.notification.title,
      body: record.notification.body,
      createdAt: record.notification.createdAt.toISOString(),
      readAt: record.readAt ? record.readAt.toISOString() : null,
      type: record.notification.type ?? null,
      rehearsal: record.notification.event
        ? {
            id: record.notification.event.id,
            title: record.notification.event.title,
            start: record.notification.event.start.toISOString(),
          }
        : null,
      attendanceStatus: record.notification.eventId
        ? (attendanceMap.get(record.notification.eventId) ?? null)
        : null,
    }));

    return NextResponse.json({ notifications });
  } catch (error) {
    console.error("Error fetching notifications", error);
    return NextResponse.json({ notifications: [] as NotificationResponse[] }, { status: 200 });
  }
}
