import Link from "next/link";
import { notFound } from "next/navigation";

import { NoInventoryAccess } from "@/components/inventory/no-access";
import { ToneBadge } from "@/components/inventory/tone-badge";
import { PageHeader } from "@/components/members/page-header";
import {
  MapPinIcon,
  PackageIcon,
  PlusIcon,
  PrinterIcon,
  ScanLineIcon,
} from "@/components/ui/action-icons";
import { Button } from "@/components/ui/button";
import { ListRow, ListRowGroup } from "@/components/ui/list-row";
import { SectionHeader } from "@/components/ui/section-header";
import {
  ASSET_STATUS_LABELS,
  ASSET_STATUS_TONES,
  INVENTORY_BASE_PATH,
  inventoryAssetPath,
  inventoryLocationPath,
} from "@/lib/inventory/constants";
import { getLocationDetail } from "@/lib/inventory/queries";
import { getInventoryAccess } from "@/lib/inventory/service";
import { membersNavigationBreadcrumb } from "@/lib/members-breadcrumbs";
import { requireAuth } from "@/lib/rbac";

const CARD = "space-y-3 rounded-xl border border-border bg-card p-4 shadow-sm";

export default async function LocationDetailPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const session = await requireAuth();
  const access = await getInventoryAccess(session.user);
  if (!access.canUse) return <NoInventoryAccess />;
  const { code } = await params;
  const location = await getLocationDetail(decodeURIComponent(code).toUpperCase());
  if (!location) notFound();
  const encoded = encodeURIComponent(location.code);

  return (
    <div className="space-y-6">
      <PageHeader
        title={location.name}
        description={location.path ?? undefined}
        breadcrumbs={[
          membersNavigationBreadcrumb(INVENTORY_BASE_PATH),
          { id: "orte", label: "Orte", href: `${INVENTORY_BASE_PATH}/orte` },
          location.parent
            ? {
                id: "parent",
                label: location.parent.name,
                href: inventoryLocationPath(location.parent.code),
              }
            : null,
          { id: "ort", label: location.code },
        ]}
      />
      <div className="flex flex-wrap gap-2">
        <Button asChild>
          <Link href={`${INVENTORY_BASE_PATH}/scannen?modus=einlagern&ziel=${encoded}`}>
            <ScanLineIcon className="mr-2 h-4 w-4" />
            Hier einscannen
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href={`${INVENTORY_BASE_PATH}/neu?ort=${location.id}`}>
            <PlusIcon className="mr-2 h-4 w-4" />
            Hier erfassen
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href={`${INVENTORY_BASE_PATH}/etiketten?codes=${encoded}`}>
            <PrinterIcon className="mr-2 h-4 w-4" />
            Etikett
          </Link>
        </Button>
      </div>
      {location.description ? (
        <p className="text-sm text-muted-foreground">{location.description}</p>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className={`${CARD} lg:col-span-2`}>
          <SectionHeader
            title={`Hier gelagert (${location.assets.length + location.stocks.length})`}
          />
          {location.assets.length || location.stocks.length ? (
            <ListRowGroup>
              {location.assets.map((asset) => (
                <ListRow
                  key={asset.id}
                  href={inventoryAssetPath(asset.code)}
                  leading={
                    asset.kind === "container" ? (
                      <PackageIcon className="h-5 w-5 text-muted-foreground" />
                    ) : undefined
                  }
                  title={asset.name}
                  description={
                    asset.kind === "container"
                      ? `${asset.code} · Kiste mit ${asset._count.contents} Objekten`
                      : asset.code
                  }
                  trailing={
                    asset.status !== "available" ? (
                      <ToneBadge tone={ASSET_STATUS_TONES[asset.status]}>
                        {ASSET_STATUS_LABELS[asset.status]}
                      </ToneBadge>
                    ) : null
                  }
                />
              ))}
              {location.stocks.map((stock) => (
                <ListRow
                  key={stock.asset.id}
                  href={inventoryAssetPath(stock.asset.code)}
                  title={stock.asset.name}
                  description={stock.asset.code}
                  trailing={`${stock.quantity} ${stock.asset.unit ?? "Stk."}`}
                />
              ))}
            </ListRowGroup>
          ) : (
            <p className="text-sm text-muted-foreground">Hier liegt noch nichts.</p>
          )}
        </section>
        <section className={CARD}>
          <SectionHeader title="Unterorte" />
          {location.children.length ? (
            <ListRowGroup>
              {location.children.map((child) => (
                <ListRow
                  key={child.id}
                  density="compact"
                  href={inventoryLocationPath(child.code)}
                  leading={<MapPinIcon className="h-4 w-4 text-muted-foreground" />}
                  title={child.name}
                  description={child.code}
                />
              ))}
            </ListRowGroup>
          ) : (
            <p className="text-sm text-muted-foreground">Keine Unterorte.</p>
          )}
        </section>
      </div>
    </div>
  );
}
