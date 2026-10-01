"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { canEditProtocol, resolveTaskRecipients } from "@/lib/calendar/protocol-server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";
import { broadcastRehearsalUpdated } from "@/lib/realtime/triggers";

const schema = z.object({ noteId: z.string().min(1), done: z.boolean() });

/** Aufgabe aus einem Probenprotokoll abhaken – von den Zuständigen oder der Protokollführung. */
export async function setEventTaskDoneAction(input: z.input<typeof schema>) {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Ungültige Eingabe." };
  const session = await requireAuth();
  const userId = session.user?.id;
  const note = await prisma.eventNote.findUnique({
    where: { id: parsed.data.noteId },
    select: {
      id: true,
      type: true,
      eventId: true,
      assigneeUserId: true,
      characterId: true,
      departmentId: true,
      event: { select: { showId: true } },
    },
  });
  if (!userId || !note || note.type !== "TASK") {
    return { ok: false as const, error: "Aufgabe nicht gefunden." };
  }
  const recipients = await resolveTaskRecipients(note);
  if (!recipients.includes(userId) && !(await canEditProtocol(session.user, note.event.showId))) {
    return { ok: false as const, error: "Diese Aufgabe ist nicht deine." };
  }

  await prisma.eventNote.update({
    where: { id: note.id },
    data: { doneAt: parsed.data.done ? new Date() : null },
  });
  revalidatePath("/mitglieder");
  revalidatePath(`/mitglieder/termine/${note.eventId}`);
  await broadcastRehearsalUpdated({
    rehearsalId: note.eventId,
    changes: { protocol: true },
    targetUserIds: [],
  }).catch((error) => console.error("[tasks] Live-Meldung fehlgeschlagen", error));
  return { ok: true as const };
}
