"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import sanitizeHtml from "sanitize-html";
import type { Prisma } from "@prisma/client";

import { requireAuth } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import {
  broadcastRehearsalCreated,
  broadcastRehearsalUpdated,
  sendNotification,
} from "@/lib/realtime/triggers";
import {
  computeRegistrationDeadline,
  registrationDeadlineOptionSchema,
  type RegistrationDeadlineOption,
} from "./registration-deadline-options";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_TIME = /^\d{2}:\d{2}$/;

const baseSchema = z.object({
  title: z.string().trim().min(3, "Titel ist zu kurz").max(120, "Titel ist zu lang"),
  date: z.string().regex(ISO_DATE, "Ungültiges Datum"),
  time: z.string().regex(ISO_TIME, "Ungültige Uhrzeit"),
  location: z.string().trim().min(2, "Ort ist zu kurz").max(120, "Ort ist zu lang").optional(),
  description: z.string().max(10_000).optional(),
  invitees: z.array(z.string().min(1)).optional(),
  registrationDeadlineOption: registrationDeadlineOptionSchema.default("1w"),
});

const draftUpdateSchema = baseSchema.partial().extend({ id: z.string().min(1) });
const publishSchema = baseSchema.extend({ id: z.string().min(1) });
const updateSchema = baseSchema.extend({ id: z.string().min(1) });

function sanitizeDescription(html?: string | null) {
  if (!html) return null;
  return sanitizeHtml(html, {
    allowedTags: ["p", "br", "strong", "em", "u", "ol", "ul", "li", "blockquote", "a", "h2", "h3"],
    allowedAttributes: {
      a: ["href", "target", "rel"],
    },
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer", target: "_blank" }),
    },
  }).trim();
}

function parseStart(date: string, time: string) {
  const start = new Date(`${date}T${time}`);
  if (Number.isNaN(start.getTime())) {
    throw new Error("Ungültige Kombination aus Datum und Uhrzeit.");
  }
  return start;
}

function computeEnd(start: Date, previousStart?: Date | null, previousEnd?: Date | null) {
  if (previousStart && previousEnd) {
    const duration = previousEnd.getTime() - previousStart.getTime();
    if (duration > 0) {
      return new Date(start.getTime() + duration);
    }
  }
  return new Date(start.getTime() + 2 * 60 * 60 * 1000);
}

async function ensurePlanner() {
  const session = await requireAuth();
  const userId = session.user?.id;
  if (!userId) {
    return { ok: false as const, error: "Keine Berechtigung." };
  }
  const allowed = await hasPermission(session.user, "mitglieder.probenplanung");
  if (!allowed) {
    return { ok: false as const, error: "Keine Berechtigung." };
  }
  return { ok: true as const, userId };
}

async function syncInvitees(
  tx: Prisma.TransactionClient,
  rehearsalId: string,
  inviteeIds: string[],
) {
  const unique = Array.from(new Set(inviteeIds));
  if (unique.length === 0) {
    await tx.rehearsalInvitee.deleteMany({ where: { rehearsalId } });
    return unique;
  }

  await tx.rehearsalInvitee.deleteMany({
    where: {
      rehearsalId,
      NOT: { userId: { in: unique } },
    },
  });

  const existing = await tx.rehearsalInvitee.findMany({
    where: { rehearsalId },
    select: { userId: true },
  });
  const existingSet = new Set(existing.map((entry) => entry.userId));
  const toCreate = unique.filter((id) => !existingSet.has(id));
  if (toCreate.length) {
    await tx.rehearsalInvitee.createMany({
      data: toCreate.map((userId) => ({ rehearsalId, userId })),
      skipDuplicates: true,
    });
  }
  return unique;
}

