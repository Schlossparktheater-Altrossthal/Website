"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireBoardAccess } from "@/lib/departments/board";
import { prisma } from "@/lib/prisma";
import {
  actionFailure,
  actionSuccess,
  type ProductionActionResult,
} from "@/lib/produktionen/actions-helpers";

function revalidateBoard() {
  revalidatePath("/mitglieder/meine-gewerke", "layout");
}

async function loadTask(taskId: string) {
  const task = await prisma.departmentTask.findUnique({
    where: { id: taskId },
    select: { id: true, departmentId: true, createdById: true, title: true },
  });
  if (!task) throw new Error("Aufgabe wurde nicht gefunden.");
  return task;
}

async function assertColumn(departmentId: string, columnId: string) {
  const column = await prisma.departmentBoardColumn.findFirst({
    where: { id: columnId, departmentId },
    select: { id: true, status: true },
  });
  if (!column) throw new Error("Spalte wurde nicht gefunden.");
  return column;
}

/** Nur aktive Mitglieder des Gewerks können Aufgaben übernehmen. */
async function validAssignees(departmentId: string, ids: string[]) {
  if (!ids.length) return [];
  const rows = await prisma.departmentMembership.findMany({
    where: { departmentId, status: "active", userId: { in: ids } },
    select: { userId: true },
  });
  return rows.map((row) => row.userId);
}

async function notifyAssignees(userIds: string[], actorId: string, title: string) {
  const recipients = userIds.filter((id) => id !== actorId);
  if (!recipients.length) return;
  await prisma.notification.create({
    data: {
      title: `Neue Aufgabe für dich: ${title}`,
      type: "department-task",
      recipients: { create: recipients.map((userId) => ({ userId })) },
    },
  });
}

const taskFields = z.object({
  title: z.string().trim().min(1, "Titel fehlt.").max(160),
  description: z.string().trim().max(4000).nullish(),
  dueAt: z.string().date().nullish(),
  priority: z.enum(["low", "normal", "high"]).optional(),
  assigneeIds: z.array(z.string()).max(30).optional(),
});

const createSchema = taskFields.extend({ departmentId: z.string(), columnId: z.string() });

export async function createBoardTaskAction(
  input: z.input<typeof createSchema>,
): Promise<ProductionActionResult> {
  try {
    const data = createSchema.parse(input);
    const access = await requireBoardAccess(data.departmentId);
    if (!access.canEdit) throw new Error("Du kannst hier nur lesen.");
    const column = await assertColumn(data.departmentId, data.columnId);
    const assignees = await validAssignees(data.departmentId, data.assigneeIds ?? []);
    const last = await prisma.departmentTask.aggregate({
      where: { columnId: column.id },
      _max: { position: true },
    });
    await prisma.departmentTask.create({
      data: {
        departmentId: data.departmentId,
        columnId: column.id,
        status: column.status,
        position: (last._max.position ?? -1) + 1,
        title: data.title,
        description: data.description || null,
        dueAt: data.dueAt ? new Date(`${data.dueAt}T12:00:00`) : null,
        priority: data.priority ?? "normal",
        createdById: access.userId,
        assignments: { create: assignees.map((userId) => ({ userId })) },
      },
    });
    await notifyAssignees(assignees, access.userId, data.title);
    revalidateBoard();
    return actionSuccess();
  } catch (error) {
    return actionFailure(error, "Aufgabe konnte nicht angelegt werden.");
  }
}

const updateSchema = taskFields.extend({ taskId: z.string() });

