import { notFound } from "next/navigation";
import {
  addDays,
  addMonths,
  differenceInYears,
  formatDistanceToNowStrict,
  startOfDay,
  subMonths,
} from "date-fns";
import { de } from "date-fns/locale/de";

import { PageHeader } from "@/components/members/page-header";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { requireAuth } from "@/lib/rbac";
import { membersNavigationBreadcrumb } from "@/lib/members-breadcrumbs";

import { CalendarClient } from "./calendar-client";
import type {
  MemberCalendarEvent,
  MemberCalendarSource,
  MemberCalendarSummaryItem,
} from "./types";

const DEFAULT_REHEARSAL_COLOR = "#6366F1";
const DEFAULT_BLOCKED_COLOR = "#F97316";
const TASK_DEADLINE_COLOR = "#EAB308";
const BIRTHDAY_COLOR = "#EC4899";
const FALLBACK_DEPARTMENT_COLORS = [
  "#0EA5E9",
  "#8B5CF6",
  "#10B981",
  "#F97316",
  "#F59E0B",
];
const CALENDAR_LOOKBACK_MONTHS = 3;
const CALENDAR_LOOKAHEAD_MONTHS = 6;
const TASK_DUE_SOON_THRESHOLD_DAYS = 3;

const ATTENDANCE_LABELS: Record<string, string> = {
  yes: "Zusage",
  no: "Absage",
  maybe: "Unentschieden",
  emergency: "Notfall",
};

function formatAttendance(value: string | null | undefined) {
  if (!value) return null;
  return ATTENDANCE_LABELS[value] ?? value;
}

function formatMemberName(firstName: string | null | undefined, lastName: string | null | undefined) {
  const parts = [firstName?.trim(), lastName?.trim()].filter((value) => Boolean(value)) as string[];
  if (parts.length === 0) {
    return "Mitglied";
  }
  return parts.join(" ");
}

function createBirthdayOccurrence(dateOfBirth: Date, year: number) {
  const month = dateOfBirth.getMonth();
  const occurrence = new Date(dateOfBirth);
  occurrence.setFullYear(year, month, dateOfBirth.getDate());
  occurrence.setHours(0, 0, 0, 0);

  if (occurrence.getMonth() !== month) {
    occurrence.setDate(occurrence.getDate() - 1);
    occurrence.setHours(0, 0, 0, 0);
  }

  return occurrence;
}

function isAllDayDate(date: Date) {
  return (
    date.getHours() === 0 &&
    date.getMinutes() === 0 &&
    date.getSeconds() === 0 &&
    date.getMilliseconds() === 0
  );
}

export const dynamic = "force-dynamic";

