import type { AllergyLevel } from "@prisma/client";

import { getActiveProductionId } from "@/lib/active-production";
import { prisma } from "@/lib/prisma";
import { getUserDisplayName } from "@/lib/names";
import type { PlannerDay, PlannerRecipe } from "@/lib/meal-planning/types";
import {
  parseDietaryStrictnessFromLabel,
  parseDietaryStyleFromLabel,
  resolveDietaryStrictnessLabel,
  resolveDietaryStyleLabel,
  type DietaryStrictnessOption,
  type DietaryStyleOption,
} from "@/data/dietary-preferences";

export const STYLE_BADGE_VARIANTS: Record<DietaryStyleOption, string> = {
  none: "border-border/60 bg-muted/40 text-muted-foreground",
  omnivore: "border-amber-400/60 bg-amber-500/10 text-amber-500",
  vegetarian: "border-emerald-400/60 bg-emerald-500/10 text-emerald-500",
  vegan: "border-lime-400/60 bg-lime-500/10 text-lime-500",
  pescetarian: "border-sky-400/60 bg-sky-500/10 text-sky-500",
  flexitarian: "border-cyan-400/60 bg-cyan-500/10 text-cyan-500",
  halal: "border-green-500/60 bg-green-500/10 text-green-500",
  kosher: "border-indigo-400/60 bg-indigo-500/10 text-indigo-500",
  custom: "border-fuchsia-400/60 bg-fuchsia-500/10 text-fuchsia-400",
};

export const STYLE_LABELS: Record<DietaryStyleOption, string> = {
  none: "Allesesser",
  omnivore: "Allesesser",
  vegetarian: "Vegetarisch",
  vegan: "Vegan",
  pescetarian: "Pescetarisch",
  flexitarian: "Flexitarisch",
  halal: "Halal",
  kosher: "Koscher",
  custom: "Individuell",
};

export const SEVERITY_RANK: Record<AllergyLevel, number> = {
  MILD: 0,
  MODERATE: 1,
  SEVERE: 2,
  LETHAL: 3,
};

export const MEAL_SLOTS = ["Frühstück", "Mittag", "Abendbrot"] as const;

function normalizeAllergen(value: string) {
  return value.trim().toLocaleLowerCase("de-DE");
}

function createLevelRecord(): Record<AllergyLevel, number> {
  return { MILD: 0, MODERATE: 0, SEVERE: 0, LETHAL: 0 };
}

export type ParticipantDietProfile = {
  userId: string;
  name: string;
  style: DietaryStyleOption;
  styleLabel: string;
  customLabel: string | null;
  strictnessValue: DietaryStrictnessOption;
  strictnessLabel: string;
  restrictions: { allergen: string; level: AllergyLevel }[];
};

export type StyleSummary = {
  key: string;
  style: DietaryStyleOption;
  label: string;
  count: number;
  share: number;
  dominantStrictnessValue: DietaryStrictnessOption;
  dominantStrictnessLabel: string;
  dominantStrictnessShare: number;
  sampleNames: string[];
};

export type AllergenSummary = {
  key: string;
  name: string;
  total: number;
  highestLevel: AllergyLevel;
  affectedNames: string[];
  levels: Record<AllergyLevel, number>;
};

type MealPlanEntry = {
  slot: (typeof MEAL_SLOTS)[number];
  focusLabel: string;
  focusStyle: DietaryStyleOption;
  dish: PlannerRecipe;
  cautionMatches: string[];
};

type MealPlanDay = {
  key: string;
  label: string;
  date: Date | null;
  entries: MealPlanEntry[];
};

type BuildMealPlanArgs = {
  startDate: Date | null;
  styleSummaries: StyleSummary[];
  criticalAllergens: Set<string>;
  dishes: PlannerRecipe[];
};

export const DISH_LIBRARY: PlannerRecipe[] = [];


function pickDishForStyle(
  style: DietaryStyleOption,
  slot: (typeof MEAL_SLOTS)[number],
  dishes: PlannerRecipe[],
  used: Set<string>,
): PlannerRecipe {
  const slotCandidates = dishes.filter((dish) => {
    if (!dish.suitableFor.includes(style)) {
      return false;
    }
    if (!dish.idealSlots || dish.idealSlots.length === 0) {
      return true;
    }
    return dish.idealSlots.includes(slot);
  });
  const availableSlotCandidate = slotCandidates.find((dish) => !used.has(dish.id));
  if (availableSlotCandidate) {
    used.add(availableSlotCandidate.id);
    return availableSlotCandidate;
  }

  if (slotCandidates.length) {
    return slotCandidates[0];
  }

  const styleCandidates = dishes.filter((dish) => dish.suitableFor.includes(style));
  const availableStyleCandidate = styleCandidates.find((dish) => !used.has(dish.id));
  if (availableStyleCandidate) {
    used.add(availableStyleCandidate.id);
    return availableStyleCandidate;
  }

  if (styleCandidates.length) {
    return styleCandidates[0];
  }

  const fallback = dishes.find((dish) => !used.has(dish.id));
  if (fallback) {
    used.add(fallback.id);
    return fallback;
  }

  return dishes[0];
}

