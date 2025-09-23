import { cache } from "react";

import { prisma } from "@/lib/prisma";

type CurrentProductionEnsembleStats = {
  showId: string;
  year: number;
  title: string | null;
  memberCount: number;
};

export const getCurrentProductionEnsembleStats = cache(async (): Promise<CurrentProductionEnsembleStats | null> => {
  if (!process.env.DATABASE_URL) {
    return null;
  }

  const latestShow = await prisma.show.findFirst({
    orderBy: [
      { year: "desc" },
      { revealedAt: "desc" },
    ],
    select: {
      id: true,
      year: true,
      title: true,
    },
  });

  if (!latestShow) {
    return null;
  }

  const participants = await prisma.characterCasting.findMany({
    where: {
      character: { showId: latestShow.id },
      user: { deactivatedAt: null },
    },
    select: { userId: true },
    distinct: ["userId"],
  });

  return {
    showId: latestShow.id,
    year: latestShow.year,
    title: latestShow.title ?? null,
    memberCount: participants.length,
  };
});
