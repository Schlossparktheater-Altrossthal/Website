import type { DirectionWishStatus } from "@prisma/client";

import { CALENDAR_PLANNER_PERMISSION } from "@/lib/calendar/permissions";
import { getUserDisplayName } from "@/lib/names";
import { notify } from "@/lib/notifications/notify";
import { NOTIFICATION_TYPES } from "@/lib/notifications/types";
import { findUserIdsWithPermission, hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import {
  currentDepartmentMembershipWhere,
  currentMembershipWhere,
} from "@/lib/produktionen/status";
import { DIRECTION_HOME_PATH } from "@/lib/regie/paths";

/**
 * Wünsche des Regieteams an die Probenplanung (docs/Plan/regie-plan.md, Phase 5).
 * Regie und Regieassistenz teilen sich einen Eingang; jeder Wunsch hat einen Verlauf.
 */

/** Gewerke, deren Mitglieder zum Regieteam gehören. */
export const DIRECTION_TEAM_TEMPLATE_SLUGS = ["regie", "regieassistenz-orga"] as const;

export const WISH_STATUS_LABELS: Record<DirectionWishStatus, string> = {
  open: "offen",
  planned: "eingeplant",
  done: "erledigt",
  declined: "abgelehnt",
};

export const WISH_TEXT_MAX = 2000;

export const PLANNER_WISHES_PATH = "/mitglieder/terminplanung/regie-wuensche";

export function wishHref(showId: string, wishId: string) {
  return `${DIRECTION_HOME_PATH}/wuensche?show=${encodeURIComponent(showId)}#wunsch-${wishId}`;
}

const nameSelect = { id: true, firstName: true, lastName: true, name: true } as const;

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
  createdAt: string;
  updatedAt: string;
  messages: {
    id: string;
    author: string | null;
    authorId: string | null;
    text: string | null;
    status: DirectionWishStatus | null;
    createdAt: string;
  }[];
};

export async function listDirectionWishes(showId: string): Promise<DirectionWishView[]> {
  const wishes = await prisma.directionWish.findMany({
    where: { showId },
    orderBy: { createdAt: "desc" },
    include: {
      author: { select: nameSelect },
      event: { select: { id: true, title: true, start: true } },
      messages: { orderBy: { createdAt: "asc" }, include: { author: { select: nameSelect } } },
    },
  });
  const sceneIds = [...new Set(wishes.flatMap((wish) => wish.sceneIds))];
  const userIds = [...new Set(wishes.flatMap((wish) => wish.userIds))];
  const [scenes, users] = await Promise.all([
    sceneIds.length
      ? prisma.scene.findMany({
          where: { id: { in: sceneIds } },
          select: { id: true, identifier: true, title: true },
        })
      : [],
    userIds.length
      ? prisma.user.findMany({ where: { id: { in: userIds } }, select: nameSelect })
      : [],
  ]);
  const sceneById = new Map(
    scenes.map((scene) => [scene.id, scene.identifier ?? scene.title ?? "Szene"]),
  );
  const userById = new Map(users.map((user) => [user.id, getUserDisplayName(user)]));

  return wishes.map((wish) => ({
    id: wish.id,
    text: wish.text,
    status: wish.status,
    author: wish.author ? { id: wish.author.id, name: getUserDisplayName(wish.author) } : null,
    scenes: wish.sceneIds
      .filter((id) => sceneById.has(id))
      .map((id) => ({ id, label: sceneById.get(id)! })),
    people: wish.userIds
      .filter((id) => userById.has(id))
      .map((id) => ({ id, name: userById.get(id)! })),
    dateFrom: wish.dateFrom?.toISOString() ?? null,
    dateTo: wish.dateTo?.toISOString() ?? null,
    event: wish.event
      ? { id: wish.event.id, title: wish.event.title, start: wish.event.start.toISOString() }
      : null,
    createdAt: wish.createdAt.toISOString(),
    updatedAt: wish.updatedAt.toISOString(),
    messages: wish.messages.map((message) => ({
      id: message.id,
      author: message.author ? getUserDisplayName(message.author) : null,
      authorId: message.authorId,
      text: message.text,
      status: message.status,
      createdAt: message.createdAt.toISOString(),
    })),
  }));
}

/** Offene und eingeplante Wünsche – für Hinweise in der Terminplanung. */
export async function countOpenDirectionWishes(showId: string) {
  return prisma.directionWish.count({ where: { showId, status: "open" } });
}

export async function canPlanForShow(user: { id?: string }, showId: string) {
  return hasPermission(user, CALENDAR_PLANNER_PERMISSION, { showId });
}

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

const snippet = (text: string) => (text.length > 120 ? `${text.slice(0, 117)}…` : text);

export type CreateWishInput = {
  showId: string;
  authorId: string;
  text: string;
  sceneIds: string[];
  userIds: string[];
  dateFrom: Date | null;
  dateTo: Date | null;
};

