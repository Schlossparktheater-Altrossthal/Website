import { GENERAL_EVENT_WHERE } from "@/lib/calendar/entries";
import { prisma } from "@/lib/prisma";
import {
  currentDepartmentMembershipWhere,
  currentMembershipWhere,
} from "@/lib/produktionen/status";

/** Muss ich hin · Optional · Verein (allgemeine Termine ohne persönliche Einladung). */
export type MyEventGroup = "required" | "optional" | "club";

export type MyEventItem = {
  id: string;
  title: string;
  /** Kurzbezeichnung der Art, z. B. „Probe“ oder der Gewerkname. */
  label: string;
  start: string;
  end: string | null;
  allDay: boolean;
  location: string | null;
  href: string | null;
  group: MyEventGroup;
  /** Warum die Person dabei ist. */
  reasons: string[];
  /** Nur bei eigenen Proben: Absage möglich und ggf. schon abgesagt (mit Grund). */
  decline: { declined: boolean; note: string | null } | null;
};

const TAKE = 30;

/** Kommende Termine einer Person: eigene Proben, Gewerk-Termine und Vereinstermine. */
export async function readMyUpcomingEvents(userId: string, now = new Date()) {
  const [rehearsals, departmentEvents, generalEvents] = await Promise.all([
    prisma.eventParticipant.findMany({
      where: {
        userId,
        invited: true,
        event: { kind: "REHEARSAL", status: "SCHEDULED", start: { gte: now } },
      },
      orderBy: { event: { start: "asc" } },
      take: TAKE,
      select: {
        level: true,
        reasons: true,
        response: true,
        responseNote: true,
        event: {
          select: { id: true, title: true, start: true, end: true, location: true },
        },
      },
    }),
    prisma.calendarEvent.findMany({
      where: {
        start: { gte: now },
        status: "SCHEDULED",
        department: { memberships: { some: { userId, ...currentDepartmentMembershipWhere() } } },
      },
      orderBy: { start: "asc" },
      take: TAKE,
      select: {
        id: true,
        title: true,
        start: true,
        end: true,
        location: true,
        department: {
          select: {
            name: true,
            slug: true,
            memberships: { where: { userId }, select: { role: true } },
          },
        },
      },
    }),
    prisma.calendarEvent.findMany({
      where: {
        ...GENERAL_EVENT_WHERE,
        status: "SCHEDULED",
        OR: [{ start: { gte: now } }, { end: { gte: now } }],
        AND: [
          {
            OR: [
              { showId: null },
              { show: { memberships: { some: { userId, ...currentMembershipWhere(now) } } } },
            ],
          },
        ],
      },
      orderBy: { start: "asc" },
      take: TAKE,
      select: {
        id: true,
        title: true,
        start: true,
        end: true,
        allDay: true,
        location: true,
        show: { select: { title: true, year: true } },
      },
    }),
  ]);

  const items: MyEventItem[] = [
    ...rehearsals.map(({ level, reasons, response, responseNote, event }) => ({
      id: event.id,
      title: event.title,
      label: "Probe",
      start: event.start.toISOString(),
      end: event.end?.toISOString() ?? null,
      allDay: false,
      location: event.location && event.location !== "Noch offen" ? event.location : null,
      href: `/mitglieder/proben/${event.id}`,
      group: level === "OPTIONAL" ? ("optional" as const) : ("required" as const),
      reasons: Array.isArray(reasons) ? reasons.filter((entry) => typeof entry === "string") : [],
      decline: {
        declined: response === "no" || response === "emergency",
        note: responseNote,
      },
    })),
    ...departmentEvents.flatMap((event) => {
      if (!event.department) return [];
      const guest = event.department.memberships[0]?.role === "guest";
      return {
        id: event.id,
        title: event.title,
        label: event.department.name,
        start: event.start.toISOString(),
        end: event.end?.toISOString() ?? null,
        allDay: false,
        location: event.location,
        href: `/mitglieder/meine-gewerke/${event.department.slug}?ansicht=termine`,
        group: guest ? ("optional" as const) : ("required" as const),
        reasons: [
          guest ? `Gast im Gewerk ${event.department.name}` : `Gewerk ${event.department.name}`,
        ],
        decline: null,
      };
    }),
    ...generalEvents.map((event) => ({
      id: event.id,
      title: event.title,
      label: event.show ? (event.show.title ?? String(event.show.year)) : "Verein",
      start: event.start.toISOString(),
      end: event.end?.toISOString() ?? null,
      allDay: event.allDay,
      location: event.location,
      href: null,
      group: "club" as const,
      reasons: [event.show ? "Termin deiner Produktion" : "Termin für alle"],
      decline: null,
    })),
  ];

  return items.sort((a, b) => a.start.localeCompare(b.start));
}
