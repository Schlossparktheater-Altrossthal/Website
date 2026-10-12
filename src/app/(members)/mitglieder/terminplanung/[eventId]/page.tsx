import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { Button } from "@/components/ui/button";

import { PageHeader } from "@/components/members/page-header";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { requireAuth } from "@/lib/rbac";
import { getActiveProduction } from "@/lib/active-production";

import { EventEditor } from "../event-editor";
import { EventSwitcherList, EventSwitcherNav, type SwitcherEvent } from "../event-switcher";
import { MembersContentLayout } from "@/components/members/members-app-shell";
import { membersNavigationBreadcrumb } from "@/lib/members-breadcrumbs";
import { DEFAULT_TIME_ZONE, formatIsoDateInTimeZone } from "@/lib/date-time";
import { loadAudienceContext, readEventAudience } from "@/lib/calendar/audience-server";
import { readDayAvailability, readWeekLoad } from "@/lib/calendar/day-availability";
import { buildScenePlan } from "@/lib/calendar/scene-plan";
import {
  loadScenePlanEntries,
  loadSceneStats,
  readEventSchedule,
} from "@/lib/calendar/scene-schedule-server";

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
  const DAY_MS = 24 * 60 * 60 * 1000;
  const [
    context,
    audience,
    availability,
    schedule,
    sceneStats,
    production,
    weekLoad,
    planEntries,
    nearby,
  ] = await Promise.all([
    loadAudienceContext(rehearsal.showId),
    readEventAudience(rehearsal.id),
    readDayAvailability(dateKey),
    readEventSchedule(rehearsal.id),
    loadSceneStats(rehearsal.showId),
    getActiveProduction(session.user?.id),
    readWeekLoad(dateKey, rehearsal.id),
    rehearsal.showId ? loadScenePlanEntries(rehearsal.showId) : Promise.resolve([]),
    // Termine rund um diesen zum Durchwechseln: dieselbe Produktion und produktionslose.
    prisma.calendarEvent.findMany({
      where: {
        departmentId: null,
        ...(rehearsal.showId ? { OR: [{ showId: rehearsal.showId }, { showId: null }] } : {}),
        start: {
          gte: new Date(rehearsal.start.getTime() - 21 * DAY_MS),
          lte: new Date(rehearsal.start.getTime() + 60 * DAY_MS),
        },
      },
      orderBy: [{ start: "asc" }, { id: "asc" }],
      take: 120,
      select: { id: true, title: true, start: true, allDay: true, status: true, kind: true },
    }),
  ]);
  const switcherEvents: SwitcherEvent[] = nearby.map((event) => ({
    id: event.id,
    title: event.title,
    start: event.start.toISOString(),
    allDay: event.allDay,
    status: event.status,
    isRehearsal: event.kind === "REHEARSAL",
  }));
  // Rückstand je Szene in Probenwochen – Grundlage für „Probe vorschlagen“.
  const todayKey = formatIsoDateInTimeZone(new Date().toISOString(), DEFAULT_TIME_ZONE);
  const sceneUrgency = Object.fromEntries(
    buildScenePlan({
      scenes: context.scenes,
      entries: planEntries,
      todayKey,
      premiereKey: null,
    }).rows.map((row) => [row.sceneId, { blocksSince: row.blocksSince, behind: row.behind }]),
  );
  // Für den Wechsel „gilt für“: Zielgruppe der anderen Seite (alle bzw. Produktion).
  const otherShowId = rehearsal.showId ? null : (production?.id ?? null);
  const otherContext =
    rehearsal.showId || otherShowId ? await loadAudienceContext(otherShowId) : null;
  const productionTitle = production ? (production.title ?? String(production.year)) : null;

  // Probenmodus jederzeit: vorab Hinweise sammeln, ab einer Stunde vor Beginn protokollieren.
  const protocolOpen = rehearsal.status === "SCHEDULED" || rehearsal.status === "TENTATIVE";
  const preparing =
    !rehearsal.actualStart && rehearsal.start.getTime() - new Date().getTime() > 60 * 60 * 1000;

  const breadcrumbs = [
    membersNavigationBreadcrumb("/mitglieder/terminplanung"),
    { id: rehearsal.id, label: rehearsal.title || "Termin", isCurrent: true },
  ];
  const noun = rehearsal.kind === "REHEARSAL" ? "Probe" : "Termin";

  return (
    // Breite Bildschirme: links die Terminliste zum Durchwechseln.
    <div className="min-[100rem]:grid min-[100rem]:grid-cols-[15rem_minmax(0,1fr)] min-[100rem]:gap-6">
      <MembersContentLayout width="full" />
      <aside className="hidden min-[100rem]:sticky min-[100rem]:top-4 min-[100rem]:flex min-[100rem]:max-h-[calc(100dvh-var(--header-height)-2rem)] min-[100rem]:flex-col min-[100rem]:self-start">
        <EventSwitcherList events={switcherEvents} currentId={rehearsal.id} />
      </aside>
      <div className="min-w-0 space-y-6">
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
          actions={<EventSwitcherNav events={switcherEvents} currentId={rehearsal.id} />}
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
          sceneUrgency={sceneUrgency}
        />

        {protocolOpen ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted p-4">
            <p className="text-sm text-muted-foreground">
              {preparing
                ? "Hinweise, Aufgaben und Ablauf schon vorab im Probenmodus hinterlegen – Anwesenheit und Zeiten ab einer Stunde vor Beginn."
                : "Anwesenheit, tatsächliche Zeiten und geprobte Szenen erfasst der Probenmodus – auch live auf mehreren Geräten."}
            </p>
            <Button asChild variant="outline" size="sm">
              <Link href={`/mitglieder/termine/${rehearsal.id}/probe`}>
                {preparing ? "Probe vorbereiten" : "Probenmodus öffnen"}
              </Link>
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
