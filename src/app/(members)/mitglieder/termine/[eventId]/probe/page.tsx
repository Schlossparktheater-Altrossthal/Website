import { notFound, redirect } from "next/navigation";

import { PageHeader } from "@/components/members/page-header";
import { canEditProtocol, readProtocol } from "@/lib/calendar/protocol-server";
import { requireAuth } from "@/lib/rbac";

import { ProbeMode } from "./probe-mode";

/** Probenmodus: während der Probe Anwesenheit, Zeiten und Szenen erfassen – live und offline. */
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
  if (!(await canEditProtocol(session.user, event.showId))) {
    redirect(`/mitglieder/termine/${eventId}`);
  }

  const breadcrumbs = [
    { id: event.id, label: event.title || "Termin", href: `/mitglieder/termine/${event.id}` },
    { id: `${event.id}-probe`, label: "Probenmodus", isCurrent: true },
  ];

  return (
    <div className="space-y-4">
      <PageHeader title="Probenmodus" breadcrumbs={breadcrumbs} />
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
      />
    </div>
  );
}
