import { prisma } from "@/lib/prisma";

/** Ein Besuch gilt als neu, wenn der letzte länger als das hier her ist. */
const VISIT_GAP_MS = 30 * 60 * 1000;

/**
 * Merkt den Besuch des Regie-Dashboards und liefert den Zeitpunkt, ab dem etwas als
 * „neu seit letztem Besuch“ gilt. Neuladen innerhalb von 30 Minuten behält die Markierungen.
 * Beim allerersten Besuch ist nichts „neu“ (`null`).
 */
export async function touchDirectionVisit(userId: string, showId: string): Promise<Date | null> {
  const now = new Date();
  const visit = await prisma.directionVisit.findUnique({
    where: { userId_showId: { userId, showId } },
  });
  if (!visit) {
    await prisma.directionVisit.create({ data: { userId, showId, seenAt: now } });
    return null;
  }
  if (now.getTime() - visit.seenAt.getTime() < VISIT_GAP_MS) {
    await prisma.directionVisit.update({
      where: { userId_showId: { userId, showId } },
      data: { seenAt: now },
    });
    return visit.previousAt;
  }
  await prisma.directionVisit.update({
    where: { userId_showId: { userId, showId } },
    data: { previousAt: visit.seenAt, seenAt: now },
  });
  return visit.seenAt;
}
