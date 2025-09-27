import { cache } from "react";
import { differenceInYears, isAfter, isBefore, isWithinInterval } from "date-fns";

import { prisma } from "@/lib/prisma";
import type { AllergyLevel, OnboardingFocus } from "@prisma/client";
import {
  onboardingDashboardSchema,
  onboardingSummarySchema,
  type AllocationCandidate,
  type AllocationRole,
  type OnboardingDashboardData,
  type OnboardingSummary,
} from "./dashboard-schemas";

interface DateRange {
  start?: Date | null;
  end?: Date | null;
}

function normalizeTitle(show: { title: string | null; year: number }): string {
  if (show.title && show.title.trim()) {
    return show.title.trim();
  }
  return `Produktion ${show.year}`;
}

function extractDateRange(raw: unknown): DateRange {
  if (!raw) {
    return {};
  }

  if (Array.isArray(raw)) {
    const parsed = raw
      .map((value) => {
        if (typeof value === "string" || value instanceof Date) {
          const date = value instanceof Date ? value : new Date(value);
          return Number.isNaN(date.getTime()) ? null : date;
        }
        if (value && typeof value === "object" && "date" in (value as Record<string, unknown>)) {
          const extracted = (value as Record<string, unknown>).date;
          if (typeof extracted === "string" || extracted instanceof Date) {
            const date = extracted instanceof Date ? extracted : new Date(extracted);
            return Number.isNaN(date.getTime()) ? null : date;
          }
        }
        return null;
      })
      .filter((date): date is Date => Boolean(date));

    if (parsed.length === 0) {
      return {};
    }

    const sorted = parsed.sort((a, b) => a.getTime() - b.getTime());
    return { start: sorted[0], end: sorted[sorted.length - 1] };
  }

  if (typeof raw === "object" && raw) {
    const candidate = raw as Record<string, unknown>;
    const startRaw = candidate.start ?? candidate.begin ?? candidate.from;
    const endRaw = candidate.end ?? candidate.until ?? candidate.to;
    const start =
      typeof startRaw === "string" || startRaw instanceof Date ? new Date(startRaw) : undefined;
    const end = typeof endRaw === "string" || endRaw instanceof Date ? new Date(endRaw) : undefined;

    return {
      start: start && !Number.isNaN(start.getTime()) ? start : undefined,
      end: end && !Number.isNaN(end.getTime()) ? end : undefined,
    };
  }

  if (typeof raw === "string" || raw instanceof Date) {
    const date = raw instanceof Date ? raw : new Date(raw);
    return Number.isNaN(date.getTime()) ? {} : { start: date, end: date };
  }

  return {};
}

function formatDateRange(range: DateRange): string | null {
  const { start, end } = range;
  if (!start && !end) {
    return null;
  }

  const formatterLong = new Intl.DateTimeFormat("de-DE", {
    month: "short",
    year: "numeric",
  });
  const formatterDay = new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  if (start && end) {
    if (start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth()) {
      return `${formatterDay.format(start)} – ${formatterDay.format(end)}`;
    }
    return `${formatterLong.format(start)} – ${formatterLong.format(end)}`;
  }

  const single = start ?? end;
  return single ? formatterLong.format(single) : null;
}

function deriveStatus(
  show: {
    revealedAt: Date | null;
    finalRehearsalWeekStart: Date | null;
  },
  range: DateRange,
): { status: OnboardingSummary["status"]; label: string } {
  const now = new Date();
  const start = range.start ?? show.revealedAt ?? null;
  const end = range.end ?? show.finalRehearsalWeekStart ?? null;

  if (!show.revealedAt || isAfter(now, show.revealedAt) === false) {
    return { status: "draft", label: "In Vorbereitung" };
  }

  if (end && isBefore(end, now)) {
    return { status: "completed", label: "Abgeschlossen" };
  }

  if (start && isBefore(start, now) && (!end || isAfter(end, now))) {
    return { status: "active", label: "Aktiv" };
  }

  return { status: "active", label: "Aktiv" };
}

function roundTo(value: number, fractionDigits = 1): number {
  const factor = 10 ** fractionDigits;
  return Math.round(value * factor) / factor;
}

