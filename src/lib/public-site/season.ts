import { showDisplayTitle, isShowRevealed } from "@/lib/karten/mails";
import { prisma } from "@/lib/prisma";

export type PublicSeason = {
  year: number;
  revealed: boolean;
  /** Vor der Enthüllung nur „Sommertheater <Jahr>“. */
  title: string;
  /** Nur nach der Enthüllung. */
  synopsis: string | null;
  /** Enthüllungszeitpunkt; ob er angezeigt wird, entscheidet die Website. */
  revealAt: string | null;
  premiereAt: string | null;
  performances: { start: string; location: string | null; cancelled: boolean }[];
};

/**
 * Laufende bzw. nächste Saison für die Website: die neueste nicht archivierte Produktion mit
 * kommenden Vorstellungen. Stücktitel und Inhalt erst ab `revealedAt`, Termine immer.
 */
export async function loadPublicSeason(now: Date = new Date()): Promise<PublicSeason | null> {
  const show = await prisma.show.findFirst({
    where: {
      archivedAt: null,
      calendarEvents: {
        some: {
          kind: "PERFORMANCE",
          status: { in: ["SCHEDULED", "CANCELLED"] },
          start: { gt: now },
        },
      },
    },
    orderBy: [{ year: "asc" }],
    select: {
      title: true,
      year: true,
      synopsis: true,
      revealedAt: true,
      calendarEvents: {
        where: { kind: "PERFORMANCE", status: { in: ["SCHEDULED", "CANCELLED"] } },
        orderBy: { start: "asc" },
        select: { start: true, location: true, status: true },
      },
    },
  });
  if (!show) return null;
  const revealed = isShowRevealed(show, now);
  const premiere = show.calendarEvents.find((event) => event.status !== "CANCELLED");
  return {
    year: show.year,
    revealed,
    title: showDisplayTitle(show, now),
    synopsis: revealed ? (show.synopsis?.trim() ?? null) : null,
    revealAt: show.revealedAt?.toISOString() ?? null,
    premiereAt: premiere?.start.toISOString() ?? null,
    performances: show.calendarEvents
      .filter((event) => event.start > now)
      .map((event) => ({
        start: event.start.toISOString(),
        location: event.location,
        cancelled: event.status === "CANCELLED",
      })),
  };
}

/** Cache-Dauer in Sekunden: nie über die Enthüllung hinaus. */
export function publicSeasonMaxAge(season: PublicSeason | null, now: Date = new Date(), max = 300) {
  if (!season || season.revealed || !season.revealAt) return max;
  const untilReveal = Math.floor((new Date(season.revealAt).getTime() - now.getTime()) / 1000);
  return Math.max(0, Math.min(max, untilReveal));
}
