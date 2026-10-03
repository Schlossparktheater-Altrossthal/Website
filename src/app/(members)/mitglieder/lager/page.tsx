import { cookies } from "next/headers";
import Link from "next/link";

import { AssetFilters } from "@/components/inventory/asset-filters";
import { AssetList } from "@/components/inventory/asset-list";
import { AssetTable } from "@/components/inventory/asset-table";
import { AssetViewToggle } from "@/components/inventory/asset-view-toggle";
import { ProductList } from "@/components/inventory/product-list";
import { LagerNav } from "@/components/inventory/lager-nav";
import { NoInventoryAccess } from "@/components/inventory/no-access";
import { PageHeader } from "@/components/members/page-header";
import {
  AlertTriangleIcon,
  ArrowRightLeftIcon,
  DownloadIcon,
  LayoutGridIcon,
  ListIcon,
  PlusIcon,
  PrinterIcon,
  QrCodeIcon,
  ScanLineIcon,
  SettingsIcon,
  ShieldCheckIcon,
} from "@/components/ui/action-icons";
import { Button } from "@/components/ui/button";
import { StatTile } from "@/components/ui/stat-tile";
import {
  INVENTORY_BASE_PATH,
  INVENTORY_TABLE_PAGE_SIZE,
  INVENTORY_VIEW_COOKIE,
  type InventoryDisplay,
} from "@/lib/inventory/constants";
import {
  getInventoryOverviewStats,
  listInventoryAreas,
  listContainerOptions,
  listInventoryAssets,
  listInventoryProducts,
  listLocationOptions,
  parseInventorySort,
  type InventoryListFilter,
} from "@/lib/inventory/queries";
import { getInventoryAccess } from "@/lib/inventory/service";
import { membersNavigationBreadcrumb } from "@/lib/members-breadcrumbs";
import { requireAuth } from "@/lib/rbac";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

type View = NonNullable<InventoryListFilter["view"]>;
const VIEWS: readonly View[] = [
  "all",
  "defects",
  "inspection",
  "checked_out",
  "missing",
  "unlabeled",
  "low",
  "retired",
];