export async function updateBoardTaskAction(
  input: z.input<typeof updateSchema>,
): Promise<ProductionActionResult> {
  try {
    const data = updateSchema.parse(input);
    const task = await loadTask(data.taskId);
    const access = await requireBoardAccess(task.departmentId);
    if (!access.canEdit) throw new Error("Du kannst hier nur lesen.");
    const assignees = await validAssignees(task.departmentId, data.assigneeIds ?? []);
    const before = await prisma.departmentTaskAssignment.findMany({
      where: { taskId: task.id },
      select: { userId: true },
    });
    await prisma.$transaction([
      prisma.departmentTask.update({
        where: { id: task.id },
        data: {
          title: data.title,
          description: data.description || null,
          dueAt: data.dueAt ? new Date(`${data.dueAt}T12:00:00`) : null,
          priority: data.priority ?? "normal",
        },
      }),
      prisma.departmentTaskAssignment.deleteMany({ where: { taskId: task.id } }),
      prisma.departmentTaskAssignment.createMany({
        data: assignees.map((userId) => ({ taskId: task.id, userId })),
      }),
    ]);
    const added = assignees.filter((id) => !before.some((entry) => entry.userId === id));
    await notifyAssignees(added, access.userId, data.title);
    revalidateBoard();
    return actionSuccess();
  } catch (error) {
    return actionFailure(error, "Aufgabe konnte nicht gespeichert werden.");
  }
}

const moveSchema = z.object({
  taskId: z.string(),
  columnId: z.string(),
  index: z.number().int().min(0),
});

/** Verschiebt eine Aufgabe an eine Stelle einer Spalte und nummeriert die Spalte neu. */
export async function moveBoardTaskAction(
  input: z.input<typeof moveSchema>,
): Promise<ProductionActionResult> {
  try {
    const data = moveSchema.parse(input);
    const task = await loadTask(data.taskId);
    const access = await requireBoardAccess(task.departmentId);
    if (!access.canEdit) throw new Error("Du kannst hier nur lesen.");
    const column = await assertColumn(task.departmentId, data.columnId);
    await prisma.$transaction(async (tx) => {
      const siblings = await tx.departmentTask.findMany({
        where: { columnId: column.id, id: { not: task.id } },
        orderBy: [{ position: "asc" }, { createdAt: "asc" }],
        select: { id: true },
      });
      const ordered = siblings.map((entry) => entry.id);
      ordered.splice(Math.min(data.index, ordered.length), 0, task.id);
      await tx.departmentTask.update({
        where: { id: task.id },
        data: { columnId: column.id, status: column.status },
      });
      for (const [position, id] of ordered.entries()) {
        await tx.departmentTask.update({ where: { id }, data: { position } });
      }
    });
    revalidateBoard();
    return actionSuccess();
  } catch (error) {
    return actionFailure(error, "Aufgabe konnte nicht verschoben werden.");
  }
}

export async function deleteBoardTaskAction(input: {
  taskId: string;
}): Promise<ProductionActionResult> {
  try {
    const task = await loadTask(z.string().parse(input.taskId));
    const access = await requireBoardAccess(task.departmentId);
    if (!access.canManage && !(access.canEdit && task.createdById === access.userId)) {
      throw new Error("Löschen dürfen Leitung und wer die Aufgabe angelegt hat.");
    }
    await prisma.departmentTask.delete({ where: { id: task.id } });
    revalidateBoard();
    return actionSuccess();
  } catch (error) {
    return actionFailure(error, "Aufgabe konnte nicht gelöscht werden.");
  }
}

export async function addBoardTaskCommentAction(input: {
  taskId: string;
  body: string;
}): Promise<ProductionActionResult> {
  try {
    const body = z.string().trim().min(1, "Kommentar ist leer.").max(2000).parse(input.body);
    const task = await loadTask(z.string().parse(input.taskId));
    const access = await requireBoardAccess(task.departmentId);
    if (!access.canEdit) throw new Error("Du kannst hier nur lesen.");
    await prisma.departmentTaskComment.create({
      data: { taskId: task.id, authorId: access.userId, body },
    });
    revalidateBoard();
    return actionSuccess();
  } catch (error) {
    return actionFailure(error, "Kommentar konnte nicht gespeichert werden.");
  }
}

const columnSchema = z.object({
  departmentId: z.string(),
  name: z.string().trim().min(1, "Name fehlt.").max(40),
  status: z.enum(["todo", "doing", "done"]),
});

export async function createBoardColumnAction(
  input: z.input<typeof columnSchema>,
): Promise<ProductionActionResult> {
  try {
    const data = columnSchema.parse(input);
    const access = await requireBoardAccess(data.departmentId);
    if (!access.canManage) throw new Error("Spalten verwaltet die Leitung.");
    const last = await prisma.departmentBoardColumn.aggregate({
      where: { departmentId: data.departmentId },
      _max: { position: true },
    });
    await prisma.departmentBoardColumn.create({
      data: { ...data, position: (last._max.position ?? -1) + 1 },
    });
    revalidateBoard();
    return actionSuccess();
  } catch (error) {
    return actionFailure(error, "Spalte konnte nicht angelegt werden.");
  }
}

