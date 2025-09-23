import { prisma } from "@/lib/prisma";
import {
  aggregateMysteryTipSubmissionScores,
  groupMysteryTipSubmissionsByPlayer,
  mysterySubmissionWithRelationsInclude,
  type MysterySubmissionWithRelations,
} from "@/lib/prisma-helpers";
export type { MysterySubmissionWithRelations } from "@/lib/prisma-helpers";

function resolveAggregateCount(value: number | { _all?: number } | null | undefined): number {
  if (typeof value === "number") return value;
  if (value && typeof value._all === "number") return value._all;
  return 0;
}

export type MysteryScoreboardEntry = {
  playerName: string;
  totalScore: number;
  correctCount: number;
  totalSubmissions: number;
  lastUpdated: Date | null;
};

export async function getMysteryScoreboard(limit?: number): Promise<MysteryScoreboardEntry[]> {
  if (!process.env.DATABASE_URL) return [];

  const totals = await groupMysteryTipSubmissionsByPlayer();
  const correctCounts = await groupMysteryTipSubmissionsByPlayer({ isCorrect: true });

  const correctMap = new Map<string, number>();
  for (const entry of correctCounts) {
    correctMap.set(entry.playerName, entry._count?._all ?? 0);
  }

  const scoreboard = totals
    .map<MysteryScoreboardEntry | null>((entry) => {
      const playerName = entry.playerName.trim();
      const totalScore = entry._sum.score ?? 0;
      const totalSubmissions = entry._count?._all ?? 0;
      if (!playerName || totalScore <= 0) return null;
      return {
        playerName,
        totalScore,
        totalSubmissions,
        correctCount: correctMap.get(playerName) ?? 0,
        lastUpdated: entry._max?.updatedAt ?? null,
      };
    })
    .filter((entry): entry is MysteryScoreboardEntry => Boolean(entry));

  scoreboard.sort((a: MysteryScoreboardEntry, b: MysteryScoreboardEntry) => {
    if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
    if (b.correctCount !== a.correctCount) return b.correctCount - a.correctCount;
    if (b.totalSubmissions !== a.totalSubmissions) return b.totalSubmissions - a.totalSubmissions;
    return a.playerName.localeCompare(b.playerName, "de-DE", { sensitivity: "base" });
  });

  if (typeof limit === "number" && limit > 0) return scoreboard.slice(0, limit);
  return scoreboard;
}

export async function getMysteryScoreboardEntry(playerName: string): Promise<MysteryScoreboardEntry | null> {
  const trimmed = playerName.trim();
  if (!trimmed) return null;
  if (!process.env.DATABASE_URL) return null;

  const [totals, correctCount] = await Promise.all([
    aggregateMysteryTipSubmissionScores({ playerName: trimmed }),
    prisma.mysteryTipSubmission.count({ where: { playerName: trimmed, isCorrect: true } }),
  ]);

  const totalScore = totals._sum.score ?? 0;
  if (totalScore <= 0) return null;
  const totalSubmissions = resolveAggregateCount(totals._count);

  return {
    playerName: trimmed,
    totalScore,
    correctCount,
    totalSubmissions,
    lastUpdated: totals._max?.updatedAt ?? null,
  };
}

export async function getMysteryClueSummaries() {
  if (!process.env.DATABASE_URL) return [] as Awaited<ReturnType<typeof prisma.clue.findMany>>;
  return prisma.clue.findMany({
    orderBy: [{ index: "asc" }],
    select: { id: true, index: true, points: true, releaseAt: true, published: true },
  });
}

export async function getMysterySubmissionsForClue(clueId: string): Promise<MysterySubmissionWithRelations[]> {
  if (!process.env.DATABASE_URL) return [] as MysterySubmissionWithRelations[];
  return prisma.mysteryTipSubmission.findMany({
    where: { clueId },
    include: mysterySubmissionWithRelationsInclude,
    orderBy: [{ createdAt: "desc" }],
  });
}

