import { addMonths, format, startOfMonth } from "date-fns";

import { PageHeader } from "@/components/members/page-header";
import { loadAudienceContext } from "@/lib/calendar/audience-server";
import type { DayAvailability } from "@/lib/calendar/day-availability";
import { readCalendarEvents } from "@/lib/calendar/entries";
import { formatIsoDateInTimeZone } from "@/lib/date-time";
import { CALENDAR_PLANNER_PERMISSION } from "@/lib/calendar/permissions";
import { membersNavigationBreadcrumb } from "@/lib/members-breadcrumbs";
import { compareMembersByLastName, getUserDisplayName } from "@/lib/names";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";
import { getActiveProduction } from "@/lib/active-production";
import { currentMembershipWhere } from "@/lib/produktionen/status";

import { EventPlanningClient, type PlanningAvailability, type PlanningMember } from "./page-client";

export default async function EventPlanningPage() {
  const session = await requireAuth();
  const production = await getActiveProduction(session.user?.id);
  const showId = production?.id ?? null;
  const productionTitle = production ? (production.title ?? String(production.year)) : null;
  if (!(await hasPermission(session.user, CALENDAR_PLANNER_PERMISSION, { showId }))) {
    return (
      <div className="text-sm text-destructive">
        {productionTitle
          ? `Kein Zugriff auf die Terminplanung von „${productionTitle}“.`
          : "Kein Zugriff auf die Terminplanung"}
      </div>
    );
  }

  // Ab Vormonat, damit gerade vergangene Termine noch nachbearbeitet werden können.
  const from = addMonths(startOfMonth(new Date()), -1);
  const to = addMonths(from, 14);

  const [events, users, productionContext, generalContext, audienceBlocks] = await Promise.all([
    // Termine der gewählten Produktion plus allgemeine; Verfügbarkeit ihrer Mitglieder.
    readCalendarEvents({ from, to, showId }),
    prisma.user.findMany({
      where: {
        deactivatedAt: null,
        ...(showId
          ? { productionMemberships: { some: { showId, ...currentMembershipWhere() } } }
          : {}),
      },
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
    // Zielgruppen-Baukasten im Termin-Dialog.
    showId ? loadAudienceContext(showId) : null,
    loadAudienceContext(null),
    prisma.blockedDay.findMany({
      where: { date: { gte: from, lt: to }, kind: { in: ["BLOCKED", "LIMITED"] } },
      select: { userId: true, date: true, kind: true },
    }),
  ]);

  const audienceAvailability: Record<string, DayAvailability> = {};
  for (const entry of audienceBlocks) {
    const day = (audienceAvailability[formatIsoDateInTimeZone(entry.date.toISOString())] ??= {});
    if (day[entry.userId] !== "blocked") {
      day[entry.userId] = entry.kind === "BLOCKED" ? "blocked" : "limited";
    }
  }

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
        description={
          productionTitle
            ? `Termine für „${productionTitle}“ und allgemeine Vereinstermine – mit Blick darauf, wer aus der Produktion kann.`
            : "Termine der Organisation anlegen – mit Blick darauf, wer an dem Tag kann."
        }
        breadcrumbs={[membersNavigationBreadcrumb("/mitglieder/terminplanung")]}
      />
      <EventPlanningClient
        events={events}
        members={members}
        availability={availability}
        audience={{
          production: productionContext,
          general: generalContext,
          availability: audienceAvailability,
        }}
        production={
          production && productionTitle ? { id: production.id, title: productionTitle } : null
        }
      />
    </div>
  );
}