function toPercentage(value: number, total: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(total) || total <= 0) {
    return 0;
  }
  return (value / total) * 100;
}

function computeAge(dateOfBirth: Date | null | undefined): number | null {
  if (!dateOfBirth) {
    return null;
  }
  const age = differenceInYears(new Date(), dateOfBirth);
  return Number.isFinite(age) && age >= 0 ? age : null;
}

function classifyAge(age: number): string {
  if (age < 18) return "<18";
  if (age < 26) return "18–25";
  if (age < 41) return "26–40";
  return ">40";
}

function shannonIndex(counts: number[]): number {
  const total = counts.reduce((sum, value) => sum + value, 0);
  if (total === 0) {
    return 0;
  }
  return counts.reduce((entropy, count) => {
    if (count <= 0) return entropy;
    const p = count / total;
    return entropy - p * Math.log(p);
  }, 0);
}

function giniIndex(counts: number[]): number {
  const total = counts.reduce((sum, value) => sum + value, 0);
  if (total === 0) {
    return 0;
  }
  const sorted = [...counts].sort((a, b) => a - b);
  const cumulative = sorted.reduce(
    (acc, value, index) => acc + value * (index + 1),
    0,
  );
  return (2 * cumulative) / (total * counts.length) - (counts.length + 1) / counts.length;
}

function severityLabel(level: AllergyLevel): "mild" | "moderat" | "schwer" | "akut" {
  switch (level) {
    case "MILD":
      return "mild";
    case "MODERATE":
      return "moderat";
    case "SEVERE":
      return "schwer";
    case "LETHAL":
      return "akut";
    default:
      return "mild";
  }
}

function formatPercentage(value: number, fractionDigits = 1): string {
  return `${roundTo(value, fractionDigits).toLocaleString("de-DE", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })}%`;
}

function determineFocusIntent(focus: OnboardingFocus): "success" | "warning" | "default" {
  switch (focus) {
    case "acting":
      return "success";
    case "tech":
      return "warning";
    default:
      return "default";
  }
}

function normalizeConfidence(score: number, maxScore: number): number {
  if (maxScore <= 0) {
    return 0;
  }
  return Math.min(1, score / maxScore);
}

interface CandidateInput {
  userId: string;
  name: string;
  focus: OnboardingFocus | null;
  interests: string[];
  experienceYears: number | null;
  actingShares: Map<string, number>;
  crewShares: Map<string, number>;
}

interface BuildAllocationArgs {
  roles: AllocationRole[];
  candidates: CandidateInput[];
}

function recomputeAllocation({ roles, candidates }: BuildAllocationArgs): AllocationRole[] {
  const candidateLookup = new Map<string, CandidateInput>();
  candidates.forEach((candidate) => {
    candidateLookup.set(candidate.userId, candidate);
  });

  return roles.map((role) => {
    const baseCandidates = role.candidates
      .map((candidate) => {
        const source = candidateLookup.get(candidate.userId);
        if (!source) {
          return candidate;
        }
        const share =
          role.domain === "acting"
            ? source.actingShares.get(role.roleId) ?? candidate.normalizedShare
            : source.crewShares.get(role.roleId) ?? candidate.normalizedShare;

        const focusAlignment = source.focus === "both" || source.focus === (role.domain === "acting" ? "acting" : "tech");
        const qualityFactor = focusAlignment ? candidate.qualityFactor + 0.1 : candidate.qualityFactor;
        const score = share * qualityFactor;
        const maxScore = Math.max(...role.candidates.map((item) => item.score), 1);

        return {
          ...candidate,
          normalizedShare: share,
          qualityFactor,
          score,
          confidence: normalizeConfidence(score, maxScore),
        } satisfies AllocationCandidate;
      })
      .sort((a, b) => b.score - a.score);

    return {
      ...role,
      candidates: baseCandidates,
    } satisfies AllocationRole;
  });
}

function buildConflictList(roles: AllocationRole[]): OnboardingDashboardData["allocation"]["conflicts"] {
  return roles
    .flatMap((role) => {
      if (role.candidates.length < 2) {
        return [];
      }
      const [primary, secondary] = role.candidates;
      const delta = Math.abs(primary.score - secondary.score);
      if (delta > 0.05) {
        return [];
      }
      return [
        {
          roleId: role.roleId,
          label: role.label,
          candidates: role.candidates.slice(0, 3).map((candidate) => ({
            userId: candidate.userId,
            name: candidate.name,
            score: roundTo(candidate.score, 3),
            tieBreaker: candidate.justification,
          })),
        },
      ];
    })
    .slice(0, 12);
}

