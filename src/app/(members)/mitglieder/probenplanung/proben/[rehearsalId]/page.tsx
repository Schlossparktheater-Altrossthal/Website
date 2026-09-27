import { notFound } from "next/navigation";

import { PageHeader } from "@/components/members/page-header";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { requireAuth } from "@/lib/rbac";

import { RehearsalEditor } from "../../rehearsal-editor";
import { RehearsalReview } from "../../rehearsal-review";
import { getUserDisplayName } from "@/lib/names";
import { membersNavigationBreadcrumb } from "@/lib/members-breadcrumbs";
import { DEFAULT_TIME_ZONE, formatIsoDateInTimeZone } from "@/lib/date-time";
import { loadAudienceContext, readEventAudience } from "@/lib/calendar/audience-server";
import { readDayAvailability } from "@/lib/calendar/day-availability";
import { loadSceneStats, readEventSchedule } from "@/lib/calendar/scene-schedule-server";

export default async function RehearsalEditorPage({
  params,
}: {
  params: Promise<{ rehearsalId: string }>;
}) {
  const session = await requireAuth();
  const allowed = await hasPermission(session.user, "PRIVATE.REHEARSAL.PLANNING.MANAGE");
  if (!allowed) {
    return <div className="text-sm text-destructive">Kein Zugriff auf die Probenplanung</div>;
  }

  const resolvedParams = await params;
  const rehearsalId = resolvedParams?.rehearsalId;
  if (!rehearsalId) {
    notFound();
  }

  const rehearsal = await prisma.calendarEvent.findFirst({
    where: { id: rehearsalId, kind: "REHEARSAL" },
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
    return (
      <div className="text-sm text-destructive">
        Kein Zugriff: Diese Probe gehört zu einer anderen Produktion.
      </div>
    );
  }

  // Allow editing both DRAFT and published rehearsals
  // Drafts use updateRehearsalDraftAction, published use updateRehearsalAction

  const dateKey = formatIsoDateInTimeZone(rehearsal.start.toISOString(), DEFAULT_TIME_ZONE);
  const [context, audience, availability, schedule, sceneStats] = await Promise.all([
    loadAudienceContext(rehearsal.showId),
    readEventAudience(rehearsal.id),
    readDayAvailability(dateKey),
    readEventSchedule(rehearsal.id),
    loadSceneStats(rehearsal.showId),
  ]);

  // Nach Probenbeginn: Szenen abhaken und Anwesenheit erfassen.
  const review =
    rehearsal.status === "SCHEDULED" && rehearsal.start <= new Date()
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
    membersNavigationBreadcrumb("/mitglieder/probenplanung"),
    { id: rehearsal.id, label: rehearsal.title || "Probe", isCurrent: true },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Probe bearbeiten"
        description={
          rehearsal.status === "DRAFT"
            ? "Passe Titel, Termine, Beschreibung und Teilnehmer deines Entwurfs an."
            : "Bearbeite diese veröffentlichte Probe. Alle Teilnehmer erhalten eine Benachrichtigung über Änderungen."
        }
        breadcrumbs={breadcrumbs}
      />

      <RehearsalEditor
        rehearsal={{
          id: rehearsal.id,
          status: rehearsal.status,
          title: rehearsal.title,
          start: rehearsal.start.toISOString(),
          end: rehearsal.end ? rehearsal.end.toISOString() : null,
          location: rehearsal.location ?? "",
          description: rehearsal.description,
        }}
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
