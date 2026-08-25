import { NextResponse } from "next/server";

import { endOfWeek, startOfWeek } from "date-fns";

import { requireAuth } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { getActiveProductionId } from "@/lib/active-production";
import { buildProfileChecklist, isPaymentDetailsComplete } from "@/lib/profile-completion";
import { databaseEnabled } from "@/lib/dev-database";
import { DEV_DASHBOARD_OVERVIEW_FIXTURE } from "@/lib/dev-dashboard-fixture";

type MembershipSummary = {
  showId: string;
  title: string | null;
  year: number;
  joinedAt: string;
  leftAt: string | null;
  isActive: boolean;
};

export async function GET() {
  if (!databaseEnabled()) {
    return NextResponse.json(DEV_DASHBOARD_OVERVIEW_FIXTURE);
  }

  try {
    const session = await requireAuth();
    const userId = session.user?.id;

    if (!userId) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }

    if (!(await hasPermission(session.user, "PRIVATE.DASHBOARD.OVERVIEW.VIEW"))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const now = new Date();
    const startOfCurrentWeek = startOfWeek(now, { weekStartsOn: 1 });
    startOfCurrentWeek.setHours(0, 0, 0, 0);
    const endOfCurrentWeek = endOfWeek(now, { weekStartsOn: 1 });
    endOfCurrentWeek.setHours(23, 59, 59, 999);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    endOfMonth.setHours(23, 59, 59, 999);

    const activeProductionId = await getActiveProductionId(userId);
    const activeProductionPromise = activeProductionId
      ? prisma.show.findUnique({
          where: { id: activeProductionId },
          select: {
            id: true,
            title: true,
            year: true,
            finalRehearsalWeekStart: true,
            finalRehearsalWeekEnd: true,
          },
        })
      : null;

    const [
      totalMembers,
      rehearsalsThisWeek,
      unreadNotifications,
      recentNotifications,
      recentRehearsals,
      upcomingRehearsals,
      totalRehearsalsThisMonth,
      onboardingProfile,
      photoConsent,
      userRecord,
      membershipRecords,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.rehearsal.count({
        where: {
          start: {
            gte: startOfCurrentWeek,
            lte: endOfCurrentWeek,
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
      prisma.memberOnboardingProfile.findUnique({
        where: { userId },
        select: { dietaryPreference: true },
      }),
      prisma.photoConsent.findUnique({
        where: { userId },
        select: {
          status: true,
          consentGiven: true,
          documentUploadedAt: true,
          updatedAt: true,
        },
      }),
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          firstName: true,
          lastName: true,
          email: true,
          dateOfBirth: true,
          payoutMethod: true,
          payoutAccountHolder: true,
          payoutIban: true,
          payoutBankName: true,
          payoutPaypalHandle: true,
          payoutNote: true,
        },
      }),
      prisma.productionMembership.findMany({
        where: { userId },
        orderBy: { joinedAt: "desc" },
        include: {
          show: {
            select: {
              id: true,
              title: true,
              year: true,
            },
          },
        },
      }),
    ]);

    const activeProduction = activeProductionPromise ? await activeProductionPromise : null;

    const notificationActivities = recentNotifications.flatMap((entry) => {
      const notification = entry.notification;
      if (!notification) {
        console.warn("[Dashboard API] Skipping notification without payload", entry.notificationId);
        return [] as const;
      }
      return [
        {
          id: entry.notificationId,
          type: "notification" as const,
          message: notification.title,
          timestamp: notification.createdAt.toISOString(),
        },
      ];
    });

    const activities = [
      ...notificationActivities,
      ...recentRehearsals.map((rehearsal) => ({
        id: `rehearsal_${rehearsal.id}_${rehearsal.createdAt.getTime()}`,
        type: "rehearsal" as const,
        message: `Neue Probe: ${rehearsal.title}`,
        timestamp: rehearsal.createdAt.toISOString(),
      })),
    ]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 10);

    const hasPaymentDetails = isPaymentDetailsComplete({
      payoutMethod: userRecord?.payoutMethod,
      payoutAccountHolder: userRecord?.payoutAccountHolder,
      payoutIban: userRecord?.payoutIban,
      payoutBankName: userRecord?.payoutBankName,
      payoutPaypalHandle: userRecord?.payoutPaypalHandle,
      payoutNote: userRecord?.payoutNote,
    });

    const profileChecklist = buildProfileChecklist({
      hasBasicData: Boolean(userRecord?.firstName && userRecord?.lastName && userRecord?.email),
      hasBirthdate: Boolean(userRecord?.dateOfBirth),
      hasPaymentDetails,
      hasDietaryPreference: Boolean(onboardingProfile?.dietaryPreference?.trim()),
      photoConsent: { consentGiven: Boolean(photoConsent?.consentGiven) },
    });

    const nowTimestamp = Date.now();
    const membershipSummaries: MembershipSummary[] = membershipRecords
      .map((membership) => {
        const show = membership.show;
        if (!show) {
          return null;
        }

        const leftAtIso = membership.leftAt ? membership.leftAt.toISOString() : null;
        const isActive = !membership.leftAt || membership.leftAt.getTime() > nowTimestamp;

        return {
          showId: show.id,
          title: show.title,
          year: show.year,
          joinedAt: membership.joinedAt.toISOString(),
          leftAt: leftAtIso,
          isActive,
        } satisfies MembershipSummary;
      })
      .filter((entry): entry is MembershipSummary => entry !== null);

    const finalRehearsalWeek = activeProduction?.finalRehearsalWeekStart
      ? {
          showId: activeProduction.id,
          title: activeProduction.title,
          year: activeProduction.year,
          startDate: activeProduction.finalRehearsalWeekStart.toISOString(),
          endDate: activeProduction.finalRehearsalWeekEnd?.toISOString() ?? null,
        }
      : null;

    return NextResponse.json({
      offline: false,
      stats: {
        totalMembers,
        rehearsalsThisWeek,
        unreadNotifications,
        totalRehearsalsThisMonth,
      },
      upcomingRehearsals,
      recentActivities: activities,
      finalRehearsalWeek,
      profileCompletion: {
        complete: profileChecklist.complete,
        completed: profileChecklist.completed,
        total: profileChecklist.total,
      },
      activeProduction: activeProduction
        ? {
            id: activeProduction.id,
            title: activeProduction.title,
            year: activeProduction.year,
          }
        : null,
      productionMemberships: membershipSummaries,
    });
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) {
      throw error;
    }
    console.error("[Dashboard API] Error loading overview:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
