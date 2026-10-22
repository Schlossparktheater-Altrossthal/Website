"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { allDoneAt } from "@/lib/calendar/protocol";
import { ASSIGNEE_SELECT, canEditProtocol, rowsForUser } from "@/lib/calendar/protocol-server";
import { syncTasksFromProtocol } from "@/lib/departments/task-sync";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";
import { broadcastRehearsalUpdated } from "@/lib/realtime/triggers";

const schema = z.object({
  noteId: z.string().min(1),
  done: z.boolean(),
  /** `mine`: nur die eigenen Zuständigkeiten, `all`: für alle Zuständigen. */
  scope: z.enum(["mine", "all"]).default("mine"),
});

/**
 * Aufgabe aus einem Probenprotokoll abhaken. Jede Zuständigkeit (Person, Figur, Gewerk) hakt für
 * sich ab; „für alle“ dürfen Zuständige, wer die Aufgabe angelegt hat, und die Protokollführung.
 */
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
      authorId: true,
      assignees: { select: ASSIGNEE_SELECT },
      event: { select: { showId: true } },
    },
  });
  if (!userId || !note || note.type !== "TASK") {
    return { ok: false as const, error: "Aufgabe nicht gefunden." };
  }
  const mine = await rowsForUser(note.assignees, userId);
  const editor =
    note.authorId === userId || (await canEditProtocol(session.user, note.event.showId));
  const rows =
    parsed.data.scope === "all"
      ? mine.length || editor
        ? note.assignees
        : []
      : mine.length
        ? mine
        : editor
          ? note.assignees
          : [];
  if (!rows.length) return { ok: false as const, error: "Diese Aufgabe ist nicht deine." };

  const now = new Date();
  const ids = new Set(rows.map((row) => row.id));
  await prisma.$transaction(async (tx) => {
    await tx.eventNoteAssignee.updateMany({
      where: { id: { in: [...ids] } },
      data: parsed.data.done ? { doneAt: now, doneById: userId } : { doneAt: null, doneById: null },
    });
    await syncTasksFromProtocol(
      tx,
      rows.flatMap((row) => row.departmentTaskId ?? []),
      parsed.data.done,
    );
    const states = note.assignees.map((row) =>
      ids.has(row.id)
        ? { doneAt: parsed.data.done ? now.toISOString() : null }
        : { doneAt: row.doneAt?.toISOString() ?? null },
    );
    const doneAt = allDoneAt(states);
    await tx.eventNote.update({
      where: { id: note.id },
      data: { doneAt: doneAt ? new Date(doneAt) : null },
    });
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
