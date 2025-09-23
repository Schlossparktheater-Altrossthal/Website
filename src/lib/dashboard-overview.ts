import { endOfWeek, startOfWeek } from "date-fns";
import type { Session } from "next-auth";

import { prisma } from "@/lib/prisma";
import { hasRole } from "@/lib/rbac";
import { hasPermission } from "@/lib/permissions";
import { getActiveProductionId } from "@/lib/active-production";
import { buildProfileChecklist } from "@/lib/profile-completion";

export type DashboardOverviewActivityType = "notification" | "rehearsal" | "attendance";

export interface DashboardOverviewActivity {
  id: string;
  type: DashboardOverviewActivityType;
  message: string;
  timestamp: string;
}

export interface DashboardOverviewStats {
  totalMembers: number;
  rehearsalsThisWeek: number;
  unreadNotifications: number;
  totalRehearsalsThisMonth: number;
}

export interface DashboardOverviewRehearsalSummary {
  id: string;
  title: string | null;
  start: string;
}

export type OnboardingFocus = "acting" | "tech" | "both";
export type OnboardingPhotoStatus = "none" | "pending" | "approved" | "rejected";

export interface DashboardOverviewOnboarding {
  completed: boolean;
  completedAt: string | null;
  focus: OnboardingFocus | null;
  background: string | null;
  backgroundClass: string | null;
  notes: string | null;
  stats: {
    acting: { count: number; averageWeight: number };
    crew: { count: number; averageWeight: number };
    interests: { count: number; top: string[] };
    dietary: { count: number; highlights: { name: string; level: string | null }[] };
  };
  photoConsent: {
    status: OnboardingPhotoStatus;
    consentGiven: boolean;
    hasDocument: boolean;
    updatedAt: string | null;
  };
  passwordSet: boolean;
}

export interface DashboardOverviewFinalRehearsalWeek {
  showId: string;
  title: string | null;
  year: number;
  startDate: string;
}

export interface DashboardOverviewProfileCompletion {
  complete: boolean;
  completed: number;
  total: number;
}

export interface DashboardOverviewData {
  stats: DashboardOverviewStats;
  upcomingRehearsals: DashboardOverviewRehearsalSummary[];
  recentActivities: DashboardOverviewActivity[];
  onboarding: DashboardOverviewOnboarding;
  finalRehearsalWeek: DashboardOverviewFinalRehearsalWeek | null;
  profileCompletion: DashboardOverviewProfileCompletion;
}

export class DashboardOverviewAccessError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = "DashboardOverviewAccessError";
    this.statusCode = statusCode;
  }
}

type SessionLike = Pick<Session, "user"> | null | undefined;

const isOnboardingFocus = (value: unknown): value is OnboardingFocus =>
  value === "acting" || value === "tech" || value === "both";

const isOnboardingPhotoStatus = (value: unknown): value is OnboardingPhotoStatus =>
  value === "pending" || value === "approved" || value === "rejected" || value === "none";

