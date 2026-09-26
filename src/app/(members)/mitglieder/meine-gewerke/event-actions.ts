"use server";

import { revalidatePath } from "next/cache";
import { format } from "date-fns";
import { de } from "date-fns/locale/de";
import { z } from "zod";

import { resolveCalendarEventTimes } from "@/lib/calendar/event-input";
import { requireBoardAccess } from "@/lib/departments/board";
import { prisma } from "@/lib/prisma";
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
      await prisma.calendarEvent.create({
        data: {
          ...fields,
          kind: "MEETING",
          showId: department.showId,
          departmentId: data.departmentId,
          createdById: access.userId,
        },
      });
      await notify(
        await activeMemberIds(data.departmentId),
        access.userId,
        `Neuer Termin (${department.name}): ${data.title}`,
        `${formatWhen(start)} – bitte zu- oder absagen.`,
      );
    } else {
      const event = await loadEvent(data.eventId);
      if (event.departmentId !== data.departmentId) throw new Error("Termin gehört nicht hierher.");
      await prisma.calendarEvent.update({ where: { id: event.id }, data: fields });
      if (event.start.getTime() !== start.getTime()) {
        await notify(
          await activeMemberIds(event.departmentId),
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
    const attending = await prisma.calendarEventResponse.findMany({
      where: { eventId: event.id, status: { in: ["yes", "maybe"] } },
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
  status: z.enum(["yes", "maybe", "no"]).nullable(),
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
    if (data.status === null) {
      await prisma.calendarEventResponse.deleteMany({
        where: { eventId: event.id, userId: access.userId },
      });
    } else {
      await prisma.calendarEventResponse.upsert({
        where: { eventId_userId: { eventId: event.id, userId: access.userId } },
        create: { eventId: event.id, userId: access.userId, status: data.status },
        update: { status: data.status },
      });
    }
    revalidateTeams();
    return actionSuccess();
  } catch (error) {
    return actionFailure(error, "Antwort konnte nicht gespeichert werden.");
  }
}
