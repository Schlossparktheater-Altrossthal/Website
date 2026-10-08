export const dynamic = "force-dynamic";

import { addMonths, format, startOfMonth } from "date-fns";

import { PageHeader } from "@/components/members/page-header";
import { getActiveProduction } from "@/lib/active-production";
import { loadAudienceContext } from "@/lib/calendar/audience-server";
import { loadScenePlanEntries } from "@/lib/calendar/scene-schedule-server";
import type { CalendarEntry } from "@/lib/calendar/event-kinds";
import { CALENDAR_PLANNER_PERMISSION } from "@/lib/calendar/permissions";
import { formatIsoDateInTimeZone } from "@/lib/date-time";
import { getSaxonySchoolHolidayRanges } from "@/lib/holidays";
import { membersNavigationBreadcrumb } from "@/lib/members-breadcrumbs";
import { compareMembersByLastName, getUserDisplayName } from "@/lib/names";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { currentMembershipWhere } from "@/lib/produktionen/status";
import { requireAuth } from "@/lib/rbac";
import { readSperrlisteSettings, resolveBlocklistSettings } from "@/lib/sperrliste-settings";

import {
  EventPlanningClient,
  type PlanningAvailability,
  type PlanningDraft,
  type PlanningEvent,
  type PlanningMember,
} from "./page-client";

export default async function EventPlanningPage({
  searchParams,
}: {
  searchParams: Promise<{ art?: string; ansicht?: string; tag?: string }>;
}) {
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
  const { art, ansicht, tag } = await searchParams;

  // Ab Vormonat, damit gerade vergangene Termine noch nachbearbeitet werden können.
  const from = addMonths(startOfMonth(new Date()), -1);
  const to = addMonths(from, 14);
  // Termine der gewählten Produktion plus allgemeine; Gewerk-eigene pflegt das Gewerk.
  const scope = {
    departmentId: null,
    ...(showId ? { OR: [{ showId }, { showId: null }] } : {}),
  };

  const settings = resolveBlocklistSettings(await readSperrlisteSettings());
  const [events, drafts, users, holidays, show, sceneContext, scenePlanEntries] = await Promise.all(
    [
      prisma.calendarEvent.findMany({
        where: {
          ...scope,
          status: { in: ["TENTATIVE", "SCHEDULED"] },
          start: { lte: to },
          AND: [{ OR: [{ start: { gte: from } }, { end: { gte: from } }] }],
        },
        orderBy: { start: "asc" },
        include: {
          participants: { where: { invited: true }, select: { userId: true, response: true } },
          _count: { select: { audienceRules: true } },
        },
      }),
      prisma.calendarEvent.findMany({
        where: { ...scope, status: "DRAFT" },
        orderBy: { start: "asc" },
        select: { id: true, title: true, kind: true, start: true, allDay: true },
      }),
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
          blockedDays: {
            where: { date: { gte: from, lt: to } },
            select: { date: true, kind: true, reason: true },
          },
        },
      }),
      getSaxonySchoolHolidayRanges(settings.cacheKey),
      showId
        ? prisma.show.findUnique({
            where: { id: showId },
            select: {
              finalRehearsalWeekStart: true,
              finalRehearsalWeekEnd: true,
              premiereAt: true,
            },
          })
        : null,
      // Szenen und Besetzung für „Was ist probbar?“ im Tagesfeld.
      showId ? loadAudienceContext(showId) : null,
      showId ? loadScenePlanEntries(showId) : [],
    ],
  );

  const planningEvents: PlanningEvent[] = events.map((event) => {
    const targeted = event._count.audienceRules > 0 || event.participants.length > 0;
    const entry: CalendarEntry = {
      id: event.id,
      source: event.kind === "REHEARSAL" ? "rehearsal" : "event",
      kind: event.kind,
      title: event.title,
      start: event.start.toISOString(),
      end: event.end?.toISOString() ?? null,
      allDay: event.allDay,
      dayKey: formatIsoDateInTimeZone(event.start.toISOString()),
      location: event.location && event.location !== "Noch offen" ? event.location : null,
      description: null,
      href: `/mitglieder/terminplanung/${event.id}`,
      showId: event.showId,
    };
    return {
      ...entry,
      status: event.status === "TENTATIVE" ? "TENTATIVE" : "SCHEDULED",
      // Ohne Zielgruppe gilt der Termin für alle.
      invitedIds: targeted ? event.participants.map((entry) => entry.userId) : null,
      declinedIds: event.participants
        .filter((entry) => entry.response === "no" || entry.response === "emergency")
        .map((entry) => entry.userId),
    };
  });

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
  const planningDrafts: PlanningDraft[] = drafts.map((draft) => ({
    id: draft.id,
    title: draft.title,
    kind: draft.kind,
    start: draft.start.toISOString(),
    allDay: draft.allDay,
  }));

  const finalWeek = show?.finalRehearsalWeekStart
    ? {
        start: format(show.finalRehearsalWeekStart, "yyyy-MM-dd"),
        end: show.finalRehearsalWeekEnd ? format(show.finalRehearsalWeekEnd, "yyyy-MM-dd") : null,
      }
    : null;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Terminplanung"
        description={
          productionTitle
            ? `Proben und Termine für „${productionTitle}“ und alle Produktionen – mit Blick darauf, wer kann.`
            : "Proben und Termine planen – mit Blick darauf, wer kann."
        }
        breadcrumbs={[membersNavigationBreadcrumb("/mitglieder/terminplanung")]}
      />
      <EventPlanningClient
        events={planningEvents}
        drafts={planningDrafts}
        members={members}
        availability={availability}
        holidays={holidays}
        finalWeek={finalWeek}
        preferredWeekdays={settings.preferredWeekdays}
        exceptionWeekdays={settings.exceptionWeekdays}
        initialFilter={art === "proben" ? "rehearsals" : art === "termine" ? "events" : "all"}
        initialView={
          ansicht === "liste"
            ? "list"
            : ansicht === "szenen"
              ? "scenes"
              : ansicht === "personen"
                ? "people"
                : "calendar"
        }
        initialDay={tag && /^\d{4}-\d{2}-\d{2}$/.test(tag) ? tag : null}
        sceneContext={
          sceneContext?.scenes.length
            ? {
                scenes: sceneContext.scenes,
                castings: sceneContext.castings,
                characters: sceneContext.characters,
                members: sceneContext.members,
              }
            : null
        }
        scenePlan={
          sceneContext?.scenes.length
            ? {
                scenes: sceneContext.scenes.map(({ id, label }) => ({ id, label })),
                entries: scenePlanEntries,
                premiereKey: show?.premiereAt
                  ? formatIsoDateInTimeZone(show.premiereAt.toISOString())
                  : null,
              }
            : null
        }
      />
    </div>
  );
}
