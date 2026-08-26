"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { broadcastRehearsalCreated, sendNotification } from "@/lib/realtime/triggers";
import { formatIsoDateInTimeZone, formatIsoTimeInTimeZone } from "@/lib/date-time";

import {
  collectInviteeRoles,
  computeEnd,
  draftUpdateSchema,
  ensurePlanner,
  parseEnd,
  parseStart,
  publishSchema,
  REHEARSAL_TIME_ZONE,
  rolesToInputJson,
  sanitizeDescription,
  syncInvitees,
} from "@/lib/probenplanung/actions-helpers";

export async function createRehearsalDraftAction(input?: {
  title?: string;
  date?: string;
  time?: string;
  endTime?: string;
  location?: string;
}) {
  const auth = await ensurePlanner();
  if (!auth.ok) {
    return { error: auth.error } as const;
  }

  const now = new Date();
  let start = new Date(now);
  start.setMinutes(0, 0, 0);
  start.setHours(start.getHours() + 1);

  if (input?.date) {
    try {
      start = parseStart(input.date, input.time ?? "19:00");
    } catch (error) {
      console.warn("Invalid draft start provided", error);
    }
  }

  let end = computeEnd(start);
  if (input?.endTime) {
    const dateForEnd = input.date
      ? input.date
      : formatIsoDateInTimeZone(start.toISOString(), REHEARSAL_TIME_ZONE);
    try {
      end = parseEnd(dateForEnd, input.endTime, start);
    } catch (error) {
      console.warn("Invalid draft end provided", error);
    }
  }
  const normalizedTitle = input?.title?.trim() || "Neue Probe";
  const normalizedLocation = input?.location?.trim() || "Noch offen";

  const rehearsal = await prisma.rehearsal.create({
    data: {
      title: normalizedTitle,
      location: normalizedLocation,
      start,
      end,
      description: null,
      requiredRoles: [],
      registrationDeadline: null,
      createdBy: auth.userId,
      status: "DRAFT",
    },
    select: { id: true },
  });

  return { success: true as const, id: rehearsal.id };
}

export async function updateRehearsalDraftAction(input: {
  id: string;
  title?: string;
  date?: string;
  time?: string;
  location?: string;
  description?: string;
  invitees?: string[];
}) {
  const auth = await ensurePlanner();
  if (!auth.ok) {
    return { error: auth.error } as const;
  }

  const parsed = draftUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Bitte Eingaben prüfen." } as const;
  }

  const { id, title, date, time, endTime, location, description, invitees } = parsed.data;

  try {
    await prisma.$transaction(async (tx) => {
      const existing = await tx.rehearsal.findUnique({
        where: { id },
        select: { status: true, start: true, end: true },
      });
      if (!existing) {
        throw new Error("not-found");
      }
      if (existing.status !== "DRAFT") {
        throw new Error("not-draft");
      }

      const updateData: Prisma.RehearsalUpdateInput = {};

      if (typeof title === "string") {
        updateData.title = title;
      }
      if (typeof location === "string") {
        updateData.location = location.trim() ? location.trim() : "Noch offen";
      }
      if (description !== undefined) {
        updateData.description = sanitizeDescription(description);
      }

      let nextStart = existing.start;

      const currentDate = formatIsoDateInTimeZone(
        existing.start.toISOString(),
        REHEARSAL_TIME_ZONE,
      );
      const currentTime = formatIsoTimeInTimeZone(
        existing.start.toISOString(),
        REHEARSAL_TIME_ZONE,
      );

      if (date || time) {
        const targetDate = date ?? currentDate;
        const targetTime = time ?? currentTime;
        nextStart = parseStart(targetDate, targetTime);
        updateData.start = nextStart;
      }

      if (endTime !== undefined) {
        const targetDateForEnd = date ?? currentDate;
        const parsedEnd = parseEnd(targetDateForEnd, endTime, nextStart);
        updateData.end = parsedEnd;
      } else if (date || time) {
        const nextEnd = computeEnd(nextStart, existing.start, existing.end);
        updateData.end = nextEnd;
      }

      updateData.registrationDeadline = null;

      if (invitees) {
        const synced = await syncInvitees(tx, id, invitees);
        const roles = await collectInviteeRoles(tx, synced);
        updateData.requiredRoles = rolesToInputJson(roles);
      }

      if (Object.keys(updateData).length > 0) {
        await tx.rehearsal.update({ where: { id }, data: updateData });
      }
    });

    return { success: true as const };
  } catch (error) {
    if (error instanceof Error && error.message === "not-found") {
      return { error: "Probe wurde nicht gefunden." } as const;
    }
    if (error instanceof Error && error.message === "not-draft") {
      return { error: "Der Entwurf wurde bereits veröffentlicht." } as const;
    }
    if (error instanceof Error && error.message === "Endzeit muss nach der Startzeit liegen.") {
      return { error: error.message } as const;
    }
    if (error instanceof Error && error.message === "Ungültige Endzeit.") {
      return { error: error.message } as const;
    }
    if (
      error instanceof Error &&
      error.message === "Ungültige Kombination aus Datum und Uhrzeit."
    ) {
      return { error: error.message } as const;
    }
    console.error("Error updating rehearsal draft", error);
    return { error: "Der Entwurf konnte nicht gespeichert werden." } as const;
  }
}

