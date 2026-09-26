import type { Role } from "@prisma/client";

import { getAppBaseUrl } from "@/lib/app-url";
import { loadAudienceContext } from "@/lib/calendar/audience-server";
import { readDayAvailability } from "@/lib/calendar/day-availability";
import {
  buildDeclineMessage,
  findSceneImpacts,
  SHORT_NOTICE_MS,
} from "@/lib/calendar/decline-message";
import {
  DEFAULT_TIME_ZONE,
  formatIsoDateInTimeZone,
  parseDateTimeInTimeZone,
} from "@/lib/date-time";
import { createConfiguredMailSender } from "@/lib/email/send";
import { getUserDisplayName } from "@/lib/names";
import { NOTIFICATION_TYPES } from "@/lib/notifications/types";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { sendNotification } from "@/lib/realtime/triggers";

const PLANNING_PERMISSION = "PRIVATE.REHEARSAL.PLANNING.MANAGE";
const ADMIN_ROLES: Role[] = ["admin", "owner"];

const WHEN = new Intl.DateTimeFormat("de-DE", {
  weekday: "short",
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Berlin",
});

/** Wer die Proben einer Produktion plant (Rollen mit Planungsrecht, geprüft pro Person). */
export async function readRehearsalPlannerIds(showId: string | null) {
  const grants = await prisma.appRolePermission.findMany({
    where: { permission: { key: PLANNING_PERMISSION } },
    select: { role: { select: { id: true, name: true, systemRole: true } } },
  });
  const roleNames = new Set<string>(ADMIN_ROLES);
  for (const { role } of grants) {
    roleNames.add(role.name);
    if (role.systemRole) roleNames.add(role.systemRole);
  }
  const systemRoles = [...roleNames].filter((name): name is Role =>
    ["member", "cast", "tech", "board", "finance", "owner", "admin"].includes(name),
  );
  const candidates = await prisma.user.findMany({
    where: {
      deactivatedAt: null,
      OR: [
        { role: { in: systemRoles } },
        { roles: { some: { role: { in: systemRoles } } } },
        { appRoles: { some: { roleId: { in: grants.map(({ role }) => role.id) } } } },
        ...(showId
          ? [{ productionMemberships: { some: { showId, roles: { hasSome: systemRoles } } } }]
          : []),
      ],
    },
    select: { id: true },
  });
  const allowed = await Promise.all(
    candidates.map(async (user) =>
      (await hasPermission(user, PLANNING_PERMISSION, { showId })) ? user.id : null,
    ),
  );
  return allowed.filter((id): id is string => id !== null);
}

/**
 * Meldet der Planung die Absage einer benötigten Person zu einer angesetzten, kommenden
 * Probe – mit Grund, betroffenen Szenen und möglicher Zweitbesetzung.
 */
export async function notifyPlannersOfDecline({
  eventId,
  userId,
  reason,
  now = new Date(),
}: {
  eventId: string;
  userId: string;
  reason: string | null;
  now?: Date;
}) {
  const event = await prisma.calendarEvent.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      title: true,
      kind: true,
      status: true,
      start: true,
      showId: true,
      createdById: true,
      audienceRules: { where: { type: "SCENE" }, select: { targetId: true } },
      participants: {
        where: { OR: [{ userId }, { response: { in: ["no", "emergency"] } }] },
        select: {
          userId: true,
          invited: true,
          level: true,
          user: { select: { id: true, firstName: true, lastName: true, name: true, email: true } },
        },
      },
    },
  });
  if (!event || event.status !== "SCHEDULED" || event.start <= now) return false;
  const participant = event.participants.find((entry) => entry.userId === userId);
  if (!participant?.invited || participant.level !== "REQUIRED") return false;

  const dateKey = formatIsoDateInTimeZone(event.start.toISOString());
  const [plannerIds, context, availability] = await Promise.all([
    readRehearsalPlannerIds(event.showId),
    loadAudienceContext(event.showId),
    readDayAvailability(dateKey),
  ]);
  const recipients = [...new Set([...plannerIds, event.createdById])].filter(
    (id): id is string => Boolean(id) && id !== userId,
  );
  if (!recipients.length) return false;

  const impacts = findSceneImpacts({
    userId,
    sceneIds: event.audienceRules.flatMap((rule) => (rule.targetId ? [rule.targetId] : [])),
    context,
    availability,
    declinedIds: new Set(event.participants.map((entry) => entry.userId)),
  });
  const shortNotice = event.start.getTime() - now.getTime() < SHORT_NOTICE_MS;
  const { title, body } = buildDeclineMessage({
    personName: getUserDisplayName(participant.user),
    eventTitle: event.title,
    when: WHEN.format(event.start),
    reason,
    shortNotice,
    impacts,
  });

  await prisma.notification.create({
    data: {
      title,
      body,
      type: shortNotice
        ? NOTIFICATION_TYPES.REHEARSAL_EMERGENCY
        : NOTIFICATION_TYPES.REHEARSAL_ATTENDANCE,
      eventId: event.id,
      recipients: { create: recipients.map((id) => ({ userId: id })) },
    },
  });
  await Promise.all(
    recipients.map((id) =>
      sendNotification({
        targetUserId: id,
        title,
        body,
        type: shortNotice ? "error" : "warning",
        metadata: { rehearsalId: event.id },
      }),
    ),
  );

  try {
    const sender = await createConfiguredMailSender();
    if (sender) {
      const people = await prisma.user.findMany({
        where: { id: { in: recipients }, email: { not: null } },
        select: { email: true },
      });
      const link = `${getAppBaseUrl()}/mitglieder/probenplanung/proben/${event.id}`;
      await Promise.all(
        people.flatMap((person) =>
          person.email
            ? [sender({ to: person.email, subject: title, text: `${body}\n\n${link}` })]
            : [],
        ),
      );
    }
  } catch (error) {
    console.error("[decline-notifications] Mail an die Planung fehlgeschlagen", error);
  }
  return true;
}

/**
 * Neue Sperren auf Tagen mit angesetzten Proben, zu denen die Person benötigt wird,
 * wirken wie eine Absage und werden der Planung gemeldet.
 */
export async function notifyPlannersOfNewBlocks(
  userId: string,
  days: { date: Date; reason: string | null }[],
) {
  for (const day of days) {
    const dateKey = day.date.toISOString().slice(0, 10);
    const dayStart = parseDateTimeInTimeZone(dateKey, "00:00", DEFAULT_TIME_ZONE);
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
    const rehearsals = await prisma.calendarEvent.findMany({
      where: {
        kind: "REHEARSAL",
        status: "SCHEDULED",
        start: { gte: dayStart, lt: dayEnd },
        participants: { some: { userId, invited: true, level: "REQUIRED", response: null } },
      },
      select: { id: true },
    });
    for (const rehearsal of rehearsals) {
      await notifyPlannersOfDecline({
        eventId: rehearsal.id,
        userId,
        reason: `Sperre in der Sperrliste eingetragen${day.reason ? ` („${day.reason}“)` : ""}`,
      });
    }
  }
}
