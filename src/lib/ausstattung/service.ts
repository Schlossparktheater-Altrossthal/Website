import type {
  Prisma,
  ProductionObjectKind,
  ProductionObjectStatus,
  TaskStatus,
} from "@prisma/client";

import { OBJECT_STATUS_FOR_TASK, TASK_STATUS_FOR_OBJECT } from "@/lib/ausstattung/constants";
import { ensureBoardColumns, requireBoardAccess } from "@/lib/departments/board";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";

type Db = Prisma.TransactionClient | typeof prisma;

export const REQUIREMENT_CREATE_PERMISSION = "PRIVATE.PRODUCTION.REQUIREMENT.CREATE";

/** Darf die angemeldete Person in Szenen Ausstattung anfordern (Regie/Planung)? */
export async function requireRequirementCreator() {
  const session = await requireAuth();
  const userId = session.user?.id;
  if (!userId || !(await hasPermission(session.user, REQUIREMENT_CREATE_PERMISSION))) {
    throw new Error("Anfordern dürfen Regie und Planung.");
  }
  return { userId };
}

/** Objekt laden und Board-Rechte im zuständigen Gewerk prüfen. */
export async function requireObjectAccess(objectId: string, mode: "view" | "edit" = "edit") {
  const object = await prisma.productionObject.findUnique({
    where: { id: objectId },
    select: { id: true, showId: true, departmentId: true, title: true, kind: true, status: true },
  });
  if (!object) throw new Error("Objekt wurde nicht gefunden.");
  const access = await requireBoardAccess(object.departmentId);
  if (mode === "edit" && !access.canEdit) throw new Error("Du kannst hier nur lesen.");
  return { object, access };
}

async function firstColumn(db: Db, departmentId: string, status: TaskStatus) {
  await ensureBoardColumns(departmentId, db);
  const column =
    (await db.departmentBoardColumn.findFirst({
      where: { departmentId, status },
      orderBy: { position: "asc" },
      select: { id: true, status: true },
    })) ??
    (await db.departmentBoardColumn.findFirst({
      where: { departmentId },
      orderBy: { position: "asc" },
      select: { id: true, status: true },
    }));
  return column;
}

async function appendPosition(db: Db, columnId: string | null) {
  if (!columnId) return 0;
  const last = await db.departmentTask.aggregate({
    where: { columnId },
    _max: { position: true },
  });
  return (last._max.position ?? -1) + 1;
}

export type NewObjectInput = {
  showId: string;
  departmentId: string;
  kind: ProductionObjectKind;
  title: string;
  description?: string | null;
  createdById: string;
  sceneIds?: string[];
  characterIds?: string[];
};

/** Legt ein Objekt mit seiner Board-Karte an (eine Karte je Objekt). */
export async function createObjectWithCard(db: Db, input: NewObjectInput) {
  const sceneIds = await validSceneIds(db, input.showId, input.sceneIds ?? []);
  const characterIds = await validCharacterIds(db, input.showId, input.characterIds ?? []);
  const object = await db.productionObject.create({
    data: {
      showId: input.showId,
      departmentId: input.departmentId,
      kind: input.kind,
      title: input.title,
      description: input.description || null,
      createdById: input.createdById,
      scenes: { create: sceneIds.map((sceneId) => ({ sceneId })) },
      characters: { create: characterIds.map((characterId) => ({ characterId })) },
    },
    select: { id: true, title: true, departmentId: true },
  });
  await ensureObjectCard(db, object.id, input.createdById);
  return object;
}

/** Karte für ein Objekt anlegen, falls es (z. B. nach der Datenübernahme) noch keine hat. */
export async function ensureObjectCard(db: Db, objectId: string, userId: string) {
  const object = await db.productionObject.findUnique({
    where: { id: objectId },
    select: {
      id: true,
      title: true,
      departmentId: true,
      status: true,
      task: { select: { id: true } },
    },
  });
  if (!object || object.task) return object?.task?.id ?? null;
  const status = TASK_STATUS_FOR_OBJECT[object.status];
  const column = await firstColumn(db, object.departmentId, status);
  const task = await db.departmentTask.create({
    data: {
      departmentId: object.departmentId,
      columnId: column?.id ?? null,
      status: column?.status ?? status,
      position: await appendPosition(db, column?.id ?? null),
      title: object.title,
      createdById: userId,
      objectId: object.id,
    },
    select: { id: true },
  });
  return task.id;
}

/** Objekt-Status setzen und die Karte in die erste passende Spalte schieben. */
export async function setObjectStatus(db: Db, objectId: string, status: ProductionObjectStatus) {
  const object = await db.productionObject.update({
    where: { id: objectId },
    data: { status },
    select: { departmentId: true, task: { select: { id: true, status: true } } },
  });
  const taskStatus = TASK_STATUS_FOR_OBJECT[status];
  if (!object.task || object.task.status === taskStatus) return;
  const column = await firstColumn(db, object.departmentId, taskStatus);
  await db.departmentTask.update({
    where: { id: object.task.id },
    data: {
      status: taskStatus,
      columnId: column?.id ?? null,
      position: await appendPosition(db, column?.id ?? null),
    },
  });
}

/** Nach dem Verschieben einer Karte: Status des Objekts nachziehen. */
export async function syncObjectFromTask(db: Db, taskId: string) {
  const task = await db.departmentTask.findUnique({
    where: { id: taskId },
    select: { status: true, objectId: true },
  });
  if (!task?.objectId) return;
  await db.productionObject.update({
    where: { id: task.objectId },
    data: { status: OBJECT_STATUS_FOR_TASK[task.status] },
  });
}

export async function validSceneIds(db: Db, showId: string, ids: string[]) {
  if (!ids.length) return [];
  const rows = await db.scene.findMany({
    where: { showId, id: { in: [...new Set(ids)] } },
    select: { id: true },
  });
  return rows.map((row) => row.id);
}

export async function validCharacterIds(db: Db, showId: string, ids: string[]) {
  if (!ids.length) return [];
  const rows = await db.character.findMany({
    where: { showId, id: { in: [...new Set(ids)] } },
    select: { id: true },
  });
  return rows.map((row) => row.id);
}

/**
 * Ausstattung einer Produktion ansehen: Regie/Board, wer anfordern darf, und Mitglieder
 * eines Gewerks der Produktion.
 */
export async function canViewShowObjects(showId: string) {
  const session = await requireAuth();
  const userId = session.user?.id;
  if (!userId) return false;
  if (
    (await hasPermission(session.user, "PRIVATE.PRODUCTION.SHOW.MANAGE")) ||
    (await hasPermission(session.user, REQUIREMENT_CREATE_PERMISSION))
  ) {
    return true;
  }
  const membership = await prisma.departmentMembership.findFirst({
    where: { userId, status: "active", department: { showId } },
    select: { id: true },
  });
  return Boolean(membership);
}
