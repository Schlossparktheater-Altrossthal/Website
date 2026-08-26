"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import {
  broadcastRehearsalCreated,
  broadcastRehearsalUpdated,
  sendNotification,
} from "@/lib/realtime/triggers";
import { NOTIFICATION_TYPES } from "@/lib/notifications/types";

import {
  baseSchema,
  collectInviteeRoles,
  computeEnd,
  deleteSchema,
  ensurePlanner,
  fetchInviteeIds,
  parseEnd,
  parseStart,
  REHEARSAL_TIME_ZONE,
  rolesToInputJson,
  sanitizeDescription,
  syncInvitees,
  updateSchema,
} from "./helpers";

export async function createRehearsalAction(input: {
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

  const parsed = baseSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Bitte Titel, Datum und Uhrzeit prüfen." } as const;
  }

  const { title, date, time, endTime, location, description, invitees } = parsed.data;
  const start = parseStart(date, time);
  const end = endTime ? parseEnd(date, endTime, start) : computeEnd(start);
  const normalizedLocation = location?.trim() ? location.trim() : "Noch offen";
  const safeDescription = sanitizeDescription(description);

  const inviteeIds = invitees
    ? Array.from(new Set(invitees))
    : (await prisma.user.findMany({ select: { id: true } })).map((entry) => entry.id);

  if (!inviteeIds.length) {
    return { error: "Es wurden keine Mitglieder gefunden." } as const;
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const roles = await collectInviteeRoles(tx, inviteeIds);
      const formatter = new Intl.DateTimeFormat("de-DE", {
        dateStyle: "full",
        timeStyle: "short",
        timeZone: REHEARSAL_TIME_ZONE,
      });
      const body = `Am ${formatter.format(start)}`;

      const rehearsal = await tx.rehearsal.create({
        data: {
          title,
          start,
          end,
          location: normalizedLocation,
          description: safeDescription,
          status: "PLANNED",
          requiredRoles: rolesToInputJson(roles),
          registrationDeadline: null,
          createdBy: auth.userId,
        },
        select: { id: true, title: true, start: true, end: true, location: true },
      });

      await syncInvitees(tx, rehearsal.id, inviteeIds);

      await tx.notification.create({
        data: {
          title: `Neue Probe: ${title}`,
          body,
          type: "rehearsal",
          rehearsalId: rehearsal.id,
          recipients: {
            create: inviteeIds.map((userId) => ({ userId })),
          },
        },
      });

      return { rehearsal, inviteeIds, body };
    });

    const { rehearsal, inviteeIds: targets, body } = result;

    await broadcastRehearsalCreated({
      rehearsal: {
        id: rehearsal.id,
        title: rehearsal.title,
        start: rehearsal.start.toISOString(),
        end: rehearsal.end.toISOString(),
        location: rehearsal.location ?? "Noch offen",
      },
      targetUserIds: targets,
    });

    await Promise.all(
      targets.map((userId) =>
        sendNotification({
          targetUserId: userId,
          title: `Neue Probe: ${rehearsal.title}`,
          body,
          type: "info",
          metadata: { rehearsalId: rehearsal.id },
        }),
      ),
    );

    revalidatePath("/mitglieder/probenplanung");
    revalidatePath("/mitglieder/meine-proben");
    revalidatePath(`/mitglieder/proben/${rehearsal.id}`);

    return { success: true as const, id: rehearsal.id };
  } catch (error) {
    if (error instanceof Error && error.message === "Endzeit muss nach der Startzeit liegen.") {
      return { error: error.message } as const;
    }
    if (error instanceof Error && error.message === "Ungültige Endzeit.") {
      return { error: error.message } as const;
    }
    console.error("Error creating rehearsal", error);
    return { error: "Die Probe konnte nicht gespeichert werden." } as const;
  }
}

