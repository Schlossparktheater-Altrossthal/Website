import { z } from "zod";
import sanitizeHtml from "sanitize-html";
import { CalendarEventKind, type Prisma } from "@prisma/client";

import { requireAuth } from "@/lib/rbac";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getActiveProductionId } from "@/lib/active-production";
import { audienceInputSchema, type AudienceInput } from "@/lib/calendar/audience-server";
import type { AudienceContext } from "@/lib/calendar/audience";
import {
  readEventSchedule,
  saveEventBlocks,
  saveEventSchedule,
  scheduleInputSchema,
  type ScheduleInput,
} from "@/lib/calendar/scene-schedule-server";
import {
  DEFAULT_TIME_ZONE,
  formatIsoDateInTimeZone,
  parseDateTimeInTimeZone,
} from "@/lib/date-time";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_TIME = /^\d{2}:\d{2}$/;
export const REHEARSAL_TIME_ZONE = DEFAULT_TIME_ZONE;

export const baseSchema = z.object({
  title: z.string().trim().min(3, "Titel ist zu kurz").max(120, "Titel ist zu lang"),
  /** Art; mit Szenen immer „Probe“. */
  kind: z.nativeEnum(CalendarEventKind).optional(),
  date: z.string().regex(ISO_DATE, "Ungültiges Datum"),
  time: z.string().regex(ISO_TIME, "Ungültige Uhrzeit"),
  endTime: z.string().regex(ISO_TIME, "Ungültige Uhrzeit").optional(),
  /** Letzter Tag mehrtägiger Termine. */
  endDate: z.string().regex(ISO_DATE, "Ungültiges Datum").nullable().optional(),
  allDay: z.boolean().optional(),
  /** Nur ohne Szenen: Produktion der Planung oder alle Produktionen. */
  scope: z.enum(["production", "all"]).optional(),
  /** Termin für alle, ohne Einladung (Zielgruppe wird geleert). */
  openAudience: z.boolean().optional(),
  // Leer = noch offen (Proben) bzw. ohne Ort.
  location: z.string().trim().max(120, "Ort ist zu lang").optional(),
  description: z.string().max(10_000).optional(),
  audience: audienceInputSchema.optional(),
  schedule: scheduleInputSchema.optional(),
});

export const draftUpdateSchema = baseSchema.partial().extend({ id: z.string().min(1) });
export const publishSchema = baseSchema.extend({
  id: z.string().min(1),
  /** Vormerken (Zielgruppe sieht die Probe, Absagen möglich) oder verbindlich ansetzen. */
  target: z.enum(["TENTATIVE", "SCHEDULED"]).default("SCHEDULED"),
});
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
  // Endzeit vor der Startzeit: Probe geht über Mitternacht (z. B. 22:00–00:30).
  if (end.getTime() < start.getTime()) {
    end = new Date(end.getTime() + 24 * 60 * 60 * 1000);
  }
  if (end.getTime() <= start.getTime()) {
    throw new Error("Endzeit muss nach der Startzeit liegen.");
  }
  return end;
}

/** Probe, sobald Szenen dabei sind; sonst die gewählte Art. */
export function resolveKind(
  kind: CalendarEventKind | undefined,
  audience: AudienceInput | undefined,
): CalendarEventKind | undefined {
  if (audience?.rules.some((rule) => rule.type === "SCENE")) return "REHEARSAL";
  return kind;
}

/** „Probe“ oder „Termin“ für Benachrichtigungen. */
export function eventNoun(kind: CalendarEventKind) {
  return kind === "REHEARSAL" ? "Probe" : "Termin";
}

/**
 * Start/Ende aus der Eingabe des Editors. Ganztägig: 00:00 bis 23:59 Ortszeit, mehrtägig bis
 * zum letzten Tag. Sonst Endzeit am selben Tag (über Mitternacht erlaubt).
 */
