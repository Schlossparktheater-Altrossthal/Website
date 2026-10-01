import { blockDayKey } from "@/lib/calendar/block-list-link";
import { readDayAvailability, type DayAvailability } from "@/lib/calendar/day-availability";
import { DEFAULT_TIME_ZONE } from "@/lib/date-time";
import { prisma } from "@/lib/prisma";
import {
  currentDepartmentMembershipWhere,
  currentMembershipWhere,
} from "@/lib/produktionen/status";

import { notify } from "./notify";
import {
  DEFAULT_REMINDER_LEAD,
  isEventReminderLead,
  reminderLeadMinutes,
  type EventReminderLead,
} from "./preferences";
import { NOTIFICATION_TYPES, categoryForEventKind } from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Vorlauf-Fenster eines Laufs: Termine, die innerhalb dieser Tage beginnen. */
export const REMINDER_WINDOW_DAYS = 7;

/** Antworten, die eine Erinnerung ausschließen: Absage und Notfall-Absage. */
const DECLINED_RESPONSES = new Set(["no", "emergency"]);

export type ReminderInvite = {
  userId: string;
  response: string | null;
  /** Gestaffelte Probe: persönliches Zeitfenster. */
  personalStart: Date | null;
};

/** Ein Termin mit allem, was für die Empfänger-Auswahl nötig ist. */
export type ReminderEvent = {
  id: string;
  title: string;
  kind: string;
  start: Date;
  /** Ganztägig: die Erinnerung nennt dann keine Uhrzeit. */
  allDay: boolean;
  /** Persönliche Einladungen (`EventParticipant.invited`). */
  invites: ReminderInvite[];
  /** Alle, für die der Termin ohne Einladung gilt (Gewerk-Mitglieder, „Für alle"). */
  audienceUserIds: string[];
};

export type ReminderSnapshot = {
  events: ReminderEvent[];
  /** Sperrliste je Termintag (`yyyy-MM-dd`, Europe/Berlin); nur Gesperrte und Eingeschränkte. */
  availabilityByDay: Map<string, DayAvailability>;
  /** Gespeicherte Vorlaufzeit je Nutzer; fehlt ein Eintrag, gilt der Standard. */
  leadByUser: Map<string, EventReminderLead>;
};

export type ReminderCandidate = {
  eventId: string;
  title: string;
  userId: string;
  /** Bezugszeit: persönliche Zeit der gestaffelten Probe, sonst Terminbeginn. */
  referenceAt: Date;
  /** Fälligkeit: Bezugszeit minus Vorlaufzeit. */
  remindAt: Date;
  lead: EventReminderLead;
};

/** Bezugszeitpunkt einer Erinnerung: persönliche Zeit schlägt den Terminbeginn. */
export function resolveReferenceAt(eventStart: Date, personalStart: Date | null): Date {
  return personalStart ?? eventStart;
}

/**
 * Alle zu erinnernden Personen je Termin: beteiligt (nicht abgesagt, kein Notfall), am Termintag
 * nicht gesperrt und mit aktiver Erinnerung (nicht `never`). Wer noch nicht geantwortet hat, ist
 * dabei. „Eingeschränkt" schließt nicht aus, nur „gesperrt".
 */
export function buildReminderCandidates(snapshot: ReminderSnapshot): ReminderCandidate[] {
  const candidates: ReminderCandidate[] = [];
  for (const event of snapshot.events) {
    const declined = new Set(
      event.invites
        .filter((invite) => DECLINED_RESPONSES.has(invite.response ?? ""))
        .map((invite) => invite.userId),
    );
    const recipients = new Map<string, Date | null>();
    for (const userId of event.audienceUserIds) {
      if (!declined.has(userId)) recipients.set(userId, null);
    }
    for (const invite of event.invites) {
      if (DECLINED_RESPONSES.has(invite.response ?? "")) continue;
      // Persönliche Zeit überschreibt die Gruppenzeit.
      recipients.set(invite.userId, invite.personalStart);
    }

    const availability = snapshot.availabilityByDay.get(blockDayKey(event.start));
    for (const [userId, personalStart] of recipients) {
      const lead = snapshot.leadByUser.get(userId) ?? DEFAULT_REMINDER_LEAD;
      const minutes = reminderLeadMinutes(lead);
      if (minutes === null) continue;
      if (availability?.[userId] === "blocked") continue;
      const referenceAt = resolveReferenceAt(event.start, personalStart);
      candidates.push({
        eventId: event.id,
        title: event.title,
        userId,
        referenceAt,
        remindAt: new Date(referenceAt.getTime() - minutes * 60_000),
        lead,
      });
    }
  }
  return candidates;
}

