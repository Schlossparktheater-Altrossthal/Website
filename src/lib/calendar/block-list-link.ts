import { BlockedDayKind } from "@prisma/client";

import { formatIsoDateInTimeZone } from "@/lib/date-time";
import { prisma } from "@/lib/prisma";
import {
  DEFAULT_FREEZE_DAYS,
  readSperrlisteSettings,
  resolveBlocklistSettings,
} from "@/lib/sperrliste-settings";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Sperrfrist in Tagen: Tage, die die Sperrliste nicht mehr neu aufnimmt. */
export async function readFreezeDays(): Promise<number> {
  try {
    const resolved = resolveBlocklistSettings(await readSperrlisteSettings());
    return Number.isFinite(resolved.freezeDays)
      ? Math.max(0, Math.floor(resolved.freezeDays))
      : DEFAULT_FREEZE_DAYS;
  } catch (error) {
    console.error("[block-list-link:freeze]", error);
    return DEFAULT_FREEZE_DAYS;
  }
}

/** Tag des Termins in `Europe/Berlin` – dieselbe Rechnung wie in der Sperrliste. */
export function blockDayKey(start: Date): string {
  return formatIsoDateInTimeZone(start.toISOString());
}

/** Wie `api/block-days`: Datumswerte liegen als UTC-Mitternacht des Tages vor. */
function dateOnlyFromKey(dayKey: string) {
  return new Date(`${dayKey}T00:00:00.000Z`);
}

/**
 * Liegt der Termin so nah, dass die Sperrliste den Tag nicht mehr aufnehmen würde? Dann ist eine
 * Absage ein Notfall. Gerechnet wird auf Tagesebene in `Europe/Berlin`, damit Server und Anzeige
 * übereinstimmen; ein Termin genau auf der Grenze zählt noch als normale Sperre.
 */
export function isWithinFreeze(start: Date, freezeDays: number, now: Date = new Date()): boolean {
  if (freezeDays <= 0) return false;
  const [year, month, day] = formatIsoDateInTimeZone(now.toISOString()).split("-").map(Number);
  const cutoffKey = new Date(Date.UTC(year, month - 1, day + freezeDays))
    .toISOString()
    .slice(0, 10);
  return blockDayKey(start) < cutoffKey;
}

export type DeclineBlockOutcome =
  | { created: true; kind: BlockedDayKind; dayKey: string }
  | { created: false; reason: "existing" | "past" };

/**
 * Legt für eine Absage den Sperrlisten-Eintrag an: „Notfall" innerhalb der Sperrfrist, sonst eine
 * normale Sperre. Existiert an dem Tag schon ein eigener Eintrag, bleibt er unangetastet – er
 * gehört der Person und nicht dem Termin, also wird er auch nicht verknüpft.
 */
export async function createBlockForDecline({
  eventId,
  userId,
  start,
  reason,
  now = new Date(),
}: {
  eventId: string;
  userId: string;
  start: Date;
  reason: string | null;
  now?: Date;
}): Promise<DeclineBlockOutcome> {
  const dayKey = blockDayKey(start);
  if (dayKey < formatIsoDateInTimeZone(now.toISOString())) {
    return { created: false, reason: "past" };
  }

  const kind = isWithinFreeze(start, await readFreezeDays(), now)
    ? BlockedDayKind.EMERGENCY
    : BlockedDayKind.BLOCKED;

  const { count } = await prisma.blockedDay.createMany({
    data: [{ userId, date: dateOnlyFromKey(dayKey), reason, kind, eventId }],
    skipDuplicates: true,
  });

  return count > 0 ? { created: true, kind, dayKey } : { created: false, reason: "existing" };
}

/**
 * Nimmt den von dieser Absage erzeugten Eintrag wieder weg. Ist am selben Tag noch ein anderer
 * Termin abgesagt, bleibt der Eintrag stehen – dann wird nur die Verknüpfung gelöst, damit ein
 * späteres „Doch dabei" ihn nicht mitreißt.
 */
export async function removeBlockForDecline({
  eventId,
  userId,
}: {
  eventId: string;
  userId: string;
}): Promise<boolean> {
  const entry = await prisma.blockedDay.findFirst({
    where: { userId, eventId },
    select: { id: true, date: true },
  });
  if (!entry) return false;

  const dayKey = entry.date.toISOString().slice(0, 10);
  const surrounding = await prisma.eventParticipant.findMany({
    where: {
      userId,
      eventId: { not: eventId },
      response: { in: ["no", "emergency"] },
      event: {
        departmentId: null,
        start: {
          gte: new Date(entry.date.getTime() - DAY_MS),
          lt: new Date(entry.date.getTime() + 2 * DAY_MS),
        },
      },
    },
    select: { event: { select: { start: true } } },
  });
  const anotherDeclineSameDay = surrounding.some((row) => blockDayKey(row.event.start) === dayKey);

  if (anotherDeclineSameDay) {
    await prisma.blockedDay.update({ where: { id: entry.id }, data: { eventId: null } });
    return false;
  }

  await prisma.blockedDay.delete({ where: { id: entry.id } });
  return true;
}
