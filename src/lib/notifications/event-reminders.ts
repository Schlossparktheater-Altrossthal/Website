import { blockDayKey } from "@/lib/calendar/block-list-link";
import { readDayAvailability, type DayAvailability } from "@/lib/calendar/day-availability";
import { prisma } from "@/lib/prisma";
import {
  currentDepartmentMembershipWhere,
  currentMembershipWhere,
} from "@/lib/produktionen/status";

import {
  DEFAULT_REMINDER_LEAD,
  isEventReminderLead,
  reminderLeadMinutes,
  type EventReminderLead,
} from "./preferences";

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
      events.flatMap((event) =>
        !event.departmentId && event.kind !== "REHEARSAL" && event.showId ? [event.showId] : [],
      ),
    ),
  ];
  const needsEveryone = events.some(
    (event) => !event.departmentId && event.kind !== "REHEARSAL" && !event.showId,
  );

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
      } else if (event.kind !== "REHEARSAL") {
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
