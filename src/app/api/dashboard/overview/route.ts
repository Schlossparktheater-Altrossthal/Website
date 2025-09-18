import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";

export async function GET() {
  try {
    const session = await requireAuth();
    const userId = session.user?.id;

    if (!userId) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }

    if (!(await hasPermission(session.user, "mitglieder.dashboard"))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    endOfMonth.setHours(23, 59, 59, 999);

    const [
      totalMembers,
      todayRehearsals,
      unreadNotifications,
      recentNotifications,
      recentRehearsals,
      upcomingRehearsals,
      totalRehearsalsThisMonth,
    ] = await Promise.all([
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
      prisma.rehearsal.findMany({
        where: {
          start: {
            gt: now,
          },
        },
        orderBy: { start: "asc" },
        take: 5,
        select: {
          id: true,
          title: true,
          start: true,
        },
      }),
      prisma.rehearsal.count({
        where: {
          start: {
            gte: startOfMonth,
            lte: endOfMonth,
          },
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
        totalRehearsalsThisMonth,
      },
      upcomingRehearsals,
      recentActivities: activities,
    });
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) {
      throw error;
    }
    console.error("[Dashboard API] Error loading overview:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
