import type {
  PhotoConsentStatus,
  ProductionMembershipStatus,
  ProductionStatus,
  Role,
} from "@prisma/client";

import { sanitizeProductionRoles, type ProductionRole } from "./production-role-keys";

export type ProductionHistoryEntry = {
  showId: string;
  title: string;
  year: number;
  productionStatus: ProductionStatus;
  membershipStatus: ProductionMembershipStatus;
  roles: ProductionRole[];
  function: string | null;
  joinedAt: Date;
  leftAt: Date | null;
  onboardingCompletedAt: Date | null;
  isReturning: boolean;
  photoConsentStatus: PhotoConsentStatus | "none";
};

type MembershipInput = {
  showId: string;
  status: ProductionMembershipStatus;
  roles: Role[];
  function: string | null;
  joinedAt: Date;
  leftAt: Date | null;
  show: { title: string | null; year: number; status: ProductionStatus };
};

/** Führt Mitgliedschaften, Onboardings und Fotoerlaubnisse pro Produktion zusammen (neueste zuerst). */
export function buildProductionHistory(
  memberships: readonly MembershipInput[],
  onboardings: ReadonlyArray<{ showId: string; completedAt: Date | null; isReturning: boolean }>,
  consents: ReadonlyArray<{ showId: string; status: PhotoConsentStatus; revokedAt: Date | null }>,
): ProductionHistoryEntry[] {
  return memberships
    .map((membership) => {
      const onboarding = onboardings.find((entry) => entry.showId === membership.showId);
      const consent = consents.find(
        (entry) => entry.showId === membership.showId && !entry.revokedAt,
      );
      return {
        showId: membership.showId,
        title: membership.show.title?.trim() || `Produktion ${membership.show.year}`,
        year: membership.show.year,
        productionStatus: membership.show.status,
        membershipStatus: membership.status,
        roles: sanitizeProductionRoles(membership.roles),
        function: membership.function,
        joinedAt: membership.joinedAt,
        leftAt: membership.leftAt,
        onboardingCompletedAt: onboarding?.completedAt ?? null,
        isReturning: onboarding?.isReturning ?? false,
        photoConsentStatus: consent?.status ?? "none",
      } satisfies ProductionHistoryEntry;
    })
    .sort((a, b) => b.year - a.year || b.joinedAt.getTime() - a.joinedAt.getTime());
}