function buildFairnessMetrics(
  profiles: Array<{
    gender: string | null;
    memberSinceYear: number | null;
    focus: OnboardingFocus;
  }>,
): OnboardingDashboardData["allocation"]["fairness"] {
  const genders = profiles.reduce(
    (acc, profile) => {
      const key = profile.gender?.toLowerCase() ?? "divers";
      acc.set(key, (acc.get(key) ?? 0) + 1);
      return acc;
    },
    new Map<string, number>(),
  );

  const total = profiles.length || 1;
  const femaleShare = genders.get("weiblich") ?? genders.get("f") ?? 0;
  const maleShare = genders.get("männlich") ?? genders.get("m") ?? 0;
  const otherShare = total - femaleShare - maleShare;
  const femalePercentage = toPercentage(femaleShare, total);
  const malePercentage = toPercentage(maleShare, total);
  const target = 50;
  const genderDelta = Math.abs(femalePercentage - malePercentage);

  const fairnessStatus = genderDelta <= 15 ? "ok" : genderDelta <= 25 ? "warning" : "critical";

  const now = new Date();
  const experienceYears = profiles
    .map((profile) => (profile.memberSinceYear ? now.getFullYear() - profile.memberSinceYear : null))
    .filter((value): value is number => value !== null && Number.isFinite(value));
  const averageExperience =
    experienceYears.length > 0
      ? experienceYears.reduce((sum, value) => sum + value, 0) / experienceYears.length
      : 0;

  const noviceShare = toPercentage(
    experienceYears.filter((value) => value <= 1).length,
    profiles.length || 1,
  );
  const veteranShare = toPercentage(
    experienceYears.filter((value) => value >= 5).length,
    profiles.length || 1,
  );

  const focusBothShare = toPercentage(
    profiles.filter((profile) => profile.focus === "both").length,
    profiles.length || 1,
  );

  return [
    {
      id: "gender-balance",
      label: "Geschlechterverteilung",
      value: roundTo(femalePercentage),
      target,
      status: fairnessStatus,
      description: `♀︎ ${roundTo(femalePercentage)}% / ♂︎ ${roundTo(malePercentage)}% / Divers ${roundTo(otherShare ? toPercentage(otherShare, total) : 0)}%`,
    },
    {
      id: "experience-mix",
      label: "Erfahrungsmix",
      value: roundTo(averageExperience, 1),
      target: 3,
      status: averageExperience >= 2 && averageExperience <= 4 ? "ok" : averageExperience < 2 ? "warning" : "critical",
      description: `Newcomer ${roundTo(noviceShare)}% · Veteranen ${roundTo(veteranShare)}%`,
    },
    {
      id: "focus-balance",
      label: "Fokus-Balance",
      value: roundTo(focusBothShare),
      target: 35,
      status: focusBothShare >= 25 && focusBothShare <= 45 ? "ok" : focusBothShare < 25 ? "warning" : "critical",
      description: "Anteil Personen mit Doppel-Fokus acting/tech",
    },
  ];
}

export const getAvailableOnboardings = cache(async (): Promise<OnboardingSummary[]> => {
  const shows = await prisma.show.findMany({
    orderBy: { year: "desc" },
    take: 12,
  });

  return shows.map((show) => {
    const range = extractDateRange(show.dates);
    const summary = onboardingSummarySchema.parse({
      id: show.id,
      title: normalizeTitle(show),
      periodLabel: formatDateRange(range),
      status: deriveStatus(show, range).status,
    });
    return summary;
  });
});

