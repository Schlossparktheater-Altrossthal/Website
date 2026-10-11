import { TicketShowPicker } from "@/components/karten/show-picker";
import { TicketsNav } from "@/components/karten/tickets-nav";
import { PageHeader } from "@/components/members/page-header";
import type { TicketActor } from "@/lib/karten/access";
import { resolveTicketShow } from "@/lib/karten/context";
import { loadOfficeData } from "@/lib/karten/office-data";
import type { MembersBreadcrumbItem } from "@/lib/members-breadcrumbs";

import { OfficeWorkbench } from "./office-workbench";
import { toOfficeReservation } from "./types";

/** Kartenbüro – im Mitgliederbereich und unter /kartenbuero gleich. */
export async function OfficePage({
  actor,
  basePath,
  searchParams,
  breadcrumbs,
}: {
  actor: TicketActor;
  basePath: string;
  searchParams: { produktion?: string; vorstellung?: string };
  breadcrumbs?: readonly (MembersBreadcrumbItem | null)[];
}) {
  const { shows, selected } = await resolveTicketShow(actor, searchParams.produktion);
  if (!selected) {
    return (
      <div className="space-y-6">
        <PageHeader title="Reservierungen" breadcrumbs={breadcrumbs} />
        <p className="py-12 text-center text-sm text-muted-foreground">
          Für keine Produktion ist der Kartenverkauf eingerichtet.
        </p>
      </div>
    );
  }
  const data = await loadOfficeData(selected.id, searchParams.vorstellung);
  return (
    <div className="space-y-4">
      <PageHeader
        title="Reservierungen"
        description={`${selected.title} · Taste „n“ für neue Reservierung, „/“ zum Suchen`}
        breadcrumbs={breadcrumbs}
        actions={<TicketShowPicker shows={shows} selectedId={selected.id} />}
      />
      <TicketsNav actor={actor} basePath={basePath} active="buero" showId={selected.id} />
      <OfficeWorkbench
        showId={selected.id}
        performances={data.performances}
        categories={data.categories}
        selectedEventId={data.selectedEventId}
        reservations={data.reservations.map(toOfficeReservation)}
      />
    </div>
  );
}