/** Ist die Erinnerung jetzt zu senden? Frühestens zur Fälligkeit, spätestens zum Bezugszeitpunkt. */
export function isReminderDue(candidate: ReminderCandidate, now: Date): boolean {
  return now >= candidate.remindAt && now < candidate.referenceAt;
}

function appendToList(map: Map<string, string[]>, key: string, value: string) {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
}

/**
 * Datenbasis eines Laufs: anstehende, fest angesetzte Termine im Fenster, die Sperrliste ihrer Tage
 * und die gespeicherten Vorlaufzeiten. Vorgemerkte und abgesagte Termine bleiben außen vor.
 */
export async function readReminderSnapshot({
  now,
  windowDays = REMINDER_WINDOW_DAYS,
}: {
  now: Date;
  windowDays?: number;
}): Promise<ReminderSnapshot> {
  const until = new Date(now.getTime() + windowDays * DAY_MS);
  const events = await prisma.calendarEvent.findMany({
    where: { status: "SCHEDULED", start: { gt: now, lte: until } },
    orderBy: { start: "asc" },
    select: {
      id: true,
      title: true,
      kind: true,
      start: true,
      allDay: true,
      showId: true,
      departmentId: true,
      audienceRules: { select: { id: true }, take: 1 },
      participants: {
        where: { invited: true },
        select: { userId: true, response: true, personalStart: true },
      },
    },
  });

  const departmentIds = [
    ...new Set(events.flatMap((event) => (event.departmentId ? [event.departmentId] : []))),
  ];
  const showIds = [
    ...new Set(
      events.flatMap((event) => (!event.departmentId && event.showId ? [event.showId] : [])),
    ),
  ];
  const needsEveryone = events.some((event) => !event.departmentId && !event.showId);

  const departmentMembers = departmentIds.length
    ? await prisma.departmentMembership.findMany({
        where: { departmentId: { in: departmentIds }, ...currentDepartmentMembershipWhere() },
        select: { departmentId: true, userId: true },
      })
    : [];
  const showMembers = showIds.length
    ? await prisma.productionMembership.findMany({
        where: { showId: { in: showIds }, ...currentMembershipWhere(now) },
        select: { showId: true, userId: true },
      })
    : [];
  const everyone = needsEveryone ? await prisma.user.findMany({ select: { id: true } }) : [];

  const membersByDepartment = new Map<string, string[]>();
  for (const entry of departmentMembers) {
    appendToList(membersByDepartment, entry.departmentId, entry.userId);
  }
  const membersByShow = new Map<string, string[]>();
  for (const entry of showMembers) {
    appendToList(membersByShow, entry.showId, entry.userId);
  }

  const reminderEvents: ReminderEvent[] = events.map((event) => {
    // Mit Einladungen oder Zielgruppe gelten nur die Eingeladenen, sonst die ganze Gruppe.
    const restricted = event.audienceRules.length > 0 || event.participants.length > 0;
    let audienceUserIds: string[] = [];
    if (!restricted) {
      if (event.departmentId) {
        audienceUserIds = membersByDepartment.get(event.departmentId) ?? [];
      } else {
        audienceUserIds = event.showId
          ? (membersByShow.get(event.showId) ?? [])
          : everyone.map((user) => user.id);
      }
    }
    return {
      id: event.id,
      title: event.title,
      kind: event.kind,
      start: event.start,
      allDay: event.allDay,
      invites: event.participants.map((participant) => ({
        userId: participant.userId,
        response: participant.response,
        personalStart: participant.personalStart,
      })),
      audienceUserIds,
    };
  });

  const dayKeys = [...new Set(reminderEvents.map((event) => blockDayKey(event.start)))];
  const availabilityByDay = new Map<string, DayAvailability>();
  for (const dayKey of dayKeys) {
    availabilityByDay.set(dayKey, await readDayAvailability(dayKey));
  }

  const userIds = [
    ...new Set(
      reminderEvents.flatMap((event) => [
        ...event.invites.map((invite) => invite.userId),
        ...event.audienceUserIds,
      ]),
    ),
  ];
  const settings = userIds.length
    ? await prisma.notificationSettings.findMany({
        where: { userId: { in: userIds } },
        select: { userId: true, reminderLead: true },
      })
    : [];
  const leadByUser = new Map<string, EventReminderLead>();
  for (const setting of settings) {
    if (isEventReminderLead(setting.reminderLead)) {
      leadByUser.set(setting.userId, setting.reminderLead);
    }
  }

  return { events: reminderEvents, availabilityByDay, leadByUser };
}