export const getOnboardingDashboardData = cache(async (
  onboardingId: string,
): Promise<OnboardingDashboardData | null> => {
  const show = await prisma.show.findUnique({
    where: { id: onboardingId },
    select: {
      id: true,
      year: true,
      title: true,
      dates: true,
      revealedAt: true,
      finalRehearsalWeekStart: true,
      meta: true,
      onboardingProfiles: {
        select: {
          id: true,
          user: {
            select: {
              id: true,
              name: true,
              firstName: true,
              lastName: true,
              dateOfBirth: true,
              photoConsent: {
                select: {
                  status: true,
                  consentGiven: true,
                  documentUploadedAt: true,
                },
              },
              dietaryRestrictions: {
                select: {
                  allergen: true,
                  level: true,
                  isActive: true,
                },
              },
            },
          },
          gender: true,
          focus: true,
          dietaryPreference: true,
          dietaryPreferenceStrictness: true,
          memberSinceYear: true,
          createdAt: true,
        },
      },
    },
  });

  if (!show) {
    return null;
  }

  const profileUserIds = show.onboardingProfiles.map((profile) => profile.user.id);

  const [rolePreferences, interests, memberships] = await Promise.all([
    prisma.memberRolePreference.findMany({
      where: { userId: { in: profileUserIds } },
      select: {
        userId: true,
        code: true,
        domain: true,
        weight: true,
      },
    }),
    prisma.userInterest.findMany({
      where: { userId: { in: profileUserIds } },
      include: {
        interest: { select: { name: true } },
      },
    }),
    prisma.productionMembership.findMany({
      where: {
        showId: onboardingId,
      },
      select: {
        userId: true,
        joinedAt: true,
      },
    }),
  ]);

  const range = extractDateRange(show.dates);
  const status = deriveStatus(show, range);
  const timeSpan = formatDateRange(range);
  const participants = show.onboardingProfiles.length;

  const onboardingSummary = onboardingSummarySchema.parse({
    id: show.id,
    title: normalizeTitle(show),
    periodLabel: timeSpan,
    status: status.status,
  });

  const now = new Date();
  const newLastWeek = show.onboardingProfiles.filter((profile) =>
    isWithinInterval(profile.createdAt, {
      start: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
      end: now,
    }),
  ).length;
  const newLastMonth = show.onboardingProfiles.filter((profile) =>
    isWithinInterval(profile.createdAt, {
      start: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
      end: now,
    }),
  ).length;

  const ages = show.onboardingProfiles
    .map((profile) => computeAge(profile.user.dateOfBirth))
    .filter((value): value is number => value !== null)
    .sort((a, b) => a - b);
  const medianAge =
    ages.length === 0
      ? null
      : ages.length % 2 === 1
        ? ages[(ages.length - 1) / 2]
        : (ages[ages.length / 2 - 1] + ages[ages.length / 2]) / 2;

  const ageGroups = show.onboardingProfiles.reduce(
    (acc, profile) => {
      const age = computeAge(profile.user.dateOfBirth);
      if (age === null) {
        return acc;
      }
      const label = classifyAge(age);
      acc.set(label, (acc.get(label) ?? 0) + 1);
      return acc;
    },
    new Map<string, number>(),
  );

  const genderDistribution = show.onboardingProfiles.reduce(
    (acc, profile) => {
      const key = profile.gender?.trim().toLowerCase() || "divers";
      acc.set(key, (acc.get(key) ?? 0) + 1);
      return acc;
    },
    new Map<string, number>(),
  );

  const focusDistribution = show.onboardingProfiles.reduce(
    (acc, profile) => {
      acc.set(profile.focus, (acc.get(profile.focus) ?? 0) + 1);
      return acc;
    },
    new Map<OnboardingFocus, number>(),
  );

  const consentCount = show.onboardingProfiles.filter(
    (profile) => profile.user.photoConsent?.consentGiven && profile.user.photoConsent.status === "approved",
  ).length;

  const actingTotals = new Map<string, { shareSum: number; userCount: number }>();
  const crewTotals = new Map<string, { shareSum: number; userCount: number }>();
  const userDomainTotals = new Map<string, { acting: number; crew: number }>();

  rolePreferences.forEach((preference) => {
    const totals = userDomainTotals.get(preference.userId) ?? { acting: 0, crew: 0 };
    if (preference.domain === "acting") {
      totals.acting += Math.max(0, preference.weight);
    } else {
      totals.crew += Math.max(0, preference.weight);
    }
    userDomainTotals.set(preference.userId, totals);
  });

  const actingSharesByUser = new Map<string, Map<string, number>>();
  const crewSharesByUser = new Map<string, Map<string, number>>();

  rolePreferences.forEach((preference) => {
    const totals = userDomainTotals.get(preference.userId);
    const total = preference.domain === "acting" ? totals?.acting ?? 0 : totals?.crew ?? 0;
    const normalized = total > 0 ? preference.weight / total : 0;

    const targetMap = preference.domain === "acting" ? actingSharesByUser : crewSharesByUser;
    const existing = targetMap.get(preference.userId) ?? new Map<string, number>();
    existing.set(preference.code, normalized);
    targetMap.set(preference.userId, existing);

    if (preference.domain === "acting") {
      const aggregate = actingTotals.get(preference.code) ?? { shareSum: 0, userCount: 0 };
      aggregate.shareSum += normalized;
      aggregate.userCount += normalized > 0 ? 1 : 0;
      actingTotals.set(preference.code, aggregate);
    } else {
      const aggregate = crewTotals.get(preference.code) ?? { shareSum: 0, userCount: 0 };
      aggregate.shareSum += normalized;
      aggregate.userCount += normalized > 0 ? 1 : 0;
      crewTotals.set(preference.code, aggregate);
    }
  });

  const uniqueActingUsers = new Set(actingSharesByUser.keys());
  const uniqueCrewUsers = new Set(crewSharesByUser.keys());

  const roleHeatmap: Array<{ x: string; y: string; value: number }> = [];
  actingSharesByUser.forEach((actingRoles, userId) => {
    const crewRoles = crewSharesByUser.get(userId);
    if (!crewRoles) {
      return;
    }
    actingRoles.forEach((actingValue, actingRole) => {
      crewRoles.forEach((crewValue, crewRole) => {
        roleHeatmap.push({
          x: actingRole,
          y: crewRole,
          value: roundTo(actingValue * crewValue, 3),
        });
      });
    });
  });

  const interestCounts = new Map<string, number>();
  const userInterestMap = new Map<string, string[]>();
  interests.forEach((entry) => {
    const tag = entry.interest?.name?.trim();
    if (!tag) {
      return;
    }
    interestCounts.set(tag, (interestCounts.get(tag) ?? 0) + 1);
    const collection = userInterestMap.get(entry.userId) ?? [];
    collection.push(tag);
    userInterestMap.set(entry.userId, collection);
  });

  const interestCoOccurrences = new Map<string, Map<string, number>>();
  userInterestMap.forEach((tags) => {
    const uniqueTags = Array.from(new Set(tags)).sort();
    for (let i = 0; i < uniqueTags.length; i += 1) {
      for (let j = i + 1; j < uniqueTags.length; j += 1) {
        const a = uniqueTags[i];
        const b = uniqueTags[j];
        const source = interestCoOccurrences.get(a) ?? new Map<string, number>();
        source.set(b, (source.get(b) ?? 0) + 1);
        interestCoOccurrences.set(a, source);
      }
    }
  });

  const interestClusters = new Map<string, number>();
  interestCounts.forEach((count, tag) => {
    const lower = tag.toLowerCase();
    let cluster = "allgemein";
    if (/(schauspiel|theater|rolle)/.test(lower)) {
      cluster = "Schauspiel";
    } else if (/(technik|bühne|licht|ton)/.test(lower)) {
      cluster = "Technik";
    } else if (/(musik|chor|instrument)/.test(lower)) {
      cluster = "Musik";
    } else if (/(orga|produktion|management)/.test(lower)) {
      cluster = "Orga";
    }
    interestClusters.set(cluster, (interestClusters.get(cluster) ?? 0) + count);
  });

  const diversityCounts = Array.from(interestCounts.values());
  const shannon = shannonIndex(diversityCounts);
  const maxShannon = diversityCounts.length > 0 ? Math.log(diversityCounts.length) : 1;
  const normalizedDiversity = maxShannon > 0 ? shannon / maxShannon : 0;
  const gini = giniIndex(diversityCounts);
  const diversityStatus =
    normalizedDiversity >= 0.65 ? "ok" : normalizedDiversity >= 0.45 ? "warning" : "critical";

  const diets = show.onboardingProfiles.reduce(
    (acc, profile) => {
      if (!profile.dietaryPreference) {
        return acc;
      }
      const key = profile.dietaryPreference;
      acc.set(key, (acc.get(key) ?? 0) + 1);
      return acc;
    },
    new Map<string, number>(),
  );

  const allergies = new Map<string, Map<string, number>>();
  show.onboardingProfiles.forEach((profile) => {
    profile.user.dietaryRestrictions.forEach((restriction) => {
      if (!restriction.isActive) {
        return;
      }
      const allergen = restriction.allergen;
      const severity = severityLabel(restriction.level);
      const store = allergies.get(allergen) ?? new Map<string, number>();
      store.set(severity, (store.get(severity) ?? 0) + 1);
      allergies.set(allergen, store);
    });
  });

  const steps = [
    {
      id: "signup",
      label: "Registrierung",
      completionRate: toPercentage(profileUserIds.length, profileUserIds.length || 1),
    },
    {
      id: "profile",
      label: "Profil ausgefüllt",
      completionRate: toPercentage(
        show.onboardingProfiles.filter((profile) => profile.focus && profile.gender).length,
        profileUserIds.length || 1,
      ),
    },
    {
      id: "preferences",
      label: "Präferenzen",
      completionRate: toPercentage(rolePreferences.length, profileUserIds.length || 1),
    },
    {
      id: "documents",
      label: "Dokumente",
      completionRate: toPercentage(
        show.onboardingProfiles.filter((profile) => profile.user.photoConsent?.documentUploadedAt).length,
        profileUserIds.length || 1,
      ),
    },
    {
      id: "casting",
      label: "Casting",
      completionRate: toPercentage(memberships.length, profileUserIds.length || 1),
    },
  ].map((step) => ({
    ...step,
    dropoutRate: Math.max(0, 100 - step.completionRate),
  }));

  const documents = {
    uploaded: show.onboardingProfiles.filter((profile) => profile.user.photoConsent?.documentUploadedAt).length,
    skipped: show.onboardingProfiles.filter((profile) => profile.user.photoConsent?.status === "rejected").length,
    pending: show.onboardingProfiles.filter((profile) => !profile.user.photoConsent).length,
  };

  const candidateInputs: CandidateInput[] = show.onboardingProfiles.map((profile) => {
    const fullName =
      profile.user.name ||
      [profile.user.firstName, profile.user.lastName].filter(Boolean).join(" ") ||
      "Unbekannt";
    const experienceYears = profile.memberSinceYear
      ? now.getFullYear() - profile.memberSinceYear
      : null;

    return {
      userId: profile.user.id,
      name: fullName,
      focus: profile.focus,
      interests: userInterestMap.get(profile.user.id) ?? [],
      experienceYears,
      actingShares: actingSharesByUser.get(profile.user.id) ?? new Map<string, number>(),
      crewShares: crewSharesByUser.get(profile.user.id) ?? new Map<string, number>(),
    };
  });

  const roleCandidates = new Map<string, AllocationCandidate[]>();
  const allRoles = new Map<string, { label: string; domain: "acting" | "crew"; demand: number }>();

  actingTotals.forEach((value, roleId) => {
    const candidates = candidateInputs
      .map((candidate) => {
        const share = candidate.actingShares.get(roleId) ?? 0;
        const focusAlignment = candidate.focus === "acting" || candidate.focus === "both";
        const quality = 1 + (candidate.experienceYears ?? 0) / 10 + (focusAlignment ? 0.2 : 0);
        const score = share * quality;
        return {
          userId: candidate.userId,
          name: candidate.name,
          focus: candidate.focus ?? undefined,
          normalizedShare: share,
          qualityFactor: quality,
          score,
          confidence: normalizeConfidence(score, 1.2),
          justification: focusAlignment
            ? "Hohe Acting-Präferenz"
            : "Acting als Zweitfokus",
          interests: candidate.interests,
          experienceYears: candidate.experienceYears ?? undefined,
        } satisfies AllocationCandidate;
      })
      .filter((candidate) => candidate.normalizedShare > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 12);

    roleCandidates.set(roleId, candidates);
    allRoles.set(roleId, {
      label: roleId,
      domain: "acting",
      demand: value.userCount,
    });
  });

  crewTotals.forEach((value, roleId) => {
    const candidates = candidateInputs
      .map((candidate) => {
        const share = candidate.crewShares.get(roleId) ?? 0;
        const focusAlignment = candidate.focus === "tech" || candidate.focus === "both";
        const quality = 1 + (candidate.experienceYears ?? 0) / 10 + (focusAlignment ? 0.2 : 0);
        const score = share * quality;
        return {
          userId: candidate.userId,
          name: candidate.name,
          focus: candidate.focus ?? undefined,
          normalizedShare: share,
          qualityFactor: quality,
          score,
          confidence: normalizeConfidence(score, 1.2),
          justification: focusAlignment ? "Technik-Fokus" : "Unterstützender Fokus",
          interests: candidate.interests,
          experienceYears: candidate.experienceYears ?? undefined,
        } satisfies AllocationCandidate;
      })
      .filter((candidate) => candidate.normalizedShare > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 12);

    roleCandidates.set(roleId, candidates);
    allRoles.set(roleId, {
      label: roleId,
      domain: "crew",
      demand: value.userCount,
    });
  });

  const defaultCapacity = (demand: number): number => {
    if (demand <= 2) return demand;
    if (demand <= 4) return Math.max(1, Math.round(demand * 0.75));
    return Math.max(2, Math.round(demand * 0.6));
  };

  const allocationRoles: AllocationRole[] = Array.from(allRoles.entries()).map(([roleId, meta]) => ({
    roleId,
    label: meta.label,
    domain: meta.domain,
    demand: meta.demand,
    capacity: defaultCapacity(meta.demand),
    candidates: roleCandidates.get(roleId) ?? [],
  }));

  const recalculatedRoles = recomputeAllocation({ roles: allocationRoles, candidates: candidateInputs });

  const history = await prisma.show.findMany({
    where: {
      id: { not: show.id },
    },
    orderBy: { year: "desc" },
    take: 5,
    select: {
      id: true,
      year: true,
      title: true,
      dates: true,
      onboardingProfiles: {
        select: {
          createdAt: true,
          focus: true,
          user: { select: { dateOfBirth: true } },
        },
      },
    },
  });

  const historySnapshots = history.map((item) => {
    const itemRange = extractDateRange(item.dates);
    const agesHistory = item.onboardingProfiles
      .map((profile) => computeAge(profile.user.dateOfBirth))
      .filter((value): value is number => value !== null)
      .sort((a, b) => a - b);
    const medianHistory =
      agesHistory.length === 0
        ? null
        : agesHistory.length % 2 === 1
          ? agesHistory[(agesHistory.length - 1) / 2]
          : (agesHistory[agesHistory.length / 2 - 1] + agesHistory[agesHistory.length / 2]) / 2;

    const focusBoth = toPercentage(
      item.onboardingProfiles.filter((profile) => profile.focus === "both").length,
      item.onboardingProfiles.length || 1,
    );

    return {
      onboardingId: item.id,
      label: normalizeTitle(item),
      participants: item.onboardingProfiles.length,
      medianAge: medianHistory,
      focusBothShare: focusBoth,
      createdAt: itemRange.start?.toISOString() ?? new Date(item.year, 0, 1).toISOString(),
    };
  });

  const dashboard = onboardingDashboardSchema.parse({
    onboarding: {
      ...onboardingSummary,
      statusLabel: status.label,
      timeSpan,
      participants,
    },
    global: {
      kpis: [
        {
          id: "participants",
          label: "Teilnehmer gesamt",
          value: participants,
          helper: `${newLastWeek} neue in 7 Tagen`,
          trend: {
            direction: newLastWeek > newLastMonth / 4 ? "up" : "flat",
            percentage: toPercentage(newLastWeek, participants || 1),
            label: "Woche",
          },
        },
        {
          id: "new-per-month",
          label: "Neue Teilnehmer (30T)",
          value: newLastMonth,
          trend: {
            direction: newLastMonth > newLastWeek ? "up" : "flat",
            percentage: toPercentage(newLastMonth, participants || 1),
            label: "Monat",
          },
        },
        {
          id: "median-age",
          label: "Medianalter",
          value: medianAge ? roundTo(medianAge, 1) : "–",
          helper: medianAge ? "Jahre" : "keine Daten",
        },
        {
          id: "focus",
          label: "Fokus acting/tech",
          value: `${formatPercentage(toPercentage(focusDistribution.get("acting") ?? 0, participants || 1))} acting`,
          helper: `${formatPercentage(toPercentage(focusDistribution.get("tech") ?? 0, participants || 1))} tech`,
        },
        {
          id: "photo",
          label: "Fotoeinverständnis",
          value: `${formatPercentage(toPercentage(consentCount, participants || 1))}`,
          intent: consentCount / (participants || 1) > 0.8 ? "success" : "warning",
        },
        {
          id: "gender",
          label: "Geschlechter",
          value: `${formatPercentage(toPercentage(genderDistribution.get("weiblich") ?? 0, participants || 1))} ♀︎`,
          helper: `${formatPercentage(toPercentage(genderDistribution.get("männlich") ?? 0, participants || 1))} ♂︎`,
        },
      ],
      ageGroups: Array.from(ageGroups.entries()).map(([label, value]) => ({
        label,
        value,
        percentage: toPercentage(value, participants || 1),
      })),
      genderDistribution: Array.from(genderDistribution.entries()).map(([label, value]) => ({
        label,
        value,
        percentage: toPercentage(value, participants || 1),
      })),
      focusDistribution: Array.from(focusDistribution.entries()).map(([label, value]) => ({
        label,
        value,
        percentage: toPercentage(value, participants || 1),
        intent: determineFocusIntent(label),
      })),
      photoConsentRate: participants ? consentCount / participants : null,
      rolesActing: Array.from(actingTotals.entries()).map(([roleId, meta]) => ({
        roleId,
        label: roleId,
        domain: "acting",
        normalizedShare: roundTo(meta.shareSum / Math.max(meta.userCount, 1), 3),
        participantShare: toPercentage(meta.userCount, participants || 1),
      })),
      rolesCrew: Array.from(crewTotals.entries()).map(([roleId, meta]) => ({
        roleId,
        label: roleId,
        domain: "crew",
        normalizedShare: roundTo(meta.shareSum / Math.max(meta.userCount, 1), 3),
        participantShare: toPercentage(meta.userCount, participants || 1),
      })),
      roleCoverage: {
        acting: toPercentage(uniqueActingUsers.size, participants || 1),
        crew: toPercentage(uniqueCrewUsers.size, participants || 1),
      },
      roleHeatmap,
      interestTopTags: Array.from(interestCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([label, value]) => ({
          label,
          value,
          percentage: toPercentage(value, participants || 1),
        })),
      interestWordCloud: Array.from(interestCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([tag, weight]) => ({
          tag,
          weight,
        })),
      interestCoOccurrences: Array.from(interestCoOccurrences.entries()).flatMap(([source, targets]) =>
        Array.from(targets.entries()).map(([target, weight]) => ({
          source,
          target,
          weight,
        })),
      ),
      interestClusters: Array.from(interestClusters.entries()).map(([label, value]) => ({
        id: label.toLowerCase(),
        label,
        value,
        intent: value >= 8 ? "success" : value >= 4 ? "default" : "warning",
      })),
      diversity: {
        shannon: roundTo(shannon, 3),
        gini: roundTo(gini, 3),
        normalized: roundTo(normalizedDiversity, 3),
        status: diversityStatus,
        explanation: `Shannon ${roundTo(shannon, 2)} · Gini ${roundTo(gini, 2)}`,
      },
      nutrition: {
        diets: Array.from(diets.entries()).map(([label, count]) => ({
          label,
          count,
        })),
        allergies: Array.from(allergies.entries()).map(([allergen, severities]) => ({
          allergen,
          severities: Object.fromEntries(severities.entries()),
        })),
      },
      process: {
        steps,
        documents,
      },
    },
    allocation: {
      roles: recalculatedRoles,
      fairness: buildFairnessMetrics(
        show.onboardingProfiles.map((profile) => ({
          gender: profile.gender,
          memberSinceYear: profile.memberSinceYear,
          focus: profile.focus,
        })),
      ),
      conflicts: buildConflictList(recalculatedRoles),
    },
    history: historySnapshots,
  });

  return dashboard;
});
