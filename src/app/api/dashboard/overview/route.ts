import { NextResponse } from "next/server";

import { endOfWeek, startOfWeek } from "date-fns";

import { Prisma } from "@prisma/client";
import { hasRole, requireAuth } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { getActiveProductionId } from "@/lib/active-production";
import { buildProfileChecklist } from "@/lib/profile-completion";
import { getOnboardingWhatsAppLink } from "@/lib/onboarding-settings";

type MembershipSummary = {
  showId: string;
  title: string | null;
  year: number;
  joinedAt: string;
  leftAt: string | null;
  isActive: boolean;
};

const onboardingProfileSelect = Prisma.validator<Prisma.MemberOnboardingProfileSelect>()({
  focus: true,
  background: true,
  backgroundClass: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
  dietaryPreference: true,
  dietaryPreferenceStrictness: true,
  whatsappLinkVisitedAt: true,
  show: { select: { meta: true } },
});

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

    const hasMeasurementPermission = await hasPermission(
      session.user,
      "mitglieder.koerpermasse",
    );
    const isEnsembleMember = hasRole(session.user, "cast");
    const canManageMeasurements = hasMeasurementPermission && isEnsembleMember;

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
          select: { id: true, title: true, year: true, finalRehearsalWeekStart: true },
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
      rolePreferences,
      interestCount,
      recentInterests,
      dietaryRestrictions,
      photoConsent,
      userRecord,
      membershipRecords,
      measurementCount,
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
        select: onboardingProfileSelect,
      }),
      prisma.memberRolePreference.findMany({
        where: { userId },
        select: { domain: true, weight: true },
      }),
      prisma.userInterest.count({ where: { userId } }),
      prisma.userInterest.findMany({
        where: { userId },
        include: { interest: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        take: 12,
      }),
      prisma.dietaryRestriction.findMany({
        where: { userId },
        select: { allergen: true, level: true },
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
          passwordHash: true,
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
      canManageMeasurements
        ? prisma.memberMeasurement.count({ where: { userId } })
        : Promise.resolve(0),
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

    const actingPreferences = rolePreferences.filter((pref) => pref.domain === "acting");
    const crewPreferences = rolePreferences.filter((pref) => pref.domain === "crew");
    const averageWeight = (entries: typeof rolePreferences) =>
      entries.length ? Math.round(entries.reduce((sum, pref) => sum + pref.weight, 0) / entries.length) : 0;

    const interestNames: string[] = [];
    const seenInterests = new Set<string>();
    for (const entry of recentInterests) {
      const name = entry.interest?.name?.trim();
      if (!name) continue;
      const key = name.toLowerCase();
      if (seenInterests.has(key)) continue;
      seenInterests.add(key);
      interestNames.push(name);
      if (interestNames.length >= 6) break;
    }

    const dietaryHighlights = dietaryRestrictions.slice(0, 3).map((entry) => ({
      name: entry.allergen,
      level: entry.level,
    }));

    const whatsappLink = getOnboardingWhatsAppLink(onboardingProfile?.show?.meta ?? null);

    const onboarding = {
      completed: Boolean(onboardingProfile),
      completedAt: onboardingProfile?.createdAt?.toISOString() ?? null,
      focus: onboardingProfile?.focus ?? null,
      background: onboardingProfile?.background ?? null,
      backgroundClass: onboardingProfile?.backgroundClass ?? null,
      notes: onboardingProfile?.notes ?? null,
      whatsappLink,
      whatsappLinkVisitedAt: onboardingProfile?.whatsappLinkVisitedAt
        ? onboardingProfile.whatsappLinkVisitedAt.toISOString()
        : null,
      stats: {
        acting: { count: actingPreferences.length, averageWeight: averageWeight(actingPreferences) },
        crew: { count: crewPreferences.length, averageWeight: averageWeight(crewPreferences) },
        interests: { count: interestCount, top: interestNames },
        dietary: { count: dietaryRestrictions.length, highlights: dietaryHighlights },
      },
      photoConsent: {
        status: photoConsent?.status ?? "none",
        consentGiven: photoConsent?.consentGiven ?? false,
        hasDocument: Boolean(photoConsent?.documentUploadedAt),
        updatedAt: photoConsent?.updatedAt ? photoConsent.updatedAt.toISOString() : null,
      },
      passwordSet: Boolean(userRecord?.passwordHash),
    };

    const profileChecklist = buildProfileChecklist({
      hasBasicData: Boolean(
        userRecord?.firstName && userRecord?.lastName && userRecord?.email,
      ),
      hasBirthdate: Boolean(userRecord?.dateOfBirth),
      hasDietaryPreference: Boolean(
        onboardingProfile?.dietaryPreference?.trim(),
      ),
      hasMeasurements: canManageMeasurements ? measurementCount > 0 : undefined,
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
        }
      : null;

    return NextResponse.json({
      stats: {
        totalMembers,
        rehearsalsThisWeek,
        unreadNotifications,
        totalRehearsalsThisMonth,
      },
      upcomingRehearsals,
      recentActivities: activities,
      onboarding,
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
