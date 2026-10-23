import chronik from "@/data/chronik-altrossthal.json";
import { prisma } from "@/lib/prisma";

import { loadPublicSeason } from "./season";

export type PublicStats = {
  /** Erstes Sommertheater laut Chronik. */
  since: number | null;
  /** Gespielte Inszenierungen: Chronik plus vergangene Produktionen aus dem Mitgliederbereich. */
  productions: number;
  /** Aktive Mitwirkende der laufenden bzw. nächsten Saison. */
  members: number;
  /** Gewerke der laufenden bzw. nächsten Saison. */
  departments: number;
  /** Vorstellungen der laufenden bzw. nächsten Saison (ohne abgesagte). */
  performances: number;
};

/** Gespielte Jahre zählen: Chronik ∪ Produktionen ohne kommende Vorstellungen bis zum aktuellen Jahr. */
export function countProductionYears(
  chronikYears: number[],
  shows: { year: number; hasUpcoming: boolean }[],
  now: Date,
) {
  const years = new Set(chronikYears);
  for (const show of shows) {
    if (show.year <= now.getFullYear() && !show.hasUpcoming) years.add(show.year);
  }
  return years.size;
}

/** Nur Zahlen, keine Namen oder Titel – daher unabhängig von der Enthüllung öffentlich. */
export async function loadPublicStats(now: Date = new Date()): Promise<PublicStats> {
  const chronikYears = (chronik as { year: number }[]).map((entry) => entry.year);
  const [shows, season] = await Promise.all([
    prisma.show.findMany({
      select: {
        id: true,
        year: true,
        _count: {
          select: { calendarEvents: { where: { kind: "PERFORMANCE", start: { gt: now } } } },
        },
      },
    }),
    loadPublicSeason(now),
  ]);
  const current = season ? shows.find((show) => show.year === season.year) : undefined;
  const [members, departments] = current
    ? await Promise.all([
        prisma.productionMembership.count({
          where: { showId: current.id, status: "active", leftAt: null },
        }),
        prisma.department.count({ where: { showId: current.id } }),
      ])
    : [0, 0];
  return {
    since: chronikYears.length > 0 ? Math.min(...chronikYears) : null,
    productions: countProductionYears(
      chronikYears,
      shows.map((show) => ({ year: show.year, hasUpcoming: show._count.calendarEvents > 0 })),
      now,
    ),
    members,
    departments,
    performances: season?.performances.filter((item) => !item.cancelled).length ?? 0,
  };
}