function buildMealPlan({ startDate, styleSummaries, criticalAllergens, dishes }: BuildMealPlanArgs): MealPlanDay[] {
  const focusList = styleSummaries.length
    ? styleSummaries
    : [
        {
          key: "omnivore",
          style: "omnivore" as const,
          label: STYLE_LABELS.omnivore,
          count: 0,
          share: 0,
          dominantStrictnessValue: "flexible" as const,
          dominantStrictnessLabel: resolveDietaryStrictnessLabel("omnivore", "flexible"),
          dominantStrictnessShare: 0,
          sampleNames: [],
        },
      ];

  const dayCount = 5;
  const formatter = new Intl.DateTimeFormat("de-DE", { weekday: "long", day: "2-digit", month: "2-digit" });

  if (dishes.length === 0) {
    return Array.from({ length: dayCount }, (_, dayIndex) => {
      const date = startDate ? new Date(startDate.getTime() + dayIndex * 86_400_000) : null;
      const label = date ? formatter.format(date) : `Tag ${dayIndex + 1}`;

      return {
        key: date ? date.toISOString().slice(0, 10) : `day-${dayIndex}`,
        label,
        date,
        entries: [],
      } satisfies MealPlanDay;
    });
  }

  const used = new Set<string>();

  return Array.from({ length: dayCount }, (_, dayIndex) => {
    const date = startDate ? new Date(startDate.getTime() + dayIndex * 86_400_000) : null;
    const label = date ? formatter.format(date) : `Tag ${dayIndex + 1}`;
    const entries = MEAL_SLOTS.map((slot, slotIndex) => {
      const focus = focusList[(dayIndex + slotIndex) % focusList.length];
      const dish = pickDishForStyle(focus.style, slot, dishes, used);
      const cautionMatches = (dish.caution ?? []).filter((entry) => criticalAllergens.has(normalizeAllergen(entry)));
      return {
        slot,
        focusLabel: focus.label,
        focusStyle: focus.style,
        dish,
        cautionMatches,
      } satisfies MealPlanEntry;
    });

    return {
      key: date ? date.toISOString().slice(0, 10) : `day-${dayIndex}`,
      label,
      date,
      entries,
    } satisfies MealPlanDay;
  });
}


export type MealPlanningContext = {
  show: { id: string; title: string | null; year: number; finalRehearsalWeekStart: Date | null } | null;
  participants: ParticipantDietProfile[];
  totalParticipants: number;
  strictParticipants: number;
  participantsWithRestrictions: number;
  criticalRestrictionCount: number;
  styleSummaries: StyleSummary[];
  allergenSummaries: AllergenSummary[];
  criticalAllergens: string[];
  mealPlan: MealPlanDay[];
  plannerDays: PlannerDay[];
  defaultParticipantCount: number;
  priorityProfiles: ParticipantDietProfile[];
};

