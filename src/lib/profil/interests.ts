import type { Prisma } from "@prisma/client";

import { MAX_INTERESTS_PER_USER } from "@/data/profile";

const MAX_INTEREST_LENGTH = 80;

export type NormalizedInterest = { value: string; lower: string };

export function normalizeInterest(raw: string): NormalizedInterest | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const limited = trimmed.slice(0, MAX_INTEREST_LENGTH);
  return { value: limited, lower: limited.toLowerCase() };
}

/** Bereinigt eine Interessenliste (leer/doppelt raus, auf das Maximum begrenzt). */
export function normalizeInterestList(raw: readonly string[]): NormalizedInterest[] {
  const seen = new Set<string>();
  const result: NormalizedInterest[] = [];
  for (const entry of raw) {
    const normalized = normalizeInterest(entry);
    if (!normalized || seen.has(normalized.lower)) continue;
    seen.add(normalized.lower);
    result.push(normalized);
    if (result.length >= MAX_INTERESTS_PER_USER) break;
  }
  return result;
}

/**
 * Ersetzt die Interessen eines Mitglieds (fehlende Schlagworte werden angelegt).
 * Gibt die gespeicherten Namen in der Schreibweise der Datenbank zurück.
 */
export async function replaceUserInterests(
  tx: Prisma.TransactionClient,
  userId: string,
  normalized: readonly NormalizedInterest[],
): Promise<string[]> {
  const existing = await tx.userInterest.findMany({
    where: { userId },
    include: { interest: { select: { id: true, name: true } } },
  });

  const targetLowers = new Set(normalized.map((entry) => entry.lower));
  const keepMap = new Map<string, { interestId: string }>();
  const removeIds: string[] = [];

  for (const link of existing) {
    const interestName = link.interest?.name ?? "";
    const lower = interestName.toLowerCase();
    if (targetLowers.has(lower)) {
      keepMap.set(lower, { interestId: link.interestId });
    } else {
      removeIds.push(link.id);
    }
  }

  if (removeIds.length) {
    await tx.userInterest.deleteMany({ where: { id: { in: removeIds } } });
  }

  if (!normalized.length) {
    return [] as string[];
  }

  const filters = normalized.map((entry) => ({
    name: { equals: entry.value, mode: "insensitive" as const },
  }));

  let interestRecords = await tx.interest.findMany({
    where: { OR: filters },
  });

  const interestByLower = new Map<string, { id: string; name: string }>();
  for (const record of interestRecords) {
    interestByLower.set(record.name.toLowerCase(), { id: record.id, name: record.name });
  }

  const toCreate = normalized
    .filter((entry) => !interestByLower.has(entry.lower))
    .map((entry) => ({ name: entry.value, createdById: userId }));

  if (toCreate.length) {
    await tx.interest.createMany({ data: toCreate, skipDuplicates: true });
    interestRecords = await tx.interest.findMany({ where: { OR: filters } });
    interestByLower.clear();
    for (const record of interestRecords) {
      interestByLower.set(record.name.toLowerCase(), { id: record.id, name: record.name });
    }
  }

  const toLink = normalized
    .filter((entry) => !keepMap.has(entry.lower))
    .map((entry) => {
      const interest = interestByLower.get(entry.lower);
      if (!interest) return null;
      return { userId, interestId: interest.id };
    })
    .filter((entry): entry is { userId: string; interestId: string } => Boolean(entry));

  if (toLink.length) {
    await tx.userInterest.createMany({ data: toLink, skipDuplicates: true });
  }

  return normalized.map((entry) => interestByLower.get(entry.lower)?.name ?? entry.value);
}