export async function getDashboardOverview(session: SessionLike): Promise<DashboardOverviewData> {
  const user = session?.user;

  if (!user?.id) {
    throw new DashboardOverviewAccessError("Nicht autorisiert", 401);
  }

  const allowed = await hasPermission(user, "mitglieder.dashboard");
  if (!allowed) {
    throw new DashboardOverviewAccessError("Forbidden", 403);
  }

  const hasMeasurementPermission = await hasPermission(user, "mitglieder.koerpermasse");
  const isEnsembleMember = hasRole(user, "cast");
  const canManageMeasurements = hasMeasurementPermission && isEnsembleMember;

  const now = new Date();
  const startOfCurrentWeek = startOfWeek(now, { weekStartsOn: 1 });
  startOfCurrentWeek.setHours(0, 0, 0, 0);
  const endOfCurrentWeek = endOfWeek(now, { weekStartsOn: 1 });
  endOfCurrentWeek.setHours(23, 59, 59, 999);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  endOfMonth.setHours(23, 59, 59, 999);

  const activeProductionId = await getActiveProductionId();

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
    measurementCount,
    activeProduction,
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
        userId: user.id,
        readAt: null,
      },
    }),
    prisma.notificationRecipient.findMany({
      where: { userId: user.id },
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
    (
      prisma as unknown as {
        memberOnboardingProfile: {
          findUnique: (args: {
            where: { userId: string };
            select: {
              focus: true;
              background: true;
              backgroundClass: true;
              notes: true;
              createdAt: true;
              updatedAt: true;
              dietaryPreference: true;
              dietaryPreferenceStrictness: true;
            };
          }) => Promise<
            | {
                focus: string;
                background: string | null;
                backgroundClass: string | null;
                notes: string | null;
                createdAt: Date;
                updatedAt: Date;
                dietaryPreference: string | null;
                dietaryPreferenceStrictness: string | null;
              }
            | null
          >;
        };
      }
    ).memberOnboardingProfile.findUnique({
      where: { userId: user.id },
      select: {
        focus: true,
        background: true,
        backgroundClass: true,
        notes: true,
        createdAt: true,
        updatedAt: true,
        dietaryPreference: true,
        dietaryPreferenceStrictness: true,
      },
    }),
    prisma.memberRolePreference.findMany({
      where: { userId: user.id },
      select: { domain: true, weight: true },
    }),
    prisma.userInterest.count({ where: { userId: user.id } }),
    prisma.userInterest.findMany({
      where: { userId: user.id },
      include: { interest: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 12,
    }),
    prisma.dietaryRestriction.findMany({
      where: { userId: user.id },
      select: { allergen: true, level: true },
    }),
    prisma.photoConsent.findUnique({
      where: { userId: user.id },
      select: {
        status: true,
        consentGiven: true,
        documentUploadedAt: true,
        updatedAt: true,
      },
    }),
    prisma.user.findUnique({
      where: { id: user.id },
      select: {
        firstName: true,
        lastName: true,
        email: true,
        dateOfBirth: true,
        passwordHash: true,
      },
    }),
    canManageMeasurements ? prisma.memberMeasurement.count({ where: { userId: user.id } }) : Promise.resolve(0),
    activeProductionId
      ? prisma.show.findUnique({
          where: { id: activeProductionId },
          select: { id: true, title: true, year: true, finalRehearsalWeekStart: true },
        })
      : Promise.resolve(null),
  ]);

  const activities: DashboardOverviewActivity[] = [
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

  const focusValue = isOnboardingFocus(onboardingProfile?.focus) ? onboardingProfile?.focus ?? null : null;
  const background = onboardingProfile?.background ?? null;
  const backgroundClass = onboardingProfile?.backgroundClass ?? null;
  const notes = onboardingProfile?.notes ?? null;
  const photoStatus = isOnboardingPhotoStatus(photoConsent?.status)
    ? photoConsent?.status ?? "none"
    : "none";

  const onboardingBase = {
    stats: {
      acting: { count: actingPreferences.length, averageWeight: averageWeight(actingPreferences) },
      crew: { count: crewPreferences.length, averageWeight: averageWeight(crewPreferences) },
      interests: { count: interestCount, top: interestNames },
      dietary: { count: dietaryRestrictions.length, highlights: dietaryHighlights },
    },
    photoConsent: {
      status: photoStatus,
      consentGiven: Boolean(photoConsent?.consentGiven),
      hasDocument: Boolean(photoConsent?.documentUploadedAt),
      updatedAt: photoConsent?.updatedAt ? photoConsent.updatedAt.toISOString() : null,
    },
    passwordSet: Boolean(userRecord?.passwordHash),
  } satisfies Pick<DashboardOverviewOnboarding, "stats" | "photoConsent" | "passwordSet">;

  const onboarding: DashboardOverviewOnboarding = onboardingProfile
    ? {
        ...onboardingBase,
        completed: true,
        completedAt: onboardingProfile.createdAt?.toISOString() ?? null,
        focus: focusValue,
        background,
        backgroundClass,
        notes,
      }
    : {
        ...onboardingBase,
        completed: false,
        completedAt: null,
        focus: null,
        background: null,
        backgroundClass: null,
        notes: null,
      };

  const profileChecklist = buildProfileChecklist({
    hasBasicData: Boolean(userRecord?.firstName && userRecord?.lastName && userRecord?.email),
    hasBirthdate: Boolean(userRecord?.dateOfBirth),
    hasDietaryPreference: Boolean(onboardingProfile?.dietaryPreference?.trim()),
    hasMeasurements: canManageMeasurements ? measurementCount > 0 : undefined,
    photoConsent: { consentGiven: Boolean(photoConsent?.consentGiven) },
  });

  const finalRehearsalWeek: DashboardOverviewFinalRehearsalWeek | null = activeProduction?.finalRehearsalWeekStart
    ? {
        showId: activeProduction.id,
        title: activeProduction.title,
        year: activeProduction.year,
        startDate: activeProduction.finalRehearsalWeekStart.toISOString(),
      }
    : null;

  return {
    stats: {
      totalMembers,
      rehearsalsThisWeek,
      unreadNotifications,
      totalRehearsalsThisMonth,
    },
    upcomingRehearsals: upcomingRehearsals.map((rehearsal) => ({
      id: rehearsal.id,
      title: rehearsal.title,
      start: rehearsal.start.toISOString(),
    })),
    recentActivities: activities,
    onboarding,
    finalRehearsalWeek,
    profileCompletion: {
      complete: profileChecklist.complete,
      completed: profileChecklist.completed,
      total: profileChecklist.total,
    },
  };
}
