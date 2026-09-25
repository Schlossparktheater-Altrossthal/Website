import { addMonths, format, startOfMonth } from "date-fns";

import { PageHeader } from "@/components/members/page-header";
import { readCalendarEvents } from "@/lib/calendar/entries";
import { CALENDAR_PLANNER_PERMISSION } from "@/lib/calendar/permissions";
import { membersNavigationBreadcrumb } from "@/lib/members-breadcrumbs";
import { compareMembersByLastName, getUserDisplayName } from "@/lib/names";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";

import { EventPlanningClient, type PlanningAvailability, type PlanningMember } from "./page-client";

export default async function EventPlanningPage() {
  const session = await requireAuth();
  if (!(await hasPermission(session.user, CALENDAR_PLANNER_PERMISSION))) {
    return <div className="text-sm text-destructive">Kein Zugriff auf die Terminplanung</div>;
  }

  // Ab Vormonat, damit gerade vergangene Termine noch nachbearbeitet werden können.
  const from = addMonths(startOfMonth(new Date()), -1);
  const to = addMonths(from, 14);

  const [events, users] = await Promise.all([
    readCalendarEvents({ from, to }),
    prisma.user.findMany({
      where: { deactivatedAt: null },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        name: true,
        email: true,
        // Alle Einträge im Zeitraum – auch neu angelegte Termine zeigen sofort, wer kann.
        blockedDays: {
          where: { date: { gte: from, lt: to } },
          select: { date: true, kind: true, reason: true },
        },
      },
    }),
  ]);

  const members: PlanningMember[] = [...users].sort(compareMembersByLastName).map((user) => ({
    id: user.id,
    name: getUserDisplayName(user),
  }));
  const availability: PlanningAvailability[] = users.flatMap((user) =>
    user.blockedDays.map((entry) => ({
      userId: user.id,
      date: format(entry.date, "yyyy-MM-dd"),
      status:
        entry.kind === "BLOCKED" ? "blocked" : entry.kind === "LIMITED" ? "limited" : "preferred",
      reason: entry.reason?.trim() || null,
    })),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Terminplanung"
        description="Termine der Organisation anlegen – mit Blick darauf, wer an dem Tag kann."
        breadcrumbs={[membersNavigationBreadcrumb("/mitglieder/terminplanung")]}
      />
      <EventPlanningClient events={events} members={members} availability={availability} />
    </div>
  );
}
