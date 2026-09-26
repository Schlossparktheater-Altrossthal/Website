import { DEFAULT_TIME_ZONE, parseDateTimeInTimeZone } from "@/lib/date-time";
import { prisma } from "@/lib/prisma";

/** Einschränkung laut Sperrliste an einem Tag (nur wer gesperrt oder eingeschränkt ist). */
export type DayAvailability = Partial<Record<string, "blocked" | "limited">>;

/** Sperrliste eines Kalendertags (yyyy-MM-dd, Europe/Berlin). */
export async function readDayAvailability(dateKey: string): Promise<DayAvailability> {
  const dayStart = parseDateTimeInTimeZone(dateKey, "00:00", DEFAULT_TIME_ZONE);
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
  const entries = await prisma.blockedDay.findMany({
    where: { date: { gte: dayStart, lt: dayEnd }, kind: { in: ["BLOCKED", "LIMITED"] } },
    select: { userId: true, kind: true },
  });
  return Object.fromEntries(
    entries.map((entry) => [entry.userId, entry.kind === "BLOCKED" ? "blocked" : "limited"]),
  );
}