async function collectInviteeRoles(
  tx: Prisma.TransactionClient,
  inviteeIds: string[],
) {
  if (!inviteeIds.length) return [] as string[];
  const users = await tx.user.findMany({
    where: { id: { in: inviteeIds } },
    select: {
      role: true,
      roles: { select: { role: true } },
    },
  });
  const roles = new Set<string>();
  for (const user of users) {
    if (user.role) {
      roles.add(user.role);
    }
    for (const entry of user.roles) {
      roles.add(entry.role);
    }
  }
  return Array.from(roles);
}

async function fetchInviteeIds(tx: Prisma.TransactionClient, rehearsalId: string) {
  const entries = await tx.rehearsalInvitee.findMany({
    where: { rehearsalId },
    select: { userId: true },
  });
  return entries.map((entry) => entry.userId);
}

export async function createRehearsalDraftAction(input?: {
  title?: string;
  date?: string;
  time?: string;
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
      const desired = parseStart(input.date, input.time ?? "19:00");
      start = desired;
    } catch (error) {
      console.warn("Invalid draft start provided", error);
    }
  }

  const end = computeEnd(start);
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
      registrationDeadline: computeRegistrationDeadline(start, "1w"),
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
  registrationDeadlineOption?: RegistrationDeadlineOption;
}) {
  const auth = await ensurePlanner();
  if (!auth.ok) {
    return { error: auth.error } as const;
  }

  const parsed = draftUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Bitte Eingaben prüfen." } as const;
  }

  const { id, title, date, time, location, description, invitees, registrationDeadlineOption } = parsed.data;

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

      if (date || time) {
        const currentDate = existing.start.toISOString().slice(0, 10);
        const currentTime = existing.start.toISOString().slice(11, 16);
        nextStart = parseStart(date ?? currentDate, time ?? currentTime);
        const nextEnd = computeEnd(nextStart, existing.start, existing.end);
        updateData.start = nextStart;
        updateData.end = nextEnd;
      }

      if (registrationDeadlineOption !== undefined) {
        const deadline = computeRegistrationDeadline(nextStart, registrationDeadlineOption);
        updateData.registrationDeadline = deadline;
      }

      if (invitees) {
        const synced = await syncInvitees(tx, id, invitees);
        const roles = await collectInviteeRoles(tx, synced);
        updateData.requiredRoles = roles as unknown as Prisma.InputJsonValue;
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
    console.error("Error updating rehearsal draft", error);
    return { error: "Der Entwurf konnte nicht gespeichert werden." } as const;
  }
}
export async function publishRehearsalAction(input: {
  id: string;
  title: string;
  date: string;
  time: string;
  location?: string;
  description?: string;
  invitees?: string[];
  registrationDeadlineOption: RegistrationDeadlineOption;
}) {
  const auth = await ensurePlanner();
  if (!auth.ok) {
    return { error: auth.error } as const;
  }

  const parsed = publishSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Bitte Eingaben prüfen." } as const;
  }

  const { id, title, date, time, location, description, invitees, registrationDeadlineOption } = parsed.data;

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
      const end = computeEnd(start, existing.start, existing.end);
      const normalizedLocation = location?.trim() ? location.trim() : "Noch offen";
      const safeDescription = sanitizeDescription(description);

      const inviteeIds = invitees
        ? Array.from(new Set(invitees))
        : existing.invitees.map((entry) => entry.userId);

      const syncedInvitees = await syncInvitees(tx, id, inviteeIds);
      const roles = await collectInviteeRoles(tx, syncedInvitees);
      const formatter = new Intl.DateTimeFormat("de-DE", { dateStyle: "full", timeStyle: "short" });
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
          requiredRoles: roles as unknown as Prisma.InputJsonValue,
          registrationDeadline: computeRegistrationDeadline(start, registrationDeadlineOption),
          createdBy: existing.createdBy ?? auth.userId,
        },
        select: { id: true, title: true, start: true, end: true, location: true },
      });

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

