import { AccessCard } from "@/components/karten/settings/access-card";
import { CategoriesCard } from "@/components/karten/settings/categories-card";
import { FreeTicketsCard } from "@/components/karten/settings/free-tickets-card";
import { GeneralSettingsCard } from "@/components/karten/settings/general-settings-card";
import { PerformancesCard } from "@/components/karten/settings/performances-card";
import { TicketShowPicker } from "@/components/karten/show-picker";
import { TicketsNav } from "@/components/karten/tickets-nav";
import { PageHeader } from "@/components/members/page-header";
import { getTicketActor } from "@/lib/karten/access";
import { MEMBERS_TICKETS_PATH, toDateTimeLocalValue } from "@/lib/karten/constants";
import { resolveTicketShow } from "@/lib/karten/context";
import { loadFreeTicketOverview } from "@/lib/karten/free-tickets";
import {
  loadPerformances,
  loadTicketCategories,
  loadTicketingSettings,
} from "@/lib/karten/queries";
import { membersNavigationBreadcrumb } from "@/lib/members-breadcrumbs";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";

export default async function TicketSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ produktion?: string }>;
}) {
  await requireAuth();
  const actor = await getTicketActor();
  if (!actor || actor.kind !== "member" || !actor.canManage) {
    return (
      <div className="space-y-6">
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          Kein Zugriff auf die Einstellungen des Kartenverkaufs.
        </div>
      </div>
    );
  }
  const { produktion } = await searchParams;
  const { shows, selected } = await resolveTicketShow(actor, produktion);
  const breadcrumbs = [membersNavigationBreadcrumb(MEMBERS_TICKETS_PATH)];

  if (!selected) {
    return (
      <div className="space-y-6">
        <PageHeader title="Karten · Einstellungen" breadcrumbs={breadcrumbs} />
        <p className="py-12 text-center text-sm text-muted-foreground">
          Es gibt noch keine Produktion.
        </p>
      </div>
    );
  }

  const now = new Date();
  const [settings, categories, performances, freeTickets, accesses] = await Promise.all([
    loadTicketingSettings(selected.id),
    loadTicketCategories(selected.id),
    loadPerformances(selected.id, { includePast: true }),
    loadFreeTicketOverview(selected.id),
    prisma.boxOfficeAccess.findMany({
      where: { showId: selected.id },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Karten · Einstellungen"
        description="Kartenarten, Plätze je Vorstellung, Freikarten und Zugänge fürs Kartenbüro."
        breadcrumbs={breadcrumbs}
        actions={<TicketShowPicker shows={shows} selectedId={selected.id} />}
      />
      <TicketsNav
        actor={actor}
        basePath={MEMBERS_TICKETS_PATH}
        active="einstellungen"
        showId={selected.id}
      />
      <GeneralSettingsCard
        key={`general-${selected.id}`}
        showId={selected.id}
        initial={{
          enabled: settings?.enabled ?? false,
          holdMinutes: settings?.holdMinutes ?? 120,
          maxSeatsPerBooking: settings?.maxSeatsPerBooking ?? 10,
          freeTicketsPerMember: settings?.freeTicketsPerMember ?? 2,
          freeTicketDeadline: toDateTimeLocalValue(settings?.freeTicketDeadline),
          infoText: settings?.infoText ?? "",
          retentionDays: settings?.retentionDays ?? 90,
        }}
      />
      <CategoriesCard
        showId={selected.id}
        categories={categories.map((category) => ({
          id: category.id,
          name: category.name,
          description: category.description,
          priceCents: category.priceCents,
          needsSeat: category.needsSeat,
          onlineBookable: category.onlineBookable,
          isActive: category.isActive,
        }))}
      />
      <PerformancesCard
        performances={performances.map((row) => ({
          eventId: row.eventId,
          start: row.start.toISOString(),
          cancelled: row.cancelled,
          configured: row.configured,
          capacity: row.capacity,
          onlineLimit: row.onlineLimit,
          boxOfficeReserve: row.boxOfficeReserve,
          salesOpen: row.salesOpen,
          salesEndAt: toDateTimeLocalValue(row.salesEndAt),
          taken: row.availability.taken,
          freeOnline: row.availability.online,
        }))}
      />
      <FreeTicketsCard
        showId={selected.id}
        rows={freeTickets}
        defaultQuantity={settings?.freeTicketsPerMember ?? 2}
      />
      <AccessCard
        showId={selected.id}
        accesses={accesses.map((access) => ({
          id: access.id,
          name: access.name,
          email: access.email,
          canCheckIn: access.canCheckIn,
          expiresAt: access.expiresAt.toISOString(),
          revokedAt: access.revokedAt?.toISOString() ?? null,
          lastUsedAt: access.lastUsedAt?.toISOString() ?? null,
          active: !access.revokedAt && access.expiresAt > now,
        }))}
      />
    </div>
  );
}
