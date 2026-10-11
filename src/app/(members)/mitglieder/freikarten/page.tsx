import { FreeTicketsPanel } from "@/components/karten/free-tickets/free-tickets-panel";
import { PageHeader } from "@/components/members/page-header";
import { showOptionLabel } from "@/lib/karten/context";
import { loadMyFreeTicketShows } from "@/lib/karten/free-tickets";
import { loadPerformances } from "@/lib/karten/queries";
import { membersNavigationBreadcrumb } from "@/lib/members-breadcrumbs";
import { requireAuth } from "@/lib/rbac";

export default async function FreeTicketsPage() {
  const session = await requireAuth();
  const userId = session.user?.id;
  const shows = userId ? await loadMyFreeTicketShows(userId) : [];
  const now = new Date();
  const panels = await Promise.all(
    shows.map(async (entry) => ({
      ...entry,
      performances: (await loadPerformances(entry.show.id, { now })).filter(
        (row) => row.configured && !row.cancelled && row.start > now,
      ),
    })),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Freikarten"
        description="Als Mitwirkender kannst du Freikarten für Familie und Freunde auf deren Namen anmelden."
        breadcrumbs={[membersNavigationBreadcrumb("/mitglieder/freikarten")]}
      />
      {panels.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          Zurzeit gibt es keine Produktion mit Kartenverkauf, an der du mitwirkst.
        </p>
      ) : (
        panels.map(({ show, quota, reservations, performances }) => (
          <FreeTicketsPanel
            key={show.id}
            title={showOptionLabel(show)}
            quota={quota}
            deadlinePassed={
              show.ticketingSettings?.freeTicketDeadline
                ? show.ticketingSettings.freeTicketDeadline <= now
                : false
            }
            performances={performances.map((row) => ({
              eventId: row.eventId,
              start: row.start.toISOString(),
              free: row.availability.online,
              bookable: row.availability.online > 0,
            }))}
            entries={reservations.map((reservation) => ({
              id: reservation.id,
              name: reservation.name,
              email: reservation.email,
              quantity: reservation.items.reduce((sum, item) => sum + item.quantity, 0),
              start: reservation.event.start.toISOString(),
              status: reservation.status,
              checkedIn: reservation.checkedInCount,
              past: reservation.event.start <= now,
            }))}
          />
        ))
      )}
    </div>
  );
}
