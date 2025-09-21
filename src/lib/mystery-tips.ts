import { prisma } from "@/lib/prisma";

export type MysteryScoreboardEntry = {
  playerName: string;
  totalScore: number;
  correctCount: number;
  totalSubmissions: number;
  lastUpdated: Date | null;
};

export async function getMysteryScoreboard(limit?: number): Promise<MysteryScoreboardEntry[]> {
  if (!process.env.DATABASE_URL) {
    return [];
  }
  const totals = await prisma.mysteryTipSubmission.groupBy({
    by: ["playerName"],
    _sum: { score: true },
    _count: { _all: true },
    _max: { updatedAt: true },
  });

  const correctCounts = await prisma.mysteryTipSubmission.groupBy({
    by: ["playerName"],
    _count: { _all: true },
    where: { isCorrect: true },
  });

  const correctMap = new Map<string, number>();
  for (const entry of correctCounts) {
    correctMap.set(entry.playerName, entry._count._all ?? 0);
  }

  const scoreboard = totals
    .map<MysteryScoreboardEntry | null>((entry) => {
      const playerName = entry.playerName.trim();
      const totalScore = entry._sum.score ?? 0;
      const totalSubmissions = entry._count._all ?? 0;
      if (!playerName || totalScore <= 0) {
        return null;
      }
      return {
        playerName,
        totalScore,
        totalSubmissions,
        correctCount: correctMap.get(playerName) ?? 0,
        lastUpdated: entry._max.updatedAt ?? null,
      };
    })
    .filter((entry): entry is MysteryScoreboardEntry => Boolean(entry));

  scoreboard.sort((a, b) => {
    if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
    if (b.correctCount !== a.correctCount) return b.correctCount - a.correctCount;
    if (b.totalSubmissions !== a.totalSubmissions) return b.totalSubmissions - a.totalSubmissions;
    return a.playerName.localeCompare(b.playerName, "de-DE", { sensitivity: "base" });
  });

  if (typeof limit === "number" && limit > 0) {
    return scoreboard.slice(0, limit);
  }

  return scoreboard;
}

export async function getMysteryScoreboardEntry(playerName: string): Promise<MysteryScoreboardEntry | null> {
  const trimmed = playerName.trim();
  if (!trimmed) {
    return null;
  }

  if (!process.env.DATABASE_URL) {
    return null;
  }

  const [totals, correctCount] = await Promise.all([
    prisma.mysteryTipSubmission.aggregate({
      where: { playerName: trimmed },
      _sum: { score: true },
      _count: true,
      _max: { updatedAt: true },
    }),
    prisma.mysteryTipSubmission.count({ where: { playerName: trimmed, isCorrect: true } }),
  ]);

  const totalScore = totals._sum.score ?? 0;
  if (totalScore <= 0) {
    return null;
  }

  const totalSubmissions = typeof totals._count === "number" ? totals._count : totals._count?._all ?? 0;

  return {
    playerName: trimmed,
    totalScore,
    correctCount,
    totalSubmissions,
    lastUpdated: totals._max.updatedAt ?? null,
  };
}

export async function getMysteryClueSummaries() {
  if (!process.env.DATABASE_URL) {
    return [] as Awaited<ReturnType<typeof prisma.clue.findMany>>;
  }
  return prisma.clue.findMany({
    orderBy: [{ index: "asc" }],
    select: {
      id: true,
      index: true,
      points: true,
      releaseAt: true,
      published: true,
    },
  });
}

export async function getMysterySubmissionsForClue(clueId: string) {
  if (!process.env.DATABASE_URL) {
    return [] as Awaited<ReturnType<typeof prisma.mysteryTipSubmission.findMany>>;
  }
  return prisma.mysteryTipSubmission.findMany({
    where: { clueId },
    include: {
      tip: {
        select: {
          text: true,
          count: true,
        },
      },
      clue: {
        select: {
          id: true,
          index: true,
          points: true,
          releaseAt: true,
          published: true,
        },
      },
    },
    orderBy: [{ createdAt: "desc" }],
  });
}
