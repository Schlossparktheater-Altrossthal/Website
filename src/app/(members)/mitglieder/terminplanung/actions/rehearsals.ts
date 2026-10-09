"use server";

import { revalidatePath } from "next/cache";
import type { CalendarEventKind, Prisma } from "@prisma/client";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { broadcastRehearsalUpdated } from "@/lib/realtime/triggers";
import { notify } from "@/lib/notifications/notify";
import {
  NOTIFICATION_TYPES,
  categoryForEventKind,
  type NotificationType,
} from "@/lib/notifications/types";
import {
  loadAudienceContext,
  saveEventAudience,
  type AudienceInput,
} from "@/lib/calendar/audience-server";

import {
  deleteSchema,
  ensurePlanner,
  eventNoun,
  fetchInviteeIds,
  OPEN_AUDIENCE,
  REHEARSAL_TIME_ZONE,
  resolveKind,
  resolveTargetShow,
  resolveTimes,
  readEventSchedule,
  sanitizeDescription,
  syncEventBlocks,
  syncRehearsalSchedule,
  updateSchema,
} from "@/lib/probenplanung/actions-helpers";
import type { ScheduleInput } from "@/lib/calendar/scene-schedule-server";

export async function updateRehearsalAction(input: {
  id: string;
  kind?: CalendarEventKind;
  title: string;
  date: string;
  time: string;
  endTime?: string;
  endDate?: string | null;
  allDay?: boolean;
  scope?: "production" | "all";
  openAudience?: boolean;
  location?: string;
  description?: string;
  audience?: AudienceInput;
  schedule?: ScheduleInput;
}) {
  const auth = await ensurePlanner({ rehearsalId: input?.id });
  if (!auth.ok) {
    return { error: auth.error } as const;
  }

  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Bitte Eingaben prüfen." } as const;
  }

  const { id, title, date, time, endTime, endDate, allDay, location, description, schedule } =
    parsed.data;
  const show = await resolveTargetShow(auth, parsed.data.scope);
  if (!show.ok) {
    return { error: show.error } as const;
  }
  const audience = parsed.data.openAudience ? OPEN_AUDIENCE : parsed.data.audience;
  const [context, storedSchedule] = await Promise.all([
    loadAudienceContext(show.showId),
    readEventSchedule(id),
  ]);

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
          kind: true,
        },
      });
      if (!existing) {
        throw new Error("not-found");
      }
      if (existing.status === "CANCELLED") {
        throw new Error("cancelled");
      }

      const kind = resolveKind(parsed.data.kind, audience) ?? existing.kind;
      const { start, end } = resolveTimes({ date, time, endTime, endDate, allDay }, existing);
      const normalizedLocation = location?.trim()
        ? location.trim()
        : kind === "REHEARSAL"
          ? (existing.location ?? "Noch offen")
          : null;

      let sanitizedDescription: string | null | undefined;
      const updateData: Prisma.CalendarEventUpdateInput = {
        title,
        kind,
        start,
        end,
        location: normalizedLocation,
        ...(allDay !== undefined ? { allDay } : {}),
        ...(parsed.data.scope
          ? {
              show: show.showId ? { connect: { id: show.showId } } : { disconnect: true },
            }
          : {}),
      };

      if (description !== undefined) {
        sanitizedDescription = sanitizeDescription(description);
        updateData.description = sanitizedDescription;
      }

      await syncEventBlocks(tx, { eventId: id, start, schedule });
      let targetInvitees: string[];
      let addedIds: string[] = [];
      let removedIds: string[] = [];
      if (audience) {
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
          kind: true,
        },
      });
      await syncRehearsalSchedule(tx, {
        eventId: id,
        start,
        audience,
        schedule,
        storedSchedule,
        context,
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
    const noun = eventNoun(rehearsal.kind);
    const updatedTitle = `${noun} aktualisiert: ${rehearsal.title}`;

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

    const notifyUsers = (userIds: string[], title: string, body: string, type: NotificationType) =>
      notify({
        type,
        recipients: userIds,
        title,
        body,
        eventId: rehearsal.id,
        category: categoryForEventKind(rehearsal.kind),
        groupKey: `event:${rehearsal.id}`,
      });

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
      `${rehearsal.kind === "REHEARSAL" ? "Neue Probe" : "Neuer Termin"}: ${rehearsal.title}`,
      `Am ${formatter.format(rehearsal.start)}`,
      rehearsal.kind === "REHEARSAL"
        ? NOTIFICATION_TYPES.REHEARSAL
        : NOTIFICATION_TYPES.CALENDAR_EVENT,
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

    revalidatePath("/mitglieder/terminplanung");
    revalidatePath("/mitglieder/sperrliste");
    revalidatePath("/mitglieder/meine-proben");
    revalidatePath(`/mitglieder/termine/${rehearsal.id}`);

    return { success: true as const };
  } catch (error) {
    if (error instanceof Error && error.message === "not-found") {
      return { error: "Der Termin konnte nicht aktualisiert werden." } as const;
    }
    if (error instanceof Error && error.message === "Endzeit muss nach der Startzeit liegen.") {
      return { error: error.message } as const;
    }
    if (error instanceof Error && error.message === "Ungültige Endzeit.") {
      return { error: error.message } as const;
    }
    if (error instanceof Error && error.message === "cancelled") {
      return { error: "Abgesagte Termine lassen sich nicht bearbeiten." } as const;
    }
    console.error("Error updating rehearsal", error);
    return { error: "Der Termin konnte nicht aktualisiert werden." } as const;
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

    revalidatePath("/mitglieder/terminplanung");
    revalidatePath("/mitglieder/meine-proben");
    revalidatePath(`/mitglieder/termine/${parsed.data.id}`);

    return { success: true as const };
  } catch (error) {
    if (error instanceof Error && error.message === "not-found") {
      return { error: "Der Termin wurde nicht gefunden." } as const;
    }
    console.error("Error deleting rehearsal", error);
    return { error: "Der Termin konnte nicht entfernt werden." } as const;
  }
}

