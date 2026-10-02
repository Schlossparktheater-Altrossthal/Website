import { LagerNav } from "@/components/inventory/lager-nav";
import { NoInventoryAccess } from "@/components/inventory/no-access";
import { StocktakeCreate } from "@/components/inventory/stocktake-create";
import { ToneBadge } from "@/components/inventory/tone-badge";
import { PageHeader } from "@/components/members/page-header";
import { ClipboardCheckIcon } from "@/components/ui/action-icons";
import { ListRow, ListRowGroup } from "@/components/ui/list-row";
import { formatInventoryDate, INVENTORY_BASE_PATH } from "@/lib/inventory/constants";
import { listInventoryAreas, listLocationOptions } from "@/lib/inventory/queries";
import { getInventoryAccess } from "@/lib/inventory/service";
import { membersNavigationBreadcrumb } from "@/lib/members-breadcrumbs";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";

export default async function StocktakesPage() {
  const session = await requireAuth();
  const access = await getInventoryAccess(session.user);
  if (!access.canUse) return <NoInventoryAccess />;

  const [stocktakes, areas, locations] = await Promise.all([
    prisma.inventoryStocktake.findMany({
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      take: 30,
      select: {
        id: true,
        title: true,
        status: true,
        createdAt: true,
        closedAt: true,
        area: { select: { name: true } },
        location: { select: { name: true } },
        _count: { select: { scans: true } },
      },
    }),
    access.canManage ? listInventoryAreas() : Promise.resolve([]),
    access.canManage ? listLocationOptions() : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventur"
        description="Mehrere Personen zählen gleichzeitig, auch ohne Netz. Am Ende wird abgeglichen."
        breadcrumbs={[membersNavigationBreadcrumb(INVENTORY_BASE_PATH)]}
      />
      <LagerNav active="inventur" canManage={access.canManage} />
      {access.canManage ? (
        <StocktakeCreate
          areas={areas.map((area) => ({ id: area.id, name: area.name }))}
          locations={locations.map((location) => ({ id: location.id, path: location.path }))}
        />
      ) : null}
      {stocktakes.length ? (
        <ListRowGroup variant="inset" className="bg-card">
          {stocktakes.map((stocktake) => (
            <ListRow
              key={stocktake.id}
              href={`${INVENTORY_BASE_PATH}/inventur/${stocktake.id}`}
              leading={<ClipboardCheckIcon className="h-5 w-5 text-muted-foreground" />}
              title={stocktake.title}
              description={[
                stocktake.area?.name ?? "Alle Bereiche",
                stocktake.location?.name ?? "alle Orte",
                `${stocktake._count.scans} Scans`,
                stocktake.status === "closed"
                  ? `abgeschlossen ${formatInventoryDate(stocktake.closedAt)}`
                  : `seit ${formatInventoryDate(stocktake.createdAt)}`,
              ].join(" · ")}
              trailing={
                <ToneBadge tone={stocktake.status === "open" ? "info" : "muted"}>
                  {stocktake.status === "open" ? "Läuft" : "Fertig"}
                </ToneBadge>
              }
            />
          ))}
        </ListRowGroup>
      ) : (
        <p className="rounded-lg border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">
          Noch keine Inventur.{" "}
          {access.canManage ? "Starte eine – alle mit Lagerzugriff können mitzählen." : ""}
        </p>
      )}
    </div>
  );
}
