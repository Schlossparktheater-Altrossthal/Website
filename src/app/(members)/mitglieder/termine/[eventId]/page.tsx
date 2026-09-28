import { notFound } from "next/navigation";

import { PageHeader } from "@/components/members/page-header";
import { loadAudienceContext } from "@/lib/calendar/audience-server";
import { sanitizeEventDescription } from "@/lib/calendar/description";
import { visibleGeneralEventWhere } from "@/lib/calendar/entries";
import { getCalendarEntryKindLabel } from "@/lib/calendar/event-kinds";
import { buildTimeline, shortNameList, type TimelineBlock } from "@/lib/calendar/event-timeline";
import { CALENDAR_PLANNER_PERMISSION } from "@/lib/calendar/permissions";
import { blockLabel } from "@/lib/calendar/scene-schedule";
import { membersNavigationBreadcrumb } from "@/lib/members-breadcrumbs";
import { getUserDisplayName } from "@/lib/names";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import {
  currentDepartmentMembershipWhere,
  currentMembershipWhere,
} from "@/lib/produktionen/status";
import { requireAuth } from "@/lib/rbac";

import { EventView, type EventPerson } from "./event-view";

function Denied({ children }: { children: React.ReactNode }) {
  return <div className="text-sm text-muted-foreground">{children}</div>;
}