/** Schlüssel eines Versand-Eintrags. */
export function dispatchKey(eventId: string, userId: string) {
  return `${eventId}|${userId}`;
}

export type ReminderDispatchSummary = {
  /** Neu zugestellte Erinnerungen (je Termin und Person). */
  sent: number;
  /** Bereits früher zugestellt. */
  skipped: number;
  /** Nicht zugestellt; der nächste Lauf versucht es erneut. */
  failed: number;
};

const reminderDayFormat = new Intl.DateTimeFormat("de-DE", {
  weekday: "short",
  day: "2-digit",
  month: "2-digit",
  timeZone: DEFAULT_TIME_ZONE,
});

const reminderClockFormat = new Intl.DateTimeFormat("de-DE", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: DEFAULT_TIME_ZONE,
});

/** Text der Erinnerung: Bezugszeit des Termins, ohne Uhrzeit bei ganztägigen Terminen. */
export function buildReminderBody(referenceAt: Date, allDay: boolean) {
  const day = reminderDayFormat.format(referenceAt);
  if (allDay) return `Beginnt am ${day}.`;
  return `Beginnt am ${day}, ${reminderClockFormat.format(referenceAt)} Uhr.`;
}

/**
 * Sendet alle fälligen Erinnerungen und protokolliert sie in `EventReminderDispatch`. Der Lauf ist
 * idempotent: Wer schon protokolliert ist, wird nicht erneut angeschrieben. Das setzt voraus, dass
 * sich zwei Läufe nicht überlappen – ein CronJob läuft nacheinander.
 */
export async function dispatchEventReminders({
  now = new Date(),
}: { now?: Date } = {}): Promise<ReminderDispatchSummary> {
  const snapshot = await readReminderSnapshot({ now });
  const due = buildReminderCandidates(snapshot).filter((candidate) =>
    isReminderDue(candidate, now),
  );
  if (!due.length) return { sent: 0, skipped: 0, failed: 0 };

  const existing = await prisma.eventReminderDispatch.findMany({
    where: {
      eventId: { in: [...new Set(due.map((candidate) => candidate.eventId))] },
      userId: { in: [...new Set(due.map((candidate) => candidate.userId))] },
    },
    select: { eventId: true, userId: true },
  });
  const dispatched = new Set(existing.map((row) => dispatchKey(row.eventId, row.userId)));
  const pending = due.filter(
    (candidate) => !dispatched.has(dispatchKey(candidate.eventId, candidate.userId)),
  );
  const skipped = due.length - pending.length;

  if (pending.length) {
    await prisma.eventReminderDispatch.createMany({
      data: pending.map((candidate) => ({
        eventId: candidate.eventId,
        userId: candidate.userId,
        lead: candidate.lead,
      })),
      skipDuplicates: true,
    });
  }

  // Je Termin und Bezugszeit eine Nachricht: bei gestaffelten Proben hat jede Person ihre eigene.
  const eventById = new Map(snapshot.events.map((event) => [event.id, event]));
  const groups = new Map<string, { eventId: string; referenceAt: Date; userIds: string[] }>();
  for (const candidate of pending) {
    const key = `${candidate.eventId}|${candidate.referenceAt.getTime()}`;
    const group = groups.get(key);
    if (group) group.userIds.push(candidate.userId);
    else {
      groups.set(key, {
        eventId: candidate.eventId,
        referenceAt: candidate.referenceAt,
        userIds: [candidate.userId],
      });
    }
  }

  let sent = 0;
  let failed = 0;
  for (const group of groups.values()) {
    const event = eventById.get(group.eventId);
    if (!event) continue;
    try {
      await notify({
        type: NOTIFICATION_TYPES.EVENT_REMINDER,
        recipients: group.userIds,
        title: `Erinnerung: ${event.title}`,
        body: buildReminderBody(group.referenceAt, event.allDay),
        eventId: event.id,
        category: categoryForEventKind(event.kind),
        groupKey: `reminder:${event.id}`,
      });
      sent += group.userIds.length;
    } catch (error) {
      console.error("[event-reminders] Versand fehlgeschlagen", { eventId: group.eventId }, error);
      failed += group.userIds.length;
      // Protokoll zurücknehmen, damit der nächste Lauf es erneut versucht.
      await prisma.eventReminderDispatch.deleteMany({
        where: { eventId: group.eventId, userId: { in: group.userIds } },
      });
    }
  }

  return { sent, skipped, failed };
}
