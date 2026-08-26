"use server";

import { z } from "zod";
import sanitizeHtml from "sanitize-html";
import type { Prisma } from "@prisma/client";

import { requireAuth } from "@/lib/rbac";
import { hasPermission } from "@/lib/permissions";
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

export async function ensurePlanner() {
  const session = await requireAuth();
  const userId = session.user?.id;
  if (!userId) {
    return { ok: false as const, error: "Keine Berechtigung." };
  }
  const allowed = await hasPermission(session.user, "PRIVATE.REHEARSAL.PLANNING.MANAGE");
  if (!allowed) {
    return { ok: false as const, error: "Keine Berechtigung." };
  }
  return { ok: true as const, userId };
}

export async function syncInvitees(
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

export async function collectInviteeRoles(tx: Prisma.TransactionClient, inviteeIds: string[]) {
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

export function rolesToInputJson(roles: readonly string[]): Prisma.InputJsonValue {
  return [...roles];
}

export async function fetchInviteeIds(tx: Prisma.TransactionClient, rehearsalId: string) {
  const entries = await tx.rehearsalInvitee.findMany({
    where: { rehearsalId },
    select: { userId: true },
  });
  return entries.map((entry) => entry.userId);
}
