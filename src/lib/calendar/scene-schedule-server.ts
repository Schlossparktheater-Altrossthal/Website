import type { EventScheduleMode, Prisma } from "@prisma/client";
import { z } from "zod";

import type { AudienceContext } from "@/lib/calendar/audience";
import {
  computePersonalWindows,
  scenesByPerson,
  type ScheduledDepartmentBlock,
  type ScheduledScene,
} from "@/lib/calendar/scene-schedule";
import {
  DEFAULT_TIME_ZONE,
  formatIsoTimeInTimeZone,
  parseDateTimeInTimeZone,
} from "@/lib/date-time";
import { visibleEventStatus } from "@/lib/calendar/status";
import { prisma } from "@/lib/prisma";

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

const optionalTime = z.union([z.string().regex(TIME), z.literal("")]);

/** Weiterer Baustein neben den Szenen (Gewerk oder frei); die ID vergibt der Editor. */
export const blockInputSchema = z
  .object({
    id: z.string().regex(/^[\w-]{8,40}$/),
    type: z.enum(["DEPARTMENT", "CUSTOM"]),
    title: z.string().trim().max(120).default(""),
    departmentId: z.string().min(1).nullable().default(null),
    start: optionalTime.default(""),
    end: optionalTime.default(""),
    location: z.string().trim().max(120).default(""),
    description: z.string().trim().max(2000).default(""),
  })
  .refine((block) => block.type !== "DEPARTMENT" || block.departmentId, {
    message: "Gewerk fehlt",
  });

export type BlockInput = z.infer<typeof blockInputSchema>;

export const scheduleInputSchema = z.object({
  mode: z.enum(["TOGETHER", "STAGGERED"]),
  /** Uhrzeiten pro Szene (HH:MM am Probentag), nur bei gestaffelten Proben. */
  times: z
    .record(z.string(), z.object({ start: z.string().regex(TIME), end: z.string().regex(TIME) }))
    .default({}),
  /** Raum pro Szene, wenn parallel geprobt wird. */
  rooms: z.record(z.string(), z.string().trim().max(120)).default({}),
  blocks: z.array(blockInputSchema).max(30).default([]),
});

export type ScheduleInput = z.infer<typeof scheduleInputSchema>;

/** Uhrzeit am Probentag; Zeiten vor dem Probenbeginn gehören zum Folgetag (über Mitternacht). */
function toDate(dateKey: string, time: string, eventStart: Date) {
  const value = parseDateTimeInTimeZone(dateKey, time, DEFAULT_TIME_ZONE);
  return value < new Date(eventStart.getTime() - 12 * 60 * 60 * 1000)
    ? new Date(value.getTime() + 24 * 60 * 60 * 1000)
    : value;
}

function toRange(dateKey: string, start: string, end: string, eventStart: Date) {
  if (!start || !end) return { startsAt: null, endsAt: null };
  const startsAt = toDate(dateKey, start, eventStart);
  let endsAt = toDate(dateKey, end, eventStart);
  if (endsAt <= startsAt) endsAt = new Date(endsAt.getTime() + 24 * 60 * 60 * 1000);
  return { startsAt, endsAt };
}

/**
 * Gewerk- und freie Bausteine speichern. Muss vor der Zielgruppe laufen, weil Gewerk-Bausteine
 * deren Mitglieder einladen. Raum und Beschreibung von Gewerk-Bausteinen pflegt die
 * Gewerk-Leitung; die Planung setzt nur Gewerk, Titel und grobes Zeitfenster.
 */
export async function saveEventBlocks(
  tx: Prisma.TransactionClient,
  {
    eventId,
    blocks,
    dateKey,
    eventStart,
  }: { eventId: string; blocks: readonly BlockInput[]; dateKey: string; eventStart: Date },
) {
  await tx.eventBlock.deleteMany({
    where: { eventId, type: { not: "SCENE" }, id: { notIn: blocks.map((block) => block.id) } },
  });
  for (const [index, block] of blocks.entries()) {
    const common = {
      type: block.type,
      title: block.title || null,
      departmentId: block.type === "DEPARTMENT" ? block.departmentId : null,
      order: 1000 + index,
      ...toRange(dateKey, block.start, block.end, eventStart),
    };
    const own =
      block.type === "CUSTOM"
        ? { location: block.location || null, description: block.description || null }
        : {};
    const updated = await tx.eventBlock.updateMany({
      where: { id: block.id, eventId, type: { not: "SCENE" } },
      data: { ...common, ...own },
    });
    if (!updated.count) {
      await tx.eventBlock.create({ data: { id: block.id, eventId, ...common, ...own } });
    }
  }
}