function isView(value: string | undefined): value is View {
  return VIEWS.some((view) => view === value);
}

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function LagerPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await requireAuth();
  const access = await getInventoryAccess(session.user);
  if (!access.canUse) return <NoInventoryAccess />;

  const params = await searchParams;
  const view = first(params.ansicht);
  // Tabelle nur am Desktop; mobil zeigt dieselbe Seite die Liste.
  const displayParam = first(params.darstellung);
  const display: InventoryDisplay =
    displayParam === "tabelle" || displayParam === "liste"
      ? displayParam
      : (await cookies()).get(INVENTORY_VIEW_COOKIE)?.value === "tabelle"
        ? "tabelle"
        : "liste";
  const table = display === "tabelle";
  const filter: InventoryListFilter = {
    query: first(params.q),
    areaId: first(params.bereich),
    locationId: first(params.ort),
    view: isView(view) ? view : "all",
    page: Number(first(params.seite)) || 1,
    ...(table
      ? { sort: parseInventorySort(first(params.sortierung)), pageSize: INVENTORY_TABLE_PAGE_SIZE }
      : {}),
  };

  // Liste ohne Sonderansicht: nach Artikeltyp gruppiert. Sonderansichten (Mängel, Prüfung …)
  // und die Tabelle zeigen einzelne Exemplare.
  const grouped = !table && filter.view === "all";
  const [stats, areas, locations, list, containers] = await Promise.all([
    getInventoryOverviewStats(),
    listInventoryAreas(),
    listLocationOptions(),
    grouped
      ? listInventoryProducts(filter).then((result) => ({ ...result, kind: "products" as const }))
      : listInventoryAssets(filter).then((result) => ({ ...result, kind: "assets" as const })),
    table ? listContainerOptions() : Promise.resolve([]),
  ]);

  const pageHref = (page: number) => {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      const entry = first(value);
      if (entry && key !== "seite") search.set(key, entry);
    }
    if (page > 1) search.set("seite", String(page));
    const text = search.toString();
    return text ? `${INVENTORY_BASE_PATH}?${text}` : INVENTORY_BASE_PATH;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Lager"
        description="Technik, Kostüme, Requisiten und Material – erfassen, finden, ausgeben."
        breadcrumbs={[membersNavigationBreadcrumb(INVENTORY_BASE_PATH)]}
      />
      <LagerNav active="uebersicht" canManage={access.canManage} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Link
          href={`${INVENTORY_BASE_PATH}/scannen`}
          className="flex min-h-16 items-center gap-4 rounded-xl border border-primary/30 bg-gradient-to-br from-primary/15 via-card to-card p-4 shadow-sm transition-colors hover:border-primary/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <ScanLineIcon className="h-6 w-6" />
          </span>
          <span className="min-w-0">
            <span className="block text-base font-semibold text-foreground">Scannen</span>
            <span className="block text-sm text-muted-foreground">
              Nachschlagen, einlagern, ausgeben
            </span>
          </span>
        </Link>
        <Link
          href={`${INVENTORY_BASE_PATH}/neu`}
          className="flex min-h-16 items-center gap-4 rounded-xl border border-border bg-card p-4 shadow-sm transition-colors hover:border-primary/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
            <PlusIcon className="h-6 w-6" />
          </span>
          <span className="min-w-0">
            <span className="block text-base font-semibold text-foreground">Erfassen</span>
            <span className="block text-sm text-muted-foreground">
              Artikel wählen, Anzahl und Ort
            </span>
          </span>
        </Link>
      </div>
      <p className="-mt-3 hidden text-right text-sm lg:block">
        <Link
          href={`${INVENTORY_BASE_PATH}/neu/tabelle`}
          className="inline-flex items-center gap-1.5 font-medium text-muted-foreground hover:text-foreground"
        >
          <LayoutGridIcon className="h-4 w-4" />
          Viele auf einmal erfassen (Tabelle)
        </Link>
      </p>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Offene Mängel"
          value={stats.defects}
          tone={stats.defects ? "warning" : "neutral"}
          icon={<AlertTriangleIcon className="h-4 w-4" />}
          href={`${INVENTORY_BASE_PATH}?ansicht=defects`}
        />
        <StatTile
          label="Prüfung fällig"
          value={stats.inspections}
          tone={stats.inspections ? "destructive" : "neutral"}
          icon={<ShieldCheckIcon className="h-4 w-4" />}
          href={`${INVENTORY_BASE_PATH}/pruefungen`}
        />
        <StatTile
          label="Ausgegeben"
          value={stats.checkedOut}
          tone="info"
          icon={<ArrowRightLeftIcon className="h-4 w-4" />}
          href={`${INVENTORY_BASE_PATH}/ausgaben`}
        />
        <StatTile
          label="Ohne Etikett"
          value={stats.unlabeled}
          tone={stats.unlabeled ? "primary" : "neutral"}
          icon={<QrCodeIcon className="h-4 w-4" />}
          href={`${INVENTORY_BASE_PATH}/etiketten`}
        />
      </div>

      {stats.lowStock || stats.openStocktakes ? (
        <div className="flex flex-wrap gap-2 text-sm">
          {stats.openStocktakes ? (
            <Link
              href={`${INVENTORY_BASE_PATH}/inventur`}
              className="rounded-full border border-info/40 bg-info/10 px-3 py-1 font-medium text-foreground hover:border-info"
            >
              {stats.openStocktakes === 1
                ? "Inventur läuft – mitzählen"
                : `${stats.openStocktakes} Inventuren laufen`}
            </Link>
          ) : null}
          {stats.lowStock ? (
            <Link
              href={`${INVENTORY_BASE_PATH}?ansicht=low`}
              className="rounded-full border border-warning/40 bg-warning/10 px-3 py-1 font-medium text-foreground hover:border-warning"
            >
              {stats.lowStock} unter Mindestbestand
            </Link>
          ) : null}
        </div>
      ) : null}

      <section className="space-y-3" aria-labelledby="lager-bestand">
        <div className="flex flex-wrap items-center gap-2">
          <h2 id="lager-bestand" className="text-lg font-semibold text-foreground">
            Bestand
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              {list.kind === "products"
                ? `${list.total} Artikel`
                : `${list.total} ${list.total === 1 ? "Exemplar" : "Exemplare"}`}
            </span>
          </h2>
          <div className="ml-auto flex flex-wrap gap-2">
            <AssetViewToggle value={display} />
            <Button asChild variant="outline" size="sm">
              <Link href={`${INVENTORY_BASE_PATH}/etiketten`}>
                <PrinterIcon className="mr-2 h-4 w-4" />
                Etiketten
              </Link>
            </Button>
            {access.canManage ? (
              <Button asChild variant="outline" size="sm">
                <a href="/api/lager/export" download>
                  <DownloadIcon className="mr-2 h-4 w-4" />
                  CSV
                </a>
              </Button>
            ) : null}
            {access.canCatalog ? (
              <Button asChild variant="outline" size="sm">
                <Link href={`${INVENTORY_BASE_PATH}/katalog`}>
                  <ListIcon className="mr-2 h-4 w-4" />
                  Kategorien
                </Link>
              </Button>
            ) : null}
            {access.canManage ? (
              <Button asChild variant="outline" size="sm">
                <Link href={`${INVENTORY_BASE_PATH}/einstellungen`}>
                  <SettingsIcon className="mr-2 h-4 w-4" />
                  Bereiche
                </Link>
              </Button>
            ) : null}
          </div>
        </div>
        <AssetFilters
          areas={areas.map((area) => ({ id: area.id, name: area.name }))}
          locations={locations.map((location) => ({ id: location.id, path: location.path }))}
        />
        {list.kind === "products" ? (
          list.items.length ? (
            <ProductList items={list.items} />
          ) : (
            <div className="rounded-lg border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">
              {stats.total === 0
                ? "Noch nichts erfasst. Leg mit „Erfassen“ den ersten Artikel an."
                : "Keine Treffer für diese Auswahl."}
            </div>
          )
        ) : list.items.length && table ? (
          <>
            <div className="lg:hidden">
              <AssetList items={list.items} />
            </div>
            <div className="hidden lg:block">
              <AssetTable
                items={list.items}
                areas={areas.map((area) => ({
                  id: area.id,
                  prefix: area.prefix,
                  categories: area.categories,
                }))}
                placementOptions={{ locations, containers }}
                sort={filter.sort}
                canManage={access.canManage}
              />
            </div>
          </>
        ) : list.items.length ? (
          <AssetList items={list.items} />
        ) : (
          <div className="rounded-lg border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">
            {stats.total === 0
              ? "Noch nichts erfasst. Leg mit „Erfassen“ das erste Objekt an."
              : "Keine Treffer für diese Auswahl."}
          </div>
        )}
        {list.pageCount > 1 ? (
          <nav className="flex items-center justify-between gap-2" aria-label="Seiten">
            {list.page > 1 ? (
              <Button asChild variant="outline" size="sm">
                <Link href={pageHref(list.page - 1)}>Zurück</Link>
              </Button>
            ) : (
              <span />
            )}
            <span className="text-sm text-muted-foreground">
              Seite {list.page} von {list.pageCount}
            </span>
            {list.page < list.pageCount ? (
              <Button asChild variant="outline" size="sm">
                <Link href={pageHref(list.page + 1)}>Weiter</Link>
              </Button>
            ) : (
              <span />
            )}
          </nav>
        ) : null}
      </section>
    </div>
  );
}