export function resolveTimes(
  input: {
    date: string;
    time: string;
    endTime?: string;
    endDate?: string | null;
    allDay?: boolean;
  },
  previous?: { start: Date; end: Date | null },
) {
  const lastDay = input.endDate && input.endDate > input.date ? input.endDate : null;
  if (input.allDay) {
    return {
      start: parseStart(input.date, "00:00"),
      end: parseDateTimeInTimeZone(lastDay ?? input.date, "23:59", REHEARSAL_TIME_ZONE),
    };
  }
  const start = parseStart(input.date, input.time);
  if (lastDay) {
    const end = parseDateTimeInTimeZone(lastDay, input.endTime ?? "23:59", REHEARSAL_TIME_ZONE);
    if (end <= start) throw new Error("Endzeit muss nach der Startzeit liegen.");
    return { start, end };
  }
  const end = input.endTime
    ? parseEnd(input.date, input.endTime, start)
    : computeEnd(start, previous?.start, previous?.end);
  return { start, end };
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
      // Gewerk-eigene Termine pflegt das Gewerk-Portal.
      where: { id: target.rehearsalId, departmentId: null },
      select: { showId: true },
    });
    if (!rehearsal) {
      return { ok: false as const, error: "Der Termin wurde nicht gefunden." };
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

/** Leere Zielgruppe: Termin für alle, ohne Einladung. */
export const OPEN_AUDIENCE: AudienceInput = { rules: [], overrides: [] };

/**
 * Produktion nach einem Wechsel „gilt für“: `all` = alle Produktionen, `production` = die
 * bisherige bzw. gerade gewählte. Das Planungsrecht muss auch dort bestehen.
 */
export async function resolveTargetShow(
  auth: { userId: string; showId: string | null },
  scope: "production" | "all" | undefined,
) {
  if (!scope) return { ok: true as const, showId: auth.showId };
  const showId =
    scope === "all" ? null : (auth.showId ?? (await getActiveProductionId(auth.userId)));
  if (showId === auth.showId) return { ok: true as const, showId };
  const session = await requireAuth();
  if (!(await hasPermission(session.user, "PRIVATE.REHEARSAL.PLANNING.MANAGE", { showId }))) {
    return { ok: false as const, error: "Keine Berechtigung für diese Produktion." };
  }
  return { ok: true as const, showId };
}

export async function fetchInviteeIds(tx: Prisma.TransactionClient, rehearsalId: string) {
  const entries = await tx.eventParticipant.findMany({
    where: { eventId: rehearsalId, invited: true },
    select: { userId: true },
  });
  return entries.map((entry) => entry.userId);
}

/**
 * Szenen der Probe mit den Szenen-Regeln abgleichen und den Ablauf speichern – nach jeder
 * Änderung an Zielgruppe, Zeitplan oder Datum.
 */
export async function syncRehearsalSchedule(
  tx: Prisma.TransactionClient,
  {
    eventId,
    start,
    audience,
    schedule,
    storedSchedule,
    context,
  }: {
    eventId: string;
    start: Date;
    audience?: AudienceInput;
    schedule?: ScheduleInput;
    storedSchedule: ScheduleInput;
    context: AudienceContext;
  },
) {
  const sceneRules = audience
    ? audience.rules.filter((rule) => rule.type === "SCENE")
    : await tx.eventAudienceRule.findMany({
        where: { eventId, type: "SCENE" },
        orderBy: { sortOrder: "asc" },
        select: { targetId: true },
      });
  await saveEventSchedule(tx, {
    eventId,
    sceneIds: sceneRules.flatMap((rule) => (rule.targetId ? [rule.targetId] : [])),
    schedule: schedule ?? storedSchedule,
    dateKey: formatIsoDateInTimeZone(start.toISOString(), REHEARSAL_TIME_ZONE),
    eventStart: start,
    context,
  });
}

/** Weitere Bausteine speichern – vor der Zielgruppe, weil Gewerk-Bausteine einladen. */
export async function syncEventBlocks(
  tx: Prisma.TransactionClient,
  { eventId, start, schedule }: { eventId: string; start: Date; schedule?: ScheduleInput },
) {
  if (!schedule) return;
  await saveEventBlocks(tx, {
    eventId,
    blocks: schedule.blocks,
    dateKey: formatIsoDateInTimeZone(start.toISOString(), REHEARSAL_TIME_ZONE),
    eventStart: start,
  });
}

export { readEventSchedule };
