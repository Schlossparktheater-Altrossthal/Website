import { z } from "zod";

import {
  audienceInputSchema,
  loadAudienceContext,
  readEventAudience,
  saveEventAudience,
} from "@/lib/calendar/audience-server";
import { DEFAULT_TIME_ZONE } from "@/lib/date-time";
import { prisma } from "@/lib/prisma";
import { sendNotification } from "@/lib/realtime/triggers";

/**
 * Zielgruppe allgemeiner Termine (Terminplanung): ohne Zielgruppe gilt ein Termin für alle,
 * mit Zielgruppe sehen ihn nur die Eingeladenen.
 * `undefined` = Zielgruppe unverändert lassen, `null` = wieder für alle.
 */
export const generalEventAudienceSchema = z.object({
  audience: audienceInputSchema.nullable().optional(),
});

const WHEN = new Intl.DateTimeFormat("de-DE", {
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: DEFAULT_TIME_ZONE,
});

async function notifyUsers(eventId: string, userIds: string[], title: string, body: string) {
  if (!userIds.length) return;
  await prisma.notification.create({
    data: {
      title,
      body,
      type: "calendar-event",
      eventId,
      recipients: { create: userIds.map((userId) => ({ userId })) },
    },
  });
  await Promise.all(
    userIds.map((userId) =>
      sendNotification({ targetUserId: userId, title, body, type: "info", metadata: { eventId } }),
    ),
  );
}

/** Zielgruppe speichern und neu Eingeladene bzw. Ausgeladene benachrichtigen. */
export async function syncGeneralEventAudience({
  event,
  audience,
  actorId,
}: {
  event: { id: string; title: string; start: Date; showId: string | null };
  audience: z.infer<typeof generalEventAudienceSchema>["audience"];
  actorId: string;
}) {
  if (audience === undefined) return;
  const context = await loadAudienceContext(event.showId);
  const { addedIds, removedIds } = await prisma.$transaction((tx) =>
    saveEventAudience(tx, event.id, audience ?? { rules: [], overrides: [] }, context),
  );
  // Zurück auf „für alle“: niemand wird einzeln ausgeladen.
  if (!audience) return;
  const others = (ids: string[]) => ids.filter((id) => id !== actorId);
  try {
    await notifyUsers(
      event.id,
      others(addedIds),
      `Neuer Termin: ${event.title}`,
      `Am ${WHEN.format(event.start)}`,
    );
    await notifyUsers(
      event.id,
      others(removedIds),
      `Nicht mehr eingeladen: ${event.title}`,
      `Der Termin am ${WHEN.format(event.start)} findet ohne dich statt.`,
    );
  } catch (error) {
    console.error("[calendar-events:audience-notify]", error);
  }
}

/** Gespeicherte Zielgruppe für den Dialog; null = Termin für alle. */
export async function readGeneralEventAudience(eventId: string) {
  const { rules, overrides } = await readEventAudience(eventId);
  return rules.length || overrides.length ? { rules, overrides } : null;
}
