import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

type PlayerScoreboardGroupByArgs = Prisma.MysteryTipSubmissionGroupByArgs & {
  by: ["playerName"];
  _sum: { score: true };
  _count: { _all: true };
  _max: { updatedAt: true };
};

const playerScoreboardGroupByArgs = Prisma.validator<PlayerScoreboardGroupByArgs>()({
  by: ["playerName"],
  _sum: { score: true },
  _count: { _all: true },
  _max: { updatedAt: true },
});

type PlayerScoreboardAggregateArgs = Prisma.MysteryTipSubmissionAggregateArgs & {
  _sum: { score: true };
  _count: true;
  _max: { updatedAt: true };
};

const playerScoreboardAggregateArgs = Prisma.validator<PlayerScoreboardAggregateArgs>()({
  _sum: { score: true },
  _count: true,
  _max: { updatedAt: true },
});

const clueSummarySelect = Prisma.validator<Prisma.ClueSelect>()({
  id: true,
  index: true,
  points: true,
  releaseAt: true,
  published: true,
});

const tipSummarySelect = Prisma.validator<Prisma.MysteryTipSelect>()({
  text: true,
  count: true,
});

const tipCountSelect = Prisma.validator<Prisma.MysteryTipSelect>()({
  count: true,
});

export const mysterySubmissionWithRelationsInclude =
  Prisma.validator<Prisma.MysteryTipSubmissionInclude>()({
    tip: { select: tipSummarySelect },
    clue: { select: clueSummarySelect },
  });

export const mysterySubmissionWithCountsInclude =
  Prisma.validator<Prisma.MysteryTipSubmissionInclude>()({
    tip: { select: tipCountSelect },
    clue: { select: clueSummarySelect },
  });

export type MysterySubmissionWithRelations = Prisma.MysteryTipSubmissionGetPayload<{
  include: typeof mysterySubmissionWithRelationsInclude;
}>;

export type MysterySubmissionWithCounts = Prisma.MysteryTipSubmissionGetPayload<{
  include: typeof mysterySubmissionWithCountsInclude;
}>;

export function groupMysteryTipSubmissionsByPlayer(
  where?: Prisma.MysteryTipSubmissionWhereInput,
) {
  return prisma.mysteryTipSubmission.groupBy({
    ...playerScoreboardGroupByArgs,
    ...(where ? { where } : {}),
  });
}

export type MysteryScoreboardGroupRow = Awaited<
  ReturnType<typeof groupMysteryTipSubmissionsByPlayer>
>[number];

export function aggregateMysteryTipSubmissionScores(
  where: Prisma.MysteryTipSubmissionWhereInput,
) {
  return prisma.mysteryTipSubmission.aggregate({
    ...playerScoreboardAggregateArgs,
    where,
  });
}

export type MysteryTipSubmissionAggregateResult = Awaited<
  ReturnType<typeof aggregateMysteryTipSubmissionScores>
>;
