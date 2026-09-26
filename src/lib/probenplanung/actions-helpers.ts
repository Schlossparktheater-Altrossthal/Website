import { z } from "zod";
import sanitizeHtml from "sanitize-html";
import type { Prisma } from "@prisma/client";

import { requireAuth } from "@/lib/rbac";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getActiveProductionId } from "@/lib/active-production";
import { DEFAULT_TIME_ZONE, parseDateTimeInTimeZone } from "@/lib/date-time";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_TIME = /^\d{2}:\d{2}$/;
export const REHEARSAL_TIME_ZONE = DEFAULT_TIME_ZONE;

export const baseSchema = z.object({
  title: z.string().trim().min(3, "Titel ist zu kurz").max(120, "Titel ist zu lang"),
  date: z.string().regex(ISO_DATE, "Ungültiges Datum"),
  time: z.string().regex(ISO_TIME, "Ungültige Uhrzeit"),
  endTime: z.string().regex(ISO_TIME, "Ungültige Uhrzeit").optional(),
  location: z.string().trim().min(2, "Ort ist zu kurz").max(120, "Ort ist zu lang").optional(),
  description: z.string().max(10_000).optional(),
  invitees: z.array(z.string().min(1)).optional(),
});

export const draftUpdateSchema = baseSchema.partial().extend({ id: z.string().min(1) });
export const publishSchema = baseSchema.extend({ id: z.string().min(1) });
export const updateSchema = baseSchema.extend({ id: z.string().min(1) });
export const deleteSchema = z.object({ id: z.string().min(1) });

export function sanitizeDescription(html?: string | null) {
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

export function parseStart(date: string, time: string) {
  try {
    return parseDateTimeInTimeZone(date, time, REHEARSAL_TIME_ZONE);
  } catch (error) {
    console.error("Failed to parse rehearsal start", error);
    throw new Error("Ungültige Kombination aus Datum und Uhrzeit.");
  }
}

export function parseEnd(date: string, endTime: string, start: Date) {
  let end: Date;
  try {
    end = parseDateTimeInTimeZone(date, endTime, REHEARSAL_TIME_ZONE);
  } catch (error) {
    console.error("Failed to parse rehearsal end", error);
    throw new Error("Ungültige Endzeit.");
  }
  if (end.getTime() <= start.getTime()) {
    throw new Error("Endzeit muss nach der Startzeit liegen.");
  }
  return end;
}

export function computeEnd(start: Date, previousStart?: Date | null, previousEnd?: Date | null) {
  if (previousStart && previousEnd) {
    const duration = previousEnd.getTime() - previousStart.getTime();
    if (duration > 0) {
      return new Date(start.getTime() + duration);
    }
  }
  return new Date(start.getTime() + 2 * 60 * 60 * 1000);
}

/**
 * Prüft das Planungsrecht im Kontext einer Produktion: bei bestehenden Proben deren
 * Produktion, sonst die gerade gewählte. `showId` ist die Produktion, der neue Proben
 * zugeordnet werden (null = allgemeine Probe ohne Produktion).
 */
export async function ensurePlanner(target?: { rehearsalId?: string | null }) {
  const session = await requireAuth();
  const userId = session.user?.id;
  if (!userId) {
    return { ok: false as const, error: "Keine Berechtigung." };
  }
  let showId: string | null;
  if (target?.rehearsalId) {
    const rehearsal = await prisma.calendarEvent.findFirst({
      where: { id: target.rehearsalId, kind: "REHEARSAL" },
      select: { showId: true },
    });
    if (!rehearsal) {
      return { ok: false as const, error: "Die Probe wurde nicht gefunden." };
    }
    showId = rehearsal.showId;
  } else {
    showId = await getActiveProductionId(userId);
  }
  const allowed = await hasPermission(session.user, "PRIVATE.REHEARSAL.PLANNING.MANAGE", {
    showId,
  });
  if (!allowed) {
    return {
      ok: false as const,
      error: showId
        ? "Keine Berechtigung für die Probenplanung dieser Produktion."
        : "Keine Berechtigung.",
    };
  }
  return { ok: true as const, userId, showId };
}

/** Standard-Einladung: aktive Mitglieder der Produktion, ohne Produktion alle Aktiven. */
export async function defaultInviteeIds(showId: string | null): Promise<string[]> {
  const users = await prisma.user.findMany({
    where: {
      deactivatedAt: null,
      ...(showId
        ? {
            productionMemberships: {
              some: {
                showId,
                status: "active",
                OR: [{ leftAt: null }, { leftAt: { gt: new Date() } }],
              },
            },
          }
        : {}),
    },
    select: { id: true },
  });
  return users.map((user) => user.id);
}

/** Eingeladene einer Probe setzen; Ausgeladene mit Rückmeldung bleiben als Rückmeldung erhalten. */
export async function syncInvitees(
  tx: Prisma.TransactionClient,
  rehearsalId: string,
  inviteeIds: string[],
) {
  const unique = Array.from(new Set(inviteeIds));
  const notInvited = { eventId: rehearsalId, NOT: { userId: { in: unique } } };
  await tx.eventParticipant.deleteMany({ where: { ...notInvited, response: null } });
  await tx.eventParticipant.updateMany({ where: notInvited, data: { invited: false } });

  if (unique.length) {
    await tx.eventParticipant.updateMany({
      where: { eventId: rehearsalId, userId: { in: unique }, invited: false },
      data: { invited: true },
    });
    await tx.eventParticipant.createMany({
      data: unique.map((userId) => ({ eventId: rehearsalId, userId })),
      skipDuplicates: true,
    });
  }
  return unique;
}

export async function fetchInviteeIds(tx: Prisma.TransactionClient, rehearsalId: string) {
  const entries = await tx.eventParticipant.findMany({
    where: { eventId: rehearsalId, invited: true },
    select: { userId: true },
  });
  return entries.map((entry) => entry.userId);
}