export async function updateRehearsalAction(input: {
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

  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Bitte Eingaben prüfen." } as const;
  }

  const { id, title, date, time, endTime, location, description, invitees } = parsed.data;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.rehearsal.findUnique({
        where: { id },
        select: {
          title: true,
          start: true,
          end: true,
          location: true,
          description: true,
          status: true,
        },
      });
      if (!existing) {
        throw new Error("not-found");
      }

      const start = parseStart(date, time);
      const end = endTime
        ? parseEnd(date, endTime, start)
        : computeEnd(start, existing.start, existing.end);
      const normalizedLocation = location?.trim()
        ? location.trim()
        : (existing.location ?? "Noch offen");

      let sanitizedDescription: string | null | undefined;
      const updateData: Prisma.RehearsalUpdateInput = {
        title,
        start,
        end,
        location: normalizedLocation,
        registrationDeadline: null,
      };

      if (description !== undefined) {
        sanitizedDescription = sanitizeDescription(description);
        updateData.description = sanitizedDescription;
      }

      let targetInvitees: string[];
      if (invitees) {
        const synced = await syncInvitees(tx, id, invitees);
        const roles = await collectInviteeRoles(tx, synced);
        updateData.requiredRoles = rolesToInputJson(roles);
        targetInvitees = synced;
      } else {
        targetInvitees = await fetchInviteeIds(tx, id);
      }

      const rehearsal = await tx.rehearsal.update({
        where: { id },
        data: updateData,
        select: {
          id: true,
          title: true,
          start: true,
          end: true,
          location: true,
        },
      });

      const descriptionChanged =
        sanitizedDescription !== undefined
          ? (sanitizedDescription ?? null) !== (existing.description ?? null)
          : false;

      return { rehearsal, targetInvitees, previous: existing, descriptionChanged };
    });

    const { rehearsal, targetInvitees, previous, descriptionChanged } = result;
    const formatter = new Intl.DateTimeFormat("de-DE", {
      dateStyle: "full",
      timeStyle: "short",
      timeZone: REHEARSAL_TIME_ZONE,
    });
    const updatedTitle = `Probe aktualisiert: ${rehearsal.title}`;

    const updates: string[] = [];

    if (previous.title !== rehearsal.title) {
      updates.push(`Titel: „${previous.title}“ → „${rehearsal.title}“`);
    }

    if (previous.start.getTime() !== rehearsal.start.getTime()) {
      updates.push(
        `Datum & Zeit: ${formatter.format(previous.start)} → ${formatter.format(rehearsal.start)}`,
      );
    }

    const previousLocation = previous.location?.trim() || "Noch offen";
    const newLocation = rehearsal.location?.trim() || "Noch offen";
    if (previousLocation !== newLocation) {
      updates.push(`Ort: ${previousLocation} → ${newLocation}`);
    }

    const previousEnd = previous.end;
    const newEnd = rehearsal.end;
    const previousEndMs = previousEnd?.getTime();
    const newEndMs = newEnd?.getTime();
    if ((previousEndMs ?? null) !== (newEndMs ?? null)) {
      if (previousEnd && newEnd) {
        updates.push(`Ende: ${formatter.format(previousEnd)} → ${formatter.format(newEnd)}`);
      } else if (!previousEnd && newEnd) {
        updates.push(`Neue Endzeit: ${formatter.format(newEnd)}`);
      } else if (previousEnd && !newEnd) {
        updates.push("Endzeit entfernt.");
      }
    }

    if (descriptionChanged) {
      updates.push("Beschreibung aktualisiert.");
    }

    const updatedBody = updates.length
      ? updates.map((entry) => `• ${entry}`).join("\n")
      : "Details der Probe wurden aktualisiert.";

    if (targetInvitees.length) {
      await prisma.notification.create({
        data: {
          title: updatedTitle,
          body: updatedBody,
          type: NOTIFICATION_TYPES.REHEARSAL_UPDATE,
          rehearsalId: rehearsal.id,
          recipients: {
            create: targetInvitees.map((userId) => ({ userId })),
          },
        },
      });

      await broadcastRehearsalUpdated({
        rehearsalId: rehearsal.id,
        changes: {
          title: rehearsal.title,
          start: rehearsal.start.toISOString(),
          end: rehearsal.end ? rehearsal.end.toISOString() : undefined,
          location: rehearsal.location ?? undefined,
        },
        targetUserIds: targetInvitees,
      });

      await Promise.all(
        targetInvitees.map((userId) =>
          sendNotification({
            targetUserId: userId,
            title: updatedTitle,
            body: updatedBody,
            type: "info",
            metadata: { rehearsalId: rehearsal.id },
          }),
        ),
      );
    }

    revalidatePath("/mitglieder/probenplanung");
    revalidatePath("/mitglieder/meine-proben");
    revalidatePath(`/mitglieder/proben/${rehearsal.id}`);

    return { success: true as const };
  } catch (error) {
    if (error instanceof Error && error.message === "not-found") {
      return { error: "Die Probe konnte nicht aktualisiert werden." } as const;
    }
    if (error instanceof Error && error.message === "Endzeit muss nach der Startzeit liegen.") {
      return { error: error.message } as const;
    }
    if (error instanceof Error && error.message === "Ungültige Endzeit.") {
      return { error: error.message } as const;
    }
    console.error("Error updating rehearsal", error);
    return { error: "Die Probe konnte nicht aktualisiert werden." } as const;
  }
}

export async function deleteRehearsalAction(input: { id: string }) {
  const auth = await ensurePlanner();
  if (!auth.ok) {
    return { error: auth.error } as const;
  }

  const parsed = deleteSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Ungültige Auswahl." } as const;
  }

  try {
    const rehearsal = await prisma.$transaction(async (tx) => {
      const existing = await tx.rehearsal.findUnique({
        where: { id: parsed.data.id },
        include: {
          invitees: { select: { userId: true } },
          notifications: { select: { recipients: { select: { userId: true } } } },
        },
      });

      if (!existing) {
        throw new Error("not-found");
      }

      await tx.rehearsal.delete({ where: { id: parsed.data.id } });

      return existing;
    });

    const targetUserIds = new Set<string>();
    rehearsal.invitees.forEach((invitee) => targetUserIds.add(invitee.userId));
    rehearsal.notifications.forEach((notification) => {
      notification.recipients.forEach((recipient) => targetUserIds.add(recipient.userId));
    });

    await broadcastRehearsalUpdated({
      rehearsalId: parsed.data.id,
      changes: { status: "deleted", title: rehearsal.title ?? undefined },
      targetUserIds: Array.from(targetUserIds),
    });

    revalidatePath("/mitglieder/probenplanung");
    revalidatePath("/mitglieder/meine-proben");
    revalidatePath(`/mitglieder/proben/${parsed.data.id}`);

    return { success: true as const };
  } catch (error) {
    if (error instanceof Error && error.message === "not-found") {
      return { error: "Die Probe wurde nicht gefunden." } as const;
    }
    console.error("Error deleting rehearsal", error);
    return { error: "Die Probe konnte nicht entfernt werden." } as const;
  }
}
