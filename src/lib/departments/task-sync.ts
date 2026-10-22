import type { Prisma } from "@prisma/client";

import { allDoneAt } from "@/lib/calendar/protocol";

/**
 * Abgleich zwischen Gewerk-Karten und Protokoll-Aufgaben, die ein Gewerk als Zuständigkeit haben
 * (`EventNoteAssignee.departmentTaskId`). Karte erledigt ⇔ Zuständigkeit des Gewerks abgehakt.
 */

/** Nach Statuswechsel von Karten: die verknüpften Zuständigkeiten nachziehen. */
export async function syncProtocolFromTasks(
  tx: Prisma.TransactionClient,
  taskIds: readonly string[],
  actorId: string | null,
) {
  if (!taskIds.length) return;
  const rows = await tx.eventNoteAssignee.findMany({
    where: { departmentTaskId: { in: [...taskIds] } },
    select: { id: true, noteId: true, doneAt: true, departmentTask: { select: { status: true } } },
  });
  const now = new Date();
  const changedNotes = new Set<string>();
  for (const row of rows) {
    const done = row.departmentTask?.status === "done";
    if (done === Boolean(row.doneAt)) continue;
    await tx.eventNoteAssignee.update({
      where: { id: row.id },
      data: done ? { doneAt: now, doneById: actorId } : { doneAt: null, doneById: null },
    });
    changedNotes.add(row.noteId);
  }
  for (const noteId of changedNotes) await refreshNoteDoneAt(tx, noteId);
}

/** Gesamtstatus einer Protokoll-Aufgabe aus ihren Zuständigkeiten neu berechnen. */
export async function refreshNoteDoneAt(tx: Prisma.TransactionClient, noteId: string) {
  const assignees = await tx.eventNoteAssignee.findMany({
    where: { noteId },
    select: { doneAt: true },
  });
  const doneAt = allDoneAt(assignees.map((row) => ({ doneAt: row.doneAt?.toISOString() ?? null })));
  await tx.eventNote.update({
    where: { id: noteId },
    data: { doneAt: doneAt ? new Date(doneAt) : null },
  });
}

/**
 * Nach Abhaken im Protokoll: Karten in die erste Spalte mit passendem Status schieben
 * (erledigt bzw. zurück nach „zu tun“). Ohne passende Spalte nur den Status setzen.
 */
export async function syncTasksFromProtocol(
  tx: Prisma.TransactionClient,
  taskIds: readonly string[],
  done: boolean,
) {
  if (!taskIds.length) return;
  const tasks = await tx.departmentTask.findMany({
    where: { id: { in: [...taskIds] } },
    select: { id: true, departmentId: true, status: true },
  });
  for (const task of tasks) {
    if ((task.status === "done") === done) continue;
    const column = await tx.departmentBoardColumn.findFirst({
      where: { departmentId: task.departmentId, status: done ? "done" : "todo" },
      orderBy: { position: "asc" },
      select: { id: true, status: true },
    });
    const last = column
      ? await tx.departmentTask.aggregate({
          where: { columnId: column.id },
          _max: { position: true },
        })
      : null;
    await tx.departmentTask.update({
      where: { id: task.id },
      data: {
        status: column?.status ?? (done ? "done" : "todo"),
        ...(column ? { columnId: column.id, position: (last?._max.position ?? -1) + 1 } : {}),
      },
    });
  }
}