const cancelSchema = z.object({
  id: z.string().min(1),
  reason: z.string().trim().max(500).optional(),
});

/** Wer von einer Absage oder ihrer Rücknahme erfahren soll: Eingeladene und alle mit Antwort. */
async function readAffectedUserIds(eventId: string) {
  const participants = await prisma.eventParticipant.findMany({
    where: { eventId, OR: [{ invited: true }, { response: { not: null } }] },
    select: { userId: true },
  });
  return [...new Set(participants.map((entry) => entry.userId))];
}

/**
 * Sagt einen vorgemerkten oder angesetzten Termin ab. Er bleibt mit Teilnehmern, Antworten und
 * Grund erhalten und für alle sichtbar; Betroffene werden benachrichtigt.
 */
export async function cancelEventAction(input: { id: string; reason?: string }) {
  const auth = await ensurePlanner({ rehearsalId: input?.id });
  if (!auth.ok) {
    return { error: auth.error } as const;
  }
  const parsed = cancelSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Bitte Eingaben prüfen." } as const;
  }
  const { id } = parsed.data;
  const reason = parsed.data.reason || null;

  const existing = await prisma.calendarEvent.findFirst({
    where: { id, departmentId: null },
    select: { status: true, kind: true, start: true, title: true, showId: true },
  });
  if (!existing) {
    return { error: "Der Termin wurde nicht gefunden." } as const;
  }
  if (existing.status !== "SCHEDULED" && existing.status !== "TENTATIVE") {
    return {
      error:
        existing.status === "CANCELLED"
          ? "Der Termin ist bereits abgesagt."
          : "Entwürfe werden verworfen, nicht abgesagt.",
    } as const;
  }

  const updated = await prisma.calendarEvent.updateMany({
    where: { id, status: existing.status },
    data: {
      status: "CANCELLED",
      cancelledAt: new Date(),
      cancelReason: reason,
      cancelledFromStatus: existing.status,
    },
  });
  if (!updated.count) {
    return { error: "Der Termin wurde inzwischen geändert. Bitte neu laden." } as const;
  }

  const noun = eventNoun(existing.kind);
  const formatter = new Intl.DateTimeFormat("de-DE", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: REHEARSAL_TIME_ZONE,
  });
  const recipients = await readAffectedUserIds(id);
  // Vergangene Termine still absagen: nur für die Statistik, niemand muss mehr reagieren.
  if (existing.start > new Date()) {
    await notify({
      type: NOTIFICATION_TYPES.EVENT_CANCELLED,
      recipients,
      title: `${noun} abgesagt: ${existing.title}`,
      body: [`Fällt aus: ${formatter.format(existing.start)}`, reason ? `Grund: ${reason}` : null]
        .filter(Boolean)
        .join("\n"),
      eventId: id,
      showId: existing.showId,
      category: categoryForEventKind(existing.kind),
      groupKey: `event:${id}`,
    });
  }
  if (recipients.length) {
    await broadcastRehearsalUpdated({
      rehearsalId: id,
      changes: { status: "cancelled", title: existing.title },
      targetUserIds: recipients,
    });
  }

  revalidateEventPaths(id);
  return { success: true as const };
}

