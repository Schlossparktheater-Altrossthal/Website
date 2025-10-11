import type { AllergyLevel, OnboardingFocus, RolePreferenceDomain } from "@prisma/client";

import type {
  OnboardingAnalytics,
  OnboardingInterestStat,
  OnboardingInviteSummary,
  OnboardingRolePreferenceStat,
  OnboardingShowAggregations,
  OnboardingShowSummary,
  OnboardingTalentProfile,
} from "@/lib/onboarding-analytics";

const FOCUS_TOTALS: Record<OnboardingFocus, number> = {
  acting: 7,
  tech: 3,
  both: 2,
};

const SHOW_DEMO_2024_ID = "show_demo_2024";
const SHOW_DEMO_2023_ID = "show_demo_2023";

const INTERESTS_DEMO_2024: OnboardingInterestStat[] = [
  { name: "Impro", count: 6 },
  { name: "Tanz", count: 4 },
  { name: "Organisation", count: 3 },
  { name: "Bühnenbild", count: 2 },
  { name: "Maske", count: 2 },
];

const INTERESTS_DEMO_2023: OnboardingInterestStat[] = [
  { name: "Gesang", count: 5 },
  { name: "Regieassistenz", count: 3 },
  { name: "Requisite", count: 2 },
];

const ROLE_PREFS_DEMO_2024: OnboardingRolePreferenceStat[] = [
  {
    code: "acting_lead",
    domain: "acting" satisfies RolePreferenceDomain,
    title: "Lead", // resolved Titel im echten System
    averageWeight: 8.4,
    responses: 5,
  },
  {
    code: "acting_support",
    domain: "acting" satisfies RolePreferenceDomain,
    title: "Support",
    averageWeight: 7.1,
    responses: 6,
  },
  {
    code: "crew_stage",
    domain: "crew" satisfies RolePreferenceDomain,
    title: "Bühne",
    averageWeight: 6.2,
    responses: 4,
  },
  {
    code: "crew_costume",
    domain: "crew" satisfies RolePreferenceDomain,
    title: "Kostüm",
    averageWeight: 5.6,
    responses: 3,
  },
];

const ROLE_PREFS_DEMO_2023: OnboardingRolePreferenceStat[] = [
  {
    code: "acting_support",
    domain: "acting" satisfies RolePreferenceDomain,
    title: "Support",
    averageWeight: 7.4,
    responses: 4,
  },
  {
    code: "crew_direction",
    domain: "crew" satisfies RolePreferenceDomain,
    title: "Regieassistenz",
    averageWeight: 6.8,
    responses: 3,
  },
];

const SHOW_AGGREGATIONS: Record<string, OnboardingShowAggregations> = {
  [SHOW_DEMO_2024_ID]: {
    interests: INTERESTS_DEMO_2024,
    rolePreferences: ROLE_PREFS_DEMO_2024,
  },
  [SHOW_DEMO_2023_ID]: {
    interests: INTERESTS_DEMO_2023,
    rolePreferences: ROLE_PREFS_DEMO_2023,
  },
};

const SHOW_SUMMARIES: OnboardingShowSummary[] = [
  {
    id: SHOW_DEMO_2024_ID,
    title: "Sommernachtstraum",
    year: 2024,
    onboardingCount: 12,
    completedCount: 9,
    openCount: 3,
    focus: { ...FOCUS_TOTALS },
    pendingPhotoConsents: 1,
    guardianDocumentsMissing: 0,
    invites: {
      total: 2,
      active: 2,
      expired: 0,
      disabled: 0,
      exhausted: 0,
      totalUsage: 15,
    },
    interests: INTERESTS_DEMO_2024,
    rolePreferences: ROLE_PREFS_DEMO_2024,
  },
  {
    id: SHOW_DEMO_2023_ID,
    title: "Into the Woods",
    year: 2023,
    onboardingCount: 14,
    completedCount: 13,
    openCount: 1,
    focus: { acting: 6, tech: 4, both: 4 },
    pendingPhotoConsents: 1,
    guardianDocumentsMissing: 1,
    invites: {
      total: 1,
      active: 0,
      expired: 1,
      disabled: 0,
      exhausted: 0,
      totalUsage: 12,
    },
    interests: INTERESTS_DEMO_2023,
    rolePreferences: ROLE_PREFS_DEMO_2023,
  },
];