export async function createDirectionWish(input: CreateWishInput) {
  const [validScenes, validUsers] = await Promise.all([
    prisma.scene.findMany({
      where: { showId: input.showId, id: { in: input.sceneIds } },
      select: { id: true },
    }),
    prisma.productionMembership.findMany({
      where: { showId: input.showId, userId: { in: input.userIds } },
      select: { userId: true },
    }),
  ]);
  const wish = await prisma.directionWish.create({
    data: {
      showId: input.showId,
      authorId: input.authorId,
      text: input.text,
      sceneIds: validScenes.map((scene) => scene.id),
      userIds: validUsers.map((user) => user.userId),
      dateFrom: input.dateFrom,
      dateTo: input.dateTo,
    },
    select: { id: true, author: { select: nameSelect } },
  });
  const [planners, team] = await Promise.all([
    findShowPlannerIds(input.showId),
    findDirectionTeamIds(input.showId),
  ]);
  const author = wish.author ? getUserDisplayName(wish.author) : "Regie";
  await Promise.all([
    notify({
      type: NOTIFICATION_TYPES.DIRECTION_WISH,
      recipients: planners,
      actorId: input.authorId,
      title: `Neuer Regie-Wunsch von ${author}`,
      body: snippet(input.text),
      actionUrl: `${PLANNER_WISHES_PATH}#wunsch-${wish.id}`,
      showId: input.showId,
    }),
    // Das übrige Regieteam sieht den gemeinsamen Eingang.
    notify({
      type: NOTIFICATION_TYPES.DIRECTION_WISH,
      recipients: team.filter((id) => !planners.includes(id)),
      actorId: input.authorId,
      title: `${author} hat einen Wunsch an die Planung geschickt`,
      body: snippet(input.text),
      actionUrl: wishHref(input.showId, wish.id),
      showId: input.showId,
    }),
  ]);
  return wish.id;
}

/** Benachrichtigt beide Seiten über eine Antwort oder einen Statuswechsel. */
async function notifyBothSides(
  wish: { id: string; showId: string; text: string },
  actorId: string,
  title: string,
  body: string,
) {
  const [planners, team] = await Promise.all([
    findShowPlannerIds(wish.showId),
    findDirectionTeamIds(wish.showId),
  ]);
  await Promise.all([
    notify({
      type: NOTIFICATION_TYPES.DIRECTION_WISH,
      recipients: team,
      actorId,
      title,
      body,
      actionUrl: wishHref(wish.showId, wish.id),
      showId: wish.showId,
    }),
    notify({
      type: NOTIFICATION_TYPES.DIRECTION_WISH,
      recipients: planners.filter((id) => !team.includes(id)),
      actorId,
      title,
      body,
      actionUrl: `${PLANNER_WISHES_PATH}#wunsch-${wish.id}`,
      showId: wish.showId,
    }),
  ]);
}

export async function replyToDirectionWish(wishId: string, authorId: string, text: string) {
  const wish = await prisma.directionWish.findUniqueOrThrow({
    where: { id: wishId },
    select: { id: true, showId: true, text: true },
  });
  await prisma.directionWishMessage.create({ data: { wishId, authorId, text } });
  await prisma.directionWish.update({ where: { id: wishId }, data: { updatedAt: new Date() } });
  const author = await prisma.user.findUnique({ where: { id: authorId }, select: nameSelect });
  await notifyBothSides(
    wish,
    authorId,
    `Antwort zu „${snippet(wish.text).slice(0, 60)}“`,
    `${author ? getUserDisplayName(author) : "Jemand"}: ${snippet(text)}`,
  );
}

export async function setDirectionWishStatus(
  wishId: string,
  actorId: string,
  status: DirectionWishStatus,
  { reason, eventId }: { reason?: string | null; eventId?: string | null } = {},
) {
  const wish = await prisma.directionWish.findUniqueOrThrow({
    where: { id: wishId },
    select: { id: true, showId: true, text: true },
  });
  const event = eventId
    ? await prisma.calendarEvent.findFirst({
        where: { id: eventId, showId: wish.showId },
        select: { id: true, title: true, start: true },
      })
    : null;
  await prisma.$transaction([
    prisma.directionWish.update({
      where: { id: wishId },
      data: {
        status,
        statusAt: new Date(),
        ...(eventId !== undefined ? { eventId: event?.id ?? null } : {}),
      },
    }),
    prisma.directionWishMessage.create({
      data: { wishId, authorId: actorId, status, text: reason?.trim() || null },
    }),
  ]);
  const when = event
    ? ` (${event.title}, ${event.start.toLocaleDateString("de-DE", { timeZone: "Europe/Berlin" })})`
    : "";
  await notifyBothSides(
    wish,
    actorId,
    `Regie-Wunsch ${WISH_STATUS_LABELS[status]}${when}`,
    [snippet(wish.text), reason?.trim()].filter(Boolean).join(" – "),
  );
}

/**
 * Wünsche, die bei einem Termin am Tag `dayKey` (yyyy-MM-dd) zu beachten sind: offene ohne
 * Zeitraum oder mit passendem Zeitraum sowie die schon in diesen Termin eingeplanten.
 */
export async function listWishesForEvent(showId: string, eventId: string, dayKey: string) {
  const day = new Date(`${dayKey}T12:00:00.000Z`);
  const wishes = await prisma.directionWish.findMany({
    where: {
      showId,
      OR: [
        { eventId },
        {
          status: "open",
          AND: [
            { OR: [{ dateFrom: null }, { dateFrom: { lte: day } }] },
            { OR: [{ dateTo: null }, { dateTo: { gte: day } }] },
          ],
        },
      ],
    },
    orderBy: { createdAt: "asc" },
    select: { id: true, text: true, status: true, eventId: true, sceneIds: true },
  });
  const sceneIds = [...new Set(wishes.flatMap((wish) => wish.sceneIds))];
  const scenes = sceneIds.length
    ? await prisma.scene.findMany({
        where: { id: { in: sceneIds } },
        select: { id: true, identifier: true, title: true },
      })
    : [];
  const label = new Map(scenes.map((s) => [s.id, s.identifier ?? s.title ?? "Szene"]));
  return wishes.map((wish) => ({
    id: wish.id,
    text: wish.text,
    plannedHere: wish.eventId === eventId,
    scenes: wish.sceneIds.map((id) => label.get(id)).filter((v): v is string => Boolean(v)),
  }));
}
