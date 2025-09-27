import { startOfMonth, startOfWeek } from "date-fns";
import type { AllergyLevel, OnboardingFocus, PhotoConsentStatus, RolePreferenceDomain } from "@prisma/client";

import {
  collectOnboardingAnalytics,
  type OnboardingAnalytics,
  type OnboardingTalentProfile,
} from "@/lib/onboarding-analytics";
import { prisma } from "@/lib/prisma";

type GenderKey = "female" | "male" | "diverse" | "no_answer" | "custom" | "unknown";

export type AgeBucket = {
  id: string;
  label: string;
  min: number | null;
  max: number | null;
  count: number;
  share: number;
};

export type GenderDistribution = {
  key: GenderKey;
  label: string;
  count: number;
  share: number;
};

export type FocusDistribution = {
  focus: OnboardingFocus;
  count: number;
  share: number;
};

export type PhotoConsentSnapshot = {
  status: PhotoConsentStatus;
  consentGiven: boolean;
  documentUploadedAt: string | null;
  userId: string;
};

export type PhotoConsentOverview = {
  total: number;
  approved: number;
  rejected: number;
  pending: number;
  missing: number;
  consentRate: number;
  documentUploads: { uploaded: number; skipped: number; pending: number };
};

export type DietaryStyleStat = {
  style: string;
  count: number;
  share: number;
};

export type AllergyStackEntry = {
  level: AllergyLevel;
  total: number;
  byFocus: Record<OnboardingFocus, number>;
};

export type ProgressDropOff = {
  stage: string;
  dropouts: number;
};

export type RolePresenceEntry = {
  code: string;
  domain: RolePreferenceDomain;
  label: string;
  respondents: number;
  share: number;
  averageNormalizedWeight: number;
};

export type PreferenceCombination = {
  combination: string[];
  count: number;
};

export type InterestCluster = {
  id: string;
  label: string;
  weight: number;
  interests: string[];
};

export type InterestCoOccurrence = {
  pair: [string, string];
  count: number;
};

export type InterestWord = {
  name: string;
  count: number;
};

export type DiversityMetric = {
  shannonIndex: number;
  normalizedIndex: number;
  uniqueTags: number;
};

export type OnboardingFilters = {
  ageBuckets: AgeBucket[];
  focuses: FocusDistribution[];
  backgrounds: string[];
  documentStatuses: string[];
};

export type GlobalOnboardingStats = {
  generatedAt: string;
  totals: {
    participants: number;
    newThisWeek: number;
    newThisMonth: number;
  };
  age: {
    buckets: AgeBucket[];
    median: number | null;
  };
  genders: GenderDistribution[];
  focus: FocusDistribution[];
  photoConsent: PhotoConsentOverview;
  dietary: {
    styles: DietaryStyleStat[];
    topFive: DietaryStyleStat[];
  };
  allergies: AllergyStackEntry[];
  onboardingProgress: {
    completionRate: number;
    completed: number;
    started: number;
    dropoffs: ProgressDropOff[];
  };
  documents: {
    uploaded: number;
    skipped: number;
    pending: number;
  };
  roles: {
    averageNormalizedShare: Record<RolePreferenceDomain, number>;
    averagePreferencesPerPerson: Record<RolePreferenceDomain, number>;
    preferencePresence: RolePresenceEntry[];
    combinations: PreferenceCombination[];
  };
  interests: {
    top: InterestWord[];
    wordcloud: InterestWord[];
    cooccurrences: InterestCoOccurrence[];
    clusters: InterestCluster[];
    diversity: DiversityMetric;
  };
  filters: OnboardingFilters;
};

export const AGE_BUCKETS: { id: string; label: string; min: number | null; max: number | null }[] = [
  { id: "under18", label: "<18", min: null, max: 17 },
  { id: "18_25", label: "18–25", min: 18, max: 25 },
  { id: "26_40", label: "26–40", min: 26, max: 40 },
  { id: "over40", label: ">40", min: 41, max: null },
];

