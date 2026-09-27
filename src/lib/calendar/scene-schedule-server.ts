import type { EventScheduleMode, Prisma } from "@prisma/client";
import { z } from "zod";

import type { AudienceContext } from "@/lib/calendar/audience";
import { computePersonalWindows, type ScheduledScene } from "@/lib/calendar/scene-schedule";
import {
  DEFAULT_TIME_ZONE,
  formatIsoTimeInTimeZone,
  parseDateTimeInTimeZone,
} from "@/lib/date-time";
import { prisma } from "@/lib/prisma";

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export const scheduleInputSchema = z.object({
  mode: z.enum(["TOGETHER", "STAGGERED"]),
  /** Uhrzeiten pro Szene (HH:MM am Probentag), nur bei gestaffelten Proben. */
  times: z
    .record(z.string(), z.object({ start: z.string().regex(TIME), end: z.string().regex(TIME) }))
    .default({}),
});

export type ScheduleInput = z.infer<typeof scheduleInputSchema>;

/** Uhrzeit am Probentag; Zeiten vor dem Probenbeginn gehören zum Folgetag (über Mitternacht). */
function toDate(dateKey: string, time: string, eventStart: Date) {
  const value = parseDateTimeInTimeZone(dateKey, time, DEFAULT_TIME_ZONE);
  return value < new Date(eventStart.getTime() - 12 * 60 * 60 * 1000)
    ? new Date(value.getTime() + 24 * 60 * 60 * 1000)
    : value;
}

/**
 * Szenen der Probe in der Reihenfolge der Szenen-Regeln speichern, Uhrzeiten setzen und die
 * persönlichen Zeitfenster der Teilnehmer neu berechnen. Ergebnisse der Nachbereitung bleiben.
 */
export async function saveEventSchedule(
  tx: Prisma.TransactionClient,
  {
    eventId,
    sceneIds,
    schedule,
    dateKey,
    eventStart,
    context,
  }: {
    eventId: string;
    sceneIds: readonly string[];
    schedule: ScheduleInput;
    dateKey: string;
    eventStart: Date;
    context: AudienceContext;
  },
) {
  const staggered = schedule.mode === "STAGGERED";
  const scenes: ScheduledScene[] = sceneIds.map((sceneId) => {
    const time = staggered ? schedule.times[sceneId] : undefined;
    if (!time) return { sceneId, startsAt: null, endsAt: null };
    const startsAt = toDate(dateKey, time.start, eventStart);
    let endsAt = toDate(dateKey, time.end, eventStart);
    if (endsAt <= startsAt) endsAt = new Date(endsAt.getTime() + 24 * 60 * 60 * 1000);
    return { sceneId, startsAt, endsAt };
  });

  await tx.calendarEvent.update({ where: { id: eventId }, data: { scheduleMode: schedule.mode } });
  await tx.eventBlock.deleteMany({
    where: { eventId, type: "SCENE", sceneId: { notIn: [...sceneIds] } },
  });
  for (const [order, scene] of scenes.entries()) {
    await tx.eventBlock.upsert({
      where: { eventId_sceneId: { eventId, sceneId: scene.sceneId } },
      update: { order, startsAt: scene.startsAt, endsAt: scene.endsAt },
      create: { eventId, order, ...scene },
    });
  }

  const windows = staggered ? computePersonalWindows(scenes, context) : new Map();
  await tx.eventParticipant.updateMany({
    where: { eventId },
    data: { personalStart: null, personalEnd: null },
  });
  for (const [userId, window] of windows) {
    await tx.eventParticipant.updateMany({
      where: { eventId, userId },
      data: { personalStart: window.start, personalEnd: window.end },
    });
  }
}

/** Gespeicherter Ablauf einer Probe für den Editor. */
export async function readEventSchedule(eventId: string): Promise<{
  mode: EventScheduleMode;
  times: ScheduleInput["times"];
}> {
  const event = await prisma.calendarEvent.findUnique({
    where: { id: eventId },
    select: {
      scheduleMode: true,
      blocks: {
        where: { type: "SCENE", sceneId: { not: null } },
        select: { sceneId: true, startsAt: true, endsAt: true },
      },
    },
  });
  const times: ScheduleInput["times"] = {};
  for (const scene of event?.blocks ?? []) {
    if (scene.sceneId && scene.startsAt && scene.endsAt) {
      times[scene.sceneId] = {
        start: formatIsoTimeInTimeZone(scene.startsAt.toISOString()),
        end: formatIsoTimeInTimeZone(scene.endsAt.toISOString()),
      };
    }
  }
  return { mode: event?.scheduleMode ?? "TOGETHER", times };
}

export type SceneStats = Record<
  string,
  { rehearsed: number; lastRehearsedAt: string | null; planned: number }
>;

/** Wie oft jede Szene einer Produktion schon geprobt wurde und wie oft sie noch angesetzt ist. */
export async function loadSceneStats(showId: string | null, now = new Date()): Promise<SceneStats> {
  if (!showId) return {};
  const entries = await prisma.eventBlock.findMany({
    where: {
      scene: { showId },
      event: { kind: "REHEARSAL", status: "SCHEDULED" },
    },
    select: { sceneId: true, outcome: true, event: { select: { start: true } } },
  });
  const stats: SceneStats = {};
  for (const entry of entries) {
    if (!entry.sceneId) continue;
    const current = (stats[entry.sceneId] ??= { rehearsed: 0, lastRehearsedAt: null, planned: 0 });
    if (entry.event.start > now) {
      current.planned += 1;
    } else if (entry.outcome !== "SKIPPED") {
      // Ohne Nachbereitung gilt eine vergangene Szene als geprobt.
      current.rehearsed += 1;
      const iso = entry.event.start.toISOString();
      if (!current.lastRehearsedAt || iso > current.lastRehearsedAt) current.lastRehearsedAt = iso;
    }
  }
  return stats;
}
