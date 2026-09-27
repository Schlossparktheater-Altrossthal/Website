"use server";

import { revalidatePath } from "next/cache";
import { format } from "date-fns";
import { de } from "date-fns/locale/de";
import { z } from "zod";

import { saveEventAudience } from "@/lib/calendar/audience-server";
import { candidateDays, rankDays, type RankedDay } from "@/lib/calendar/date-finder";
import { loadFinderDays } from "@/lib/calendar/date-finder-server";
import { resolveCalendarEventTimes } from "@/lib/calendar/event-input";
import { EVENT_RESPONSE_STATUSES } from "@/lib/calendar/responses";
import { requireBoardAccess } from "@/lib/departments/board";
import { getUserDisplayName } from "@/lib/names";
import { prisma } from "@/lib/prisma";
import { updateAttendanceWithLog } from "@/lib/rehearsals/attendance";
import {
  actionFailure,
  actionSuccess,
  type ProductionActionResult,
} from "@/lib/produktionen/actions-helpers";

const isoDate = /^\d{4}-\d{2}-\d{2}$/;
const time = /^([01]\d|2[0-3]):[0-5]\d$/;

function revalidateTeams() {
  revalidatePath("/mitglieder/meine-gewerke", "layout");
  revalidatePath("/mitglieder/meine-proben");
}

async function loadEvent(eventId: string) {
  const event = await prisma.calendarEvent.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      title: true,
      start: true,
      departmentId: true,
      department: { select: { name: true } },
    },
  });
  if (!event?.departmentId) throw new Error("Termin wurde nicht gefunden.");
  return { ...event, departmentId: event.departmentId };
}

function formatWhen(date: Date) {
  return format(date, "EEE d. MMM, HH:mm", { locale: de });
}

async function notify(userIds: string[], actorId: string, title: string, body?: string) {
  const recipients = [...new Set(userIds)].filter((id) => id !== actorId);
  if (!recipients.length) return;
  await prisma.notification.create({
    data: {
      title,
      body: body ?? null,
      type: "department-event",
      recipients: { create: recipients.map((userId) => ({ userId })) },
    },
  });
}

async function activeMemberIds(departmentId: string) {
  const rows = await prisma.departmentMembership.findMany({
    where: { departmentId, status: "active", user: { deactivatedAt: null } },
    select: { userId: true },
  });
  return rows.map((row) => row.userId);
}

/**
 * Auswahl einzelner Mitglieder als Zielgruppe speichern (Personen-Regeln). Nur aktive
 * Mitglieder des Gewerks zählen. Gibt die Eingeladenen zurück, null = ganzes Team.
 */
async function saveTeamSelection(
  eventId: string,
  departmentId: string,
  memberIds: readonly string[] | null | undefined,
) {
  const active = await activeMemberIds(departmentId);
  const selected = memberIds ? active.filter((id) => memberIds.includes(id)) : [];
  const context = {
    hasProduction: false,
    members: active.map((id) => ({ id, name: "" })),
    castings: [],
    characters: [],
    scenes: [],
    departments: [],
  };
  await prisma.$transaction((tx) =>
    saveEventAudience(
      tx,
      eventId,
      {
        rules: selected.map((id) => ({
          type: "USER" as const,
          targetId: id,
          level: "REQUIRED" as const,
        })),
        overrides: [],
      },
      context,
    ),
  );
  return selected.length ? selected : null;
}

const eventSchema = z
  .object({
    departmentId: z.string(),
    eventId: z.string().optional(),
    title: z.string().trim().min(1, "Titel fehlt.").max(120),
    date: z.string().regex(isoDate, "Datum fehlt."),
    startTime: z.string().regex(time, "Beginn fehlt."),
    endTime: z
      .string()
      .regex(time)
      .nullish()
      .or(z.literal("").transform(() => null)),
    location: z.string().trim().max(160).nullish(),
    description: z.string().trim().max(2000).nullish(),
    /** Nur diese Mitglieder einladen; null/fehlend = ganzes Team. */
    memberIds: z.array(z.string().min(1)).max(500).nullish(),
  })
  .refine((value) => !value.endTime || value.endTime > value.startTime, {
    message: "Ende liegt vor dem Beginn.",
    path: ["endTime"],
  });

export async function saveTeamEventAction(
  input: z.input<typeof eventSchema>,
): Promise<ProductionActionResult> {
  try {
    const data = eventSchema.parse(input);
    const access = await requireBoardAccess(data.departmentId);
    if (!access.canManage) throw new Error("Termine planen Leitung, Vertretung und Regie.");
    const { start, end } = resolveCalendarEventTimes({
      title: data.title,
      kind: "MEETING",
      date: data.date,
      allDay: false,
      startTime: data.startTime,
      endTime: data.endTime ?? null,
      location: null,
      description: null,
    });
    const fields = {
      title: data.title,
      start,
      end,
      location: data.location || null,
      description: data.description || null,
    };

    if (!data.eventId) {
      const department = await prisma.department.findUniqueOrThrow({
        where: { id: data.departmentId },
        select: { name: true, showId: true },
      });
      const created = await prisma.calendarEvent.create({
        data: {
          ...fields,
          kind: "MEETING",
          showId: department.showId,
          departmentId: data.departmentId,
          createdById: access.userId,
        },
        select: { id: true },
      });
      const invited = await saveTeamSelection(created.id, data.departmentId, data.memberIds);
      await notify(
        invited ?? (await activeMemberIds(data.departmentId)),
        access.userId,
        `Neuer Termin (${department.name}): ${data.title}`,
        `${formatWhen(start)} – bitte zu- oder absagen.`,
      );
    } else {
      const event = await loadEvent(data.eventId);
      if (event.departmentId !== data.departmentId) throw new Error("Termin gehört nicht hierher.");
      await prisma.calendarEvent.update({ where: { id: event.id }, data: fields });
      const invited = await saveTeamSelection(event.id, event.departmentId, data.memberIds);
      if (event.start.getTime() !== start.getTime()) {
        await notify(
          invited ?? (await activeMemberIds(event.departmentId)),
          access.userId,
          `Termin verschoben (${event.department?.name ?? "Gewerk"}): ${data.title}`,
          `Neu: ${formatWhen(start)}`,
        );
      }
    }
    revalidateTeams();
    return actionSuccess();
  } catch (error) {
    return actionFailure(error, "Termin konnte nicht gespeichert werden.");
  }
}

