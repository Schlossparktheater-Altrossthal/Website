import { TicketShowPicker } from "@/components/karten/show-picker";
import { TicketsNav } from "@/components/karten/tickets-nav";
import { PageHeader } from "@/components/members/page-header";
import type { TicketActor } from "@/lib/karten/access";
import { loadDoorSnapshot } from "@/lib/karten/checkin";
import { resolveTicketShow } from "@/lib/karten/context";
import { loadPerformances, loadTicketCategories } from "@/lib/karten/queries";
import type { MembersBreadcrumbItem } from "@/lib/members-breadcrumbs";

import { DoorWorkbench } from "./door-workbench";

/** Vorstellung am Abend: die heutige bzw. nächste, sonst die gewählte. */
function pickPerformance<T extends { eventId: string; start: Date; configured: boolean }>(
  performances: T[],
  requested: string | undefined,
  now: Date,
) {
  const configured = performances.filter((row) => row.configured);
  return (
    configured.find((row) => row.eventId === requested) ??
    configured.find((row) => row.start.getTime() > now.getTime() - 4 * 3600_000) ??
    configured.at(-1) ??
    null
  );
}

export async function DoorPage({
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
  const now = new Date();
  const performances = selected
    ? await loadPerformances(selected.id, { includePast: true, now })
    : [];
  const performance = pickPerformance(performances, searchParams.vorstellung, now);
  const header = (
    <>
      <PageHeader
        title="Einlass"
        description={selected?.title}
        breadcrumbs={breadcrumbs}
        actions={<TicketShowPicker shows={shows} selectedId={selected?.id ?? null} />}
      />
      <TicketsNav
        actor={actor}
        basePath={basePath}
        active="einlass"
        showId={selected?.id ?? null}
      />
    </>
  );
  if (!selected || !performance) {
    return (
      <div className="space-y-4">
        {header}
        <p className="py-12 text-center text-sm text-muted-foreground">
          Keine eingerichtete Vorstellung gefunden.
        </p>
      </div>
    );
  }
  const [snapshot, categories] = await Promise.all([
    loadDoorSnapshot(performance.eventId),
    loadTicketCategories(selected.id, { activeOnly: true }),
  ]);
  return (
    <div className="space-y-4">
      {header}
      <DoorWorkbench
        key={performance.eventId}
        initialSnapshot={snapshot}
        performances={performances.map((row) => ({
          eventId: row.eventId,
          start: row.start.toISOString(),
          cancelled: row.cancelled,
          configured: row.configured,
        }))}
        categories={categories.map((category) => ({
          id: category.id,
          name: category.name,
          priceCents: category.priceCents,
        }))}
      />
    </div>
  );
}
