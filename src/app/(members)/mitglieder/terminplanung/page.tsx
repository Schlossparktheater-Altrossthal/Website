import { addMonths, format, startOfMonth } from "date-fns";

import { PageHeader } from "@/components/members/page-header";
import { readCalendarEvents } from "@/lib/calendar/entries";
import { CALENDAR_PLANNER_PERMISSION } from "@/lib/calendar/permissions";
import { membersNavigationBreadcrumb } from "@/lib/members-breadcrumbs";
import { getUserDisplayName } from "@/lib/names";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";

import { EventPlanningClient, type EventAbsence } from "./page-client";

export default async function EventPlanningPage() {
  const session = await requireAuth();
  if (!(await hasPermission(session.user, CALENDAR_PLANNER_PERMISSION))) {
    return <div className="text-sm text-destructive">Kein Zugriff auf die Terminplanung</div>;
  }

  // Ab Vormonat, damit gerade vergangene Termine noch nachbearbeitet werden können.
  const from = addMonths(startOfMonth(new Date()), -1);
  const to = addMonths(from, 14);

  const [events, memberCount] = await Promise.all([
    readCalendarEvents({ from, to }),
    prisma.user.count({ where: { deactivatedAt: null } }),
  ]);

  // Alle Abwesenheiten im Zeitraum – auch neu angelegte Termine zeigen sofort, wer fehlt.
  const blockedDays = await prisma.blockedDay.findMany({
    where: {
      date: { gte: from, lt: to },
      kind: { in: ["BLOCKED", "LIMITED"] },
      user: { deactivatedAt: null },
    },
    select: {
      date: true,
      kind: true,
      reason: true,
      user: { select: { firstName: true, lastName: true, name: true, email: true } },
    },
  });

  const absences: EventAbsence[] = blockedDays.map((entry) => ({
    date: format(entry.date, "yyyy-MM-dd"),
    status: entry.kind === "BLOCKED" ? "blocked" : "limited",
    name: getUserDisplayName(entry.user),
    reason: entry.reason?.trim() || null,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Terminplanung"
        description="Termine der Organisation anlegen – mit Blick darauf, wer an dem Tag kann."
        breadcrumbs={[membersNavigationBreadcrumb("/mitglieder/terminplanung")]}
      />
      <EventPlanningClient events={events} absences={absences} memberCount={memberCount} />
    </div>
  );
}
