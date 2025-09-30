import { notFound } from "next/navigation";
import { addMonths, subMonths, startOfDay } from "date-fns";

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
const FALLBACK_DEPARTMENT_COLORS = [
  "#0EA5E9",
  "#8B5CF6",
  "#10B981",
  "#F97316",
  "#F59E0B",
];
const CALENDAR_LOOKBACK_MONTHS = 3;
const CALENDAR_LOOKAHEAD_MONTHS = 6;

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

  const [rehearsals, blockedDays] = await Promise.all([
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
  ]);

  const calendarSources: MemberCalendarSource[] = [];
  const calendarEvents: MemberCalendarEvent[] = [];

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
    {
      id: "blocked-count",
      label: "Abwesenheiten",
      value: String(blockedDays.length),
      hint: "Eingetragene Sperrungen im Zeitraum",
    },
  ];

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
        description="Plane deinen Vereinsalltag wie im Google Kalender: persönliche Proben, Gewerke-Termine und Sperrungen auf einen Blick."
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
