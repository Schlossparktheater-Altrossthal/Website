import { prisma } from "@/lib/prisma";

export type MemberHistory = {
  /** Frühestes bekanntes Jahr: eigene Angabe oder erste Produktion. */
  sinceYear: number | null;
  /** Anzahl der Produktionen, bei denen das Mitglied dabei war oder ist. */
  productionCount: number;
};

/**
 * Leitet „Dabei seit“ aus den Produktionen ab (Mitgliedschaften und Onboardings).
 * Eine selbst angegebene Jahreszahl zählt nur, wenn sie früher liegt – z. B. für
 * Mitglieder, die schon vor Einführung des Mitgliederbereichs mitgespielt haben.
 */
export async function loadMemberHistory(
  userId: string,
  memberSinceYear: number | null,
): Promise<MemberHistory> {
  const [memberships, onboardings] = await Promise.all([
    prisma.productionMembership.findMany({
      where: { userId },
      select: { showId: true, show: { select: { year: true } } },
    }),
    prisma.productionOnboarding.findMany({
      where: { userId, completedAt: { not: null } },
      select: { showId: true, show: { select: { year: true } } },
    }),
  ]);

  const years = new Map<string, number>();
  for (const entry of [...memberships, ...onboardings]) {
    years.set(entry.showId, entry.show.year);
  }

  const candidates = [...years.values()];
  if (typeof memberSinceYear === "number") {
    candidates.push(memberSinceYear);
  }

  return {
    sinceYear: candidates.length ? Math.min(...candidates) : null,
    productionCount: years.size,
  };
}
