"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { broadcastRehearsalUpdated, sendNotification } from "@/lib/realtime/triggers";
import { NOTIFICATION_TYPES } from "@/lib/notifications/types";
import {
  loadAudienceContext,
  saveEventAudience,
  type AudienceInput,
} from "@/lib/calendar/audience-server";

import {
  computeEnd,
  deleteSchema,
  ensurePlanner,
  fetchInviteeIds,
  parseEnd,
  parseStart,
  REHEARSAL_TIME_ZONE,
  sanitizeDescription,
  updateSchema,
} from "@/lib/probenplanung/actions-helpers";

export async function updateRehearsalAction(input: {
  id: string;
  title: string;
  date: string;
  time: string;
  endTime?: string;
  location?: string;
  description?: string;
  audience?: AudienceInput;
}) {
  const auth = await ensurePlanner({ rehearsalId: input?.id });
  if (!auth.ok) {
    return { error: auth.error } as const;
  }

  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Bitte Eingaben prüfen." } as const;
  }

  const { id, title, date, time, endTime, location, description, audience } = parsed.data;
  const context = audience ? await loadAudienceContext(auth.showId) : null;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.calendarEvent.findUnique({
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
      const updateData: Prisma.CalendarEventUpdateInput = {
        title,
        start,
        end,
        location: normalizedLocation,
      };

      if (description !== undefined) {
        sanitizedDescription = sanitizeDescription(description);
        updateData.description = sanitizedDescription;
      }

      let targetInvitees: string[];
      let addedIds: string[] = [];
      let removedIds: string[] = [];
      if (audience && context) {
        const saved = await saveEventAudience(tx, id, audience, context);
        targetInvitees = saved.invitedIds;
        addedIds = saved.addedIds;
        removedIds = saved.removedIds;
      } else {
        targetInvitees = await fetchInviteeIds(tx, id);
      }

      const rehearsal = await tx.calendarEvent.update({
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

      return {
        rehearsal,
        targetInvitees,
        addedIds,
        removedIds,
        previous: existing,
        descriptionChanged,
      };
    });

    const { rehearsal, targetInvitees, addedIds, removedIds, previous, descriptionChanged } =
      result;
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

    const notifyUsers = async (userIds: string[], title: string, body: string, type: string) => {
      if (!userIds.length) return;
      await prisma.notification.create({
        data: {
          title,
          body,
          type,
          eventId: rehearsal.id,
          recipients: { create: userIds.map((userId) => ({ userId })) },
        },
      });
      await Promise.all(
        userIds.map((userId) =>
          sendNotification({
            targetUserId: userId,
            title,
            body,
            type: "info",
            metadata: { rehearsalId: rehearsal.id },
          }),
        ),
      );
    };

    // Bisherige Teilnehmer nur bei echten Änderungen benachrichtigen, nicht bei jeder Auswahl.
    const addedSet = new Set(addedIds);
    const existingInvitees = targetInvitees.filter((userId) => !addedSet.has(userId));
    if (updates.length) {
      await notifyUsers(
        existingInvitees,
        updatedTitle,
        updates.map((entry) => `• ${entry}`).join("\n"),
        NOTIFICATION_TYPES.REHEARSAL_UPDATE,
      );
    }
    await notifyUsers(
      addedIds,
      `Neue Probe: ${rehearsal.title}`,
      `Am ${formatter.format(rehearsal.start)}`,
      "rehearsal",
    );
    await notifyUsers(
      removedIds,
      `Nicht mehr eingeplant: ${rehearsal.title}`,
      `Du wirst am ${formatter.format(rehearsal.start)} nicht mehr benötigt.`,
      NOTIFICATION_TYPES.REHEARSAL_UPDATE,
    );

    const touched = [...new Set([...targetInvitees, ...removedIds])];
    if (touched.length) {
      await broadcastRehearsalUpdated({
        rehearsalId: rehearsal.id,
        changes: {
          title: rehearsal.title,
          start: rehearsal.start.toISOString(),
          end: rehearsal.end ? rehearsal.end.toISOString() : undefined,
          location: rehearsal.location ?? undefined,
        },
        targetUserIds: touched,
      });
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
  const auth = await ensurePlanner({ rehearsalId: input?.id });
  if (!auth.ok) {
    return { error: auth.error } as const;
  }

  const parsed = deleteSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Ungültige Auswahl." } as const;
  }

  try {
    const rehearsal = await prisma.$transaction(async (tx) => {
      const existing = await tx.calendarEvent.findUnique({
        where: { id: parsed.data.id },
        include: {
          participants: { where: { invited: true }, select: { userId: true } },
          notifications: { select: { recipients: { select: { userId: true } } } },
        },
      });

      if (!existing) {
        throw new Error("not-found");
      }

      await tx.calendarEvent.delete({ where: { id: parsed.data.id } });

      return existing;
    });

    const targetUserIds = new Set<string>();
    rehearsal.participants.forEach((invitee) => targetUserIds.add(invitee.userId));
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
