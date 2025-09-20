import type { AllergyLevel, OnboardingFocus, RolePreferenceDomain } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { calculateInviteStatus } from "@/lib/member-invites";

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
  }[];
  completions: {
    total: number;
    byFocus: Record<OnboardingFocus, number>;
  };
  interests: { name: string; count: number }[];
  rolePreferences: { code: string; domain: RolePreferenceDomain; averageWeight: number; responses: number }[];
  dietary: { level: AllergyLevel; count: number }[];
  minorsPendingDocuments: number;
  pendingPhotoConsents: number;
};

export async function collectOnboardingAnalytics(now: Date = new Date()): Promise<OnboardingAnalytics> {
  const [invites, profiles, rolePreferences, interestEntries, dietaryGroups, pendingPhotoConsents] = await Promise.all([
    prisma.memberInvite.findMany({
      include: { redemptions: { select: { id: true, completedAt: true } } },
    }),
    prisma.memberOnboardingProfile.findMany({ select: { focus: true } }),
    prisma.memberRolePreference.findMany({ select: { code: true, domain: true, weight: true } }),
    prisma.userInterest.findMany({ include: { interest: true } }),
    prisma.dietaryRestriction.groupBy({
      by: ["level"],
      _count: { level: true },
      where: { isActive: true },
    }),
    prisma.photoConsent.count({ where: { status: "pending" } }),
  ]);

  const inviteStats = invites.reduce(
    (acc, invite) => {
      const status = calculateInviteStatus(invite, now);
      acc.total += 1;
      acc.totalUsage += invite.usageCount;
      if (status.isActive) acc.active += 1;
      if (status.isExpired) acc.expired += 1;
      if (status.isExhausted) acc.exhausted += 1;
      if (invite.isDisabled) acc.disabled += 1;
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
      };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const focusCounts: Record<OnboardingFocus, number> = {
    acting: 0,
    tech: 0,
    both: 0,
  };
  for (const profile of profiles) {
    focusCounts[profile.focus] = (focusCounts[profile.focus] ?? 0) + 1;
  }

  const interestMap = new Map<string, number>();
  for (const entry of interestEntries) {
    const name = entry.interest?.name ?? "Sonstige";
    interestMap.set(name, (interestMap.get(name) ?? 0) + 1);
  }
  const interests = Array.from(interestMap.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  const preferenceKey = (domain: RolePreferenceDomain, code: string) => `${domain}:${code}`;
  const prefMap = new Map<string, { domain: RolePreferenceDomain; code: string; total: number; responses: number }>();
  for (const pref of rolePreferences) {
    const key = preferenceKey(pref.domain, pref.code);
    if (!prefMap.has(key)) {
      prefMap.set(key, { domain: pref.domain, code: pref.code, total: 0, responses: 0 });
    }
    const bucket = prefMap.get(key)!;
    bucket.total += pref.weight;
    bucket.responses += 1;
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

  const majorityFocusTotal = profiles.length;
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

  return {
    invites: inviteStats,
    inviteUsage,
    completions,
    interests,
    rolePreferences: rolePrefStats,
    dietary,
    minorsPendingDocuments,
    pendingPhotoConsents,
  };
}
