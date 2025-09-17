import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await requireAuth();
  const userId = session.user?.id;

  if (!userId) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }

  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59, 999);

  const [totalMembers, todayRehearsals, unreadNotifications, recentNotifications, recentRehearsals] =
    await Promise.all([
      prisma.user.count(),
      prisma.rehearsal.count({
        where: {
          start: {
            gte: startOfDay,
            lte: endOfDay,
          },
        },
      }),
      prisma.notificationRecipient.count({
        where: {
          userId,
          readAt: null,
        },
      }),
      prisma.notificationRecipient.findMany({
        where: { userId },
        orderBy: { notification: { createdAt: "desc" } },
        take: 10,
        include: {
          notification: true,
        },
      }),
      prisma.rehearsal.findMany({
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          title: true,
          start: true,
          createdAt: true,
        },
      }),
    ]);

  const activities = [
    ...recentNotifications.map((entry) => ({
      id: entry.notificationId,
      type: "notification" as const,
      message: entry.notification.title,
      timestamp: entry.notification.createdAt.toISOString(),
    })),
    ...recentRehearsals.map((rehearsal) => ({
      id: `rehearsal_${rehearsal.id}_${rehearsal.createdAt.getTime()}`,
      type: "rehearsal" as const,
      message: `Neue Probe: ${rehearsal.title}`,
      timestamp: rehearsal.createdAt.toISOString(),
    })),
  ]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 10);

  return NextResponse.json({
    stats: {
      totalMembers,
      todayRehearsals,
      unreadNotifications,
    },
    recentActivities: activities,
  });
}
