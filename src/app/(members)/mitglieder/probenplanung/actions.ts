"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAuth } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import {
  broadcastRehearsalCreated,
  broadcastRehearsalUpdated,
  sendNotification,
} from "@/lib/realtime/triggers";

const rehearsalSchema = z.object({
  title: z.string().min(3, "Titel ist zu kurz").max(120, "Titel ist zu lang"),
  date: z.string().min(1),
  time: z.string().min(1),
  location: z
    .string()
    .min(2, "Ort ist zu kurz")
    .max(120, "Ort ist zu lang")
    .optional(),
});

export async function createRehearsalAction(input: {
  title: string;
  date: string;
  time: string;
  location?: string;
}) {
  const session = await requireAuth(["board", "admin", "tech"]);
  const userId = session.user?.id;

  if (!userId) {
    return { error: "Keine Berechtigung." } as const;
  }

  const parsed = rehearsalSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Bitte Titel, Datum und Uhrzeit prüfen." } as const;
  }

  const { title, date, time, location } = parsed.data;
  const start = new Date(`${date}T${time}`);
  if (Number.isNaN(start.getTime())) {
    return { error: "Ungültige Kombination aus Datum und Uhrzeit." } as const;
  }
  const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);

  try {
    const users = await prisma.user.findMany({ select: { id: true } });
    if (!users.length) {
      return { error: "Es wurden keine Benutzer gefunden." } as const;
    }

    const formatter = new Intl.DateTimeFormat("de-DE", {
      dateStyle: "full",
      timeStyle: "short",
    });

      const created = await prisma.$transaction(async (tx) => {
        const rehearsal = await tx.rehearsal.create({
          data: {
            title,
            start,
            end,
            location: location ?? "Noch offen",
            requiredRoles: [],
          createdBy: userId,
          },
        select: {
          id: true,
          title: true,
          start: true,
          end: true,
          location: true,
        },
      });

      await tx.notification.create({
        data: {
          title: `Neue Probe: ${title}`,
          body: `Am ${formatter.format(start)}`,
          type: "rehearsal",
          rehearsalId: rehearsal.id,
          recipients: {
            create: users.map((u) => ({ userId: u.id })),
          },
        },
      });

      return rehearsal;
    });

    if (created) {
      await broadcastRehearsalCreated({
        rehearsal: {
          id: created.id,
          title: created.title,
          start: created.start.toISOString(),
          end: created.end.toISOString(),
          location: created.location ?? "Noch offen",
        },
        targetUserIds: users.map((entry) => entry.id),
      });

      await Promise.all(
        users.map((recipient) =>
          sendNotification({
            targetUserId: recipient.id,
            title: `Neue Probe: ${title}`,
            body: `Am ${formatter.format(start)}`,
            type: "info",
            metadata: {
              rehearsalId: created.id,
            },
          }),
        ),
      );
    }

    revalidatePath("/mitglieder/probenplanung");
    return { success: true } as const;
  } catch (error) {
    console.error("Error creating rehearsal", error);
    return { error: "Die Probe konnte nicht gespeichert werden." } as const;
  }
}

const updateSchema = rehearsalSchema.extend({
  id: z.string().min(1),
});

export async function updateRehearsalAction(input: {
  id: string;
  title: string;
  date: string;
  time: string;
  location?: string;
}) {
  const session = await requireAuth(["board", "admin", "tech"]);
  const userId = session.user?.id;

  if (!userId) {
    return { error: "Keine Berechtigung." } as const;
  }

  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Bitte Eingaben prüfen." } as const;
  }

  const { id, title, date, time, location } = parsed.data;
  const start = new Date(`${date}T${time}`);
  if (Number.isNaN(start.getTime())) {
    return { error: "Ungültige Kombination aus Datum und Uhrzeit." } as const;
  }
  const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);

  try {
    const users = await prisma.user.findMany({ select: { id: true } });

    const rehearsal = await prisma.$transaction(async (tx) => {
      const existing = await tx.rehearsal.findUnique({ where: { id } });
      if (!existing) {
        throw new Error("Rehearsal not found");
      }

      return tx.rehearsal.update({
        where: { id },
        data: {
          title,
          start,
          end,
          location: location ?? existing.location ?? "Noch offen",
        },
        select: {
          id: true,
          title: true,
          start: true,
          end: true,
          location: true,
        },
      });
    });

    await broadcastRehearsalUpdated({
      rehearsalId: rehearsal.id,
      changes: {
        title: rehearsal.title,
        start: rehearsal.start.toISOString(),
        end: rehearsal.end.toISOString(),
        location: rehearsal.location ?? undefined,
      },
      targetUserIds: users.map((entry) => entry.id),
    });

    revalidatePath("/mitglieder/probenplanung");
    return { success: true } as const;
  } catch (error) {
    console.error("Error updating rehearsal", error);
    return { error: "Die Probe konnte nicht aktualisiert werden." } as const;
  }
}

const deleteSchema = z.object({ id: z.string().min(1) });

export async function deleteRehearsalAction(input: { id: string }) {
  const session = await requireAuth(["board", "admin", "tech"]);
  const userId = (session.user as { id?: string } | undefined)?.id;

  if (!userId) {
    return { error: "Keine Berechtigung." } as const;
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
          notifications: {
            select: { recipients: { select: { userId: true } } },
          },
        },
      });

      if (!existing) {
        throw new Error("Rehearsal not found");
      }

      await tx.rehearsal.delete({ where: { id: parsed.data.id } });

      return existing;
    });

    const targetUserIds = new Set<string>();
    rehearsal.notifications.forEach((notification) => {
      notification.recipients.forEach((recipient) => targetUserIds.add(recipient.userId));
    });

    await broadcastRehearsalUpdated({
      rehearsalId: parsed.data.id,
      changes: { status: "deleted", title: rehearsal.title ?? undefined },
      targetUserIds: Array.from(targetUserIds),
    });

    revalidatePath("/mitglieder/probenplanung");
    return { success: true } as const;
  } catch (error) {
    console.error("Error deleting rehearsal", error);
    return { error: "Die Probe konnte nicht entfernt werden." } as const;
  }
}
