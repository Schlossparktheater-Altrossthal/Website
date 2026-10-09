import type {
  DepartmentMembershipRole,
  Prisma,
  ProductionObjectKind,
  TaskPriority,
  TaskStatus,
} from "@prisma/client";

import { earliestFor, nextRehearsalByScene } from "@/lib/ausstattung/rehearsals";
import type { HandoverState } from "@/lib/departments/activity-format";
import { HANDOVER_TASK_SELECT, toHandoverState } from "@/lib/departments/handover";
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
  /** Meilenstein im Produktionsplan; ohne eigene Frist gilt dessen Fälligkeit. */
  milestone: BoardMilestone | null;
  assignees: BoardPerson[];
  createdById: string;
  comments: { id: string; body: string; author: string; createdAt: string }[];
  /** Karte eines Ausstattungsstücks (docs/Plan/ausstattung-plan.md). */
  object: BoardObject | null;
  checklist: { done: number; total: number };
  /** Stand für die Übergabe: Nächster Schritt, Achtung, „Ich bin dran“. */
  handover: HandoverState;
  /** Andere haben seit dem letzten Besuch etwas geändert. */
  hasNews: boolean;
};

export type BoardObject = {
  id: string;
  kind: ProductionObjectKind;
  /** Szenennummern, z. B. „1.3“. */
  scenes: string[];
  /** Abgeleitete Frist: nächste Probe einer der Szenen. */
  nextRehearsal: string | null;
};

export type BoardMilestone = {
  id: string;
  title: string;
  dueAt: string | null;
  /** Gewerk des Meilensteins; `null` = ganze Produktion. */
  departmentName: string | null;
  own: boolean;
};

export type BoardColumn = { id: string; name: string; status: TaskStatus; tasks: BoardTask[] };

export type BoardData = {
  departmentId: string;
  /** Hinweise und „Achtung“ darf die angemeldete Person pflegen. */
  canEditNotes: boolean;
  /** Heute als `YYYY-MM-DD` (Europe/Berlin), für „überfällig“. */
  today: string;
  columns: BoardColumn[];
  members: BoardPerson[];
  /** Wählbare Meilensteine der Produktion, die des eigenen Gewerks zuerst. */
  milestones: BoardMilestone[];
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

export async function loadBoard(
  departmentId: string,
  options: { viewerId?: string; since?: Date | null; canEditNotes?: boolean } = {},
): Promise<BoardData> {
  await ensureBoardColumns(departmentId);
  const department = await prisma.department.findUnique({
    where: { id: departmentId },
    select: { showId: true },
  });
  const [columns, tasks, memberships, milestones, news] = await Promise.all([
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
        milestone: { select: { id: true, title: true, dueAt: true } },
        createdById: true,
        assignments: { select: { user: { select: USER_SELECT } } },
        comments: {
          orderBy: { createdAt: "asc" },
          select: { id: true, body: true, createdAt: true, author: { select: USER_SELECT } },
        },
        checklist: { select: { doneAt: true } },
        ...HANDOVER_TASK_SELECT,
        object: {
          select: {
            id: true,
            kind: true,
            scenes: { select: { sceneId: true, scene: { select: { identifier: true } } } },
          },
        },
      },
    }),
    prisma.departmentMembership.findMany({
      where: { departmentId, status: "active", user: { deactivatedAt: null } },
      select: { user: { select: USER_SELECT } },
    }),
    department
      ? prisma.showMilestone.findMany({
          where: { showId: department.showId },
          orderBy: [{ dueAt: { sort: "asc", nulls: "last" } }, { position: "asc" }],
          select: {
            id: true,
            title: true,
            dueAt: true,
            departmentId: true,
            department: { select: { name: true } },
          },
        })
      : Promise.resolve([]),
    options.since && options.viewerId
      ? prisma.taskActivity.findMany({
          where: {
            departmentId,
            taskId: { not: null },
            createdAt: { gt: options.since },
            NOT: { actorId: options.viewerId },
          },
          distinct: ["taskId"],
          select: { taskId: true },
        })
      : Promise.resolve([]),
  ]);
  const newsIds = new Set(news.map((entry) => entry.taskId));

  const rehearsals = await nextRehearsalByScene(
    tasks.flatMap((task) => task.object?.scenes.map((entry) => entry.sceneId) ?? []),
  );
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
      milestone: task.milestone
        ? {
            id: task.milestone.id,
            title: task.milestone.title,
            dueAt: task.milestone.dueAt?.toISOString() ?? null,
            departmentName: null,
            own: true,
          }
        : null,
      createdById: task.createdById,
      assignees: task.assignments.map((entry) => toPerson(entry.user)),
      comments: task.comments.map((comment) => ({
        id: comment.id,
        body: comment.body,
        author: comment.author ? getUserDisplayName(comment.author) : "Gelöschtes Konto",
        createdAt: comment.createdAt.toISOString(),
      })),
      object: task.object
        ? {
            id: task.object.id,
            kind: task.object.kind,
            scenes: task.object.scenes
              .map((entry) => entry.scene.identifier)
              .filter((value): value is string => Boolean(value))
              .sort((a, b) => a.localeCompare(b, "de", { numeric: true })),
            // Fertige Karten brauchen keine Frist mehr.
            nextRehearsal:
              task.status === "done"
                ? null
                : (earliestFor(
                    task.object.scenes.map((entry) => entry.sceneId),
                    rehearsals,
                  )?.toISOString() ?? null),
          }
        : null,
      checklist: {
        done: task.checklist.filter((item) => item.doneAt).length,
        total: task.checklist.length,
      },
      handover: toHandoverState(task),
      hasNews: newsIds.has(task.id),
    });
  }

  return {
    departmentId,
    canEditNotes: options.canEditNotes ?? false,
    today: new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" }),
    columns: board,
    members: memberships
      .map((entry) => toPerson(entry.user))
      .sort((a, b) => a.name.localeCompare(b.name, "de")),
    milestones: [...milestones]
      .sort(
        (a, b) => Number(a.departmentId !== departmentId) - Number(b.departmentId !== departmentId),
      )
      .map((milestone) => ({
        id: milestone.id,
        title: milestone.title,
        dueAt: milestone.dueAt?.toISOString() ?? null,
        departmentName: milestone.department?.name ?? null,
        own: milestone.departmentId === departmentId,
      })),
  };
}
