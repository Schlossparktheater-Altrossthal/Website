import { notFound } from "next/navigation";

import { PageHeader } from "@/components/members/page-header";
import { readEventView } from "@/lib/calendar/event-view-server";
import { membersNavigationBreadcrumb } from "@/lib/members-breadcrumbs";
import { requireAuth } from "@/lib/rbac";

import { EventView } from "./event-view";

/** Ein Termin für alle, die ihn sehen dürfen: Ablauf, Leute, eigene Rückmeldung. */
export default async function EventPage({ params }: { params: Promise<{ eventId: string }> }) {
  const session = await requireAuth();
  const userId = session.user?.id;
  const { eventId } = await params;
  if (!userId || !eventId) notFound();

  const view = await readEventView(eventId, session.user, userId);
  if (!view.ok) {
    return <div className="text-sm text-muted-foreground">{view.message}</div>;
  }

  const breadcrumbs = [
    membersNavigationBreadcrumb("/mitglieder/meine-proben"),
    { id: eventId, label: view.props.event.title, isCurrent: true },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title={view.props.event.title} breadcrumbs={breadcrumbs} />
      <EventView {...view.props} />
    </div>
  );
}
