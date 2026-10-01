"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { protocolOpSchema } from "@/lib/calendar/protocol";
import { applyProtocolOpsToDb, canEditProtocol } from "@/lib/calendar/protocol-server";
import { notify } from "@/lib/notifications/notify";
import { NOTIFICATION_TYPES } from "@/lib/notifications/types";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";
import { broadcastRehearsalUpdated } from "@/lib/realtime/triggers";

const inputSchema = z.object({
  eventId: z.string().min(1),
  ops: z.array(protocolOpSchema).min(1).max(200),
});

/**
 * Nimmt Änderungen aus dem Probenmodus entgegen – auch nachträglich aus der Offline-Warteschlange –
 * und meldet allen offenen Geräten, dass sich etwas geändert hat.
 */
export async function applyProtocolOpsAction(input: z.input<typeof inputSchema>) {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: "Ungültige Eingabe.", retry: false };
  }
  const { eventId, ops } = parsed.data;

  const session = await requireAuth();
  const userId = session.user?.id;
  if (!userId) return { ok: false as const, error: "Nicht angemeldet.", retry: false };
  const event = await prisma.calendarEvent.findUnique({
    where: { id: eventId },
    select: { showId: true, status: true },
  });
  if (!event || event.status === "DRAFT" || event.status === "CANCELLED") {
    return { ok: false as const, error: "Für diesen Termin gibt es kein Protokoll.", retry: false };
  }
  if (!(await canEditProtocol(session.user, event.showId))) {
    return { ok: false as const, error: "Du darfst dieses Protokoll nicht führen.", retry: false };
  }

  try {
    const { rejected } = await applyProtocolOpsToDb(eventId, ops, userId);
    revalidatePath(`/mitglieder/termine/${eventId}`);
    revalidatePath(`/mitglieder/termine/${eventId}/probe`);
    await broadcastRehearsalUpdated({
      rehearsalId: eventId,
      changes: { protocol: true },
      targetUserIds: [],
    }).catch((error) => console.error("[protocol] Live-Meldung fehlgeschlagen", error));
    return { ok: true as const, rejected };
  } catch (error) {
    console.error("[protocol] Speichern fehlgeschlagen", error);
    return { ok: false as const, error: "Speichern fehlgeschlagen.", retry: true };
  }
}

/** Schickt das Protokoll an alle Eingeladenen und Anwesenden (App, Push; einmal je Probe neu). */
export async function sendProtocolAction(input: { eventId: string }) {
  const eventId = z.string().min(1).safeParse(input?.eventId);
  if (!eventId.success) return { ok: false as const, error: "Ungültige Eingabe." };

  const session = await requireAuth();
  const userId = session.user?.id;
  const event = await prisma.calendarEvent.findUnique({
    where: { id: eventId.data },
    select: {
      id: true,
      title: true,
      showId: true,
      status: true,
      protocolSummary: true,
      participants: {
        where: { OR: [{ invited: true }, { attendance: { not: null } }] },
        select: { userId: true },
      },
    },
  });
  if (!userId || !event || event.status === "DRAFT") {
    return { ok: false as const, error: "Termin nicht gefunden." };
  }
  if (!(await canEditProtocol(session.user, event.showId))) {
    return { ok: false as const, error: "Du darfst dieses Protokoll nicht verschicken." };
  }

  await notify({
    type: NOTIFICATION_TYPES.REHEARSAL_PROTOCOL,
    recipients: event.participants.map((entry) => entry.userId),
    actorId: userId,
    title: `Protokoll: ${event.title}`,
    body: event.protocolSummary?.slice(0, 280) ?? null,
    eventId: event.id,
    showId: event.showId,
    actionUrl: `/mitglieder/termine/${event.id}?ansicht=protokoll`,
  });
  await prisma.calendarEvent.update({
    where: { id: event.id },
    data: { protocolSentAt: new Date() },
  });
  revalidatePath(`/mitglieder/termine/${event.id}`);
  revalidatePath(`/mitglieder/termine/${event.id}/probe`);
  return { ok: true as const };
}