export const GENDER_LABELS: Record<GenderKey, string> = {
  female: "Weiblich",
  male: "Männlich",
  diverse: "Divers",
  no_answer: "Keine Angabe",
  custom: "Selbst beschrieben",
  unknown: "Unbekannt",
};

const ROLE_LABEL_OVERRIDES: Record<string, string> = {
  acting_lead: "Schauspiel – Hauptrolle",
  acting_medium: "Schauspiel – Mittelrolle",
  acting_scout: "Schauspiel – Scout",
  acting_statist: "Schauspiel – Statist",
  crew_stage: "Bühne",
  crew_costume: "Kostüm",
  crew_light: "Licht",
  crew_sound: "Ton",
  crew_props: "Requisite",
  crew_front_of_house: "Front of House",
};

export function resolveGenderKey(value: string | null): GenderKey {
  if (!value) return "unknown";
  const normalized = value.trim().toLowerCase();
  if (normalized.startsWith("weib")) return "female";
  if (normalized.startsWith("män") || normalized.startsWith("man")) return "male";
  if (normalized.startsWith("div")) return "diverse";
  if (normalized.startsWith("keine")) return "no_answer";
  if (normalized.startsWith("selbst")) return "custom";
  return "custom";
}

export function resolveAgeBucket(age: number): string {
  for (const bucket of AGE_BUCKETS) {
    const meetsMin = bucket.min === null || age >= bucket.min;
    const meetsMax = bucket.max === null || age <= bucket.max;
    if (meetsMin && meetsMax) return bucket.id;
  }
  return AGE_BUCKETS[AGE_BUCKETS.length - 1]!.id;
}

function calculateMedian(numbers: number[]): number | null {
  if (!numbers.length) return null;
  const sorted = [...numbers].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return Math.round(((sorted[mid - 1]! + sorted[mid]!) / 2) * 10) / 10;
  }
  return sorted[mid]!;
}

function roundShare(count: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round(((count / total) * 100) * 10) / 10;
}

type RedemptionSnapshot = {
  id: string;
  inviteId: string;
  userId: string | null;
  createdAt: string;
  completedAt: string | null;
  photoConsentSkipped: boolean;
};

function readRedemptionPayload(payload: unknown): { photoConsentSkipped: boolean } {
  if (!payload || typeof payload !== "object") {
    return { photoConsentSkipped: false };
  }
  const record = payload as Record<string, unknown>;
  const photoConsent = record.photoConsent;
  if (photoConsent && typeof photoConsent === "object") {
    const skip = (photoConsent as Record<string, unknown>).skipDocument;
    if (typeof skip === "boolean") {
      return { photoConsentSkipped: skip };
    }
  }
  return { photoConsentSkipped: false };
}

export async function loadOnboardingDataset(
  now: Date = new Date(),
): Promise<{
  now: Date;
  analytics: OnboardingAnalytics;
  consents: PhotoConsentSnapshot[];
  redemptions: RedemptionSnapshot[];
}> {
  const analyticsPromise = collectOnboardingAnalytics(now);
  const photoConsentsPromise = prisma.photoConsent.findMany({
    select: { userId: true, status: true, consentGiven: true, documentUploadedAt: true },
  });
  const redemptionsPromise = prisma.memberInviteRedemption.findMany({
    select: { id: true, inviteId: true, userId: true, createdAt: true, completedAt: true, payload: true },
  });

  const [analytics, photoConsents, redemptionRecords] = await Promise.all([
    analyticsPromise,
    photoConsentsPromise,
    redemptionsPromise,
  ]);

  const consents: PhotoConsentSnapshot[] = photoConsents.map((entry) => ({
    userId: entry.userId,
    status: entry.status,
    consentGiven: entry.consentGiven,
    documentUploadedAt: entry.documentUploadedAt?.toISOString() ?? null,
  }));

  const redemptions: RedemptionSnapshot[] = redemptionRecords.map((entry) => ({
    id: entry.id,
    inviteId: entry.inviteId,
    userId: entry.userId,
    createdAt: entry.createdAt.toISOString(),
    completedAt: entry.completedAt?.toISOString() ?? null,
    photoConsentSkipped: readRedemptionPayload(entry.payload).photoConsentSkipped,
  }));

  return { now, analytics, consents, redemptions };
}

