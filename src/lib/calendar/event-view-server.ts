import type { EventStatus } from "@prisma/client";

import { loadAudienceContext } from "@/lib/calendar/audience-server";
import { isWithinFreeze, readFreezeDays } from "@/lib/calendar/block-list-link";
import { sanitizeEventDescription } from "@/lib/calendar/description";
import { visibleGeneralEventWhere } from "@/lib/calendar/entries";
import { getCalendarEntryKindLabel } from "@/lib/calendar/event-kinds";
import {
  buildTimeline,
  shortNameList,
  type TimelineBlock,
  type TimelineRow,
} from "@/lib/calendar/event-timeline";
import { CALENDAR_PLANNER_PERMISSION } from "@/lib/calendar/permissions";
import { blockLabel } from "@/lib/calendar/scene-schedule";
import { getUserDisplayName } from "@/lib/names";
import { canEditProtocol } from "@/lib/calendar/protocol-server";
import { readProtocolView, type ProtocolView } from "@/lib/calendar/protocol-view";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import {
  currentDepartmentMembershipWhere,
  currentMembershipWhere,
} from "@/lib/produktionen/status";

export type EventPerson = {
  userId: string;
  name: string;
  me: boolean;
  group: "required" | "optional" | "declined";
  reasons: string[];
  window: { start: string; end: string } | null;
  note: string | null;
};

export type EventViewProps = {
  event: {
    id: string;
    title: string;
    kindLabel: string;
    production: string | null;
    status: EventStatus;
    /** Grund, wenn die Planung den Termin abgesagt hat. */
    cancelReason: string | null;
    start: string;
    end: string | null;
    allDay: boolean;
    location: string | null;
    description: string | null;
    past: boolean;
  };
  me: {
    window: { start: string; end: string } | null;
    invited: boolean;
    optional: boolean;
    declined: boolean;
    emergency: boolean;
    note: string | null;
    canRespond: boolean;
    withinFreeze: boolean;
    mySceneCount: number;
  } | null;
  editHref: string | null;
  editLabel: string;
  /** Probenmodus, wenn die Person Protokoll führen darf und die Probe bald beginnt oder lief. */
  protocolHref: string | null;
  rows: TimelineRow[];
  people: EventPerson[];
  /** Probenprotokoll, sobald etwas erfasst ist. */
  protocol: ProtocolView | null;
};

type ViewUser = Parameters<typeof hasPermission>[0];

/**
 * Terminseite für eine Person: prüft, ob sie den Termin sehen darf (Planung, Eingeladene,
 * Produktion, Gewerk oder „für alle“), und bereitet Ablauf, Leute und eigene Rückmeldung auf.
 */
export async function readEventView(
  eventId: string,
  user: ViewUser,
  userId: string,
): Promise<{ ok: true; props: EventViewProps } | { ok: false; message: string }> {
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
      _count: { select: { audienceRules: true } },
    },
  });
  if (!event) return { ok: false, message: "Diesen Termin gibt es nicht." };

  const [canViewOwn, canPlan] = await Promise.all([
    hasPermission(user, "PRIVATE.REHEARSAL.OWN.VIEW"),
    hasPermission(
      user,
      CALENDAR_PLANNER_PERMISSION,
      event.showId ? { showId: event.showId } : undefined,
    ),
  ]);
  const own = event.participants.find((entry) => entry.userId === userId) ?? null;
  // „Für alle“-Termine: Rückmeldung ohne Einladung.
  const response = own
    ? own
    : await prisma.eventParticipant.findUnique({
        where: { eventId_userId: { eventId: event.id, userId } },
        select: { response: true, responseNote: true },
      });

  if (event.status === "DRAFT" && !canPlan) {
    return { ok: false, message: "Dieser Termin ist noch nicht veröffentlicht." };
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
    return { ok: false, message: "Diesen Termin sehen nur die Beteiligten." };
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
  const declined = response?.response === "no" || response?.response === "emergency";
  const canRespond =
    !event.departmentId &&
    event.start > now &&
    (event.status === "SCHEDULED" || event.status === "TENTATIVE") &&
    // Mit Zielgruppe antworten nur Eingeladene, offene Termine alle, die sie sehen.
    (!!own || (!event.participants.length && !event._count.audienceRules));
  const freezeDays = canRespond ? await readFreezeDays() : 0;
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

  return {
    ok: true,
    props: {
      event: {
        id: event.id,
        title: event.title || "Termin",
        kindLabel,
        production,
        status: event.status,
        cancelReason: event.status === "CANCELLED" ? event.cancelReason : null,
        start: event.start.toISOString(),
        end: event.end?.toISOString() ?? null,
        allDay: event.allDay,
        location: event.location && event.location !== "Noch offen" ? event.location : null,
        description: sanitizeEventDescription(event.description),
        past: (event.end ?? event.start) < now,
      },
      me:
        own || canRespond
          ? {
              window:
                own?.personalStart && own.personalEnd
                  ? { start: own.personalStart.toISOString(), end: own.personalEnd.toISOString() }
                  : null,
              invited: !!own,
              optional: own?.level === "OPTIONAL",
              declined,
              emergency: response?.response === "emergency",
              note: response?.responseNote ?? null,
              canRespond,
              withinFreeze: canRespond && isWithinFreeze(event.start, freezeDays, now),
              mySceneCount: blocks.filter((block) => block.mine).length,
            }
          : null,
      editHref,
      editLabel: event.departmentId ? "Im Gewerk öffnen" : "Bearbeiten",
      protocolHref:
        !event.departmentId &&
        (event.status === "SCHEDULED" || event.status === "TENTATIVE") &&
        event.start.getTime() - now.getTime() <= 60 * 60 * 1000 &&
        (await canEditProtocol(user, event.showId))
          ? `/mitglieder/termine/${event.id}/probe`
          : null,
      rows: buildTimeline(blocks),
      people,
      protocol: event.departmentId ? null : await readProtocolView(event.id, userId, context),
    },
  };
}