/** Ein Termin für alle, die ihn sehen dürfen: Ablauf, Leute, eigene Rückmeldung. */
export default async function EventPage({ params }: { params: Promise<{ eventId: string }> }) {
  const session = await requireAuth();
  const userId = session.user?.id;
  const { eventId } = await params;
  if (!userId || !eventId) notFound();

  const event = await prisma.calendarEvent.findUnique({
    where: { id: eventId },
    include: {
      show: { select: { title: true, year: true } },
      department: { select: { id: true, name: true, slug: true } },
      blocks: {
        orderBy: [{ startsAt: { sort: "asc", nulls: "last" } }, { order: "asc" }],
        include: {
          scene: { select: { id: true, identifier: true, sequence: true, title: true } },
          department: { select: { id: true, name: true } },
        },
      },
      participants: {
        where: { invited: true },
        include: { user: { select: { firstName: true, lastName: true, name: true, email: true } } },
      },
    },
  });
  if (!event) notFound();

  const [canViewOwn, canPlan] = await Promise.all([
    hasPermission(session.user, "PRIVATE.REHEARSAL.OWN.VIEW"),
    hasPermission(
      session.user,
      CALENDAR_PLANNER_PERMISSION,
      event.showId ? { showId: event.showId } : undefined,
    ),
  ]);
  const own = event.participants.find((entry) => entry.userId === userId) ?? null;

  if (event.status === "DRAFT" && !canPlan) {
    return <Denied>Dieser Termin ist noch nicht veröffentlicht.</Denied>;
  }

  // Sehen dürfen: Planung, Eingeladene und – je nach Termin – das Gewerk, alle der Produktion
  // oder bei allgemeinen Terminen ohne Zielgruppe alle.
  const [departmentIds, canSee] = await Promise.all([
    prisma.departmentMembership
      .findMany({
        where: { userId, ...currentDepartmentMembershipWhere() },
        select: { departmentId: true },
      })
      .then((rows) => new Set(rows.map((row) => row.departmentId))),
    (async () => {
      if (canPlan || own) return true;
      if (!canViewOwn) return false;
      if (event.departmentId) {
        const count = await prisma.departmentMembership.count({
          where: {
            userId,
            departmentId: event.departmentId,
            ...currentDepartmentMembershipWhere(),
          },
        });
        return count > 0;
      }
      if (event.showId) {
        const count = await prisma.productionMembership.count({
          where: { userId, showId: event.showId, ...currentMembershipWhere() },
        });
        return count > 0;
      }
      const count = await prisma.calendarEvent.count({
        where: { id: event.id, ...visibleGeneralEventWhere(userId) },
      });
      return count > 0;
    })(),
  ]);
  if (!canSee) {
    return <Denied>Diesen Termin sehen nur die Beteiligten.</Denied>;
  }

  const context = event.showId ? await loadAudienceContext(event.showId) : null;
  const memberName = new Map(context?.members.map((member) => [member.id, member.name]) ?? []);
  const castOfScene = (sceneId: string) => {
    const scene = context?.scenes.find((entry) => entry.id === sceneId);
    if (!scene || !context) return [];
    return Array.from(
      new Set(
        context.castings
          .filter((casting) => scene.characterIds.includes(casting.characterId))
          .map((casting) => casting.userId),
      ),
    );
  };

  const blocks: TimelineBlock[] = event.blocks
    .filter((block) => block.type !== "SCENE" || block.scene)
    .map((block) => {
      const cast = block.sceneId ? castOfScene(block.sceneId) : [];
      const mine =
        block.type === "SCENE"
          ? cast.includes(userId)
          : block.type === "DEPARTMENT"
            ? !!block.departmentId && departmentIds.has(block.departmentId)
            : false;
      return {
        id: block.id,
        label: blockLabel({ ...block, location: null }),
        kind: block.type,
        startsAt: block.startsAt?.toISOString() ?? null,
        endsAt: block.endsAt?.toISOString() ?? null,
        location: block.location,
        description: block.description,
        who:
          block.type === "SCENE"
            ? shortNameList(
                cast
                  .map((id) => (id === userId ? "du" : memberName.get(id)))
                  .filter((name): name is string => !!name),
              )
            : null,
        mine,
        outcome: block.outcome,
      };
    });

  const people: EventPerson[] = event.participants
    .map((entry) => {
      const declined = entry.response === "no" || entry.response === "emergency";
      return {
        userId: entry.userId,
        name: getUserDisplayName(entry.user),
        me: entry.userId === userId,
        group: declined
          ? ("declined" as const)
          : entry.level === "OPTIONAL"
            ? ("optional" as const)
            : ("required" as const),
        reasons: Array.isArray(entry.reasons)
          ? entry.reasons.filter((reason): reason is string => typeof reason === "string")
          : [],
        window:
          entry.personalStart && entry.personalEnd
            ? { start: entry.personalStart.toISOString(), end: entry.personalEnd.toISOString() }
            : null,
        // Absagegründe sieht nur die Planung.
        note: declined && canPlan ? entry.responseNote : null,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "de"));

  const now = new Date();
  const declined = own ? own.response === "no" || own.response === "emergency" : false;
  const editHref = event.departmentId
    ? event.department
      ? `/mitglieder/meine-gewerke/${event.department.slug}?ansicht=termine`
      : null
    : canPlan
      ? `/mitglieder/terminplanung/${event.id}`
      : null;
  const kindLabel = event.department
    ? `Gewerk ${event.department.name}`
    : getCalendarEntryKindLabel(event.kind);
  const production = event.show ? (event.show.title ?? String(event.show.year)) : null;

  const breadcrumbs = [
    membersNavigationBreadcrumb("/mitglieder/meine-proben"),
    { id: event.id, label: event.title || "Termin", isCurrent: true },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title={event.title || "Termin"} breadcrumbs={breadcrumbs} />
      <EventView
        event={{
          id: event.id,
          title: event.title || "Termin",
          kindLabel,
          production,
          status: event.status,
          start: event.start.toISOString(),
          end: event.end?.toISOString() ?? null,
          allDay: event.allDay,
          location: event.location && event.location !== "Noch offen" ? event.location : null,
          description: sanitizeEventDescription(event.description),
          past: (event.end ?? event.start) < now,
        }}
        me={
          own
            ? {
                window:
                  own.personalStart && own.personalEnd
                    ? { start: own.personalStart.toISOString(), end: own.personalEnd.toISOString() }
                    : null,
                optional: own.level === "OPTIONAL",
                declined,
                note: own.responseNote,
                canRespond:
                  !event.departmentId &&
                  event.start > now &&
                  (event.status === "SCHEDULED" || event.status === "TENTATIVE"),
                mySceneCount: blocks.filter((block) => block.mine).length,
              }
            : null
        }
        editHref={editHref}
        editLabel={event.departmentId ? "Im Gewerk öffnen" : "Bearbeiten"}
        rows={buildTimeline(blocks)}
        people={people}
      />
    </div>
  );
}
