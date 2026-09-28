import { notFound, redirect } from "next/navigation";

import { PageHeader } from "@/components/members/page-header";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { requireAuth } from "@/lib/rbac";
import { getActiveProduction } from "@/lib/active-production";

import { EventEditor } from "../event-editor";
import { RehearsalReview } from "../rehearsal-review";
import { getUserDisplayName } from "@/lib/names";
import { membersNavigationBreadcrumb } from "@/lib/members-breadcrumbs";
import { DEFAULT_TIME_ZONE, formatIsoDateInTimeZone } from "@/lib/date-time";
import { loadAudienceContext, readEventAudience } from "@/lib/calendar/audience-server";
import { readDayAvailability } from "@/lib/calendar/day-availability";
import { loadSceneStats, readEventSchedule } from "@/lib/calendar/scene-schedule-server";

export default async function EventEditorPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const session = await requireAuth();
  const resolvedParams = await params;
  const rehearsalId = resolvedParams?.eventId;
  if (!rehearsalId) {
    notFound();
  }
  // Wer nicht planen darf, bekommt die Terminseite zum Ansehen.
  const allowed = await hasPermission(session.user, "PRIVATE.REHEARSAL.PLANNING.MANAGE");
  if (!allowed) {
    redirect(`/mitglieder/termine/${rehearsalId}`);
  }

  const rehearsal = await prisma.calendarEvent.findFirst({
    // Gewerk-eigene Termine pflegt das Gewerk-Portal.
    where: { id: rehearsalId, departmentId: null },
  });

  if (!rehearsal) {
    notFound();
  }

  // Produktionsrollen planen nur Proben ihrer eigenen Produktion.
  if (
    rehearsal.showId &&
    !(await hasPermission(session.user, "PRIVATE.REHEARSAL.PLANNING.MANAGE", {
      showId: rehearsal.showId,
    }))
  ) {
    redirect(`/mitglieder/termine/${rehearsal.id}`);
  }

  // Allow editing both DRAFT and published rehearsals
  // Drafts use updateRehearsalDraftAction, published use updateRehearsalAction

  const dateKey = formatIsoDateInTimeZone(rehearsal.start.toISOString(), DEFAULT_TIME_ZONE);
  const [context, audience, availability, schedule, sceneStats, production] = await Promise.all([
    loadAudienceContext(rehearsal.showId),
    readEventAudience(rehearsal.id),
    readDayAvailability(dateKey),
    readEventSchedule(rehearsal.id),
    loadSceneStats(rehearsal.showId),
    getActiveProduction(session.user?.id),
  ]);
  // Für den Wechsel „gilt für“: Zielgruppe der anderen Seite (alle bzw. Produktion).
  const otherShowId = rehearsal.showId ? null : (production?.id ?? null);
  const otherContext =
    rehearsal.showId || otherShowId ? await loadAudienceContext(otherShowId) : null;
  const productionTitle = production ? (production.title ?? String(production.year)) : null;

  // Nach Probenbeginn: Szenen abhaken und Anwesenheit erfassen.
  const review =
    rehearsal.kind === "REHEARSAL" &&
    rehearsal.status === "SCHEDULED" &&
    rehearsal.start <= new Date()
      ? await prisma.calendarEvent
          .findUnique({
            where: { id: rehearsal.id },
            select: {
              blocks: {
                where: { type: "SCENE", sceneId: { not: null } },
                orderBy: { order: "asc" },
                select: {
                  sceneId: true,
                  outcome: true,
                  scene: { select: { identifier: true, sequence: true, title: true } },
                },
              },
              participants: {
                where: { invited: true },
                select: {
                  userId: true,
                  response: true,
                  attended: true,
                  user: {
                    select: { firstName: true, lastName: true, name: true, email: true },
                  },
                },
              },
            },
          })
          .then((data) => ({
            scenes: (data?.blocks ?? [])
              .flatMap((entry) =>
                entry.sceneId && entry.scene
                  ? [{ ...entry, sceneId: entry.sceneId, scene: entry.scene }]
                  : [],
              )
              .map((entry) => ({
                sceneId: entry.sceneId,
                label: `Sz. ${entry.scene.identifier || entry.scene.sequence}${
                  entry.scene.title ? ` ${entry.scene.title}` : ""
                }`,
                outcome: entry.outcome,
              })),
            people: (data?.participants ?? [])
              .map((entry) => ({
                userId: entry.userId,
                name: getUserDisplayName(entry.user),
                declined: entry.response === "no" || entry.response === "emergency",
                attended: entry.attended,
              }))
              .sort((a, b) => a.name.localeCompare(b.name, "de")),
          }))
      : null;

  const breadcrumbs = [
    membersNavigationBreadcrumb("/mitglieder/terminplanung"),
    { id: rehearsal.id, label: rehearsal.title || "Termin", isCurrent: true },
  ];
  const noun = rehearsal.kind === "REHEARSAL" ? "Probe" : "Termin";

  return (
    <div className="space-y-6">
      <PageHeader
        title={rehearsal.status === "DRAFT" ? `${noun} planen` : `${noun} bearbeiten`}
        description={
          rehearsal.status === "DRAFT"
            ? "Entwurf – nur die Planung sieht ihn. Änderungen werden automatisch gespeichert."
            : "Änderungen werden automatisch gespeichert; Eingeladene werden benachrichtigt."
        }
        breadcrumbs={breadcrumbs}
      />

      <EventEditor
        rehearsal={{
          id: rehearsal.id,
          status: rehearsal.status,
          kind: rehearsal.kind,
          allDay: rehearsal.allDay,
          showId: rehearsal.showId,
          title: rehearsal.title,
          start: rehearsal.start.toISOString(),
          end: rehearsal.end ? rehearsal.end.toISOString() : null,
          location: rehearsal.location ?? "",
          description: rehearsal.description,
        }}
        production={
          rehearsal.showId
            ? {
                id: rehearsal.showId,
                title:
                  rehearsal.showId === production?.id && productionTitle
                    ? productionTitle
                    : "Produktion",
              }
            : production && productionTitle
              ? { id: production.id, title: productionTitle }
              : null
        }
        otherContext={otherContext}
        context={context}
        audience={{ rules: audience.rules, overrides: audience.overrides }}
        invited={audience.invited}
        initialAvailability={availability}
        declined={audience.declined}
        schedule={schedule}
        sceneStats={sceneStats}
      />

      {review ? (
        <RehearsalReview eventId={rehearsal.id} scenes={review.scenes} people={review.people} />
      ) : null}
    </div>
  );
}
