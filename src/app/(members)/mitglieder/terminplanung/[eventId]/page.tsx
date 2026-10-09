import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { Button } from "@/components/ui/button";

import { PageHeader } from "@/components/members/page-header";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { requireAuth } from "@/lib/rbac";
import { getActiveProduction } from "@/lib/active-production";

import { EventEditor } from "../event-editor";
import { membersNavigationBreadcrumb } from "@/lib/members-breadcrumbs";
import { DEFAULT_TIME_ZONE, formatIsoDateInTimeZone } from "@/lib/date-time";
import { loadAudienceContext, readEventAudience } from "@/lib/calendar/audience-server";
import { readDayAvailability, readWeekLoad } from "@/lib/calendar/day-availability";
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
  const [context, audience, availability, schedule, sceneStats, production, weekLoad] =
    await Promise.all([
      loadAudienceContext(rehearsal.showId),
      readEventAudience(rehearsal.id),
      readDayAvailability(dateKey),
      readEventSchedule(rehearsal.id),
      loadSceneStats(rehearsal.showId),
      getActiveProduction(session.user?.id),
      readWeekLoad(dateKey, rehearsal.id),
    ]);
  // Für den Wechsel „gilt für“: Zielgruppe der anderen Seite (alle bzw. Produktion).
  const otherShowId = rehearsal.showId ? null : (production?.id ?? null);
  const otherContext =
    rehearsal.showId || otherShowId ? await loadAudienceContext(otherShowId) : null;
  const productionTitle = production ? (production.title ?? String(production.year)) : null;

  // Ab einer Stunde vor Beginn: Probenmodus für Anwesenheit, Zeiten und Szenen.
  const protocolOpen =
    rehearsal.status === "SCHEDULED" || rehearsal.status === "TENTATIVE"
      ? rehearsal.start.getTime() - new Date().getTime() <= 60 * 60 * 1000
      : false;

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
            : rehearsal.status === "CANCELLED"
              ? "Abgesagt – Eingeladene sehen den Termin durchgestrichen."
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
          cancelReason: rehearsal.cancelReason,
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
        initialWeekLoad={weekLoad}
        declined={audience.declined}
        schedule={schedule}
        sceneStats={sceneStats}
      />

      {protocolOpen ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted p-4">
          <p className="text-sm text-muted-foreground">
            Anwesenheit, tatsächliche Zeiten und geprobte Szenen erfasst der Probenmodus – auch live
            auf mehreren Geräten.
          </p>
          <Button asChild variant="outline" size="sm">
            <Link href={`/mitglieder/termine/${rehearsal.id}/probe`}>Probenmodus öffnen</Link>
          </Button>
        </div>
      ) : null}
    </div>
  );
}
