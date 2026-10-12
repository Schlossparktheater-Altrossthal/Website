import { notFound, redirect } from "next/navigation";

import { PageHeader } from "@/components/members/page-header";
import { getProtocolAccess, readProtocol } from "@/lib/calendar/protocol-server";
import { requireAuth } from "@/lib/rbac";

import { ProbeMode } from "./probe-mode";

/** Bis eine Stunde vor Beginn gilt der Probenmodus als Vorbereitung. */
const PREPARE_UNTIL_MS = 60 * 60 * 1000;

/**
 * Probenmodus: vorab Hinweise sammeln, während der Probe Anwesenheit, Zeiten und Szenen erfassen –
 * live und offline. Gewerk-Leitungen sehen nur die Notizen.
 */
export default async function ProbePage({ params }: { params: Promise<{ eventId: string }> }) {
  const session = await requireAuth();
  const { eventId } = await params;
  if (!session.user?.id || !eventId) notFound();

  const data = await readProtocol(eventId);
  if (!data) notFound();
  const { event, state, candidates, scenes, assignees } = data;
  if (event.status === "DRAFT" || event.status === "CANCELLED") {
    redirect(`/mitglieder/termine/${eventId}`);
  }
  const access = event.departmentId ? null : await getProtocolAccess(session.user, event.showId);
  if (!access) redirect(`/mitglieder/termine/${eventId}`);
  const preparing =
    !event.actualStart && event.start.getTime() - new Date().getTime() > PREPARE_UNTIL_MS;

  const breadcrumbs = [
    { id: event.id, label: event.title || "Termin", href: `/mitglieder/termine/${event.id}` },
    {
      id: `${event.id}-probe`,
      label: access === "notes" ? "Hinweise" : "Probenmodus",
      isCurrent: true,
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title={access === "notes" ? "Hinweise zur Probe" : "Probenmodus"}
        breadcrumbs={breadcrumbs}
      />
      <ProbeMode
        eventId={event.id}
        title={event.title || "Probe"}
        plannedStart={event.start.toISOString()}
        plannedEnd={event.end?.toISOString() ?? null}
        serverState={state}
        candidates={candidates}
        scenes={scenes}
        assignees={assignees}
        sentAt={event.protocolSentAt?.toISOString() ?? null}
        access={access}
        userId={session.user.id}
        initialPreparing={preparing}
      />
    </div>
  );
}
