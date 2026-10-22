import type { Prisma } from "@prisma/client";

import { allDoneAt } from "@/lib/calendar/protocol";
import { notifyWishTargetChanges, syncWishesFromTasks } from "@/lib/regie/wishes";

/**
 * Abgleich zwischen Gewerk-Karten und dem, wofür sie stehen: Protokoll-Aufgaben mit dem Gewerk
 * als Zuständigkeit (`EventNoteAssignee.departmentTaskId`) und Wünsche der Regie an das Gewerk
 * (`DirectionWishTarget.departmentTaskId`, docs/Plan/wuensche-plan.md).
 */

export type TaskSyncResult = Awaited<ReturnType<typeof syncWishesFromTasks>>;

/**
 * Nach Statuswechsel von Karten: verknüpfte Zuständigkeiten und Wunsch-Empfänger nachziehen.
 * Das Ergebnis nach der Transaktion an `notifyTaskSync` geben.
 */
export async function syncFromTasks(
  tx: Prisma.TransactionClient,
  taskIds: readonly string[],
  actorId: string | null,
): Promise<TaskSyncResult> {
  await syncProtocolFromTasks(tx, taskIds, actorId);
  return syncWishesFromTasks(tx, taskIds, actorId);
}

/** Beteiligte über geänderte Wünsche informieren; Fehler nur protokollieren. */
export async function notifyTaskSync(changes: TaskSyncResult, actorId: string) {
  if (!changes.length) return;
  await notifyWishTargetChanges(changes, actorId).catch((error) =>
    console.error("[task-sync] Benachrichtigung fehlgeschlagen", error),
  );
}

/** Karte erledigt ⇔ Zuständigkeit des Gewerks in der Protokoll-Aufgabe abgehakt. */
async function syncProtocolFromTasks(
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

/**
 * Vor dem Löschen einer Karte: Die Protokoll-Aufgabe verliert die Zuständigkeit des Gewerks
 * (sonst bliebe sie für immer offen). War das Gewerk allein zuständig, gilt sie als erledigt.
 */
export async function detachProtocolFromTask(
  tx: Prisma.TransactionClient,
  taskId: string,
  actorId: string,
) {
  const rows = await tx.eventNoteAssignee.findMany({
    where: { departmentTaskId: taskId },
    select: {
      id: true,
      noteId: true,
      doneAt: true,
      note: { select: { _count: { select: { assignees: true } } } },
    },
  });
  for (const row of rows) {
    if (row.note._count.assignees > 1) {
      await tx.eventNoteAssignee.delete({ where: { id: row.id } });
    } else if (!row.doneAt) {
      await tx.eventNoteAssignee.update({
        where: { id: row.id },
        data: { doneAt: new Date(), doneById: actorId },
      });
    }
    await refreshNoteDoneAt(tx, row.noteId);
  }
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
