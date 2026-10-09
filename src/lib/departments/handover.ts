import type {
  DepartmentEditorScope,
  HandoverPushScope,
  Prisma,
  TaskActivityType,
} from "@prisma/client";

import {
  claimActive,
  describeActivity,
  type ActivityEntry,
  type HandoverState,
} from "@/lib/departments/activity-format";
import type { BoardAccess } from "@/lib/departments/board";
import { DEFAULT_TIME_ZONE, parseDateTimeInTimeZone } from "@/lib/date-time";
import { getUserDisplayName } from "@/lib/names";
import { prisma } from "@/lib/prisma";

type Db = Prisma.TransactionClient | typeof prisma;
type Data = Record<string, Prisma.InputJsonValue | null>;

const USER_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  name: true,
  email: true,
} as const;

/** Nach so langer Pause beginnt ein neuer Besuch. */
const VISIT_GAP_MS = 30 * 60 * 1000;

// ---------------------------------------------------------------------------
// Verlauf mitschreiben

/** Verlaufseintrag zu einer Karte (inkl. ihres Ausstattungsstücks). */
export async function logTaskActivity(
  db: Db,
  taskId: string,
  actorId: string | null,
  type: TaskActivityType,
  data?: Data,
) {
  const task = await db.departmentTask.findUnique({
    where: { id: taskId },
    select: { departmentId: true, objectId: true },
  });
  if (!task) return;
  await db.taskActivity.create({
    data: {
      departmentId: task.departmentId,
      taskId,
      objectId: task.objectId,
      actorId,
      type,
      data: data ?? undefined,
    },
  });
}

/** Verlaufseintrag zu einem Ausstattungsstück (inkl. seiner Karte, falls vorhanden). */
export async function logObjectActivity(
  db: Db,
  objectId: string,
  actorId: string | null,
  type: TaskActivityType,
  data?: Data,
) {
  const object = await db.productionObject.findUnique({
    where: { id: objectId },
    select: { departmentId: true, task: { select: { id: true } } },
  });
  if (!object) return;
  await db.taskActivity.create({
    data: {
      departmentId: object.departmentId,
      taskId: object.task?.id ?? null,
      objectId,
      actorId,
      type,
      data: data ?? undefined,
    },
  });
}

const personName = (user: Parameters<typeof getUserDisplayName>[0] | null) =>
  user ? getUserDisplayName(user) : null;

function toEntry(row: {
  id: string;
  type: TaskActivityType;
  data: Prisma.JsonValue;
  createdAt: Date;
  actor: Parameters<typeof getUserDisplayName>[0] | null;
}): ActivityEntry {
  return {
    id: row.id,
    type: row.type,
    actor: personName(row.actor),
    text: describeActivity(row.type, row.data as Record<string, unknown> | null),
    at: row.createdAt.toISOString(),
  };
}

/** Verlauf einer Karte, neueste zuerst. */
export async function loadTaskActivity(taskId: string, take = 50): Promise<ActivityEntry[]> {
  const task = await prisma.departmentTask.findUnique({
    where: { id: taskId },
    select: { objectId: true },
  });
  const rows = await prisma.taskActivity.findMany({
    where: task?.objectId ? { OR: [{ taskId }, { objectId: task.objectId }] } : { taskId },
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      type: true,
      data: true,
      createdAt: true,
      actor: { select: USER_SELECT },
    },
  });
  return rows.map(toEntry);
}

// ---------------------------------------------------------------------------
// Stand einer Karte

export const HANDOVER_TASK_SELECT = {
  nextStep: true,
  nextStepAt: true,
  nextStepBy: { select: USER_SELECT },
  caution: true,
  cautionAt: true,
  cautionBy: { select: USER_SELECT },
  claimedAt: true,
  claimedBy: { select: USER_SELECT },
} as const;

type HandoverRow = Prisma.DepartmentTaskGetPayload<{ select: typeof HANDOVER_TASK_SELECT }>;