export async function publishRehearsalAction(input: {
  id: string;
  title: string;
  date: string;
  time: string;
  endTime?: string;
  location?: string;
  description?: string;
  invitees?: string[];
}) {
  const auth = await ensurePlanner();
  if (!auth.ok) {
    return { error: auth.error } as const;
  }

  const parsed = publishSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Bitte Eingaben prüfen." } as const;
  }

  const { id, title, date, time, endTime, location, description, invitees } = parsed.data;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.rehearsal.findUnique({
        where: { id },
        include: { invitees: { select: { userId: true } } },
      });
      if (!existing) {
        throw new Error("not-found");
      }
      if (existing.status !== "DRAFT") {
        throw new Error("not-draft");
      }

      const start = parseStart(date, time);
      const end = endTime
        ? parseEnd(date, endTime, start)
        : computeEnd(start, existing.start, existing.end);
      const normalizedLocation = location?.trim() ? location.trim() : "Noch offen";
      const safeDescription = sanitizeDescription(description);

      const inviteeIds = invitees
        ? Array.from(new Set(invitees))
        : existing.invitees.map((entry) => entry.userId);

      const syncedInvitees = await syncInvitees(tx, id, inviteeIds);
      const roles = await collectInviteeRoles(tx, syncedInvitees);
      const formatter = new Intl.DateTimeFormat("de-DE", {
        dateStyle: "full",
        timeStyle: "short",
        timeZone: REHEARSAL_TIME_ZONE,
      });
      const notificationBody = `Am ${formatter.format(start)}`;

      const rehearsal = await tx.rehearsal.update({
        where: { id },
        data: {
          title,
          start,
          end,
          location: normalizedLocation,
          description: safeDescription,
          status: "PLANNED",
          requiredRoles: rolesToInputJson(roles),
          registrationDeadline: null,
          createdBy: existing.createdBy ?? auth.userId,
        },
        select: { id: true, title: true, start: true, end: true, location: true },
      });

      if (!rehearsal.end) {
        throw new Error("missing-end");
      }

      if (syncedInvitees.length) {
        await tx.notification.create({
          data: {
            title: `Neue Probe: ${title}`,
            body: notificationBody,
            type: "rehearsal",
            rehearsalId: rehearsal.id,
            recipients: {
              create: syncedInvitees.map((userId) => ({ userId })),
            },
          },
        });
      }

      return { rehearsal, inviteeIds: syncedInvitees, body: notificationBody };
    });

    const { rehearsal, inviteeIds, body } = result;

    if (inviteeIds.length) {
      await broadcastRehearsalCreated({
        rehearsal: {
          id: rehearsal.id,
          title: rehearsal.title,
          start: rehearsal.start.toISOString(),
          end: rehearsal.end.toISOString(),
          location: rehearsal.location ?? "Noch offen",
        },
        targetUserIds: inviteeIds,
      });

      await Promise.all(
        inviteeIds.map((userId) =>
          sendNotification({
            targetUserId: userId,
            title: `Neue Probe: ${rehearsal.title}`,
            body,
            type: "info",
            metadata: { rehearsalId: rehearsal.id },
          }),
        ),
      );
    }

    revalidatePath("/mitglieder/probenplanung");
    revalidatePath("/mitglieder/meine-proben");
    revalidatePath(`/mitglieder/proben/${rehearsal.id}`);
    return { success: true as const, id: rehearsal.id };
  } catch (error) {
    if (error instanceof Error && error.message === "not-found") {
      return { error: "Probe wurde nicht gefunden." } as const;
    }
    if (error instanceof Error && error.message === "not-draft") {
      return { error: "Die Probe wurde bereits veröffentlicht." } as const;
    }
    if (error instanceof Error && error.message === "missing-end") {
      return { error: "Die Probe konnte keine Endzeit speichern." } as const;
    }
    if (error instanceof Error && error.message === "Endzeit muss nach der Startzeit liegen.") {
      return { error: error.message } as const;
    }
    if (error instanceof Error && error.message === "Ungültige Endzeit.") {
      return { error: error.message } as const;
    }
    console.error("Error publishing rehearsal", error);
    return { error: "Die Probe konnte nicht veröffentlicht werden." } as const;
  }
}

export async function discardRehearsalDraftAction(input: { id: string }) {
  const auth = await ensurePlanner();
  if (!auth.ok) {
    return { error: auth.error } as const;
  }

  if (!input?.id) {
    return { error: "Ungültiger Entwurf." } as const;
  }

  try {
    await prisma.rehearsal.delete({
      where: { id: input.id, status: "DRAFT" },
    });
    revalidatePath("/mitglieder/probenplanung");
    return { success: true as const };
  } catch (error) {
    console.error("Error discarding rehearsal draft", error);
    return { error: "Der Entwurf konnte nicht verworfen werden." } as const;
  }
}
