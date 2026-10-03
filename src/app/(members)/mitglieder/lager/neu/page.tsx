import Link from "next/link";

import { CaptureWizard } from "@/components/inventory/capture-wizard";
import { NoInventoryAccess } from "@/components/inventory/no-access";
import { PageHeader } from "@/components/members/page-header";
import { LayoutGridIcon } from "@/components/ui/action-icons";
import { Button } from "@/components/ui/button";
import { INVENTORY_BASE_PATH } from "@/lib/inventory/constants";
import { loadInventoryCatalog } from "@/lib/inventory/catalog";
import {
  listContainerOptions,
  listLocationOptions,
  searchInventoryProducts,
} from "@/lib/inventory/queries";
import { getInventoryAccess } from "@/lib/inventory/service";
import type { PlacementTarget } from "@/lib/inventory/service-types";
import { membersNavigationBreadcrumb } from "@/lib/members-breadcrumbs";
import { requireAuth } from "@/lib/rbac";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function NewAssetPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await requireAuth();
  const access = await getInventoryAccess(session.user);
  if (!access.canUse) return <NoInventoryAccess />;

  const params = await searchParams;
  const typ = first(params.typ);
  const [areas, locations, containers, initialProduct] = await Promise.all([
    loadInventoryCatalog(),
    listLocationOptions(),
    listContainerOptions(),
    // „Weitere Exemplare“ von der Typ-Seite: Schritt 1 überspringen.
    typ
      ? searchInventoryProducts("", 1, { publicId: typ }).then((hits) => hits[0] ?? null)
      : Promise.resolve(null),
  ]);

  // Vorbelegung, z. B. „in diese Kiste erfassen“ von der Kisten- oder Ortsseite.
  const area = areas.find((entry) => entry.id === first(params.bereich)) ?? areas[0];
  const ort = first(params.ort);
  const kiste = first(params.kiste);
  const placement: PlacementTarget =
    kiste && containers.some((container) => container.id === kiste)
      ? { type: "container", id: kiste }
      : ort && locations.some((location) => location.id === ort)
        ? { type: "location", id: ort }
        : { type: "none" };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Erfassen"
        description="Artikel wählen oder neu anlegen, dann Anzahl und Ort."
        breadcrumbs={[membersNavigationBreadcrumb(INVENTORY_BASE_PATH)]}
        actions={
          <Button asChild variant="outline" size="sm" className="hidden lg:inline-flex">
            <Link href={`${INVENTORY_BASE_PATH}/neu/tabelle`}>
              <LayoutGridIcon className="mr-2 h-4 w-4" />
              Viele auf einmal
            </Link>
          </Button>
        }
      />
      {areas.length ? (
        <div className="mx-auto max-w-3xl">
          <CaptureWizard
            areas={areas}
            canManage={access.canManage}
            placementOptions={{ locations, containers }}
            initialPlacement={placement}
            initialProduct={initialProduct}
            defaultAreaId={area?.id ?? null}
          />
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Es gibt noch keine Bereiche. Lege sie unter „Bereiche“ an.
        </p>
      )}
    </div>
  );
}