export default async function MitgliederKalenderPage() {
  const session = await requireAuth();
  const allowed = await hasPermission(session.user, "mitglieder.kalender");
  if (!allowed) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
        Kein Zugriff auf den persönlichen Kalender.
      </div>
    );
  }

  const userId = session.user?.id;
  if (!userId) {
    notFound();
  }

  const now = new Date();
  const rangeStart = startOfDay(subMonths(now, CALENDAR_LOOKBACK_MONTHS));
  const rangeEnd = startOfDay(addMonths(now, CALENDAR_LOOKAHEAD_MONTHS));

  const memberships = await prisma.departmentMembership.findMany({
    where: { userId },
    include: {
      department: { select: { id: true, name: true, color: true } },
    },
  });

  const departmentIds = memberships.map((entry) => entry.departmentId);

  const departmentEvents = departmentIds.length
    ? await prisma.departmentEvent.findMany({
        where: {
          departmentId: { in: departmentIds },
          start: { gte: rangeStart, lte: rangeEnd },
        },
        include: {
          department: { select: { id: true, name: true, color: true } },
        },
        orderBy: { start: "asc" },
      })
    : [];

  const [rehearsals, blockedDays, birthdayMembers, taskAssignments] = await Promise.all([
    prisma.rehearsal.findMany({
      where: {
        status: { not: "DRAFT" },
        start: { gte: rangeStart, lte: rangeEnd },
        OR: [
          { attendance: { some: { userId } } },
          { invitees: { some: { userId } } },
        ],
      },
      include: {
        attendance: {
          where: { userId },
          select: { status: true },
        },
      },
      orderBy: { start: "asc" },
    }),
    prisma.blockedDay.findMany({
      where: {
        userId,
        date: { gte: rangeStart, lte: rangeEnd },
      },
      orderBy: { date: "asc" },
    }),
    prisma.user.findMany({
      where: {
        dateOfBirth: { not: null },
        deactivatedAt: null,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        dateOfBirth: true,
      },
    }),
    prisma.departmentTaskAssignment.findMany({
      where: {
        userId,
        task: {
          status: { not: "done" },
          dueAt: { not: null, gte: rangeStart, lte: rangeEnd },
        },
      },
      include: {
        task: {
          include: {
            department: { select: { id: true, name: true } },
          },
        },
      },
    }),
  ]);

  const calendarSources: MemberCalendarSource[] = [];
  const calendarEvents: MemberCalendarEvent[] = [];
  const birthdayOccurrences: { id: string; date: Date; age: number; name: string }[] = [];

  type AssignmentWithDueDate = (typeof taskAssignments)[number] & {
    task: (typeof taskAssignments)[number]["task"] & { dueAt: Date };
  };

  const tasksWithDueDates: AssignmentWithDueDate[] = taskAssignments.filter(
    (assignment): assignment is AssignmentWithDueDate => Boolean(assignment.task.dueAt),
  );

  const dueSoonThreshold = addDays(now, TASK_DUE_SOON_THRESHOLD_DAYS);
  let overdueTaskCount = 0;
  let dueSoonTaskCount = 0;

  calendarSources.push({
    id: "rehearsals",
    label: "Meine Proben",
    color: DEFAULT_REHEARSAL_COLOR,
    type: "rehearsal",
    secondaryLabel: "Einladungen & Teilnahmen",
  });

  for (const rehearsal of rehearsals) {
    const attendanceStatus = rehearsal.attendance.at(0)?.status ?? null;
    const normalizedEnd = rehearsal.end ?? rehearsal.start;
    calendarEvents.push({
      id: `rehearsal-${rehearsal.id}`,
      calendarId: "rehearsals",
      title: rehearsal.title,
      start: rehearsal.start.toISOString(),
      end: normalizedEnd.toISOString(),
      allDay: false,
      location: rehearsal.location,
      description: rehearsal.description ?? null,
      metadata: attendanceStatus
        ? { attendanceStatus: formatAttendance(attendanceStatus) }
        : undefined,
    });
  }

  const departmentColorMap = new Map<string, string>();
  let fallbackIndex = 0;
  for (const membership of memberships) {
    const existing = departmentColorMap.get(membership.departmentId);
    if (!existing) {
      const color =
        membership.department?.color ??
        FALLBACK_DEPARTMENT_COLORS[fallbackIndex % FALLBACK_DEPARTMENT_COLORS.length];
      departmentColorMap.set(membership.departmentId, color);
      fallbackIndex += 1;
    }
  }

  const handledDepartments = new Set<string>();
  for (const membership of memberships) {
    if (handledDepartments.has(membership.departmentId)) continue;
    handledDepartments.add(membership.departmentId);
    const department = membership.department;
    const color = departmentColorMap.get(membership.departmentId) ?? FALLBACK_DEPARTMENT_COLORS[0];
    calendarSources.push({
      id: `department:${membership.departmentId}`,
      label: department?.name ?? "Gewerk",
      color,
      type: "department",
      secondaryLabel: "Gewerk-Termine",
    });
  }

  for (const event of departmentEvents) {
    const calendarId = `department:${event.departmentId}`;
    const color = departmentColorMap.get(event.departmentId);
    if (color && !calendarSources.some((source) => source.id === calendarId)) {
      calendarSources.push({
        id: calendarId,
        label: event.department?.name ?? "Gewerk",
        color,
        type: "department",
        secondaryLabel: "Gewerk-Termine",
      });
    }
    const end = event.end ?? event.start;
    calendarEvents.push({
      id: `department-event-${event.id}`,
      calendarId,
      title: event.title,
      start: event.start.toISOString(),
      end: end.toISOString(),
      allDay: false,
      location: event.location,
      description: event.description ?? null,
      metadata: {
        departmentName: event.department?.name ?? null,
      },
    });
  }

  for (const member of birthdayMembers) {
    if (!member.dateOfBirth) continue;
    const name = formatMemberName(member.firstName, member.lastName);
    for (let year = rangeStart.getFullYear(); year <= rangeEnd.getFullYear(); year += 1) {
      const occurrence = createBirthdayOccurrence(member.dateOfBirth, year);
      if (occurrence < rangeStart || occurrence > rangeEnd) continue;
      const age = differenceInYears(occurrence, member.dateOfBirth);
      if (age < 1) continue;
      birthdayOccurrences.push({
        id: `birthday-${member.id}-${year}`,
        date: occurrence,
        age,
        name,
      });
    }
  }

  if (birthdayOccurrences.length) {
    calendarSources.push({
      id: "birthdays",
      label: "Geburtstage",
      color: BIRTHDAY_COLOR,
      type: "milestone",
      secondaryLabel: "Geburtstage & Jubiläen",
    });

    for (const birthday of birthdayOccurrences) {
      const milestoneBadge =
        birthday.age % 10 === 0
          ? { label: `${birthday.age} Jahre`, tone: "accent" as const }
          : null;
      calendarEvents.push({
        id: birthday.id,
        calendarId: "birthdays",
        title: `Geburtstag: ${birthday.name}`,
        start: birthday.date.toISOString(),
        end: birthday.date.toISOString(),
        allDay: true,
        metadata: {
          note: `Feiert den ${birthday.age}. Geburtstag.`,
          badge: milestoneBadge,
        },
      });
    }
  }

  if (tasksWithDueDates.length) {
    calendarSources.push({
      id: "tasks",
      label: "Aufgaben & Deadlines",
      color: TASK_DEADLINE_COLOR,
      type: "task",
      secondaryLabel: "Persönliche To-dos",
    });

    for (const assignment of tasksWithDueDates) {
      const task = assignment.task;
      const dueAt = task.dueAt;
      const allDay = isAllDayDate(dueAt);
      const eventEnd = allDay ? dueAt : new Date(dueAt.getTime() + 60 * 60 * 1000);
      const isOverdue = dueAt < now;
      if (isOverdue) {
        overdueTaskCount += 1;
      } else if (dueAt <= dueSoonThreshold) {
        dueSoonTaskCount += 1;
      }

      const relative = formatDistanceToNowStrict(dueAt, { addSuffix: true, locale: de });
      const overdueDuration = relative.replace(/^vor\s+/i, "");
      const timingNote = isOverdue ? `Seit ${overdueDuration} überfällig` : `Fällig ${relative}`;
      const departmentName = task.department?.name ?? null;
      const noteParts = [departmentName ? `Gewerk ${departmentName}` : null, timingNote].filter(Boolean) as string[];
      const badge = isOverdue
        ? { label: "Überfällig", tone: "destructive" as const }
        : dueAt <= dueSoonThreshold
          ? { label: "Bald fällig", tone: "warning" as const }
          : null;

      calendarEvents.push({
        id: `task-${task.id}`,
        calendarId: "tasks",
        title: task.title.trim() || "Aufgabe ohne Titel",
        start: dueAt.toISOString(),
        end: eventEnd.toISOString(),
        allDay,
        description: task.description ?? null,
        metadata: {
          note: noteParts.join(" • "),
          badge,
          departmentName,
        },
      });
    }
  }

  calendarSources.push({
    id: "blocked",
    label: "Meine Abwesenheiten",
    color: DEFAULT_BLOCKED_COLOR,
    type: "personal",
    secondaryLabel: "Sperrungen & Urlaube",
  });

  for (const blocked of blockedDays) {
    calendarEvents.push({
      id: `blocked-${blocked.id}`,
      calendarId: "blocked",
      title: blocked.reason ? `Blockiert: ${blocked.reason}` : "Blockierter Tag",
      start: blocked.date.toISOString(),
      end: blocked.date.toISOString(),
      allDay: true,
      description: blocked.reason ?? null,
    });
  }

  const upcoming = [...calendarEvents]
    .filter((event) => {
      const start = new Date(event.start);
      return start >= now;
    })
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

  const nextEvent = upcoming.at(0) ?? null;

  const summary: MemberCalendarSummaryItem[] = [
    {
      id: "rehearsal-count",
      label: "Proben im Zeitraum",
      value: String(rehearsals.length),
      hint: "Eigene Einladungen und zugesagte Termine",
    },
    {
      id: "department-count",
      label: "Gewerk-Termine",
      value: String(departmentEvents.length),
      hint:
        departmentColorMap.size === 1
          ? "1 aktives Gewerk"
          : `${departmentColorMap.size} aktive Gewerke`,
    },
  ];

  const taskHintParts: string[] = [];
  if (overdueTaskCount) {
    taskHintParts.push(
      `${overdueTaskCount} überfällige Aufgabe${overdueTaskCount === 1 ? "" : "n"}`,
    );
  }
  if (dueSoonTaskCount) {
    taskHintParts.push(
      `${dueSoonTaskCount} bald fällige Aufgabe${dueSoonTaskCount === 1 ? "" : "n"}`,
    );
  }

  summary.push({
    id: "task-deadlines",
    label: "Aufgaben mit Deadline",
    value: String(tasksWithDueDates.length),
    hint:
      tasksWithDueDates.length === 0
        ? "Keine offenen Deadlines im Zeitraum"
        : taskHintParts.length
          ? taskHintParts.join(", ")
          : "Alle Deadlines im Zeitplan",
  });

  const upcomingBirthdays = birthdayOccurrences
    .filter((entry) => entry.date >= now)
    .sort((a, b) => a.date.getTime() - b.date.getTime());
  const nextBirthday = upcomingBirthdays.at(0) ?? null;
  const mediumDateFormatter = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" });

  summary.push({
    id: "birthday-count",
    label: "Geburtstage im Zeitraum",
    value: String(birthdayOccurrences.length),
    hint:
      birthdayOccurrences.length === 0
        ? "Keine Geburtstage im Zeitraum"
        : nextBirthday
          ? `${nextBirthday.name} (${nextBirthday.age}) am ${mediumDateFormatter.format(nextBirthday.date)}`
          : "Nur vergangene Geburtstage im Zeitraum",
  });

  summary.push({
    id: "blocked-count",
    label: "Abwesenheiten",
    value: String(blockedDays.length),
    hint: "Eingetragene Sperrungen im Zeitraum",
  });

  if (nextEvent) {
    const source = calendarSources.find((entry) => entry.id === nextEvent.calendarId);
    const dateFormatter = new Intl.DateTimeFormat("de-DE", {
      dateStyle: "full",
      timeStyle: nextEvent.allDay ? undefined : "short",
    });
    summary.push({
      id: "next-event",
      label: "Nächster Termin",
      value: dateFormatter.format(new Date(nextEvent.start)),
      hint: source ? source.label : undefined,
    });
  }

  const breadcrumbs = [membersNavigationBreadcrumb("/mitglieder/kalender")].filter(Boolean);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Kalender"
        description="Plane deinen Vereinsalltag wie im Google Kalender: Proben, Gewerke-Termine, Deadlines, Geburtstage und Sperrungen auf einen Blick."
        breadcrumbs={breadcrumbs}
      />

      <CalendarClient
        initialDate={now.toISOString()}
        calendars={calendarSources}
        events={calendarEvents}
        summary={summary}
      />
    </div>
  );
}