const INVITE_USAGE: OnboardingInviteSummary[] = [
  {
    id: "invite_demo_2024_main",
    label: "Casting-Runde Frühjahr",
    expiresAt: "2024-05-31T21:59:59.000Z",
    isActive: true,
    isExpired: false,
    isDisabled: false,
    isExhausted: false,
    remainingUses: 5,
    usageCount: 9,
    maxUses: 14,
    showId: SHOW_DEMO_2024_ID,
  },
  {
    id: "invite_demo_2024_bonus",
    label: "Crew Spezial",
    expiresAt: null,
    isActive: true,
    isExpired: false,
    isDisabled: false,
    isExhausted: false,
    remainingUses: null,
    usageCount: 6,
    maxUses: null,
    showId: SHOW_DEMO_2024_ID,
  },
  {
    id: "invite_demo_2023",
    label: "Onboarding Herbst 2023",
    expiresAt: "2023-10-01T21:59:59.000Z",
    isActive: false,
    isExpired: true,
    isDisabled: false,
    isExhausted: false,
    remainingUses: 0,
    usageCount: 12,
    maxUses: 12,
    showId: SHOW_DEMO_2023_ID,
  },
];

const TALENT_PROFILES: OnboardingTalentProfile[] = [
  {
    id: "talent_demo_01",
    userId: "user_demo_01",
    name: "Alex Beispiel",
    email: "alex.beispiel@example.org",
    focus: "acting",
    background: "Spielt seit drei Jahren an der Hochschule und liebt Impro.",
    backgroundClass: "Schauspiel",
    notes: "Hat bereits Workshop für Bühnenkampf absolviert.",
    gender: "divers",
    memberSinceYear: 2021,
    inviteLabel: "Casting-Runde Frühjahr",
    createdAt: "2024-03-12T18:24:00.000Z",
    completedAt: "2024-03-18T11:02:00.000Z",
    dietaryPreference: "Vegetarisch",
    dietaryPreferenceStrictness: "Flexibel",
    preferences: [
      { code: "acting_lead", domain: "acting", weight: 9 },
      { code: "acting_support", domain: "acting", weight: 8 },
      { code: "crew_stage", domain: "crew", weight: 5 },
    ],
    interests: ["Impro", "Tanz", "Bühnenbild"],
    dietaryRestrictions: [
      { allergen: "Nüsse", level: "SEVERE" satisfies AllergyLevel },
      { allergen: "Soja", level: "MILD" satisfies AllergyLevel },
    ],
    age: 24,
    hasPendingPhotoConsent: false,
    requiresGuardianDocument: false,
    show: { id: SHOW_DEMO_2024_ID, title: "Sommernachtstraum", year: 2024 },
    invite: INVITE_USAGE[0],
  },
  {
    id: "talent_demo_02",
    userId: "user_demo_02",
    name: "Bianca Crew",
    email: "bianca.crew@example.org",
    focus: "tech",
    background: "Leitet seit zwei Jahren das Licht-Team ihrer Schule.",
    backgroundClass: "Technik",
    notes: null,
    gender: "weiblich",
    memberSinceYear: 2022,
    inviteLabel: "Crew Spezial",
    createdAt: "2024-03-10T09:14:00.000Z",
    completedAt: "2024-03-21T14:32:00.000Z",
    dietaryPreference: "Vegan",
    dietaryPreferenceStrictness: "Streng",
    preferences: [
      { code: "crew_stage", domain: "crew", weight: 8 },
      { code: "crew_costume", domain: "crew", weight: 6 },
    ],
    interests: ["Organisation", "Maske", "Bühnenbild"],
    dietaryRestrictions: [{ allergen: "Gluten", level: "MODERATE" satisfies AllergyLevel }],
    age: 22,
    hasPendingPhotoConsent: true,
    requiresGuardianDocument: false,
    show: { id: SHOW_DEMO_2024_ID, title: "Sommernachtstraum", year: 2024 },
    invite: INVITE_USAGE[1],
  },
  {
    id: "talent_demo_03",
    userId: "user_demo_03",
    name: "Chris Young",
    email: "chris.young@example.org",
    focus: "both",
    background: "Studiert Theaterpädagogik und unterstützt gern im Regieteam.",
    backgroundClass: "Hybrid",
    notes: "Hat Zugang zu eigenem Kamera-Equipment.",
    gender: "männlich",
    memberSinceYear: 2020,
    inviteLabel: "Onboarding Herbst 2023",
    createdAt: "2023-08-22T16:45:00.000Z",
    completedAt: "2023-09-05T10:28:00.000Z",
    dietaryPreference: "Omnivor",
    dietaryPreferenceStrictness: null,
    preferences: [
      { code: "acting_support", domain: "acting", weight: 7 },
      { code: "crew_direction", domain: "crew", weight: 8 },
    ],
    interests: ["Gesang", "Regieassistenz", "Impro"],
    dietaryRestrictions: [],
    age: 27,
    hasPendingPhotoConsent: false,
    requiresGuardianDocument: false,
    show: { id: SHOW_DEMO_2023_ID, title: "Into the Woods", year: 2023 },
    invite: INVITE_USAGE[2],
  },
  {
    id: "talent_demo_04",
    userId: "user_demo_04",
    name: "Dana Minor",
    email: "dana.minor@example.org",
    focus: "acting",
    background: "Schülerin, spielt seit zwei Jahren im Jugendensemble.",
    backgroundClass: "Nachwuchs",
    notes: null,
    gender: "weiblich",
    memberSinceYear: null,
    inviteLabel: "Onboarding Herbst 2023",
    createdAt: "2023-08-30T12:10:00.000Z",
    completedAt: null,
    dietaryPreference: "Vegetarisch",
    dietaryPreferenceStrictness: "Locker",
    preferences: [{ code: "acting_support", domain: "acting", weight: 6 }],
    interests: ["Gesang", "Requisite"],
    dietaryRestrictions: [{ allergen: "Milch", level: "MILD" satisfies AllergyLevel }],
    age: 17,
    hasPendingPhotoConsent: true,
    requiresGuardianDocument: true,
    show: { id: SHOW_DEMO_2023_ID, title: "Into the Woods", year: 2023 },
    invite: INVITE_USAGE[2],
  },
];