export async function createRehearsalAction(input: {
  title: string;
  date: string;
  time: string;
  location?: string;
  description?: string;
  invitees?: string[];
  registrationDeadlineOption: RegistrationDeadlineOption;
}) {
  const auth = await ensurePlanner();
  if (!auth.ok) {
    return { error: auth.error } as const;
  }

  const parsed = baseSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Bitte Titel, Datum und Uhrzeit prüfen." } as const;
  }

  const { title, date, time, location, description, invitees, registrationDeadlineOption } = parsed.data;
  const start = parseStart(date, time);
  const end = computeEnd(start);
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
      const formatter = new Intl.DateTimeFormat("de-DE", { dateStyle: "full", timeStyle: "short" });
      const body = `Am ${formatter.format(start)}`;

      const rehearsal = await tx.rehearsal.create({
        data: {
          title,
          start,
          end,
          location: normalizedLocation,
          description: safeDescription,
          status: "PLANNED",
          requiredRoles: roles as unknown as Prisma.InputJsonValue,
          registrationDeadline: computeRegistrationDeadline(start, registrationDeadlineOption),
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
    console.error("Error creating rehearsal", error);
    return { error: "Die Probe konnte nicht gespeichert werden." } as const;
  }
}

export async function updateRehearsalAction(input: {
  id: string;
  title: string;
  date: string;
  time: string;
  location?: string;
  description?: string;
  invitees?: string[];
  registrationDeadlineOption: RegistrationDeadlineOption;
}) {
  const auth = await ensurePlanner();
  if (!auth.ok) {
    return { error: auth.error } as const;
  }

  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Bitte Eingaben prüfen." } as const;
  }

  const { id, title, date, time, location, description, invitees, registrationDeadlineOption } = parsed.data;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.rehearsal.findUnique({
        where: { id },
        select: { start: true, end: true, location: true, description: true, status: true },
      });
      if (!existing) {
        throw new Error("not-found");
      }

      const start = parseStart(date, time);
      const end = computeEnd(start, existing.start, existing.end);
      const normalizedLocation = location?.trim()
        ? location.trim()
        : existing.location ?? "Noch offen";

      const updateData: Prisma.RehearsalUpdateInput = {
        title,
        start,
        end,
        location: normalizedLocation,
      };

      if (description !== undefined) {
        updateData.description = sanitizeDescription(description);
      }

      if (registrationDeadlineOption) {
        const deadline = computeRegistrationDeadline(start, registrationDeadlineOption);
        updateData.registrationDeadline = deadline;
      }

      let targetInvitees: string[];
      if (invitees) {
        const synced = await syncInvitees(tx, id, invitees);
        const roles = await collectInviteeRoles(tx, synced);
        updateData.requiredRoles = roles as unknown as Prisma.InputJsonValue;
        targetInvitees = synced;
      } else {
        targetInvitees = await fetchInviteeIds(tx, id);
      }

      const rehearsal = await tx.rehearsal.update({
        where: { id },
        data: updateData,
        select: { id: true, title: true, start: true, end: true, location: true },
      });

      return { rehearsal, targetInvitees };
    });

    const { rehearsal, targetInvitees } = result;
    const formatter = new Intl.DateTimeFormat("de-DE", { dateStyle: "full", timeStyle: "short" });
    const updatedTitle = `Probe aktualisiert: ${rehearsal.title}`;
    const updatedBody = `Neuer Termin: ${formatter.format(rehearsal.start)}${
      rehearsal.location ? ` · Ort: ${rehearsal.location}` : ""
    }`;

    if (targetInvitees.length) {
      await prisma.notification.create({
        data: {
          title: updatedTitle,
          body: updatedBody,
          type: "rehearsal-update",
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
          end: rehearsal.end.toISOString(),
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
    console.error("Error updating rehearsal", error);
    return { error: "Die Probe konnte nicht aktualisiert werden." } as const;
  }
}


const deleteSchema = z.object({ id: z.string().min(1) });

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
