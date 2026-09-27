"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { visibleEventStatus } from "@/lib/calendar/status";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { requireAuth } from "@/lib/rbac";
import { notifyPlannersOfDecline } from "@/lib/calendar/decline-notifications";
import { updateAttendanceWithLog } from "@/lib/rehearsals/attendance";

const DECLINE_SCHEMA = z.object({
  eventId: z.string().min(1),
  reason: z.string().trim().max(500, "Die Begründung ist zu lang."),
});

/** Bei angesetzten Proben ist die Begründung Pflicht, bei vorgemerkten freiwillig. */
const MIN_REASON = 3;

/** Fehler, deren Text direkt angezeigt werden darf. */
class RespondError extends Error {}

async function loadOwnRehearsal(eventId: string) {
  const session = await requireAuth();
  const userId = session.user?.id ?? null;
  if (!userId || !(await hasPermission(session.user, "PRIVATE.REHEARSAL.OWN.VIEW"))) {
    throw new RespondError("Du darfst auf diesen Termin nicht antworten.");
  }
  const rehearsal = await prisma.calendarEvent.findFirst({
    where: {
      id: eventId,
      kind: "REHEARSAL",
      status: visibleEventStatus,
      participants: { some: { userId, invited: true } },
    },
    select: { id: true, start: true, status: true },
  });
  if (!rehearsal) throw new RespondError("Du bist für diesen Termin nicht eingeladen.");
  if (rehearsal.start <= new Date()) throw new RespondError("Der Termin hat schon begonnen.");
  return { userId, rehearsal };
}

function revalidateOwn(eventId: string) {
  revalidatePath("/mitglieder/meine-proben");
  revalidatePath(`/mitglieder/proben/${eventId}`);
  revalidatePath(`/mitglieder/probenplanung/proben/${eventId}`);
}

/** Absage mit Begründung; die Planung wird bei benötigten Personen benachrichtigt. */
export async function declineRehearsalAction(input: { eventId: string; reason: string }) {
  const parsed = DECLINE_SCHEMA.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe." };
  }
  try {
    const { userId, rehearsal } = await loadOwnRehearsal(parsed.data.eventId);
    const reason = parsed.data.reason || null;
    if (rehearsal.status === "SCHEDULED" && (reason?.length ?? 0) < MIN_REASON) {
      throw new RespondError("Bitte gib kurz an, warum du nicht kannst.");
    }
    await updateAttendanceWithLog({
      prisma,
      eventId: rehearsal.id,
      targetUserId: userId,
      actorUserId: userId,
      nextStatus: "no",
      comment: reason ?? undefined,
      note: reason ?? undefined,
    });
    await notifyPlannersOfDecline({
      eventId: rehearsal.id,
      userId,
      reason,
    }).catch((error) => console.error("[decline] Planung nicht benachrichtigt", error));
    revalidateOwn(rehearsal.id);
    return { ok: true as const };
  } catch (error) {
    console.error("Error declining rehearsal", error);
    return {
      ok: false as const,
      error:
        error instanceof RespondError
          ? error.message
          : "Die Absage konnte nicht gespeichert werden.",
    };
  }
}

/** Absage zurücknehmen – die Person gilt wieder als dabei. */
export async function withdrawDeclineAction(input: { eventId: string }) {
  try {
    const { userId, rehearsal } = await loadOwnRehearsal(z.string().min(1).parse(input.eventId));
    await updateAttendanceWithLog({
      prisma,
      eventId: rehearsal.id,
      targetUserId: userId,
      actorUserId: userId,
      nextStatus: null,
      comment: "Absage zurückgenommen",
    });
    revalidateOwn(rehearsal.id);
    return { ok: true as const };
  } catch (error) {
    console.error("Error withdrawing decline", error);
    return {
      ok: false as const,
      error: error instanceof RespondError ? error.message : "Das hat nicht geklappt.",
    };
  }
}
