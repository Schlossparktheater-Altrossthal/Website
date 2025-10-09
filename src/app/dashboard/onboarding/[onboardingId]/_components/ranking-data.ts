import type { OnboardingDashboardData } from "@/lib/onboarding/dashboard-schemas";
import { getRolePreferenceOrder } from "@/lib/onboarding/role-preferences";

import type {
  CandidateAggregate,
  CandidatePreference,
  Domain,
  HighlightContext,
  RoleGroup,
  RoleSummary,
} from "./ranking-types";

function addPreferenceEntry(
  entry: CandidateAggregate,
  domain: Domain,
  preference: CandidatePreference,
) {
  const list = entry.preferences[domain];
  const existingIndex = list.findIndex((item) => item.roleId === preference.roleId);
  if (existingIndex === -1) {
    list.push(preference);
    return;
  }
  if (list[existingIndex].share < preference.share) {
    list[existingIndex] = preference;
  }
}

export function buildCandidateAggregates(
  ranking: OnboardingDashboardData["ranking"],
): Map<string, CandidateAggregate> {
  const map = new Map<string, CandidateAggregate>();

  for (const role of ranking.roles) {
    for (const candidate of role.candidates) {
      let entry = map.get(candidate.userId);

      if (!entry) {
        entry = {
          userId: candidate.userId,
          name: candidate.name,
          email: candidate.email,
          focus: candidate.focus,
          score: candidate.score,
          confidence: candidate.confidence,
          experienceYears: candidate.experienceYears,
          interests: [...new Set(candidate.interests)],
          background: candidate.background,
          notes: candidate.notes,
          preferences: {
            acting: [],
            crew: [],
          },
        } satisfies CandidateAggregate;

        map.set(candidate.userId, entry);
      } else {
        entry.email = entry.email ?? candidate.email;
        entry.focus = entry.focus ?? candidate.focus;
        entry.score = Math.max(entry.score, candidate.score);
        entry.confidence = Math.max(entry.confidence, candidate.confidence);
        entry.experienceYears =
          entry.experienceYears === null
            ? candidate.experienceYears
            : candidate.experienceYears === null
              ? entry.experienceYears
              : Math.max(entry.experienceYears, candidate.experienceYears);
        entry.interests = Array.from(new Set([...entry.interests, ...candidate.interests]));
        entry.background = entry.background ?? candidate.background;
        entry.notes = entry.notes ?? candidate.notes;
      }

      addPreferenceEntry(entry, role.domain as Domain, {
        roleId: role.roleId,
        label: role.label,
        share: candidate.normalizedShare,
        rank: candidate.rank,
      });

      for (const otherPreference of candidate.otherPreferences) {
        addPreferenceEntry(entry, otherPreference.domain as Domain, {
          roleId: otherPreference.roleId,
          label: otherPreference.label,
          share: otherPreference.normalizedShare,
          rank: otherPreference.rank,
        });
      }
    }
  }

  for (const aggregate of map.values()) {
    aggregate.preferences.acting.sort((a, b) => b.share - a.share);
    aggregate.preferences.crew.sort((a, b) => b.share - a.share);
  }

  return map;
}

export function createRoleSummaries(
  ranking: OnboardingDashboardData["ranking"],
): RoleSummary[] {
  return ranking.roles.map((role) => {
    const totalShare = role.candidates.reduce((sum, candidate) => sum + candidate.normalizedShare, 0);
    const averageShare = role.candidates.length === 0 ? 0 : totalShare / role.candidates.length;

    return {
      roleId: role.roleId,
      label: role.label,
      domain: role.domain as Domain,
      averageShare,
    } satisfies RoleSummary;
  });
}

export function createRoleGroups(
  ranking: OnboardingDashboardData["ranking"],
  candidateMap: Map<string, CandidateAggregate>,
): RoleGroup[] {
  return ranking.roles.map((role) => ({
    roleId: role.roleId,
    label: role.label,
    domain: role.domain as Domain,
    demand: role.demand,
    candidates: role.candidates.map((candidate) => {
      const aggregate = candidateMap.get(candidate.userId);
      if (!aggregate) {
        throw new Error(`Missing aggregate for candidate ${candidate.userId}`);
      }
      return {
        candidate: aggregate,
        highlight: {
          domain: role.domain as Domain,
          roleId: role.roleId,
          label: role.label,
          rank: candidate.rank,
          share: candidate.normalizedShare,
        },
      };
    }),
  }));
}

export function sortRoleSummariesByDomain(
  summaries: RoleSummary[],
  domain: Domain,
): RoleSummary[] {
  return summaries
    .filter((summary) => summary.domain === domain)
    .slice()
    .sort((a, b) => {
      if (b.averageShare === a.averageShare) {
        return a.label.localeCompare(b.label, "de-DE");
      }
      return b.averageShare - a.averageShare;
    });
}

export function sortRoleGroupsByDomain(
  groups: RoleGroup[],
  domain: Domain,
  summaryMap: Map<string, RoleSummary>,
): RoleGroup[] {
  const roleOrder = getRolePreferenceOrder(domain === "acting" ? "acting" : "crew");
  const orderMap = new Map<string, number>(roleOrder.map((code, index) => [code, index]));

  return groups
    .filter((group) => group.domain === domain && group.candidates.length > 0)
    .map((group) => ({
      ...group,
      candidates: group.candidates.slice().sort((a, b) => a.highlight.rank - b.highlight.rank),
    }))
    .sort((a, b) => {
      const aPriority = orderMap.get(a.roleId) ?? Number.MAX_SAFE_INTEGER;
      const bPriority = orderMap.get(b.roleId) ?? Number.MAX_SAFE_INTEGER;

      if (aPriority !== bPriority) {
        return aPriority - bPriority;
      }

      const aSummary = summaryMap.get(a.roleId)?.averageShare ?? 0;
      const bSummary = summaryMap.get(b.roleId)?.averageShare ?? 0;

      if (bSummary === aSummary) {
        return a.label.localeCompare(b.label, "de-DE");
      }

      return bSummary - aSummary;
    });
}

export function getCandidateHighlight(
  ranking: OnboardingDashboardData["ranking"],
  roleId: string,
  userId: string,
): HighlightContext | null {
  for (const role of ranking.roles) {
    if (role.roleId !== roleId) {
      continue;
    }
    const candidate = role.candidates.find((entry) => entry.userId === userId);
    if (!candidate) {
      return null;
    }
    return {
      domain: role.domain as Domain,
      roleId: role.roleId,
      label: role.label,
      rank: candidate.rank,
      share: candidate.normalizedShare,
    };
  }
  return null;
}

export function getPrimaryCandidateHighlight(
  ranking: OnboardingDashboardData["ranking"],
  userId: string,
): HighlightContext | null {
  let best: { share: number; highlight: HighlightContext } | null = null;

  for (const role of ranking.roles) {
    for (const candidate of role.candidates) {
      if (candidate.userId !== userId) {
        continue;
      }
      const highlight: HighlightContext = {
        domain: role.domain as Domain,
        roleId: role.roleId,
        label: role.label,
        rank: candidate.rank,
        share: candidate.normalizedShare,
      };
      if (!best || candidate.normalizedShare > best.share) {
        best = { share: candidate.normalizedShare, highlight };
      }
    }
  }

  return best?.highlight ?? null;
}