/** Nimmt eine Absage zurück: der Termin gilt wieder wie vorher (vorgemerkt oder angesetzt). */
export async function restoreEventAction(input: { id: string }) {
  const auth = await ensurePlanner({ rehearsalId: input?.id });
  if (!auth.ok) {
    return { error: auth.error } as const;
  }
  const parsed = deleteSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Ungültige Auswahl." } as const;
  }
  const { id } = parsed.data;

  const existing = await prisma.calendarEvent.findFirst({
    where: { id, departmentId: null },
    select: {
      status: true,
      cancelledFromStatus: true,
      kind: true,
      start: true,
      title: true,
      showId: true,
    },
  });
  if (!existing || existing.status !== "CANCELLED") {
    return { error: "Der Termin ist nicht abgesagt." } as const;
  }
  const status = existing.cancelledFromStatus === "TENTATIVE" ? "TENTATIVE" : "SCHEDULED";

  const updated = await prisma.calendarEvent.updateMany({
    where: { id, status: "CANCELLED" },
    data: { status, cancelledAt: null, cancelReason: null, cancelledFromStatus: null },
  });
  if (!updated.count) {
    return { error: "Der Termin wurde inzwischen geändert. Bitte neu laden." } as const;
  }

  const noun = eventNoun(existing.kind);
  const formatter = new Intl.DateTimeFormat("de-DE", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: REHEARSAL_TIME_ZONE,
  });
  const recipients = await readAffectedUserIds(id);
  if (existing.start > new Date()) {
    await notify({
      type: NOTIFICATION_TYPES.REHEARSAL_UPDATE,
      recipients,
      title: `${noun} findet doch statt: ${existing.title}`,
      body: `Die Absage wurde zurückgenommen. Am ${formatter.format(existing.start)}`,
      eventId: id,
      showId: existing.showId,
      category: categoryForEventKind(existing.kind),
      groupKey: `event:${id}`,
    });
  }
  if (recipients.length) {
    await broadcastRehearsalUpdated({
      rehearsalId: id,
      changes: { status: status.toLowerCase(), title: existing.title },
      targetUserIds: recipients,
    });
  }

  revalidateEventPaths(id);
  return { success: true as const };
}

function revalidateEventPaths(id: string) {
  revalidatePath("/mitglieder/terminplanung");
  revalidatePath(`/mitglieder/terminplanung/${id}`);
  revalidatePath("/mitglieder/sperrliste");
  revalidatePath("/mitglieder/meine-proben");
  revalidatePath(`/mitglieder/termine/${id}`);
}
