import type { DepartmentMembershipRole, Prisma, TaskPriority, TaskStatus } from "@prisma/client";

import { getNameInitials, getUserDisplayName } from "@/lib/names";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";

type DbClient = Prisma.TransactionClient | typeof prisma;

export const DEFAULT_BOARD_COLUMNS: { name: string; status: TaskStatus }[] = [
  { name: "Offen", status: "todo" },
  { name: "In Arbeit", status: "doing" },
  { name: "Review", status: "doing" },
  { name: "Erledigt", status: "done" },
];

/** Legt die Standardspalten an, falls ein Gewerk noch keine hat. */
export async function ensureBoardColumns(departmentId: string, db: DbClient = prisma) {
  const count = await db.departmentBoardColumn.count({ where: { departmentId } });
  if (count > 0) return;
  await db.departmentBoardColumn.createMany({
    data: DEFAULT_BOARD_COLUMNS.map((column, position) => ({ departmentId, position, ...column })),
  });
}

export type BoardAccess = {
  userId: string;
  departmentId: string;
  role: DepartmentMembershipRole | null;
  /** Aufgaben anlegen, bearbeiten, verschieben, kommentieren. */
  canEdit: boolean;
  /** Spalten verwalten und fremde Aufgaben löschen. */
  canManage: boolean;
};

/** Rechte der angemeldeten Person im Board eines Gewerks. Wirft, wenn sie es nicht sehen darf. */
export async function requireBoardAccess(departmentId: string): Promise<BoardAccess> {
  const session = await requireAuth();
  const userId = session.user?.id;
  if (!userId) throw new Error("Nicht angemeldet.");
  const [department, membership, isManager] = await Promise.all([
    prisma.department.findUnique({ where: { id: departmentId }, select: { archivedAt: true } }),
    prisma.departmentMembership.findFirst({
      where: { departmentId, userId, status: "active" },
      select: { role: true },
    }),
    hasPermission(session.user, "PRIVATE.PRODUCTION.SHOW.MANAGE"),
  ]);
  if (!department || department.archivedAt) throw new Error("Gewerk wurde nicht gefunden.");
  const role = membership?.role ?? null;
  if (!role && !isManager) throw new Error("Kein Zugriff auf dieses Gewerk.");
  const canManage = isManager || role === "lead" || role === "deputy";
  return { userId, departmentId, role, canEdit: canManage || role === "member", canManage };
}

export type BoardPerson = { id: string; name: string; initials: string };

export type BoardTask = {
  id: string;
  columnId: string;
  title: string;
  description: string | null;
  priority: TaskPriority;
  dueAt: string | null;
  assignees: BoardPerson[];
  createdById: string;
  comments: { id: string; body: string; author: string; createdAt: string }[];
};

export type BoardColumn = { id: string; name: string; status: TaskStatus; tasks: BoardTask[] };

export type BoardData = {
  departmentId: string;
  /** Heute als `YYYY-MM-DD` (Europe/Berlin), für „überfällig“. */
  today: string;
  columns: BoardColumn[];
  members: BoardPerson[];
};

const toPerson = (user: {
  id: string;
  firstName: string | null;
  lastName: string | null;
  name: string | null;
  email: string | null;
}): BoardPerson => ({
  id: user.id,
  name: getUserDisplayName(user),
  initials: getNameInitials(user),
});

const USER_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  name: true,
  email: true,
} as const;

export async function loadBoard(departmentId: string): Promise<BoardData> {
  await ensureBoardColumns(departmentId);
  const [columns, tasks, memberships] = await Promise.all([
    prisma.departmentBoardColumn.findMany({
      where: { departmentId },
      orderBy: { position: "asc" },
      select: { id: true, name: true, status: true },
    }),
    prisma.departmentTask.findMany({
      where: { departmentId },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        columnId: true,
        status: true,
        title: true,
        description: true,
        priority: true,
        dueAt: true,
        createdById: true,
        assignments: { select: { user: { select: USER_SELECT } } },
        comments: {
          orderBy: { createdAt: "asc" },
          select: { id: true, body: true, createdAt: true, author: { select: USER_SELECT } },
        },
      },
    }),
    prisma.departmentMembership.findMany({
      where: { departmentId, status: "active", user: { deactivatedAt: null } },
      select: { user: { select: USER_SELECT } },
    }),
  ]);

  const columnIds = new Set(columns.map((column) => column.id));
  // Aufgaben ohne (gültige) Spalte landen in der ersten Spalte mit passendem Status.
  const fallback = (status: TaskStatus) =>
    columns.find((column) => column.status === status)?.id ?? columns[0]?.id ?? "";

  const board: BoardColumn[] = columns.map((column) => ({ ...column, tasks: [] }));
  const byId = new Map(board.map((column) => [column.id, column]));
  for (const task of tasks) {
    const columnId =
      task.columnId && columnIds.has(task.columnId) ? task.columnId : fallback(task.status);
    byId.get(columnId)?.tasks.push({
      id: task.id,
      columnId,
      title: task.title,
      description: task.description,
      priority: task.priority,
      dueAt: task.dueAt?.toISOString() ?? null,
      createdById: task.createdById,
      assignees: task.assignments.map((entry) => toPerson(entry.user)),
      comments: task.comments.map((comment) => ({
        id: comment.id,
        body: comment.body,
        author: comment.author ? getUserDisplayName(comment.author) : "Gelöschtes Konto",
        createdAt: comment.createdAt.toISOString(),
      })),
    });
  }

  return {
    departmentId,
    today: new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" }),
    columns: board,
    members: memberships
      .map((entry) => toPerson(entry.user))
      .sort((a, b) => a.name.localeCompare(b.name, "de")),
  };
}