function buildPhotoConsentOverview(
  consents: PhotoConsentSnapshot[],
  participants: number,
  redemptionLookup: Map<string, RedemptionSnapshot>,
): PhotoConsentOverview {
  const uploaded = consents.filter((entry) => Boolean(entry.documentUploadedAt)).length;
  const skipped = consents.filter((entry) => {
    if (!entry.userId) return false;
    const redemption = redemptionLookup.get(entry.userId);
    return Boolean(redemption?.photoConsentSkipped);
  }).length;
  const pending = consents.filter((entry) => entry.status === "pending").length;
  const approved = consents.filter((entry) => entry.status === "approved").length;
  const rejected = consents.filter((entry) => entry.status === "rejected").length;
  const covered = consents.length;
  const missing = Math.max(participants - covered, 0);
  const consentRate = participants > 0 ? approved / participants : 0;

  return {
    total: participants,
    approved,
    rejected,
    pending,
    missing,
    consentRate,
    documentUploads: { uploaded, skipped, pending },
  } satisfies PhotoConsentOverview;
}

function computeDietaryStats(profiles: OnboardingTalentProfile[]) {
  const styleCounts = new Map<string, number>();
  for (const profile of profiles) {
    const style = profile.dietaryPreference?.trim() || "Keine Angabe";
    styleCounts.set(style, (styleCounts.get(style) ?? 0) + 1);
  }
  const total = Math.max(1, profiles.length);
  const styles = Array.from(styleCounts.entries())
    .map(([style, count]) => ({ style, count, share: roundShare(count, total) }))
    .sort((a, b) => b.count - a.count || a.style.localeCompare(b.style, "de-DE"));
  return { styles, topFive: styles.slice(0, 5) };
}

function computeAllergyStacks(profiles: OnboardingTalentProfile[]): AllergyStackEntry[] {
  const stacks = new Map<AllergyLevel, AllergyStackEntry>();
  for (const profile of profiles) {
    for (const entry of profile.dietaryRestrictions) {
      const current = stacks.get(entry.level) ?? {
        level: entry.level,
        total: 0,
        byFocus: { acting: 0, tech: 0, both: 0 },
      };
      current.total += 1;
      current.byFocus[profile.focus] = (current.byFocus[profile.focus] ?? 0) + 1;
      stacks.set(entry.level, current);
    }
  }
  return Array.from(stacks.values()).sort((a, b) => b.total - a.total);
}