/** Gewerk-Bausteine eines Termins für Einladung und Zeitfenster. */
export async function readDepartmentBlocks(tx: Prisma.TransactionClient, eventId: string) {
  const blocks = await tx.eventBlock.findMany({
    where: { eventId, type: "DEPARTMENT", departmentId: { not: null } },
    select: { departmentId: true, title: true, startsAt: true, endsAt: true },
  });
  return blocks.flatMap((block) =>
    block.departmentId ? [{ ...block, departmentId: block.departmentId }] : [],
  );
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
    return { sceneId, ...toRange(dateKey, time?.start ?? "", time?.end ?? "", eventStart) };
  });

  await tx.calendarEvent.update({ where: { id: eventId }, data: { scheduleMode: schedule.mode } });
  await tx.eventBlock.deleteMany({
    where: { eventId, type: "SCENE", sceneId: { notIn: [...sceneIds] } },
  });
  for (const [order, scene] of scenes.entries()) {
    const location = schedule.rooms[scene.sceneId] || null;
    await tx.eventBlock.upsert({
      where: { eventId_sceneId: { eventId, sceneId: scene.sceneId } },
      update: { order, startsAt: scene.startsAt, endsAt: scene.endsAt, location },
      create: { eventId, order, location, ...scene },
    });
  }

  // Wer zur Terminzeit zu den Szenen kommt, braucht kein eigenes Fenster.
  const departmentBlocks: ScheduledDepartmentBlock[] = await readDepartmentBlocks(tx, eventId);
  const windows = computePersonalWindows(staggered ? scenes : [], context, departmentBlocks);
  if (!staggered) {
    for (const userId of scenesByPerson(sceneIds, context).keys()) windows.delete(userId);
  }
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

const formatTime = (value: Date | null) =>
  value ? formatIsoTimeInTimeZone(value.toISOString()) : "";

/** Gespeicherter Ablauf eines Termins (Szenen und weitere Bausteine) für den Editor. */
export async function readEventSchedule(eventId: string): Promise<{
  mode: EventScheduleMode;
  times: ScheduleInput["times"];
  rooms: ScheduleInput["rooms"];
  blocks: BlockInput[];
}> {
  const event = await prisma.calendarEvent.findUnique({
    where: { id: eventId },
    select: {
      scheduleMode: true,
      blocks: {
        orderBy: { order: "asc" },
        select: {
          id: true,
          type: true,
          sceneId: true,
          departmentId: true,
          title: true,
          description: true,
          location: true,
          startsAt: true,
          endsAt: true,
        },
      },
    },
  });
  const times: ScheduleInput["times"] = {};
  const rooms: ScheduleInput["rooms"] = {};
  const blocks: BlockInput[] = [];
  for (const block of event?.blocks ?? []) {
    if (block.type === "SCENE") {
      if (!block.sceneId) continue;
      if (block.startsAt && block.endsAt) {
        times[block.sceneId] = { start: formatTime(block.startsAt), end: formatTime(block.endsAt) };
      }
      if (block.location) rooms[block.sceneId] = block.location;
      continue;
    }
    blocks.push({
      id: block.id,
      type: block.type,
      title: block.title ?? "",
      departmentId: block.departmentId,
      start: formatTime(block.startsAt),
      end: formatTime(block.endsAt),
      location: block.location ?? "",
      description: block.description ?? "",
    });
  }
  return { mode: event?.scheduleMode ?? "TOGETHER", times, rooms, blocks };
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
      event: { kind: "REHEARSAL", status: visibleEventStatus },
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