export const DEV_ONBOARDING_ANALYTICS_FIXTURE: OnboardingAnalytics = {
  offline: true,
  invites: {
    total: 3,
    active: 2,
    expired: 1,
    disabled: 0,
    exhausted: 0,
    totalUsage: INVITE_USAGE.reduce((sum, invite) => sum + invite.usageCount, 0),
  },
  inviteUsage: [
    {
      id: "invite_demo_2024_main",
      label: "Casting-Runde Frühjahr",
      createdAt: "2024-03-01T09:00:00.000Z",
      usageCount: 9,
      remainingUses: 5,
      isActive: true,
      show: { id: SHOW_DEMO_2024_ID, title: "Sommernachtstraum", year: 2024 },
    },
    {
      id: "invite_demo_2024_bonus",
      label: "Crew Spezial",
      createdAt: "2024-03-05T12:00:00.000Z",
      usageCount: 6,
      remainingUses: null,
      isActive: true,
      show: { id: SHOW_DEMO_2024_ID, title: "Sommernachtstraum", year: 2024 },
    },
    {
      id: "invite_demo_2023",
      label: "Onboarding Herbst 2023",
      createdAt: "2023-08-10T10:00:00.000Z",
      usageCount: 12,
      remainingUses: 0,
      isActive: false,
      show: { id: SHOW_DEMO_2023_ID, title: "Into the Woods", year: 2023 },
    },
  ],
  completions: {
    total: 22,
    byFocus: {
      acting: 12,
      tech: 5,
      both: 5,
    },
  },
  interests: [...INTERESTS_DEMO_2024, ...INTERESTS_DEMO_2023].reduce<OnboardingInterestStat[]>(
    (acc, current) => {
      const existing = acc.find((entry) => entry.name === current.name);
      if (existing) {
        existing.count += current.count;
      } else {
        acc.push({ ...current });
      }
      return acc;
    },
    [],
  ),
  rolePreferences: [...ROLE_PREFS_DEMO_2024, ...ROLE_PREFS_DEMO_2023].map((entry) => ({ ...entry })),
  dietary: [
    { level: "MILD", count: 2 },
    { level: "MODERATE", count: 1 },
    { level: "SEVERE", count: 1 },
  ],
  minorsPendingDocuments: 1,
  pendingPhotoConsents: 2,
  shows: SHOW_SUMMARIES,
  talentProfiles: TALENT_PROFILES,
  showAggregations: SHOW_AGGREGATIONS,
};

