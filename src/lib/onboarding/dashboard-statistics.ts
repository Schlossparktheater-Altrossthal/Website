import type { OnboardingFocus } from "@prisma/client";

import type {
  OnboardingStatisticsActingRole,
  OnboardingStatisticsParticipant,
} from "./dashboard-schemas";

export type OnboardingStatisticsFilters = {
  search?: string;
  classes: string[];
  focuses: OnboardingFocus[];
  actingRoles: OnboardingStatisticsActingRole[];
  crewRoles: string[];
};

function normalizeList<T>(values?: readonly T[]): T[] {
  if (!values) return [];
  return Array.from(new Set(values.filter(Boolean))).map((value) => value as T);
}

export function normalizeStatisticsFilters(
  filters: Partial<OnboardingStatisticsFilters>,
): OnboardingStatisticsFilters {
  return {
    search: filters.search?.trim() || undefined,
    classes: normalizeList(filters.classes),
    focuses: normalizeList(filters.focuses),
    actingRoles: normalizeList(filters.actingRoles),
    crewRoles: normalizeList(filters.crewRoles),
  };
}

export function filterStatisticsParticipants(
  participants: OnboardingStatisticsParticipant[],
  filters?: Partial<OnboardingStatisticsFilters>,
): OnboardingStatisticsParticipant[] {
  const normalized = normalizeStatisticsFilters(filters ?? {});
  const query = normalized.search?.toLowerCase();

  return participants.filter((participant) => {
    if (normalized.classes.length && (!participant.classLabel || !normalized.classes.includes(participant.classLabel))) {
      return false;
    }
    if (normalized.focuses.length && !normalized.focuses.includes(participant.focus)) {
      return false;
    }
    if (
      normalized.actingRoles.length &&
      (!participant.actingRoleSize || !normalized.actingRoles.includes(participant.actingRoleSize))
    ) {
      return false;
    }
    if (
      normalized.crewRoles.length &&
      !participant.crewRoles.some((role) => normalized.crewRoles.includes(role))
    ) {
      return false;
    }
    if (query) {
      const haystack = [
        participant.name,
        participant.classLabel,
        participant.actingRoleLabel,
        participant.focus,
        ...participant.crewRoles,
        ...participant.interests,
        ...participant.dietary,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      if (!haystack.includes(query)) {
        return false;
      }
    }

    return true;
  });
}

export function hasActiveStatisticsFilters(filters?: Partial<OnboardingStatisticsFilters>): boolean {
  if (!filters) return false;
  const normalized = normalizeStatisticsFilters(filters);
  return Boolean(
    normalized.search ||
      normalized.classes.length ||
      normalized.focuses.length ||
      normalized.actingRoles.length ||
      normalized.crewRoles.length,
  );
}

export function filtersToSearchParams(filters: Partial<OnboardingStatisticsFilters>): URLSearchParams {
  const normalized = normalizeStatisticsFilters(filters);
  const params = new URLSearchParams();

  if (normalized.search) {
    params.set("q", normalized.search);
  }
  normalized.classes.forEach((value) => params.append("class", value));
  normalized.focuses.forEach((value) => params.append("focus", value));
  normalized.actingRoles.forEach((value) => params.append("actingRole", value));
  normalized.crewRoles.forEach((value) => params.append("crewRole", value));

  return params;
}

export function parseFiltersFromSearchParams(searchParams: URLSearchParams): OnboardingStatisticsFilters {
  return normalizeStatisticsFilters({
    search: searchParams.get("q") ?? undefined,
    classes: searchParams.getAll("class"),
    focuses: searchParams.getAll("focus") as OnboardingFocus[],
    actingRoles: searchParams.getAll("actingRole") as OnboardingStatisticsActingRole[],
    crewRoles: searchParams.getAll("crewRole"),
  });
}
