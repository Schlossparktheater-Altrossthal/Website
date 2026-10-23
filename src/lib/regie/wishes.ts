import type {
  DirectionWishStatus,
  DirectionWishTargetKind,
  DirectionWishTargetStatus,
  Prisma,
} from "@prisma/client";

import { CALENDAR_PLANNER_PERMISSION } from "@/lib/calendar/permissions";
import { getUserDisplayName } from "@/lib/names";
import { notify } from "@/lib/notifications/notify";
import { NOTIFICATION_TYPES } from "@/lib/notifications/types";
import { findUserIdsWithPermission, hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import {
  currentCastingWhere,
  currentDepartmentMembershipWhere,
  currentMembershipWhere,
} from "@/lib/produktionen/status";
import { getDirectionShows } from "@/lib/regie/access";
import { DIRECTION_HOME_PATH } from "@/lib/regie/paths";
import { formatSceneShort } from "@/lib/produktionen/scenes";

/**
 * Wünsche des Regieteams (docs/Plan/regie-plan.md, Phase 5; docs/Plan/wuensche-plan.md).
 * Ein Wunsch geht an einen oder mehrere Empfänger – Planung, Gewerk, Figur, Person –, jeder mit
 * eigenem Status. `DirectionWish.status` fasst die Empfänger zusammen.
 */

/** Gewerke, deren Mitglieder zum Regieteam gehören. */
export const DIRECTION_TEAM_TEMPLATE_SLUGS = ["regie", "regieassistenz-orga"] as const;

export const WISH_STATUS_LABELS: Record<DirectionWishStatus, string> = {
  open: "offen",
  planned: "in Arbeit",
  done: "erledigt",
  declined: "abgelehnt",
};

export const TARGET_STATUS_LABELS: Record<DirectionWishTargetStatus, string> = {
  open: "offen",
  accepted: "angenommen",
  planned: "eingeplant",
  done: "erledigt",
  declined: "abgelehnt",
};

export const WISH_TEXT_MAX = 2000;
export const WISH_TARGETS_MAX = 20;

export const PLANNER_WISHES_PATH = "/mitglieder/terminplanung/regie-wuensche";
export const RECIPIENT_WISHES_PATH = "/mitglieder/wuensche";

export function wishHref(showId: string, wishId: string) {
  return `${DIRECTION_HOME_PATH}/wuensche?show=${encodeURIComponent(showId)}#wunsch-${wishId}`;
}

const nameSelect = { id: true, firstName: true, lastName: true, name: true } as const;

export type WishTargetInput =
  { kind: "planning" } | { kind: Exclude<DirectionWishTargetKind, "planning">; id: string };

// ---------------------------------------------------------------------------
// Wer darf was

/** Rechte einer Person bezogen auf die Wünsche einer Produktion. */
export type WishViewer = {
  userId: string;
  showId: string;
  direction: boolean;
  planner: boolean;
  /** Gewerk → darf bearbeiten (annehmen/erledigen) bzw. leiten (ablehnen). */
  departments: Map<string, { edit: boolean; lead: boolean }>;
  characterIds: Set<string>;
};

export async function loadWishViewer(userId: string, showId: string): Promise<WishViewer> {
  const [directionShows, planner, memberships, castings, manager] = await Promise.all([
    getDirectionShows(userId),
    canPlanForShow({ id: userId }, showId),
    prisma.departmentMembership.findMany({
      where: { userId, ...currentDepartmentMembershipWhere(), department: { showId } },
      select: { departmentId: true, role: true },
    }),
    prisma.characterCasting.findMany({
      where: { userId, ...currentCastingWhere(), character: { showId } },
      select: { characterId: true },
    }),
    hasPermission({ id: userId }, "PRIVATE.PRODUCTION.SHOW.MANAGE"),
  ]);
  const departments = new Map<string, { edit: boolean; lead: boolean }>();
  for (const membership of memberships) {
    const lead = manager || membership.role === "lead" || membership.role === "deputy";
    departments.set(membership.departmentId, {
      lead,
      edit: lead || membership.role === "member",
    });
  }
  return {
    userId,
    showId,
    direction: directionShows.some((show) => show.id === showId),
    planner,
    departments,
    characterIds: new Set(castings.map((casting) => casting.characterId)),
  };
}

type TargetRef = {
  kind: DirectionWishTargetKind;
  departmentId: string | null;
  characterId: string | null;
  userId: string | null;
};

/** Ist die Person Empfänger dieses Ziels (Planung zählt hier nicht)? */
function isRecipient(viewer: WishViewer, target: TargetRef) {
  if (target.kind === "department") return viewer.departments.has(target.departmentId ?? "");
  if (target.kind === "character") return viewer.characterIds.has(target.characterId ?? "");
  if (target.kind === "user") return target.userId === viewer.userId;
  return false;
}

/** Status, die die Person für dieses Ziel setzen darf. */
export function allowedTargetStatuses(
  viewer: WishViewer,
  target: TargetRef,
): DirectionWishTargetStatus[] {
  const allowed = new Set<DirectionWishTargetStatus>();
  const add = (...statuses: DirectionWishTargetStatus[]) => statuses.forEach((s) => allowed.add(s));
  if (target.kind === "planning") {
    if (viewer.planner) add("open", "planned", "done", "declined");
    // Das Regieteam kann einen Wunsch selbst als erledigt markieren oder wieder öffnen.
    if (viewer.direction) add("open", "done");
  } else if (target.kind === "department") {
    const access = viewer.departments.get(target.departmentId ?? "");
    if (access?.edit) add("open", "accepted", "done");
    // Ablehnen nur die Gewerksleitung (Entscheidung E3).
    if (access?.lead) add("declined");
  } else if (isRecipient(viewer, target)) {
    // Darsteller dürfen auch ablehnen (Entscheidung E4).
    add("open", "accepted", "done", "declined");
  }
  // Das Regieteam darf einen abgelehnten oder erledigten Wunsch erneut stellen.
  if (viewer.direction) add("open");
  return [...allowed];
}

/** Wer einen Wunsch sehen und beantworten darf. */
function canSeeWish(viewer: WishViewer, targets: readonly TargetRef[]) {
  return (
    viewer.direction ||
    targets.some(
      (target) => (target.kind === "planning" && viewer.planner) || isRecipient(viewer, target),
    )
  );
}

/** Rechte der Person für einen Wunsch; `null`, wenn sie ihn nicht sehen darf. */
export async function loadWishAccess(wishId: string, userId: string) {
  const wish = await prisma.directionWish.findUnique({
    where: { id: wishId },
    select: {
      showId: true,
      targets: { select: { kind: true, departmentId: true, characterId: true, userId: true } },
    },
  });
  if (!wish) return null;
  const viewer = await loadWishViewer(userId, wish.showId);
  return canSeeWish(viewer, wish.targets) ? viewer : null;
}

// ---------------------------------------------------------------------------
// Lesen

export type WishTargetView = {
  id: string;
  kind: DirectionWishTargetKind;
  label: string;
  status: DirectionWishTargetStatus;
  reason: string | null;
  statusAt: string | null;
  statusBy: string | null;
  /** Für die angemeldete Person erlaubte Statuswechsel. */
  allowed: DirectionWishTargetStatus[];
  /** Die angemeldete Person gehört zu diesem Empfänger. */
  mine: boolean;
};

export type DirectionWishView = {
  id: string;
  text: string;
  status: DirectionWishStatus;
  author: { id: string; name: string } | null;
  scenes: { id: string; label: string }[];
  people: { id: string; name: string }[];
  dateFrom: string | null;
  dateTo: string | null;
  event: { id: string; title: string; start: string } | null;
  targets: WishTargetView[];
  /** Text bearbeiten: Regieteam. */
  canEdit: boolean;
  createdAt: string;
  updatedAt: string;
  messages: {
    id: string;
    author: string | null;
    authorId: string | null;
    text: string | null;
    status: DirectionWishStatus | null;
    targetStatus: DirectionWishTargetStatus | null;
    targetLabel: string | null;
    createdAt: string;
  }[];
};

const WISH_INCLUDE = {
  author: { select: nameSelect },
  event: { select: { id: true, title: true, start: true } },
  messages: { orderBy: { createdAt: "asc" }, include: { author: { select: nameSelect } } },
  scenes: { include: { scene: { select: { id: true, identifier: true, title: true } } } },
  people: { include: { user: { select: nameSelect } } },
  targets: {
    orderBy: { createdAt: "asc" },
    include: {
      department: { select: { name: true } },
      character: { select: { name: true } },
      user: { select: nameSelect },
      statusBy: { select: nameSelect },
    },
  },
} satisfies Prisma.DirectionWishInclude;

type WishRow = Prisma.DirectionWishGetPayload<{ include: typeof WISH_INCLUDE }>;
type TargetRow = WishRow["targets"][number];

function targetLabel(target: {
  kind: DirectionWishTargetKind;
  department: { name: string } | null;
  character: { name: string } | null;
  user: Parameters<typeof getUserDisplayName>[0] | null;
}) {
  if (target.kind === "planning") return "Planung";
  if (target.kind === "department") return target.department?.name ?? "Gewerk";
  if (target.kind === "character") return target.character?.name ?? "Figur";
  return target.user ? getUserDisplayName(target.user) : "Person";
}

function toView(wish: WishRow, viewer: WishViewer): DirectionWishView {
  return {
    id: wish.id,
    text: wish.text,
    status: wish.status,
    author: wish.author ? { id: wish.author.id, name: getUserDisplayName(wish.author) } : null,
    scenes: wish.scenes.map(({ scene }) => ({
      id: scene.id,
      label: formatSceneShort(scene, "Szene"),
    })),
    people: wish.people.map(({ user }) => ({ id: user.id, name: getUserDisplayName(user) })),
    dateFrom: wish.dateFrom?.toISOString() ?? null,
    dateTo: wish.dateTo?.toISOString() ?? null,
    event: wish.event
      ? { id: wish.event.id, title: wish.event.title, start: wish.event.start.toISOString() }
      : null,
    targets: wish.targets.map((target: TargetRow) => ({
      id: target.id,
      kind: target.kind,
      label: targetLabel(target),
      status: target.status,
      reason: target.reason,
      statusAt: target.statusAt?.toISOString() ?? null,
      statusBy: target.statusBy ? getUserDisplayName(target.statusBy) : null,
      allowed: allowedTargetStatuses(viewer, target).filter((status) => status !== target.status),
      mine: isRecipient(viewer, target) || (target.kind === "planning" && viewer.planner),
    })),
    canEdit: viewer.direction,
    createdAt: wish.createdAt.toISOString(),
    updatedAt: wish.updatedAt.toISOString(),
    messages: wish.messages.map((message) => ({
      id: message.id,
      author: message.author ? getUserDisplayName(message.author) : null,
      authorId: message.authorId,
      text: message.text,
      status: message.status,
      targetStatus: message.targetStatus,
      targetLabel: message.targetLabel,
      createdAt: message.createdAt.toISOString(),
    })),
  };
}

async function loadViews(where: Prisma.DirectionWishWhereInput, viewer: WishViewer) {
  const wishes = await prisma.directionWish.findMany({
    where: { showId: viewer.showId, ...where },
    orderBy: { createdAt: "desc" },
    include: WISH_INCLUDE,
  });
  return wishes
    .filter((wish) => canSeeWish(viewer, wish.targets))
    .map((wish) => toView(wish, viewer));
}

/** Alle Wünsche einer Produktion (Sicht des Regieteams). */
export async function listDirectionWishes(showId: string, userId: string) {
  return loadViews({}, await loadWishViewer(userId, showId));
}

/** Wünsche an die Planung. */
export async function listPlannerWishes(showId: string, userId: string) {
  return loadViews(
    { targets: { some: { kind: "planning" } } },
    await loadWishViewer(userId, showId),
  );
}

/** Wünsche an die Person selbst, ihre Figuren oder ihre Gewerke. */
export async function listRecipientWishes(showId: string, userId: string) {
  const viewer = await loadWishViewer(userId, showId);
  const or: Prisma.DirectionWishTargetWhereInput[] = [{ kind: "user", userId }];
  if (viewer.departments.size) {
    or.push({ kind: "department", departmentId: { in: [...viewer.departments.keys()] } });
  }
  if (viewer.characterIds.size) {
    or.push({ kind: "character", characterId: { in: [...viewer.characterIds] } });
  }
  return loadViews({ targets: { some: { OR: or } } }, viewer);
}

/** Offene Wünsche an die Person (Dashboard). */
export async function countOpenRecipientWishes(showId: string, userId: string) {
  const wishes = await listRecipientWishes(showId, userId);
  return wishes.filter((wish) =>
    wish.targets.some((target) => target.mine && target.status === "open"),
  ).length;
}

/** Offene Wünsche an die Planung – für Hinweise in der Terminplanung. */
export async function countOpenDirectionWishes(showId: string) {
  return prisma.directionWishTarget.count({
    where: { kind: "planning", status: "open", wish: { showId } },
  });
}

export async function canPlanForShow(user: { id?: string }, showId: string) {
  return hasPermission(user, CALENDAR_PLANNER_PERMISSION, { showId });
}

// ---------------------------------------------------------------------------
// Empfänger auflösen

/** Planung der Produktion: alle mit Planungsrecht (global oder in dieser Produktion). */
export async function findShowPlannerIds(showId: string) {
  const [global, members] = await Promise.all([
    findUserIdsWithPermission(CALENDAR_PLANNER_PERMISSION),
    prisma.productionMembership.findMany({
      where: { showId, ...currentMembershipWhere() },
      select: { userId: true },
    }),
  ]);
  const candidates = [...new Set([...global, ...members.map((member) => member.userId)])];
  const allowed = await Promise.all(
    candidates.map(async (id) => ((await canPlanForShow({ id }, showId)) ? id : null)),
  );
  return allowed.filter((id): id is string => Boolean(id));
}

export async function findDirectionTeamIds(showId: string) {
  const memberships = await prisma.departmentMembership.findMany({
    where: {
      ...currentDepartmentMembershipWhere(),
      department: { showId, template: { slug: { in: [...DIRECTION_TEAM_TEMPLATE_SLUGS] } } },
    },
    select: { userId: true },
  });
  return [...new Set(memberships.map((membership) => membership.userId))];
}

async function targetRecipientIds(showId: string, target: TargetRef): Promise<string[]> {
  if (target.kind === "planning") return findShowPlannerIds(showId);
  if (target.kind === "user") return target.userId ? [target.userId] : [];
  if (target.kind === "department") {
    const rows = await prisma.departmentMembership.findMany({
      where: { departmentId: target.departmentId ?? "", ...currentDepartmentMembershipWhere() },
      select: { userId: true },
    });
    return rows.map((row) => row.userId);
  }
  const rows = await prisma.characterCasting.findMany({
    where: { characterId: target.characterId ?? "", ...currentCastingWhere() },
    select: { userId: true },
  });
  return rows.map((row) => row.userId);
}

const snippet = (text: string) => (text.length > 120 ? `${text.slice(0, 117)}…` : text);

/**
 * Benachrichtigt Empfänger, Autor und alle, die im Verlauf geschrieben haben (Entscheidung E5).
 * Jede Person bekommt den Link auf die Seite, von der aus sie handeln kann.
 */
async function notifyWish(
  wishId: string,
  actorId: string,
  title: string,
  body: string,
  { onlyTargetIds }: { onlyTargetIds?: string[] } = {},
) {
  const wish = await prisma.directionWish.findUniqueOrThrow({
    where: { id: wishId },
    select: {
      id: true,
      showId: true,
      authorId: true,
      targets: true,
      messages: { select: { authorId: true } },
    },
  });
  const [team, planners] = await Promise.all([
    findDirectionTeamIds(wish.showId),
    wish.targets.some((target) => target.kind === "planning")
      ? findShowPlannerIds(wish.showId)
      : Promise.resolve([] as string[]),
  ]);
  const targets = onlyTargetIds
    ? wish.targets.filter((target) => onlyTargetIds.includes(target.id))
    : wish.targets;
  const recipients = new Set<string>();
  for (const target of targets) {
    for (const id of await targetRecipientIds(wish.showId, target)) recipients.add(id);
  }
  if (!onlyTargetIds) {
    if (wish.authorId) recipients.add(wish.authorId);
    for (const message of wish.messages) if (message.authorId) recipients.add(message.authorId);
  }
  recipients.delete(actorId);

  const byHref = new Map<string, string[]>();
  for (const id of recipients) {
    const href = team.includes(id)
      ? wishHref(wish.showId, wish.id)
      : planners.includes(id)
        ? `${PLANNER_WISHES_PATH}#wunsch-${wish.id}`
        : `${RECIPIENT_WISHES_PATH}#wunsch-${wish.id}`;
    byHref.set(href, [...(byHref.get(href) ?? []), id]);
  }
  await Promise.all(
    [...byHref].map(([actionUrl, ids]) =>
      notify({
        type: NOTIFICATION_TYPES.DIRECTION_WISH,
        recipients: ids,
        actorId,
        title,
        body,
        actionUrl,
        showId: wish.showId,
      }),
    ),
  );
}

// ---------------------------------------------------------------------------
// Gesamtstatus und Gewerk-Karten

/** Gesamtstatus aus den Empfängern: offen, solange einer offen ist; fertig, wenn alle fertig. */
export function aggregateWishStatus(
  statuses: readonly DirectionWishTargetStatus[],
): DirectionWishStatus {
  if (!statuses.length) return "open";
  if (statuses.every((status) => status === "done" || status === "declined")) {
    return statuses.includes("done") ? "done" : "declined";
  }
  if (statuses.includes("open")) return "open";
  return "planned";
}

export async function refreshWishStatus(tx: Prisma.TransactionClient, wishId: string) {
  const targets = await tx.directionWishTarget.findMany({
    where: { wishId },
    select: { status: true },
  });
  const status = aggregateWishStatus(targets.map((target) => target.status));
  const wish = await tx.directionWish.findUniqueOrThrow({
    where: { id: wishId },
    select: { status: true },
  });
  await tx.directionWish.update({
    where: { id: wishId },
    data: {
      status,
      ...(wish.status !== status ? { statusAt: new Date() } : {}),
      updatedAt: new Date(),
    },
  });
}

const CARD_STATUS: Partial<Record<DirectionWishTargetStatus, "todo" | "doing" | "done">> = {
  open: "todo",
  accepted: "doing",
  done: "done",
};

/** Karte in die erste Spalte mit dem passenden Status schieben (ohne Spalte nur Status). */
async function moveCard(
  tx: Prisma.TransactionClient,
  taskId: string,
  status: "todo" | "doing" | "done",
) {
  const task = await tx.departmentTask.findUnique({
    where: { id: taskId },
    select: { departmentId: true, status: true },
  });
  if (!task || task.status === status) return;
  const column = await tx.departmentBoardColumn.findFirst({
    where: { departmentId: task.departmentId, status },
    orderBy: { position: "asc" },
    select: { id: true },
  });
  const last = column
    ? await tx.departmentTask.aggregate({
        where: { columnId: column.id },
        _max: { position: true },
      })
    : null;
  await tx.departmentTask.update({
    where: { id: taskId },
    data: {
      status,
      ...(column ? { columnId: column.id, position: (last?._max.position ?? -1) + 1 } : {}),
    },
  });
}

async function createWishCard(
  tx: Prisma.TransactionClient,
  departmentId: string,
  wish: { id: string; text: string; dateTo: Date | null },
  authorId: string,
  authorName: string,
) {
  const column = await tx.departmentBoardColumn.findFirst({
    where: { departmentId },
    orderBy: { position: "asc" },
    select: { id: true, status: true },
  });
  const last = column
    ? await tx.departmentTask.aggregate({
        where: { columnId: column.id },
        _max: { position: true },
      })
    : null;
  const card = await tx.departmentTask.create({
    data: {
      departmentId,
      columnId: column?.id ?? null,
      status: column?.status ?? "todo",
      position: (last?._max.position ?? -1) + 1,
      title: wish.text.split("\n")[0].slice(0, 160),
      description: `Wunsch der Regie (${authorName}):\n${wish.text}\n\nAntworten und ablehnen: ${RECIPIENT_WISHES_PATH}#wunsch-${wish.id}`,
      dueAt: wish.dateTo,
      createdById: authorId,
    },
    select: { id: true },
  });
  return card.id;
}

/**
 * Nach Statuswechsel von Gewerk-Karten: die Wunsch-Empfänger nachziehen
 * (Karte „in Arbeit“ ⇒ angenommen, „erledigt“ ⇒ erledigt, „zu tun“ ⇒ offen).
 */
export async function syncWishesFromTasks(
  tx: Prisma.TransactionClient,
  taskIds: readonly string[],
  actorId: string | null,
) {
  if (!taskIds.length) return [];
  const targets = await tx.directionWishTarget.findMany({
    where: { departmentTaskId: { in: [...taskIds] } },
    select: { id: true, wishId: true, status: true, departmentTask: { select: { status: true } } },
  });
  const changed: { wishId: string; targetId: string; status: DirectionWishTargetStatus }[] = [];
  for (const target of targets) {
    const card = target.departmentTask?.status;
    if (!card || target.status === "declined") continue;
    const next: DirectionWishTargetStatus =
      card === "done" ? "done" : card === "doing" ? "accepted" : "open";
    if (next === target.status) continue;
    await tx.directionWishTarget.update({
      where: { id: target.id },
      data: { status: next, statusAt: new Date(), statusById: actorId, reason: null },
    });
    await refreshWishStatus(tx, target.wishId);
    changed.push({ wishId: target.wishId, targetId: target.id, status: next });
  }
  return changed;
}

/** Nach dem Abgleich außerhalb der Transaktion: Beteiligte informieren. */
export async function notifyWishTargetChanges(
  changes: readonly { wishId: string; targetId: string; status: DirectionWishTargetStatus }[],
  actorId: string,
) {
  for (const change of changes) {
    const target = await prisma.directionWishTarget.findUnique({
      where: { id: change.targetId },
      include: {
        wish: { select: { text: true } },
        department: { select: { name: true } },
        character: { select: { name: true } },
        user: { select: nameSelect },
      },
    });
    if (!target) continue;
    await notifyWish(
      change.wishId,
      actorId,
      `${targetLabel(target)}: Wunsch ${TARGET_STATUS_LABELS[change.status]}`,
      snippet(target.wish.text),
    );
  }
}

/**
 * Vor dem Löschen einer Gewerk-Karte: gehört sie zu einem Wunsch, darf nur die Leitung löschen;
 * der Empfänger gilt dann als abgelehnt.
 */
export async function declineWishForDeletedCard(
  tx: Prisma.TransactionClient,
  taskId: string,
  actorId: string,
) {
  const target = await tx.directionWishTarget.findUnique({
    where: { departmentTaskId: taskId },
    select: { id: true, wishId: true, status: true },
  });
  if (!target) return null;
  if (target.status !== "declined" && target.status !== "done") {
    await tx.directionWishTarget.update({
      where: { id: target.id },
      data: {
        status: "declined",
        reason: "Karte im Gewerk-Board gelöscht",
        statusAt: new Date(),
        statusById: actorId,
      },
    });
    await tx.directionWishMessage.create({
      data: {
        wishId: target.wishId,
        authorId: actorId,
        targetStatus: "declined",
        text: "Karte im Gewerk-Board gelöscht",
      },
    });
    await refreshWishStatus(tx, target.wishId);
    return { wishId: target.wishId, targetId: target.id, status: "declined" as const };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Schreiben

export type CreateWishInput = {
  showId: string;
  authorId: string;
  text: string;
  targets: WishTargetInput[];
  sceneIds: string[];
  userIds: string[];
  dateFrom: Date | null;
  dateTo: Date | null;
};

/** Nur Empfänger dieser Produktion übernehmen; doppelte entfernen. */
async function validTargets(showId: string, targets: readonly WishTargetInput[]) {
  const ids = (kind: WishTargetInput["kind"]) => [
    ...new Set(
      targets.flatMap((target) => (target.kind === kind && "id" in target ? [target.id] : [])),
    ),
  ];
  const [departments, characters, users] = await Promise.all([
    prisma.department.findMany({
      where: { showId, archivedAt: null, id: { in: ids("department") } },
      select: { id: true },
    }),
    prisma.character.findMany({
      where: { showId, id: { in: ids("character") } },
      select: { id: true },
    }),
    prisma.productionMembership.findMany({
      where: { showId, userId: { in: ids("user") } },
      select: { userId: true },
    }),
  ]);
  const result: TargetRef[] = [];
  if (targets.some((target) => target.kind === "planning")) {
    result.push({ kind: "planning", departmentId: null, characterId: null, userId: null });
  }
  for (const { id } of departments) {
    result.push({ kind: "department", departmentId: id, characterId: null, userId: null });
  }
  for (const { id } of characters) {
    result.push({ kind: "character", departmentId: null, characterId: id, userId: null });
  }
  for (const { userId } of users) {
    result.push({ kind: "user", departmentId: null, characterId: null, userId });
  }
  return result;
}

export async function createDirectionWish(input: CreateWishInput) {
  const [targets, validScenes, validUsers, author] = await Promise.all([
    validTargets(input.showId, input.targets),
    prisma.scene.findMany({
      where: { showId: input.showId, id: { in: input.sceneIds } },
      select: { id: true },
    }),
    prisma.productionMembership.findMany({
      where: { showId: input.showId, userId: { in: input.userIds } },
      select: { userId: true },
    }),
    prisma.user.findUnique({ where: { id: input.authorId }, select: nameSelect }),
  ]);
  if (!targets.length) throw new Error("Bitte wähle mindestens einen Empfänger.");
  const authorName = author ? getUserDisplayName(author) : "Regie";

  const wishId = await prisma.$transaction(async (tx) => {
    const wish = await tx.directionWish.create({
      data: {
        showId: input.showId,
        authorId: input.authorId,
        text: input.text,
        dateFrom: input.dateFrom,
        dateTo: input.dateTo,
        scenes: { create: validScenes.map((scene) => ({ sceneId: scene.id })) },
        people: {
          create: [...new Set(validUsers.map((u) => u.userId))].map((userId) => ({ userId })),
        },
      },
      select: { id: true, text: true, dateTo: true },
    });
    for (const target of targets) {
      const departmentTaskId =
        target.kind === "department"
          ? await createWishCard(tx, target.departmentId!, wish, input.authorId, authorName)
          : null;
      await tx.directionWishTarget.create({
        data: { wishId: wish.id, ...target, departmentTaskId },
      });
    }
    return wish.id;
  });

  await notifyWish(
    wishId,
    input.authorId,
    `Neuer Wunsch der Regie von ${authorName}`,
    snippet(input.text),
  );
  return wishId;
}

export async function updateDirectionWishText(wishId: string, actorId: string, text: string) {
  const wish = await prisma.directionWish.findUniqueOrThrow({
    where: { id: wishId },
    select: { text: true, targets: { select: { departmentTaskId: true } } },
  });
  if (wish.text === text) return;
  const cards = wish.targets.flatMap((target) => target.departmentTaskId ?? []);
  await prisma.$transaction([
    prisma.directionWish.update({ where: { id: wishId }, data: { text } }),
    prisma.directionWishMessage.create({
      data: { wishId, authorId: actorId, text: `Wunsch geändert. Vorher: „${snippet(wish.text)}“` },
    }),
    ...(cards.length
      ? [
          prisma.departmentTask.updateMany({
            where: { id: { in: cards } },
            data: { title: text.split("\n")[0].slice(0, 160) },
          }),
        ]
      : []),
  ]);
  await notifyWish(wishId, actorId, "Wunsch der Regie geändert", snippet(text));
}

export async function replyToDirectionWish(wishId: string, authorId: string, text: string) {
  const wish = await prisma.directionWish.findUniqueOrThrow({
    where: { id: wishId },
    select: { id: true, text: true },
  });
  await prisma.directionWishMessage.create({ data: { wishId, authorId, text } });
  await prisma.directionWish.update({ where: { id: wishId }, data: { updatedAt: new Date() } });
  const author = await prisma.user.findUnique({ where: { id: authorId }, select: nameSelect });
  await notifyWish(
    wish.id,
    authorId,
    `Antwort zu „${snippet(wish.text).slice(0, 60)}“`,
    `${author ? getUserDisplayName(author) : "Jemand"}: ${snippet(text)}`,
  );
}

/** Lädt Ziel + Rechte der Person; `null`, wenn es das Ziel nicht gibt. */
export async function loadTargetForViewer(targetId: string, userId: string) {
  const target = await prisma.directionWishTarget.findUnique({
    where: { id: targetId },
    include: {
      wish: { select: { id: true, showId: true, text: true } },
      department: { select: { name: true } },
      character: { select: { name: true } },
      user: { select: nameSelect },
    },
  });
  if (!target) return null;
  const viewer = await loadWishViewer(userId, target.wish.showId);
  return { target, allowed: allowedTargetStatuses(viewer, target) };
}

export async function setWishTargetStatus(
  targetId: string,
  actorId: string,
  status: DirectionWishTargetStatus,
  { reason, eventId }: { reason?: string | null; eventId?: string | null } = {},
) {
  const target = await prisma.directionWishTarget.findUniqueOrThrow({
    where: { id: targetId },
    include: {
      wish: { select: { id: true, showId: true, text: true } },
      department: { select: { name: true } },
      character: { select: { name: true } },
      user: { select: nameSelect },
    },
  });
  const label = targetLabel(target);
  const event =
    target.kind === "planning" && status === "planned" && eventId
      ? await prisma.calendarEvent.findFirst({
          where: { id: eventId, showId: target.wish.showId },
          select: { id: true, title: true, start: true },
        })
      : null;
  const cleanReason = reason?.trim() || null;

  await prisma.$transaction(async (tx) => {
    await tx.directionWishTarget.update({
      where: { id: targetId },
      data: {
        status,
        statusAt: new Date(),
        statusById: actorId,
        reason: status === "declined" ? cleanReason : null,
      },
    });
    if (target.kind === "planning" && (status === "planned" || status === "open")) {
      await tx.directionWish.update({
        where: { id: target.wishId },
        data: { eventId: status === "planned" ? (event?.id ?? null) : null },
      });
    }
    await tx.directionWishMessage.create({
      data: {
        wishId: target.wishId,
        authorId: actorId,
        targetStatus: status,
        targetLabel: label,
        text: cleanReason,
      },
    });
    if (target.departmentTaskId) {
      if (status === "declined") {
        await tx.departmentTask.delete({ where: { id: target.departmentTaskId } });
      } else if (CARD_STATUS[status]) {
        await moveCard(tx, target.departmentTaskId, CARD_STATUS[status]!);
      }
    } else if (target.kind === "department" && status !== "declined") {
      // Nach Ablehnung wieder geöffnet: Karte neu anlegen.
      const wish = await tx.directionWish.findUniqueOrThrow({
        where: { id: target.wishId },
        select: { id: true, text: true, dateTo: true, author: { select: nameSelect } },
      });
      const cardId = await createWishCard(
        tx,
        target.departmentId!,
        wish,
        actorId,
        wish.author ? getUserDisplayName(wish.author) : "Regie",
      );
      await tx.directionWishTarget.update({
        where: { id: targetId },
        data: { departmentTaskId: cardId },
      });
      if (CARD_STATUS[status]) await moveCard(tx, cardId, CARD_STATUS[status]!);
    }
    await refreshWishStatus(tx, target.wishId);
  });

  const when = event
    ? ` (${event.title}, ${event.start.toLocaleDateString("de-DE", { timeZone: "Europe/Berlin" })})`
    : "";
  await notifyWish(
    target.wishId,
    actorId,
    `${label}: Wunsch ${TARGET_STATUS_LABELS[status]}${when}`,
    [snippet(target.wish.text), cleanReason].filter(Boolean).join(" – "),
  );
}

/**
 * Wünsche an die Planung, die bei einem Termin am Tag `dayKey` (yyyy-MM-dd) zu beachten sind:
 * offene ohne Zeitraum oder mit passendem Zeitraum sowie die schon in diesen Termin eingeplanten.
 */
export async function listWishesForEvent(showId: string, eventId: string, dayKey: string) {
  const day = new Date(`${dayKey}T12:00:00.000Z`);
  const wishes = await prisma.directionWish.findMany({
    where: {
      showId,
      targets: { some: { kind: "planning" } },
      OR: [
        { eventId },
        {
          targets: { some: { kind: "planning", status: "open" } },
          AND: [
            { OR: [{ dateFrom: null }, { dateFrom: { lte: day } }] },
            { OR: [{ dateTo: null }, { dateTo: { gte: day } }] },
          ],
        },
      ],
    },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      text: true,
      eventId: true,
      scenes: { select: { scene: { select: { identifier: true, title: true } } } },
    },
  });
  return wishes.map((wish) => ({
    id: wish.id,
    text: wish.text,
    plannedHere: wish.eventId === eventId,
    scenes: wish.scenes.map(({ scene }) => formatSceneShort(scene, "Szene")),
  }));
}
