import type { AllergyLevel, OnboardingFocus, RolePreferenceDomain } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { calculateInviteStatus } from "@/lib/member-invites";

export type OnboardingInviteSummary = {
  id: string;
  label: string | null;
  expiresAt: string | null;
  isActive: boolean;
  isExpired: boolean;
  isDisabled: boolean;
  isExhausted: boolean;
  remainingUses: number | null;
  usageCount: number;
  maxUses: number | null;
  showId: string;
};

export type OnboardingInterestStat = { name: string; count: number };

export type OnboardingRolePreferenceStat = {
  code: string;
  domain: RolePreferenceDomain;
  averageWeight: number;
  responses: number;
};

export type OnboardingShowAggregations = {
  interests: OnboardingInterestStat[];
  rolePreferences: OnboardingRolePreferenceStat[];
};

export type OnboardingShowSummary = {
  id: string;
  title: string | null;
  year: number;
  onboardingCount: number;
  completedCount: number;
  openCount: number;
  focus: Record<OnboardingFocus, number>;
  pendingPhotoConsents: number;
  guardianDocumentsMissing: number;
  invites: {
    total: number;
    active: number;
    expired: number;
    disabled: number;
    exhausted: number;
    totalUsage: number;
  };
} & OnboardingShowAggregations;

export type OnboardingTalentProfile = {
  id: string;
  userId: string;
  name: string | null;
  email: string | null;
  focus: OnboardingFocus;
  background: string | null;
  backgroundClass: string | null;
  notes: string | null;
  gender: string | null;
  memberSinceYear: number | null;
  inviteLabel: string | null;
  createdAt: string;
  completedAt: string | null;
  dietaryPreference: string | null;
  dietaryPreferenceStrictness: string | null;
  preferences: { code: string; domain: RolePreferenceDomain; weight: number }[];
  interests: string[];
  dietaryRestrictions: { allergen: string; level: AllergyLevel }[];
  age: number | null;
  hasPendingPhotoConsent: boolean;
  requiresGuardianDocument: boolean;
  show: { id: string; title: string | null; year: number } | null;
  invite: OnboardingInviteSummary | null;
};

export type OnboardingAnalytics = {
  invites: {
    total: number;
    active: number;
    expired: number;
    disabled: number;
    exhausted: number;
    totalUsage: number;
  };
  inviteUsage: {
    id: string;
    label: string | null;
    createdAt: string;
    usageCount: number;
    remainingUses: number | null;
    isActive: boolean;
    show: { id: string; title: string | null; year: number } | null;
  }[];
  completions: {
    total: number;
    byFocus: Record<OnboardingFocus, number>;
  };
  interests: OnboardingInterestStat[];
  rolePreferences: OnboardingRolePreferenceStat[];
  dietary: { level: AllergyLevel; count: number }[];
  minorsPendingDocuments: number;
  pendingPhotoConsents: number;
  shows: OnboardingShowSummary[];
  talentProfiles: OnboardingTalentProfile[];
  showAggregations: Record<string, OnboardingShowAggregations>;
};

type ShowSummaryAccumulator = {
  show: { id: string; title: string | null; year: number };
  invites: {
    total: number;
    active: number;
    expired: number;
    disabled: number;
    exhausted: number;
    totalUsage: number;
  };
  onboardingCount: number;
  completedCount: number;
  focus: Record<OnboardingFocus, number>;
  pendingPhotoConsents: number;
  guardianDocumentsMissing: number;
  interestCounts: Map<string, number>;
  rolePreferenceTotals: Map<
    string,
    { domain: RolePreferenceDomain; code: string; total: number; responses: number }
  >;
};

function ensureShowSummary(
  map: Map<string, ShowSummaryAccumulator>,
  show: { id: string; title: string | null; year: number },
) {
  let summary = map.get(show.id);
  if (!summary) {
    summary = {
      show: { id: show.id, title: show.title, year: show.year },
      invites: { total: 0, active: 0, expired: 0, disabled: 0, exhausted: 0, totalUsage: 0 },
      onboardingCount: 0,
      completedCount: 0,
      focus: { acting: 0, tech: 0, both: 0 },
      pendingPhotoConsents: 0,
      guardianDocumentsMissing: 0,
      interestCounts: new Map(),
      rolePreferenceTotals: new Map(),
    } satisfies ShowSummaryAccumulator;
    map.set(show.id, summary);
  }
  return summary;
}