const columnUpdateSchema = z.object({
  columnId: z.string(),
  name: z.string().trim().min(1, "Name fehlt.").max(40),
  status: z.enum(["todo", "doing", "done"]),
});

export async function updateBoardColumnAction(
  input: z.input<typeof columnUpdateSchema>,
): Promise<ProductionActionResult> {
  try {
    const data = columnUpdateSchema.parse(input);
    const column = await prisma.departmentBoardColumn.findUnique({
      where: { id: data.columnId },
      select: { departmentId: true },
    });
    if (!column) throw new Error("Spalte wurde nicht gefunden.");
    const access = await requireBoardAccess(column.departmentId);
    if (!access.canManage) throw new Error("Spalten verwaltet die Leitung.");
    await prisma.$transaction([
      prisma.departmentBoardColumn.update({
        where: { id: data.columnId },
        data: { name: data.name, status: data.status },
      }),
      prisma.departmentTask.updateMany({
        where: { columnId: data.columnId },
        data: { status: data.status },
      }),
    ]);
    revalidateBoard();
    return actionSuccess();
  } catch (error) {
    return actionFailure(error, "Spalte konnte nicht gespeichert werden.");
  }
}

/** Verschiebt eine Spalte nach links (-1) oder rechts (+1). */
export async function moveBoardColumnAction(input: {
  columnId: string;
  direction: -1 | 1;
}): Promise<ProductionActionResult> {
  try {
    const column = await prisma.departmentBoardColumn.findUnique({
      where: { id: z.string().parse(input.columnId) },
      select: { id: true, departmentId: true },
    });
    if (!column) throw new Error("Spalte wurde nicht gefunden.");
    const access = await requireBoardAccess(column.departmentId);
    if (!access.canManage) throw new Error("Spalten verwaltet die Leitung.");
    const columns = await prisma.departmentBoardColumn.findMany({
      where: { departmentId: column.departmentId },
      orderBy: { position: "asc" },
      select: { id: true },
    });
    const ids = columns.map((entry) => entry.id);
    const from = ids.indexOf(column.id);
    const to = from + (input.direction === -1 ? -1 : 1);
    if (to < 0 || to >= ids.length) return actionSuccess();
    [ids[from], ids[to]] = [ids[to], ids[from]];
    await prisma.$transaction(
      ids.map((id, position) =>
        prisma.departmentBoardColumn.update({ where: { id }, data: { position } }),
      ),
    );
    revalidateBoard();
    return actionSuccess();
  } catch (error) {
    return actionFailure(error, "Spalte konnte nicht verschoben werden.");
  }
}

/** Löscht eine Spalte; ihre Aufgaben wandern in die erste verbleibende Spalte. */
export async function deleteBoardColumnAction(input: {
  columnId: string;
}): Promise<ProductionActionResult> {
  try {
    const column = await prisma.departmentBoardColumn.findUnique({
      where: { id: z.string().parse(input.columnId) },
      select: { id: true, departmentId: true },
    });
    if (!column) throw new Error("Spalte wurde nicht gefunden.");
    const access = await requireBoardAccess(column.departmentId);
    if (!access.canManage) throw new Error("Spalten verwaltet die Leitung.");
    const target = await prisma.departmentBoardColumn.findFirst({
      where: { departmentId: column.departmentId, id: { not: column.id } },
      orderBy: { position: "asc" },
      select: { id: true, status: true },
    });
    if (!target) throw new Error("Die letzte Spalte kann nicht gelöscht werden.");
    await prisma.$transaction([
      prisma.departmentTask.updateMany({
        where: { columnId: column.id },
        data: { columnId: target.id, status: target.status },
      }),
      prisma.departmentBoardColumn.delete({ where: { id: column.id } }),
    ]);
    revalidateBoard();
    return actionSuccess();
  } catch (error) {
    return actionFailure(error, "Spalte konnte nicht gelöscht werden.");
  }
}
