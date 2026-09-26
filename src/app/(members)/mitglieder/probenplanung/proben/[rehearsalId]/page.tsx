import { notFound } from "next/navigation";

import { PageHeader } from "@/components/members/page-header";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { requireAuth } from "@/lib/rbac";

import { RehearsalEditor } from "../../rehearsal-editor";
import { membersNavigationBreadcrumb } from "@/lib/members-breadcrumbs";
import { DEFAULT_TIME_ZONE, formatIsoDateInTimeZone } from "@/lib/date-time";
import { loadAudienceContext, readEventAudience } from "@/lib/calendar/audience-server";
import { readDayAvailability } from "@/lib/calendar/day-availability";

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
  const [context, audience, availability] = await Promise.all([
    loadAudienceContext(rehearsal.showId),
    readEventAudience(rehearsal.id),
    readDayAvailability(dateKey),
  ]);

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
      />
    </div>
  );
}
