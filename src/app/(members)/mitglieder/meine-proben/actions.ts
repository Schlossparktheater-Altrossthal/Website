"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  createBlockForDecline,
  isWithinFreeze,
  readFreezeDays,
  removeBlockForDecline,
} from "@/lib/calendar/block-list-link";
import {
  notifyPlannersOfDecline,
  notifyPlannersOfNewBlocks,
} from "@/lib/calendar/decline-notifications";
import { GENERAL_EVENT_WHERE, visibleGeneralEventWhere } from "@/lib/calendar/entries";
import { visibleEventStatus } from "@/lib/calendar/status";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { currentMembershipWhere } from "@/lib/produktionen/status";
import { requireAuth } from "@/lib/rbac";
import { updateAttendanceWithLog } from "@/lib/rehearsals/attendance";

const DECLINE_SCHEMA = z.object({
  eventId: z.string().min(1),
  reason: z.string().trim().max(500, "Die Begründung ist zu lang."),
});

/** Innerhalb der Sperrfrist ist die Begründung Pflicht, außerhalb freiwillig. */
const MIN_REASON = 3;

/** Fehler, deren Text direkt angezeigt werden darf. */
class RespondError extends Error {}

/**
 * Der eigene Termin: entweder eine persönliche Einladung oder ein „Für alle"-Termin der eigenen
 * Produktion. Die Sichtbarkeit wird serverseitig nachgeprüft – sonst ließe sich mit einer fremden
 * Termin-Kennung eine Absage auslösen. Gewerk-Termine antworten weiter über ihr Portal.
 */
async function loadOwnEvent(eventId: string) {
  const session = await requireAuth();
  const userId = session.user?.id ?? null;
  if (!userId || !(await hasPermission(session.user, "PRIVATE.REHEARSAL.OWN.VIEW"))) {
    throw new RespondError("Du darfst auf diesen Termin nicht antworten.");
  }

  const event = await prisma.calendarEvent.findFirst({
    where: {
      id: eventId,
      status: visibleEventStatus,
      OR: [
        { departmentId: null, participants: { some: { userId, invited: true } } },
        {
          ...GENERAL_EVENT_WHERE,
          AND: [
            {
              OR: [
                { showId: null },
                { show: { memberships: { some: { userId, ...currentMembershipWhere() } } } },
              ],
            },
            visibleGeneralEventWhere(userId),
          ],
        },
      ],
    },
    select: { id: true, start: true },
  });

  if (!event) throw new RespondError("Du bist für diesen Termin nicht eingeladen.");
  if (event.start <= new Date()) throw new RespondError("Der Termin hat schon begonnen.");
  return { userId, event };
}

function revalidateOwn(eventId: string) {
  revalidatePath("/mitglieder/meine-proben");
  revalidatePath("/mitglieder/sperrliste");
  revalidatePath(`/mitglieder/termine/${eventId}`);
  revalidatePath(`/mitglieder/terminplanung/${eventId}`);
}

/** Absage mit Begründung; die Planung wird genau einmal benachrichtigt, sofern jemand zuständig ist. */
export async function declineRehearsalAction(input: { eventId: string; reason: string }) {
  const parsed = DECLINE_SCHEMA.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe." };
  }

  try {
    const { userId, event } = await loadOwnEvent(parsed.data.eventId);
    const reason = parsed.data.reason || null;
    // Innerhalb der Sperrfrist würde die Sperrliste den Tag nicht mehr aufnehmen: Notfall.
    const emergency = isWithinFreeze(event.start, await readFreezeDays());
    if (emergency && (reason?.length ?? 0) < MIN_REASON) {
      throw new RespondError("Bitte gib kurz an, warum du nicht kannst.");
    }

    await updateAttendanceWithLog({
      prisma,
      eventId: event.id,
      targetUserId: userId,
      actorUserId: userId,
      nextStatus: emergency ? "emergency" : "no",
      comment: reason ?? undefined,
      note: reason ?? undefined,
    });

    const block = await createBlockForDecline({
      eventId: event.id,
      userId,
      start: event.start,
      reason,
    });

    const notified = await notifyPlannersOfDecline({ eventId: event.id, userId, reason }).catch(
      (error) => {
        console.error("[decline] Planung nicht benachrichtigt", error);
        return false;
      },
    );
    if (!notified && block.created) {
      // Hat die Absage niemanden erreicht (z. B. „Für alle" ohne zuständige Person), meldet der
      // Sperrlisten-Eintrag die Abwesenheit – nie doppelt, aber mindestens einmal.
      await notifyPlannersOfNewBlocks(userId, [
        { date: new Date(`${block.dayKey}T00:00:00.000Z`), reason },
      ]).catch((error) => console.error("[decline] Sperrlisten-Hinweis fehlgeschlagen", error));
    }

    revalidateOwn(event.id);
    return { ok: true as const, emergency };
  } catch (error) {
    console.error("Error declining event", error);
    return {
      ok: false as const,
      error:
        error instanceof RespondError
          ? error.message
          : "Die Absage konnte nicht gespeichert werden.",
    };
  }
}

/** Absage zurücknehmen – die Person gilt wieder als dabei, der Eintrag verschwindet mit. */
export async function withdrawDeclineAction(input: { eventId: string }) {
  try {
    const { userId, event } = await loadOwnEvent(z.string().min(1).parse(input.eventId));
    await updateAttendanceWithLog({
      prisma,
      eventId: event.id,
      targetUserId: userId,
      actorUserId: userId,
      nextStatus: null,
      comment: "Absage zurückgenommen",
    });
    await removeBlockForDecline({ eventId: event.id, userId });
    revalidateOwn(event.id);
    return { ok: true as const };
  } catch (error) {
    console.error("Error withdrawing decline", error);
    return {
      ok: false as const,
      error: error instanceof RespondError ? error.message : "Das hat nicht geklappt.",
    };
  }
}