export async function deleteTeamEventAction(input: {
  eventId: string;
}): Promise<ProductionActionResult> {
  try {
    const event = await loadEvent(z.string().parse(input.eventId));
    const access = await requireBoardAccess(event.departmentId);
    if (!access.canManage) throw new Error("Termine planen Leitung, Vertretung und Regie.");
    const attending = await prisma.eventParticipant.findMany({
      where: { eventId: event.id, response: { in: ["yes", "maybe"] } },
      select: { userId: true },
    });
    await prisma.calendarEvent.delete({ where: { id: event.id } });
    if (event.start > new Date()) {
      await notify(
        attending.map((entry) => entry.userId),
        access.userId,
        `Termin abgesagt (${event.department?.name ?? "Gewerk"}): ${event.title}`,
        formatWhen(event.start),
      );
    }
    revalidateTeams();
    return actionSuccess();
  } catch (error) {
    return actionFailure(error, "Termin konnte nicht gelöscht werden.");
  }
}

const responseSchema = z.object({
  eventId: z.string(),
  status: z.enum(EVENT_RESPONSE_STATUSES).nullable(),
});

/** Eigene Zu-/Absage; `null` nimmt die Antwort zurück. */
export async function respondTeamEventAction(
  input: z.input<typeof responseSchema>,
): Promise<ProductionActionResult> {
  try {
    const data = responseSchema.parse(input);
    const event = await loadEvent(data.eventId);
    const access = await requireBoardAccess(event.departmentId);
    if (!access.role) throw new Error("Nur Mitglieder des Gewerks können zu- oder absagen.");
    await updateAttendanceWithLog({
      prisma,
      eventId: event.id,
      targetUserId: access.userId,
      actorUserId: access.userId,
      nextStatus: data.status,
    });
    revalidateTeams();
    return actionSuccess();
  } catch (error) {
    return actionFailure(error, "Antwort konnte nicht gespeichert werden.");
  }
}

const finderSchema = z.object({
  departmentId: z.string(),
  from: z.string().regex(isoDate),
  to: z.string().regex(isoDate),
  weekdays: z.array(z.number().int().min(0).max(6)).max(7),
  startTime: z.string().regex(time),
  endTime: z.string().regex(time),
  /** Nur diese Mitglieder berücksichtigen; fehlend = ganzes Team. */
  memberIds: z.array(z.string().min(1)).max(500).nullish(),
});

const FINDER_MAX_DAYS = 120;

/** Terminfinder fürs Gewerk: beste Tage für alle aktiven Mitglieder (Sperrliste + Termine). */
export async function findTeamEventDatesAction(
  input: z.input<typeof finderSchema>,
): Promise<
  | { ok: true; days: RankedDay[]; names: Record<string, string>; memberCount: number }
  | { ok: false; error: string }
> {
  try {
    const data = finderSchema.parse(input);
    if (data.from > data.to) return { ok: false, error: "Zeitraum endet vor dem Beginn." };
    const access = await requireBoardAccess(data.departmentId);
    if (!access.canManage) throw new Error("Termine planen Leitung, Vertretung und Regie.");
    const members = await prisma.departmentMembership.findMany({
      where: {
        departmentId: data.departmentId,
        status: "active",
        user: { deactivatedAt: null },
        ...(data.memberIds ? { userId: { in: data.memberIds } } : {}),
      },
      select: {
        user: { select: { id: true, firstName: true, lastName: true, name: true, email: true } },
      },
    });
    if (!members.length) return { ok: false, error: "Das Gewerk hat noch keine Mitglieder." };
    const participants = members.map((entry) => ({
      userId: entry.user.id,
      level: "REQUIRED" as const,
    }));
    const days = await loadFinderDays({
      userIds: participants.map((entry) => entry.userId),
      dateKeys: candidateDays({ ...data, limit: FINDER_MAX_DAYS }),
      startTime: data.startTime,
      endTime: data.endTime,
    });
    return {
      ok: true,
      days: rankDays(participants, days),
      names: Object.fromEntries(
        members.map((entry) => [entry.user.id, getUserDisplayName(entry.user)]),
      ),
      memberCount: members.length,
    };
  } catch (error) {
    if (error instanceof z.ZodError) return { ok: false, error: "Bitte Eingaben prüfen." };
    if (error instanceof Error && error.message.startsWith("Termine planen")) {
      return { ok: false, error: error.message };
    }
    console.error("Error finding team event dates", error);
    return { ok: false, error: "Die Termine konnten nicht berechnet werden." };
  }
}