export function toHandoverState(row: HandoverRow): HandoverState {
  return {
    nextStep:
      row.nextStep && row.nextStepAt
        ? {
            text: row.nextStep,
            by: personName(row.nextStepBy),
            at: row.nextStepAt.toISOString(),
          }
        : null,
    caution:
      row.caution && row.cautionAt
        ? { text: row.caution, by: personName(row.cautionBy), at: row.cautionAt.toISOString() }
        : null,
    claim:
      row.claimedBy && claimActive(row.claimedAt)
        ? {
            userId: row.claimedBy.id,
            name: getUserDisplayName(row.claimedBy),
            at: row.claimedAt!.toISOString(),
          }
        : null,
  };
}

export async function loadTaskHandover(taskId: string): Promise<HandoverState | null> {
  const row = await prisma.departmentTask.findUnique({
    where: { id: taskId },
    select: HANDOVER_TASK_SELECT,
  });
  return row ? toHandoverState(row) : null;
}

// ---------------------------------------------------------------------------
// Einstellungen und Rechte

export type HandoverSettings = {
  handoverPush: HandoverPushScope;
  noteEditors: DepartmentEditorScope;
};

export async function loadHandoverSettings(departmentId: string): Promise<HandoverSettings> {
  const department = await prisma.department.findUnique({
    where: { id: departmentId },
    select: { handoverPush: true, noteEditors: true },
  });
  return {
    handoverPush: department?.handoverPush ?? "leads",
    noteEditors: department?.noteEditors ?? "all",
  };
}

/** Darf Hinweise und „Achtung“ setzen/erledigen? */
export function canEditNotes(
  access: Pick<BoardAccess, "canEdit" | "canManage">,
  scope: DepartmentEditorScope,
) {
  return scope === "leads" ? access.canManage : access.canEdit;
}

// ---------------------------------------------------------------------------
// Besuche: „Seit deinem letzten Besuch“

/**
 * Merkt den Besuch und liefert den Bezugspunkt für „neu“ (Ende des vorigen Besuchs).
 * Innerhalb von 30 Minuten zählt alles als derselbe Besuch, damit „neu“ beim Umschalten
 * der Ansichten nicht verschwindet.
 */
export async function touchDepartmentVisit(departmentId: string, userId: string) {
  const now = new Date();
  const visit = await prisma.departmentVisit.findUnique({
    where: { departmentId_userId: { departmentId, userId } },
    select: { lastSeenAt: true, previousAt: true },
  });
  if (!visit) {
    await prisma.departmentVisit.create({ data: { departmentId, userId, lastSeenAt: now } });
    return null;
  }
  const newVisit = now.getTime() - visit.lastSeenAt.getTime() > VISIT_GAP_MS;
  const previousAt = newVisit ? visit.lastSeenAt : visit.previousAt;
  await prisma.departmentVisit.update({
    where: { departmentId_userId: { departmentId, userId } },
    data: { lastSeenAt: now, previousAt },
  });
  return previousAt;
}

export type ChangedTask = {
  taskId: string | null;
  objectId: string | null;
  title: string;
  handover: HandoverState | null;
  entries: ActivityEntry[];
};

export type HandoverView = {
  id: string;
  author: string | null;
  at: string;
  note: string | null;
  summary: HandoverSummary;
};

export type HandoverSummary = { taskId: string | null; title: string; lines: string[] }[];

export type NoticeView = { id: string; body: string; author: string | null; at: string };

export type SinceLastVisit = {
  /** `null` = erster Besuch. */
  since: string | null;
  tasks: ChangedTask[];
  handovers: HandoverView[];
};