function computeRoleStats(profiles: OnboardingTalentProfile[]) {
  type DomainStats = {
    respondentCount: number;
    normalizedTotals: number;
    preferenceCount: number;
  };
  const domainStats: Record<RolePreferenceDomain, DomainStats> = {
    acting: { respondentCount: 0, normalizedTotals: 0, preferenceCount: 0 },
    crew: { respondentCount: 0, normalizedTotals: 0, preferenceCount: 0 },
  };
  const presence = new Map<
    string,
    { domain: RolePreferenceDomain; code: string; respondents: number; normalizedWeightTotal: number }
  >();
  const combinationCounts = new Map<string, number>();

  for (const profile of profiles) {
    const byDomain = new Map<RolePreferenceDomain, { total: number; items: { code: string; weight: number }[] }>();
    for (const pref of profile.preferences) {
      if (pref.weight <= 0) continue;
      const entry = byDomain.get(pref.domain) ?? { total: 0, items: [] };
      entry.total += pref.weight;
      entry.items.push({ code: pref.code, weight: pref.weight });
      byDomain.set(pref.domain, entry);
    }

    for (const [domain, data] of byDomain) {
      if (data.total <= 0) continue;
      domainStats[domain]!.respondentCount += 1;
      domainStats[domain]!.preferenceCount += data.items.length;
      const normalizedValues: number[] = [];
      for (const item of data.items) {
        const normalized = item.weight / data.total;
        normalizedValues.push(normalized);
        const key = `${domain}:${item.code}`;
        const bucket = presence.get(key) ?? { domain, code: item.code, respondents: 0, normalizedWeightTotal: 0 };
        bucket.respondents += 1;
        bucket.normalizedWeightTotal += normalized;
        presence.set(key, bucket);
      }
      const averageNormalized = normalizedValues.length
        ? normalizedValues.reduce((acc, value) => acc + value, 0) / normalizedValues.length
        : 0;
      domainStats[domain]!.normalizedTotals += averageNormalized;
    }

    const codes = profile.preferences
      .filter((pref) => pref.weight > 0)
      .map((pref) => pref.code)
      .sort((a, b) => a.localeCompare(b, "de-DE"));
    if (codes.length >= 2) {
      for (let i = 0; i < codes.length; i += 1) {
        for (let j = i + 1; j < codes.length; j += 1) {
          const pair = `${codes[i]}|${codes[j]}`;
          combinationCounts.set(pair, (combinationCounts.get(pair) ?? 0) + 1);
        }
      }
    }
  }

  const averageNormalizedShare: Record<RolePreferenceDomain, number> = {
    acting:
      domainStats.acting.respondentCount > 0
        ? Math.round(
            ((domainStats.acting.normalizedTotals / domainStats.acting.respondentCount) * 100) * 10,
          ) / 10
        : 0,
    crew:
      domainStats.crew.respondentCount > 0
        ? Math.round(((domainStats.crew.normalizedTotals / domainStats.crew.respondentCount) * 100) * 10) / 10
        : 0,
  };

  const averagePreferencesPerPerson: Record<RolePreferenceDomain, number> = {
    acting:
      domainStats.acting.respondentCount > 0
        ? Math.round(
            ((domainStats.acting.preferenceCount / domainStats.acting.respondentCount) * 10),
          ) / 10
        : 0,
    crew:
      domainStats.crew.respondentCount > 0
        ? Math.round(((domainStats.crew.preferenceCount / domainStats.crew.respondentCount) * 10)) / 10
        : 0,
  };

  const preferencePresence: RolePresenceEntry[] = Array.from(presence.values())
    .map((entry) => ({
      code: entry.code,
      domain: entry.domain,
      label: ROLE_LABEL_OVERRIDES[entry.code] ?? entry.code,
      respondents: entry.respondents,
      share: roundShare(entry.respondents, profiles.length),
      averageNormalizedWeight:
        entry.respondents > 0
          ? Math.round(((entry.normalizedWeightTotal / entry.respondents) * 100) * 10) / 10
          : 0,
    }))
    .sort((a, b) => b.respondents - a.respondents || a.label.localeCompare(b.label, "de-DE"));

  const combinations: PreferenceCombination[] = Array.from(combinationCounts.entries())
    .map(([combo, count]) => ({ combination: combo.split("|"), count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 25);

  return { averageNormalizedShare, averagePreferencesPerPerson, preferencePresence, combinations };
}

function computeInterestClusters(words: InterestWord[]): InterestCluster[] {
  const clusters: { id: string; label: string; keywords: RegExp[] }[] = [
    { id: "acting", label: "Schauspiel", keywords: [/schauspiel/i, /acting/i, /rolle/i, /impro/i] },
    { id: "tech", label: "Technik", keywords: [/technik/i, /licht/i, /ton/i, /sound/i, /stage/i, /crew/i] },
    { id: "music", label: "Musik", keywords: [/musik/i, /gesang/i, /chor/i, /gitarre/i, /piano/i, /band/i] },
    { id: "orga", label: "Orga", keywords: [/orga/i, /planung/i, /produktion/i, /marketing/i, /management/i] },
  ];
  const buckets = new Map<string, InterestCluster>();

  for (const word of words) {
    const cluster = clusters.find((entry) => entry.keywords.some((pattern) => pattern.test(word.name)));
    const key = cluster?.id ?? "other";
    if (!buckets.has(key)) {
      buckets.set(key, {
        id: key,
        label: cluster?.label ?? "Weitere Themen",
        weight: 0,
        interests: [],
      });
    }
    const bucket = buckets.get(key)!;
    bucket.weight += word.count;
    bucket.interests.push(word.name);
  }

  return Array.from(buckets.values())
    .map((entry) => ({
      ...entry,
      interests: entry.interests.sort((a, b) => a.localeCompare(b, "de-DE")),
    }))
    .sort((a, b) => b.weight - a.weight);
}

function computeInterestDiversity(words: InterestWord[]): DiversityMetric {
  const total = words.reduce((acc, word) => acc + word.count, 0);
  if (total <= 0) {
    return { shannonIndex: 0, normalizedIndex: 0, uniqueTags: 0 };
  }
  let shannon = 0;
  for (const word of words) {
    const share = word.count / total;
    shannon -= share * Math.log(share);
  }
  const unique = words.length;
  const normalized = unique > 1 ? shannon / Math.log(unique) : 0;
  return {
    shannonIndex: Math.round(shannon * 1000) / 1000,
    normalizedIndex: Math.round(normalized * 1000) / 1000,
    uniqueTags: unique,
  };
}

export async function loadOnboardingGlobalStats(now: Date = new Date()): Promise<GlobalOnboardingStats> {
  const { analytics, consents, redemptions } = await loadOnboardingDataset(now);
  const participants = analytics.talentProfiles.length;
  const startWeek = startOfWeek(now, { weekStartsOn: 1 });
  const startMonth = startOfMonth(now);

  const newThisWeek = analytics.talentProfiles.filter((profile) => new Date(profile.createdAt) >= startWeek).length;
  const newThisMonth = analytics.talentProfiles.filter((profile) => new Date(profile.createdAt) >= startMonth).length;

  const ages: number[] = [];
  const ageBucketCounts = new Map<string, number>();
  const genderCounts = new Map<GenderKey, number>();
  const focusCounts: Record<OnboardingFocus, number> = { acting: 0, tech: 0, both: 0 };
  const backgrounds = new Set<string>();

  for (const profile of analytics.talentProfiles) {
    if (typeof profile.age === "number") {
      ages.push(profile.age);
      const bucket = resolveAgeBucket(profile.age);
      ageBucketCounts.set(bucket, (ageBucketCounts.get(bucket) ?? 0) + 1);
    }
    const genderKey = resolveGenderKey(profile.gender);
    genderCounts.set(genderKey, (genderCounts.get(genderKey) ?? 0) + 1);
    focusCounts[profile.focus] = (focusCounts[profile.focus] ?? 0) + 1;
    if (profile.backgroundClass) {
      backgrounds.add(profile.backgroundClass);
    } else if (profile.background) {
      backgrounds.add(profile.background);
    }
  }

  const buckets: AgeBucket[] = AGE_BUCKETS.map((bucket) => {
    const count = ageBucketCounts.get(bucket.id) ?? 0;
    return {
      id: bucket.id,
      label: bucket.label,
      min: bucket.min,
      max: bucket.max,
      count,
      share: roundShare(count, participants),
    } satisfies AgeBucket;
  });

  const genders: GenderDistribution[] = Array.from(genderCounts.entries())
    .map(([key, count]) => ({ key, label: GENDER_LABELS[key] ?? key, count, share: roundShare(count, participants) }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "de-DE"));

  const focusDistribution: FocusDistribution[] = (Object.keys(focusCounts) as OnboardingFocus[])
    .map((focus) => ({ focus, count: focusCounts[focus], share: roundShare(focusCounts[focus], participants) }))
    .sort((a, b) => b.count - a.count || a.focus.localeCompare(b.focus));

  const redemptionLookup = new Map<string, RedemptionSnapshot>();
  for (const redemption of redemptions) {
    if (redemption.userId) {
      redemptionLookup.set(redemption.userId, redemption);
    }
  }

  const photoConsent = buildPhotoConsentOverview(consents, participants, redemptionLookup);
  const dietary = computeDietaryStats(analytics.talentProfiles);
  const allergies = computeAllergyStacks(analytics.talentProfiles);
  const roles = computeRoleStats(analytics.talentProfiles);

  const interests: InterestWord[] = analytics.interests.map((entry) => ({ name: entry.name, count: entry.count }));
  const cooccurrencesMap = new Map<string, number>();
  for (const profile of analytics.talentProfiles) {
    const unique = Array.from(new Set(profile.interests)).sort((a, b) => a.localeCompare(b, "de-DE"));
    for (let i = 0; i < unique.length; i += 1) {
      for (let j = i + 1; j < unique.length; j += 1) {
        const key = `${unique[i]}|${unique[j]}`;
        cooccurrencesMap.set(key, (cooccurrencesMap.get(key) ?? 0) + 1);
      }
    }
  }
  const cooccurrences: InterestCoOccurrence[] = Array.from(cooccurrencesMap.entries())
    .map(([pair, count]) => {
      const [first, second] = pair.split("|");
      return { pair: [first ?? "", second ?? ""] as [string, string], count };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 40);

  const interestClusters = computeInterestClusters(interests);
  const diversity = computeInterestDiversity(interests);

  const totalInvites = analytics.invites.total;
  const redemptionsStarted = redemptions.length;
  const completed = analytics.completions.total;
  const completionRate = redemptionsStarted > 0 ? completed / redemptionsStarted : 1;
  const pendingDocuments = photoConsent.documentUploads.pending + (photoConsent.total - photoConsent.approved - photoConsent.rejected);

  const dropoffs: ProgressDropOff[] = [
    { stage: "Einladungen", dropouts: Math.max(totalInvites - redemptionsStarted, 0) },
    { stage: "Profil", dropouts: Math.max(redemptionsStarted - completed, 0) },
    { stage: "Dokumente", dropouts: Math.max(pendingDocuments, 0) },
  ];

  const medianAge = calculateMedian(ages);

  const documentStatuses = new Set<string>();
  for (const consent of consents) {
    if (consent.status === "approved") {
      documentStatuses.add("genehmigt");
    } else if (consent.status === "pending") {
      documentStatuses.add("ausstehend");
    } else if (consent.status === "rejected") {
      documentStatuses.add("abgelehnt");
    }
    if (!consent.documentUploadedAt) {
      documentStatuses.add("kein Upload");
    } else {
      documentStatuses.add("hochgeladen");
    }
  }
  if (participants > consents.length) {
    documentStatuses.add("fehlend");
  }

  return {
    generatedAt: now.toISOString(),
    totals: { participants, newThisWeek, newThisMonth },
    age: { buckets, median: medianAge },
    genders,
    focus: focusDistribution,
    photoConsent,
    dietary,
    allergies,
    onboardingProgress: {
      completionRate,
      completed,
      started: redemptionsStarted,
      dropoffs,
    },
    documents: {
      uploaded: photoConsent.documentUploads.uploaded,
      skipped: photoConsent.documentUploads.skipped,
      pending: photoConsent.documentUploads.pending,
    },
    roles,
    interests: {
      top: interests.slice(0, 10),
      wordcloud: interests,
      cooccurrences,
      clusters: interestClusters,
      diversity,
    },
    filters: {
      ageBuckets: buckets,
      focuses: focusDistribution,
      backgrounds: Array.from(backgrounds).sort((a, b) => a.localeCompare(b, "de-DE")),
      documentStatuses: Array.from(documentStatuses).sort((a, b) => a.localeCompare(b, "de-DE")),
    },
  } satisfies GlobalOnboardingStats;
}
