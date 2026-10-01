"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { broadcastRehearsalCreated } from "@/lib/realtime/triggers";
import { createNotification, dispatchNotification } from "@/lib/notifications/notify";
import { NOTIFICATION_TYPES, categoryForEventKind } from "@/lib/notifications/types";
import { formatIsoDateInTimeZone, formatIsoTimeInTimeZone } from "@/lib/date-time";

import type { CalendarEventKind } from "@prisma/client";

import {
  computeEnd,
  draftUpdateSchema,
  ensurePlanner,
  eventNoun,
  OPEN_AUDIENCE,
  parseEnd,
  parseStart,
  publishSchema,
  REHEARSAL_TIME_ZONE,
  readEventSchedule,
  resolveKind,
  resolveTargetShow,
  resolveTimes,
  sanitizeDescription,
  syncEventBlocks,
  syncRehearsalSchedule,
} from "@/lib/probenplanung/actions-helpers";
import type { ScheduleInput } from "@/lib/calendar/scene-schedule-server";
import {
  audienceInputSchema,
  loadAudienceContext,
  readEventAudience,
  saveEventAudience,
  type AudienceInput,
} from "@/lib/calendar/audience-server";

export async function createRehearsalDraftAction(input?: {
  /** Ohne Angabe eine Probe. */
  kind?: CalendarEventKind;
  title?: string;
  date?: string;
  time?: string;
  endTime?: string;
  location?: string;
  /** Zielgruppe aus dem Terminfinder; ohne Angabe die ganze Produktion. */
  audience?: AudienceInput;
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
  const kind = input?.kind ?? "REHEARSAL";
  const isRehearsal = kind === "REHEARSAL";
  const normalizedTitle = input?.title?.trim() || (isRehearsal ? "Neue Probe" : "Neuer Termin");
  const normalizedLocation = input?.location?.trim() || (isRehearsal ? "Noch offen" : null);

  const rehearsal = await prisma.calendarEvent.create({
    data: {
      kind,
      title: normalizedTitle,
      location: normalizedLocation,
      start,
      end,
      description: null,
      createdById: auth.userId,
      status: "DRAFT",
      showId: auth.showId,
    },
    select: { id: true },
  });

  // Proben: noch niemand eingeladen, die Planung wählt im Editor aus. Andere Termine
  // gelten zunächst für alle, ohne Einladung.
  const parsedAudience = input?.audience ? audienceInputSchema.safeParse(input.audience) : null;
  const audience: AudienceInput = parsedAudience?.success ? parsedAudience.data : OPEN_AUDIENCE;
  const context = await loadAudienceContext(auth.showId);
  await prisma.$transaction(async (tx) => {
    await saveEventAudience(tx, rehearsal.id, audience, context);
    if (audience.rules.some((rule) => rule.type === "SCENE")) {
      await syncRehearsalSchedule(tx, {
        eventId: rehearsal.id,
        start,
        audience,
        storedSchedule: { mode: "TOGETHER", times: {}, rooms: {}, blocks: [] },
        context,
      });
    }
  });

  return { success: true as const, id: rehearsal.id };
}

export async function updateRehearsalDraftAction(input: {
  id: string;
  kind?: CalendarEventKind;
  title?: string;
  date?: string;
  time?: string;
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

  const parsed = draftUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Bitte Eingaben prüfen." } as const;
  }

  const { id, title, date, time, endTime, endDate, allDay, location, description, schedule } =
    parsed.data;
  const target = await resolveTargetShow(auth, parsed.data.scope);
  if (!target.ok) {
    return { error: target.error } as const;
  }
  const audience = parsed.data.openAudience ? OPEN_AUDIENCE : parsed.data.audience;
  const kind = resolveKind(parsed.data.kind, audience);
  const [context, storedSchedule] = await Promise.all([
    loadAudienceContext(target.showId),
    readEventSchedule(id),
  ]);

  try {
    await prisma.$transaction(async (tx) => {
      const existing = await tx.calendarEvent.findUnique({
        where: { id },
        select: { status: true, start: true, end: true, kind: true },
      });
      if (!existing) {
        throw new Error("not-found");
      }
      if (existing.status !== "DRAFT") {
        throw new Error("not-draft");
      }

      const updateData: Prisma.CalendarEventUpdateInput = {};

      if (typeof title === "string") {
        updateData.title = title;
      }
      const nextKind = kind ?? existing.kind;
      if (kind) updateData.kind = kind;
      if (allDay !== undefined) updateData.allDay = allDay;
      if (parsed.data.scope) {
        updateData.show = target.showId ? { connect: { id: target.showId } } : { disconnect: true };
      }
      if (typeof location === "string") {
        updateData.location = location.trim()
          ? location.trim()
          : nextKind === "REHEARSAL"
            ? "Noch offen"
            : null;
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

      if (date || time || endTime !== undefined || endDate !== undefined || allDay !== undefined) {
        const times = resolveTimes(
          { date: date ?? currentDate, time: time ?? currentTime, endTime, endDate, allDay },
          existing,
        );
        nextStart = times.start;
        updateData.start = times.start;
        updateData.end = times.end;
      }

      await syncEventBlocks(tx, { eventId: id, start: nextStart, schedule });
      if (audience) {
        await saveEventAudience(tx, id, audience, context);
      } else if (schedule) {
        // Gewerk-Bausteine können Einladungen ändern.
        const stored = await readEventAudience(id);
        await saveEventAudience(tx, id, stored, context);
      }

      if (Object.keys(updateData).length > 0) {
        await tx.calendarEvent.update({ where: { id }, data: updateData });
      }
      await syncRehearsalSchedule(tx, {
        eventId: id,
        start: nextStart,
        audience,
        schedule,
        storedSchedule,
        context,
      });
    });

    return { success: true as const };
  } catch (error) {
    if (error instanceof Error && error.message === "not-found") {
      return { error: "Termin wurde nicht gefunden." } as const;
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
  target?: "TENTATIVE" | "SCHEDULED";
}) {
  const auth = await ensurePlanner({ rehearsalId: input?.id });
  if (!auth.ok) {
    return { error: auth.error } as const;
  }

  const parsed = publishSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Bitte Eingaben prüfen." } as const;
  }

  const {
    id,
    title,
    date,
    time,
    endTime,
    endDate,
    allDay,
    location,
    description,
    schedule,
    target,
  } = parsed.data;
  const show = await resolveTargetShow(auth, parsed.data.scope);
  if (!show.ok) {
    return { error: show.error } as const;
  }
  const openAudience = parsed.data.openAudience === true;
  const audience = openAudience ? OPEN_AUDIENCE : parsed.data.audience;
  const [context, stored, storedSchedule] = await Promise.all([
    loadAudienceContext(show.showId),
    audience ? null : readEventAudience(id),
    readEventSchedule(id),
  ]);
  const currentAudience = audience ?? {
    rules: stored?.rules ?? [],
    overrides: stored?.overrides ?? [],
  };

  try {
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.calendarEvent.findUnique({
        where: { id },
        select: { status: true, start: true, end: true, createdById: true, kind: true },
      });
      if (!existing) {
        throw new Error("not-found");
      }
      const kind = resolveKind(parsed.data.kind, audience) ?? existing.kind;
      const noun = eventNoun(kind);
      // Entwurf → vorgemerkt/angesetzt, vorgemerkt → angesetzt.
      const allowed =
        existing.status === "DRAFT" || (existing.status === "TENTATIVE" && target === "SCHEDULED");
      if (!allowed) {
        throw new Error("not-draft");
      }
      const wasTentative = existing.status === "TENTATIVE";

      const { start, end } = resolveTimes({ date, time, endTime, endDate, allDay }, existing);
      const normalizedLocation = location?.trim()
        ? location.trim()
        : kind === "REHEARSAL"
          ? "Noch offen"
          : null;
      const safeDescription = sanitizeDescription(description);

      await syncEventBlocks(tx, { eventId: id, start, schedule });
      const { invitedIds: syncedInvitees } = await saveEventAudience(
        tx,
        id,
        currentAudience,
        context,
      );
      // Ohne Zielgruppe gilt ein Termin für alle (auch eine Probe); mit Zielgruppe braucht er
      // Eingeladene.
      const open = !currentAudience.rules.length && !currentAudience.overrides.length;
      if (!syncedInvitees.length && !open) {
        throw new Error("no-invitees");
      }
      await syncRehearsalSchedule(tx, {
        eventId: id,
        start,
        audience: currentAudience,
        schedule,
        storedSchedule,
        context,
      });
      const formatter = new Intl.DateTimeFormat("de-DE", {
        dateStyle: "full",
        timeStyle: "short",
        timeZone: REHEARSAL_TIME_ZONE,
      });
      const notificationBody =
        target === "TENTATIVE"
          ? `Vorgemerkt für ${formatter.format(start)} – noch nicht verbindlich. Wenn du nicht kannst, sag gern schon ab.`
          : `Am ${formatter.format(start)}`;
      const notificationTitle =
        target === "TENTATIVE"
          ? `${noun} vorgemerkt: ${title}`
          : wasTentative
            ? `${noun} angesetzt: ${title}`
            : `${kind === "REHEARSAL" ? "Neue Probe" : "Neuer Termin"}: ${title}`;

      const rehearsal = await tx.calendarEvent.update({
        where: { id },
        data: {
          title,
          kind,
          start,
          end,
          ...(allDay !== undefined ? { allDay } : {}),
          ...(parsed.data.scope ? { showId: show.showId } : {}),
          location: normalizedLocation,
          description: safeDescription,
          status: target,
          createdById: existing.createdById ?? auth.userId,
        },
        select: { id: true, title: true, start: true, end: true, location: true, kind: true },
      });

      if (!rehearsal.end && kind === "REHEARSAL") {
        throw new Error("missing-end");
      }

      const notification = await createNotification(tx, {
        type:
          kind === "REHEARSAL" ? NOTIFICATION_TYPES.REHEARSAL : NOTIFICATION_TYPES.CALENDAR_EVENT,
        recipients: syncedInvitees,
        title: notificationTitle,
        body: notificationBody,
        eventId: rehearsal.id,
        showId: show.showId,
        category: categoryForEventKind(kind),
        groupKey: `event:${rehearsal.id}`,
      });

      return { rehearsal, inviteeIds: syncedInvitees, notification };
    });

    const { rehearsal, inviteeIds, notification } = result;
    await dispatchNotification(notification);

    if (inviteeIds.length) {
      await broadcastRehearsalCreated({
        rehearsal: {
          id: rehearsal.id,
          title: rehearsal.title,
          start: rehearsal.start.toISOString(),
          end: (rehearsal.end ?? rehearsal.start).toISOString(),
          location: rehearsal.location ?? "Noch offen",
        },
        targetUserIds: inviteeIds,
      });
    }

    revalidatePath("/mitglieder/terminplanung");
    revalidatePath("/mitglieder/sperrliste");
    revalidatePath("/mitglieder/meine-proben");
    revalidatePath(`/mitglieder/termine/${rehearsal.id}`);
    return { success: true as const, id: rehearsal.id };
  } catch (error) {
    if (error instanceof Error && error.message === "not-found") {
      return { error: "Termin wurde nicht gefunden." } as const;
    }
    if (error instanceof Error && error.message === "not-draft") {
      return { error: "Der Termin wurde bereits angesetzt." } as const;
    }
    if (error instanceof Error && error.message === "no-invitees") {
      return { error: "Bitte wähle mindestens eine Person aus." } as const;
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
    return { error: "Der Termin konnte nicht veröffentlicht werden." } as const;
  }
}

export async function discardRehearsalDraftAction(input: { id: string }) {
  const auth = await ensurePlanner({ rehearsalId: input?.id });
  if (!auth.ok) {
    return { error: auth.error } as const;
  }

  if (!input?.id) {
    return { error: "Ungültiger Entwurf." } as const;
  }

  try {
    await prisma.calendarEvent.delete({
      where: { id: input.id, status: "DRAFT" },
    });
    revalidatePath("/mitglieder/terminplanung");
    return { success: true as const };
  } catch (error) {
    console.error("Error discarding rehearsal draft", error);
    return { error: "Der Entwurf konnte nicht verworfen werden." } as const;
  }
}