/** Änderungen anderer seit dem letzten Besuch, gruppiert nach Karte. */
export async function loadSinceLastVisit(
  departmentId: string,
  userId: string,
  since: Date | null,
): Promise<SinceLastVisit> {
  // Erster Besuch: die letzte Woche zeigen, damit Neue sehen, was gerade läuft.
  const from = since ?? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [rows, handovers] = await Promise.all([
    prisma.taskActivity.findMany({
      where: { departmentId, createdAt: { gt: from }, NOT: { actorId: userId } },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        id: true,
        type: true,
        data: true,
        createdAt: true,
        taskId: true,
        objectId: true,
        actor: { select: USER_SELECT },
        task: { select: { title: true, ...HANDOVER_TASK_SELECT } },
        object: { select: { title: true } },
      },
    }),
    prisma.departmentHandover.findMany({
      where: { departmentId, createdAt: { gt: from }, NOT: { authorId: userId } },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        note: true,
        summary: true,
        createdAt: true,
        author: { select: USER_SELECT },
      },
    }),
  ]);

  const groups = new Map<string, ChangedTask>();
  for (const row of rows) {
    const key = row.taskId ?? row.objectId ?? row.id;
    let group = groups.get(key);
    if (!group) {
      group = {
        taskId: row.taskId,
        objectId: row.objectId,
        title: row.task?.title ?? row.object?.title ?? "Karte",
        handover: row.task ? toHandoverState(row.task) : null,
        entries: [],
      };
      groups.set(key, group);
    }
    // Achtung, Nächster Schritt und „dran“ zeigt die Gruppe ohnehin als aktuellen Stand.
    const shownAsState = row.type === "next_step" || row.type === "caution" || row.type === "claim";
    if (!shownAsState && group.entries.length < 6) group.entries.push(toEntry(row));
  }

  return {
    since: since?.toISOString() ?? null,
    tasks: [...groups.values()],
    handovers: handovers.map(toHandoverView),
  };
}

function toHandoverView(row: {
  id: string;
  note: string | null;
  summary: Prisma.JsonValue;
  createdAt: Date;
  author: Parameters<typeof getUserDisplayName>[0] | null;
}): HandoverView {
  return {
    id: row.id,
    author: personName(row.author),
    at: row.createdAt.toISOString(),
    note: row.note,
    summary: Array.isArray(row.summary) ? (row.summary as HandoverSummary) : [],
  };
}

/** Angepinnte, offene Hinweise des Gewerks. */
export async function loadNotices(departmentId: string): Promise<NoticeView[]> {
  const rows = await prisma.departmentNotice.findMany({
    where: { departmentId, resolvedAt: null },
    orderBy: { createdAt: "desc" },
    select: { id: true, body: true, createdAt: true, author: { select: USER_SELECT } },
  });
  return rows.map((row) => ({
    id: row.id,
    body: row.body,
    author: personName(row.author),
    at: row.createdAt.toISOString(),
  }));
}

// ---------------------------------------------------------------------------
// Feierabend / Übergabe

function startOfTodayBerlin(now = new Date()) {
  const day = now.toLocaleDateString("sv-SE", { timeZone: DEFAULT_TIME_ZONE });
  return parseDateTimeInTimeZone(day, "00:00");
}

/** Eigene Arbeit seit Tagesbeginn bzw. seit der letzten eigenen Übergabe, nach Karte. */
export async function buildHandoverSummary(
  departmentId: string,
  userId: string,
): Promise<HandoverSummary> {
  const last = await prisma.departmentHandover.findFirst({
    where: { departmentId, authorId: userId },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  const today = startOfTodayBerlin();
  const from = last && last.createdAt > today ? last.createdAt : today;
  const rows = await prisma.taskActivity.findMany({
    where: { departmentId, actorId: userId, createdAt: { gt: from } },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      type: true,
      data: true,
      taskId: true,
      objectId: true,
      task: { select: { title: true } },
      object: { select: { title: true } },
    },
  });
  const groups = new Map<string, HandoverSummary[number]>();
  for (const row of rows) {
    // Freigeben/Übernehmen ist für die Nächsten kein Arbeitsschritt.
    if (row.type === "claim") continue;
    const key = row.taskId ?? row.objectId ?? row.id;
    let group = groups.get(key);
    if (!group) {
      group = {
        taskId: row.taskId,
        title: row.task?.title ?? row.object?.title ?? "Karte",
        lines: [],
      };
      groups.set(key, group);
    }
    const line = describeActivity(row.type, row.data as Record<string, unknown> | null);
    if (!group.lines.includes(line)) group.lines.push(line);
  }
  return [...groups.values()];
}

/** Empfänger der Push-Nachricht nach Einstellung des Gewerks. */
export async function handoverRecipients(departmentId: string, scope: HandoverPushScope) {
  if (scope === "none") return [];
  const rows = await prisma.departmentMembership.findMany({
    where: {
      departmentId,
      status: "active",
      ...(scope === "leads" ? { role: { in: ["lead", "deputy"] } } : { role: { not: "guest" } }),
    },
    select: { userId: true },
  });
  return rows.map((row) => row.userId);
}