export async function loadMealPlanningContext(userId?: string | null): Promise<MealPlanningContext> {
  const activeProductionId = await getActiveProductionId(userId);
  const membershipFilter = activeProductionId
    ? {
        some: {
          showId: activeProductionId,
          OR: [{ leftAt: null }, { leftAt: { gt: new Date() } }],
        },
      }
    : undefined;

  const [activeShow, profiles, rawRestrictions] = await Promise.all([
    activeProductionId
      ? prisma.show.findUnique({
          where: { id: activeProductionId },
          select: { id: true, title: true, year: true, finalRehearsalWeekStart: true },
        })
      : Promise.resolve(null),
    prisma.memberOnboardingProfile.findMany({
      where: {
        user: {
          deactivatedAt: null,
          productionMemberships: membershipFilter,
        },
      },
      select: {
        userId: true,
        dietaryPreference: true,
        dietaryPreferenceStrictness: true,
        user: { select: { firstName: true, lastName: true, name: true, email: true } },
      },
    }),
    prisma.dietaryRestriction.findMany({
      where: {
        isActive: true,
        user: {
          deactivatedAt: null,
          productionMemberships: membershipFilter,
        },
      },
      select: { userId: true, allergen: true, level: true },
    }),
  ]);

  let show = activeShow;
  if (!show) {
    show =
      (await prisma.show.findFirst({
        where: { finalRehearsalWeekStart: { not: null } },
        orderBy: { finalRehearsalWeekStart: "desc" },
        select: { id: true, title: true, year: true, finalRehearsalWeekStart: true },
      })) ??
      (await prisma.show.findFirst({
        orderBy: { year: "desc" },
        select: { id: true, title: true, year: true, finalRehearsalWeekStart: true },
      }));
  }

  const restrictionsByUser = new Map<string, { allergen: string; level: AllergyLevel }[]>();
  for (const entry of rawRestrictions) {
    const list = restrictionsByUser.get(entry.userId) ?? [];
    list.push({ allergen: entry.allergen, level: entry.level });
    restrictionsByUser.set(entry.userId, list);
  }

  const participants: ParticipantDietProfile[] = profiles.map((profile) => {
    const user = profile.user;
    const name = getUserDisplayName({
      firstName: user?.firstName ?? undefined,
      lastName: user?.lastName ?? undefined,
      name: user?.name ?? undefined,
      email: user?.email ?? undefined,
    });

    const { style, customLabel } = parseDietaryStyleFromLabel(profile.dietaryPreference);
    const styleResolution = resolveDietaryStyleLabel(style, customLabel ?? undefined);
    const strictnessValue = parseDietaryStrictnessFromLabel(profile.dietaryPreferenceStrictness);
    const strictnessLabelRaw = profile.dietaryPreferenceStrictness?.trim();
    const strictnessLabel = strictnessLabelRaw && strictnessLabelRaw.length > 0
      ? strictnessLabelRaw
      : resolveDietaryStrictnessLabel(style, strictnessValue);

    const restrictions = (restrictionsByUser.get(profile.userId) ?? []).sort((a, b) => {
      const rankDiff = SEVERITY_RANK[b.level] - SEVERITY_RANK[a.level];
      if (rankDiff !== 0) return rankDiff;
      return a.allergen.localeCompare(b.allergen, "de-DE");
    });

    return {
      userId: profile.userId,
      name,
      style,
      styleLabel: styleResolution.label,
      customLabel: styleResolution.custom,
      strictnessValue,
      strictnessLabel,
      restrictions,
    } satisfies ParticipantDietProfile;
  });

  const totalParticipants = participants.length;
  const restrictionsWithSeverity = participants.flatMap((participant) => participant.restrictions);
  const participantsWithRestrictions = participants.filter((participant) => participant.restrictions.length > 0).length;
  const strictParticipants = participants.filter((participant) => participant.strictnessValue === "strict").length;
  const criticalRestrictionCount = restrictionsWithSeverity.filter(
    (entry) => SEVERITY_RANK[entry.level] >= SEVERITY_RANK.SEVERE,
  ).length;

  const styleBuckets = new Map<
    string,
    {
      key: string;
      style: DietaryStyleOption;
      label: string;
      count: number;
      strictness: Map<DietaryStrictnessOption, number>;
      sampleNames: Set<string>;
    }
  >();

  for (const participant of participants) {
    const identifier = participant.style === "custom"
      ? `custom:${(participant.customLabel ?? participant.styleLabel).toLocaleLowerCase("de-DE")}`
      : participant.style;

    let bucket = styleBuckets.get(identifier);
    if (!bucket) {
      bucket = {
        key: identifier,
        style: participant.style,
        label: participant.customLabel ?? participant.styleLabel,
        count: 0,
        strictness: new Map<DietaryStrictnessOption, number>(),
        sampleNames: new Set<string>(),
      };
      styleBuckets.set(identifier, bucket);
    }

    bucket.count += 1;
    bucket.strictness.set(
      participant.strictnessValue,
      (bucket.strictness.get(participant.strictnessValue) ?? 0) + 1,
    );
    if (bucket.sampleNames.size < 3) {
      bucket.sampleNames.add(participant.name);
    }
  }

  const styleSummaries: StyleSummary[] = Array.from(styleBuckets.values())
    .map((bucket) => {
      const strictnessEntries = Array.from(bucket.strictness.entries()).sort((a, b) => b[1] - a[1]);
      const dominantEntry = strictnessEntries[0];
      const dominantStrictnessValue = dominantEntry ? dominantEntry[0] : ("flexible" as DietaryStrictnessOption);
      const dominantStrictnessCount = dominantEntry ? dominantEntry[1] : 0;
      const dominantStrictnessLabel = resolveDietaryStrictnessLabel(bucket.style, dominantStrictnessValue);
      const sampleNames = Array.from(bucket.sampleNames).sort((a, b) => a.localeCompare(b, "de-DE"));
      return {
        key: bucket.key,
        style: bucket.style,
        label: bucket.label,
        count: bucket.count,
        share: totalParticipants ? Math.round((bucket.count / totalParticipants) * 100) : 0,
        dominantStrictnessValue,
        dominantStrictnessLabel,
        dominantStrictnessShare: bucket.count ? Math.round((dominantStrictnessCount / bucket.count) * 100) : 0,
        sampleNames,
      } satisfies StyleSummary;
    })
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.label.localeCompare(b.label, "de-DE");
    });

  const allergenMap = new Map<
    string,
    {
      key: string;
      name: string;
      total: number;
      highestLevel: AllergyLevel;
      affected: Set<string>;
      levels: Record<AllergyLevel, number>;
    }
  >();

  for (const participant of participants) {
    for (const restriction of participant.restrictions) {
      const normalized = normalizeAllergen(restriction.allergen);
      const existing = allergenMap.get(normalized);
      if (existing) {
        existing.total += 1;
        existing.levels[restriction.level] += 1;
        if (SEVERITY_RANK[restriction.level] > SEVERITY_RANK[existing.highestLevel]) {
          existing.highestLevel = restriction.level;
          existing.name = restriction.allergen;
        }
        existing.affected.add(participant.name);
      } else {
        const bucket = {
          key: normalized,
          name: restriction.allergen,
          total: 1,
          highestLevel: restriction.level,
          affected: new Set([participant.name]),
          levels: createLevelRecord(),
        };
        bucket.levels[restriction.level] = 1;
        allergenMap.set(normalized, bucket);
      }
    }
  }

  const criticalAllergensSet = new Set<string>();
  const allergenSummaries: AllergenSummary[] = Array.from(allergenMap.values())
    .map((bucket) => {
      const affectedNames = Array.from(bucket.affected).sort((a, b) => a.localeCompare(b, "de-DE"));
      if (SEVERITY_RANK[bucket.highestLevel] >= SEVERITY_RANK.SEVERE) {
        criticalAllergensSet.add(bucket.key);
      }
      return {
        key: bucket.key,
        name: bucket.name,
        total: bucket.total,
        highestLevel: bucket.highestLevel,
        affectedNames,
        levels: bucket.levels,
      } satisfies AllergenSummary;
    })
    .sort((a, b) => {
      const severityDiff = SEVERITY_RANK[b.highestLevel] - SEVERITY_RANK[a.highestLevel];
      if (severityDiff !== 0) return severityDiff;
      if (b.total !== a.total) return b.total - a.total;
      return a.name.localeCompare(b.name, "de-DE");
    });

  const mealPlan = buildMealPlan({
    startDate: show?.finalRehearsalWeekStart ?? null,
    styleSummaries,
    criticalAllergens: criticalAllergensSet,
    dishes: DISH_LIBRARY,
  });

  const priorityProfiles = participants
    .filter((participant) => {
      const maxSeverity = participant.restrictions.reduce((acc, entry) => Math.max(acc, SEVERITY_RANK[entry.level]), 0);
      return participant.strictnessValue === "strict" || maxSeverity >= SEVERITY_RANK.SEVERE;
    })
    .sort((a, b) => {
      const maxA = a.restrictions.reduce((acc, entry) => Math.max(acc, SEVERITY_RANK[entry.level]), 0);
      const maxB = b.restrictions.reduce((acc, entry) => Math.max(acc, SEVERITY_RANK[entry.level]), 0);
      if (maxB !== maxA) return maxB - maxA;
      if (b.restrictions.length !== a.restrictions.length) return b.restrictions.length - a.restrictions.length;
      if (a.strictnessValue !== b.strictnessValue) {
        if (a.strictnessValue === "strict") return -1;
        if (b.strictnessValue === "strict") return 1;
      }
      return a.name.localeCompare(b.name, "de-DE");
    })
    .slice(0, 6);

  const dayDateFormatter = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" });
  const plannerDays: PlannerDay[] = mealPlan.map((day) => ({
    key: day.key,
    label: day.label,
    dateLabel: day.date ? dayDateFormatter.format(day.date) : null,
    slots: day.entries.map((entry) => ({
      slot: entry.slot,
      focusLabel: entry.focusLabel,
      focusStyle: entry.focusStyle,
      dishId: entry.dish.id,
    })),
  }));
  const defaultParticipantCount = totalParticipants > 0 ? totalParticipants : 12;

  return {
    show,
    participants,
    totalParticipants,
    strictParticipants,
    participantsWithRestrictions,
    criticalRestrictionCount,
    styleSummaries,
    allergenSummaries,
    criticalAllergens: Array.from(criticalAllergensSet),
    mealPlan,
    plannerDays,
    defaultParticipantCount,
    priorityProfiles,
  };
}
