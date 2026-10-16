import type { CharacterCastingType } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export type MemberRoles = {
  /** Rollennamen in Reihenfolge der Figurenliste, Zweitbesetzung/Cover markiert. */
  labels: string[];
  /** Position der ersten Rolle in der Figurenliste; ohne Rolle `Infinity`. */
  rank: number;
};

const CASTING_SUFFIX: Partial<Record<CharacterCastingType, string>> = {
  alternate: " (Zweitbesetzung)",
  cover: " (Cover)",
};

/** Schauspielrollen pro Person in einer Produktion (für Personenlisten). */
export async function loadMemberRoles(showId: string | null): Promise<Map<string, MemberRoles>> {
  const result = new Map<string, MemberRoles>();
  if (!showId) return result;
  const characters = await prisma.character.findMany({
    where: { showId },
    orderBy: [{ order: "asc" }, { name: "asc" }],
    select: { name: true, castings: { select: { userId: true, type: true } } },
  });
  characters.forEach((character, index) => {
    for (const casting of character.castings) {
      const entry = result.get(casting.userId) ?? { labels: [], rank: Infinity };
      entry.labels.push(`${character.name}${CASTING_SUFFIX[casting.type] ?? ""}`);
      // Hauptbesetzung zählt vor Zweitbesetzung/Cover.
      const rank = casting.type === "primary" || casting.type === "cameo" ? index : index + 10_000;
      entry.rank = Math.min(entry.rank, rank);
      result.set(casting.userId, entry);
    }
  });
  return result;
}

export function roleRankOf(roles: Map<string, MemberRoles>) {
  return (member: { id?: string }) =>
    (member.id ? roles.get(member.id)?.rank : undefined) ?? Infinity;
}
