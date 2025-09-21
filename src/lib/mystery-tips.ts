import { prisma } from "@/lib/prisma";

function resolveAggregateCount(value: number | { _all?: number } | null | undefined) {
  if (typeof value === "number") {
    return value;
  }
  if (value && typeof value._all === "number") {
    return value._all;
  }
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
  if (!process.env.DATABASE_URL) {
    return [];
  }
  type GroupTotals = {
    playerName: string;
    _sum: { score: number | null };
    _count: { _all: number | null };
    _max: { updatedAt: Date | null };
  };
  const totals = (await (prisma as unknown as {
    mysteryTipSubmission: {
      groupBy: (args: {
        by: ["playerName"];
        _sum: { score: true };
        _count: { _all: true };
        _max: { updatedAt: true };
      }) => Promise<GroupTotals[]>;
    };
  }).mysteryTipSubmission.groupBy({
    by: ["playerName"],
    _sum: { score: true },
    _count: { _all: true },
    _max: { updatedAt: true },
  })) as GroupTotals[];

  type CorrectCount = { playerName: string; _count: { _all: number | null } };
  const correctCounts = (await (prisma as unknown as {
    mysteryTipSubmission: {
      groupBy: (args: {
        by: ["playerName"];
        _count: { _all: true };
        where: { isCorrect: true };
      }) => Promise<CorrectCount[]>;
    };
  }).mysteryTipSubmission.groupBy({
    by: ["playerName"],
    _count: { _all: true },
    where: { isCorrect: true },
  })) as CorrectCount[];

  const correctMap = new Map<string, number>();
  for (const entry of correctCounts) {
    correctMap.set(entry.playerName, entry._count._all ?? 0);
  }

  const scoreboard = totals
    .map<MysteryScoreboardEntry | null>((entry: GroupTotals) => {
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

  scoreboard.sort((a: MysteryScoreboardEntry, b: MysteryScoreboardEntry) => {
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

  type AggregateTotals = {
    _sum: { score: number | null };
    _count: number | { _all?: number } | null;
    _max: { updatedAt: Date | null };
  };
  const [totals, correctCount] = await Promise.all([
    (prisma as unknown as {
      mysteryTipSubmission: {
        aggregate: (args: {
          where: { playerName: string };
          _sum: { score: true };
          _count: true;
          _max: { updatedAt: true };
        }) => Promise<AggregateTotals>;
      };
    }).mysteryTipSubmission.aggregate({
      where: { playerName: trimmed },
      _sum: { score: true },
      _count: true,
      _max: { updatedAt: true },
    }),
    (prisma as unknown as {
      mysteryTipSubmission: {
        count: (args: { where: { playerName: string; isCorrect: true } }) => Promise<number>;
      };
    }).mysteryTipSubmission.count({ where: { playerName: trimmed, isCorrect: true } }),
  ]);

  const totalScore = totals._sum.score ?? 0;
  if (totalScore <= 0) {
    return null;
  }

  const totalSubmissions = resolveAggregateCount(totals._count);

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

const mysterySubmissionInclude = {
  tip: { select: { text: true, count: true } },
  clue: { select: { id: true, index: true, points: true, releaseAt: true, published: true } },
} as const;

export type MysterySubmissionWithRelations = {
  id: string;
  tipId: string;
  clueId: string | null;
  playerName: string;
  tipText: string;
  normalizedText: string;
  isCorrect: boolean;
  score: number;
  createdAt: Date;
  updatedAt: Date;
  tip: { text: string; count: number };
  clue: { id: string; index: number; points: number; releaseAt: Date | null; published: boolean } | null;
};

export async function getMysterySubmissionsForClue(
  clueId: string,
): Promise<MysterySubmissionWithRelations[]> {
  if (!process.env.DATABASE_URL) {
    return [] as MysterySubmissionWithRelations[];
  }
  return (prisma as unknown as {
    mysteryTipSubmission: {
      findMany: (args: {
        where: { clueId: string };
        include: typeof mysterySubmissionInclude;
        orderBy: Array<{ createdAt: "desc" }>;
      }) => Promise<MysterySubmissionWithRelations[]>;
    };
  }).mysteryTipSubmission.findMany({
    where: { clueId },
    include: mysterySubmissionInclude,
    orderBy: [{ createdAt: "desc" }],
  });
}