export async function collectOnboardingAnalytics(now: Date = new Date()): Promise<OnboardingAnalytics> {
  const [
    invites,
    profileRecords,
    rolePreferences,
    interestEntries,
    dietaryGroups,
    dietaryDetails,
    pendingPhotoConsents,
  ] = await Promise.all([
    prisma.memberInvite.findMany({
      include: {
        redemptions: { select: { id: true, completedAt: true } },
        show: { select: { id: true, title: true, year: true } },
      },
    }),
    prisma.memberOnboardingProfile.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            dateOfBirth: true,
            photoConsent: { select: { status: true, documentUploadedAt: true } },
          },
        },
        invite: {
          select: {
            id: true,
            label: true,
            expiresAt: true,
            maxUses: true,
            usageCount: true,
            isDisabled: true,
            showId: true,
            show: { select: { id: true, title: true, year: true } },
          },
        },
        redemption: { select: { completedAt: true } },
        show: { select: { id: true, title: true, year: true } },
      },
    }),
    prisma.memberRolePreference.findMany({ select: { userId: true, code: true, domain: true, weight: true } }),
    prisma.userInterest.findMany({ include: { interest: true } }),
    prisma.dietaryRestriction.groupBy({
      by: ["level"],
      _count: { level: true },
      where: { isActive: true },
    }),
    prisma.dietaryRestriction.findMany({
      where: { isActive: true },
      select: { userId: true, allergen: true, level: true },
    }),
    prisma.photoConsent.count({ where: { status: "pending" } }),
  ]);

  const showSummaries = new Map<string, ShowSummaryAccumulator>();

  const inviteStats = invites.reduce(
    (acc, invite) => {
      const status = calculateInviteStatus(invite, now);
      acc.total += 1;
      acc.totalUsage += invite.usageCount;
      if (status.isActive) acc.active += 1;
      if (status.isExpired) acc.expired += 1;
      if (status.isExhausted) acc.exhausted += 1;
      if (invite.isDisabled) acc.disabled += 1;

      if (invite.show) {
        const summary = ensureShowSummary(showSummaries, invite.show);
        summary.invites.total += 1;
        summary.invites.totalUsage += invite.usageCount;
        if (status.isActive) summary.invites.active += 1;
        if (status.isExpired) summary.invites.expired += 1;
        if (status.isExhausted) summary.invites.exhausted += 1;
        if (invite.isDisabled) summary.invites.disabled += 1;
      }

      return acc;
    },
    { total: 0, active: 0, expired: 0, disabled: 0, exhausted: 0, totalUsage: 0 },
  );

  const inviteUsage = invites
    .map((invite) => {
      const status = calculateInviteStatus(invite, now);
      return {
        id: invite.id,
        label: invite.label,
        createdAt: invite.createdAt.toISOString(),
        usageCount: invite.usageCount,
        remainingUses: status.remainingUses,
        isActive: status.isActive,
        show: invite.show ? { id: invite.show.id, title: invite.show.title, year: invite.show.year } : null,
      };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const focusCounts: Record<OnboardingFocus, number> = {
    acting: 0,
    tech: 0,
    both: 0,
  };
  for (const profile of profileRecords) {
    focusCounts[profile.focus] = (focusCounts[profile.focus] ?? 0) + 1;
    const show = profile.show ?? profile.invite?.show ?? null;
    if (show) {
      const summary = ensureShowSummary(showSummaries, show);
      summary.onboardingCount += 1;
      summary.focus[profile.focus] = (summary.focus[profile.focus] ?? 0) + 1;
    }
  }

  const interestMap = new Map<string, number>();
  const interestsByUser = new Map<string, string[]>();
  for (const entry of interestEntries) {
    const name = entry.interest?.name ?? "Sonstige";
    interestMap.set(name, (interestMap.get(name) ?? 0) + 1);
    const list = interestsByUser.get(entry.userId) ?? [];
    list.push(name);
    interestsByUser.set(entry.userId, list);
  }
  for (const [userId, list] of interestsByUser) {
    const unique = Array.from(new Set(list));
    unique.sort((a, b) => a.localeCompare(b, "de-DE"));
    interestsByUser.set(userId, unique);
  }
  const interests = Array.from(interestMap.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  const preferenceKey = (domain: RolePreferenceDomain, code: string) => `${domain}:${code}`;
  const prefMap = new Map<string, { domain: RolePreferenceDomain; code: string; total: number; responses: number }>();
  const preferencesByUser = new Map<string, { code: string; domain: RolePreferenceDomain; weight: number }[]>();
  for (const pref of rolePreferences) {
    const key = preferenceKey(pref.domain, pref.code);
    if (!prefMap.has(key)) {
      prefMap.set(key, { domain: pref.domain, code: pref.code, total: 0, responses: 0 });
    }
    const bucket = prefMap.get(key)!;
    bucket.total += pref.weight;
    bucket.responses += 1;
    const userPrefs = preferencesByUser.get(pref.userId) ?? [];
    userPrefs.push({ code: pref.code, domain: pref.domain, weight: pref.weight });
    preferencesByUser.set(pref.userId, userPrefs);
  }
  for (const [userId, entries] of preferencesByUser) {
    entries.sort((a, b) => b.weight - a.weight || a.code.localeCompare(b.code));
    preferencesByUser.set(userId, entries);
  }
  const rolePrefStats = Array.from(prefMap.values())
    .map((bucket) => ({
      code: bucket.code,
      domain: bucket.domain,
      responses: bucket.responses,
      averageWeight: bucket.responses ? Math.round((bucket.total / bucket.responses) * 10) / 10 : 0,
    }))
    .sort((a, b) => b.averageWeight - a.averageWeight || a.code.localeCompare(b.code));

  const dietary = dietaryGroups
    .map((group) => ({ level: group.level, count: group._count.level }))
    .sort((a, b) => b.count - a.count);

  const dietaryByUser = new Map<string, { allergen: string; level: AllergyLevel }[]>();
  for (const entry of dietaryDetails) {
    const list = dietaryByUser.get(entry.userId) ?? [];
    list.push({ allergen: entry.allergen, level: entry.level });
    dietaryByUser.set(entry.userId, list);
  }
  for (const [userId, list] of dietaryByUser) {
    list.sort((a, b) => a.allergen.localeCompare(b.allergen, "de-DE"));
    dietaryByUser.set(userId, list);
  }

  const majorityFocusTotal = profileRecords.length;
  const completions = {
    total: majorityFocusTotal,
    byFocus: focusCounts,
  };

  const minorCutoff = new Date(now);
  minorCutoff.setFullYear(minorCutoff.getFullYear() - 18);
  const minorsPendingDocuments = await prisma.user.count({
    where: {
      dateOfBirth: { gt: minorCutoff },
      OR: [{ photoConsent: null }, { photoConsent: { documentUploadedAt: null } }],
    },
  });

  const talentProfiles = profileRecords
    .map((profile) => {
      const user = profile.user;
      const userId = user?.id ?? profile.userId;
      const completedAt = profile.redemption?.completedAt ?? null;
      const preferences = preferencesByUser.get(userId) ?? [];
      const interestsForUser = interestsByUser.get(userId) ?? [];
      const dietaryEntries = dietaryByUser.get(userId) ?? [];
      const age = calculateAge(user?.dateOfBirth ?? null);
      const hasPendingPhotoConsent = user?.photoConsent?.status === "pending";
      const requiresGuardianDocument =
        typeof age === "number" && age < 18 && (!user?.photoConsent || !user.photoConsent.documentUploadedAt);
      const show = profile.show ?? profile.invite?.show ?? null;

      if (show) {
        const summary = ensureShowSummary(showSummaries, show);
        if (completedAt) {
          summary.completedCount += 1;
        }
        if (hasPendingPhotoConsent) {
          summary.pendingPhotoConsents += 1;
        }
        if (requiresGuardianDocument) {
          summary.guardianDocumentsMissing += 1;
        }
        for (const interest of interestsForUser) {
          summary.interestCounts.set(interest, (summary.interestCounts.get(interest) ?? 0) + 1);
        }
        for (const pref of preferences) {
          const key = preferenceKey(pref.domain, pref.code);
          if (!summary.rolePreferenceTotals.has(key)) {
            summary.rolePreferenceTotals.set(key, {
              domain: pref.domain,
              code: pref.code,
              total: 0,
              responses: 0,
            });
          }
          const bucket = summary.rolePreferenceTotals.get(key)!;
          bucket.total += pref.weight;
          bucket.responses += 1;
        }
      }

      const inviteSummary: OnboardingInviteSummary | null = profile.invite
        ? (() => {
            const status = calculateInviteStatus(profile.invite, now);
            return {
              id: profile.invite.id,
              label: profile.invite.label?.trim() || null,
              expiresAt: profile.invite.expiresAt ? profile.invite.expiresAt.toISOString() : null,
              isActive: status.isActive,
              isExpired: status.isExpired,
              isDisabled: status.isDisabled,
              isExhausted: status.isExhausted,
              remainingUses: status.remainingUses,
              usageCount: profile.invite.usageCount,
              maxUses: profile.invite.maxUses ?? null,
              showId: profile.invite.showId,
            } satisfies OnboardingInviteSummary;
          })()
        : null;

      return {
        id: profile.id,
        userId,
        name: user?.name?.trim() || null,
        email: user?.email?.trim() || null,
        focus: profile.focus,
        background: profile.background?.trim() || null,
        backgroundClass: profile.backgroundClass?.trim() || null,
        notes: profile.notes?.trim() || null,
        gender: profile.gender?.trim() || null,
        memberSinceYear: profile.memberSinceYear ?? null,
        inviteLabel: profile.invite?.label?.trim() || null,
        createdAt: profile.createdAt.toISOString(),
        completedAt: completedAt ? completedAt.toISOString() : null,
        dietaryPreference: profile.dietaryPreference?.trim() || null,
        dietaryPreferenceStrictness: profile.dietaryPreferenceStrictness?.trim() || null,
        preferences,
        interests: interestsForUser,
        dietaryRestrictions: dietaryEntries,
        age,
        hasPendingPhotoConsent,
        requiresGuardianDocument,
        show: show ? { id: show.id, title: show.title, year: show.year } : null,
        invite: inviteSummary,
      } satisfies OnboardingTalentProfile;
    })
    .sort((a, b) => {
      const aTime = a.completedAt ? new Date(a.completedAt).getTime() : new Date(a.createdAt).getTime();
      const bTime = b.completedAt ? new Date(b.completedAt).getTime() : new Date(b.createdAt).getTime();
      return bTime - aTime;
    });

  const showAggregations = new Map<string, OnboardingShowAggregations>();

  const shows = Array.from(showSummaries.values())
    .map((summary) => {
      const interests = Array.from(summary.interestCounts.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "de-DE"));

      const rolePreferences = Array.from(summary.rolePreferenceTotals.values())
        .map((bucket) => ({
          code: bucket.code,
          domain: bucket.domain,
          responses: bucket.responses,
          averageWeight: bucket.responses
            ? Math.round((bucket.total / bucket.responses) * 10) / 10
            : 0,
        }))
        .sort((a, b) => b.averageWeight - a.averageWeight || a.code.localeCompare(b.code));

      const aggregates: OnboardingShowAggregations = {
        interests,
        rolePreferences,
      };

      showAggregations.set(summary.show.id, aggregates);

      return {
        id: summary.show.id,
        title: summary.show.title,
        year: summary.show.year,
        onboardingCount: summary.onboardingCount,
        completedCount: summary.completedCount,
        openCount: Math.max(summary.onboardingCount - summary.completedCount, 0),
        focus: { ...summary.focus },
        pendingPhotoConsents: summary.pendingPhotoConsents,
        guardianDocumentsMissing: summary.guardianDocumentsMissing,
        invites: { ...summary.invites },
        interests,
        rolePreferences,
      } satisfies OnboardingShowSummary;
    })
    .sort((a, b) => b.year - a.year || (a.title ?? "").localeCompare(b.title ?? "", "de-DE"));

  return {
    invites: inviteStats,
    inviteUsage,
    completions,
    interests,
    rolePreferences: rolePrefStats,
    dietary,
    minorsPendingDocuments,
    pendingPhotoConsents,
    shows,
    talentProfiles,
    showAggregations: Object.fromEntries(showAggregations.entries()),
  };
}

function calculateAge(date: Date | string | null | undefined): number | null {
  if (!date) return null;
  const reference = typeof date === "string" ? new Date(date) : date;
  if (!(reference instanceof Date) || Number.isNaN(reference.valueOf())) {
    return null;
  }
  const now = new Date();
  let age = now.getFullYear() - reference.getFullYear();
  const monthDiff = now.getMonth() - reference.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < reference.getDate())) {
    age -= 1;
  }
  return age;
}
