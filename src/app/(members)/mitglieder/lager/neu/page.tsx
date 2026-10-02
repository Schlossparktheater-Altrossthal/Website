import Link from "next/link";

import { AssetForm } from "@/components/inventory/asset-form";
import { emptyAssetValues } from "@/lib/inventory/asset-form-values";
import { NoInventoryAccess } from "@/components/inventory/no-access";
import { PageHeader } from "@/components/members/page-header";
import { LayoutGridIcon } from "@/components/ui/action-icons";
import { Button } from "@/components/ui/button";
import { INVENTORY_BASE_PATH } from "@/lib/inventory/constants";
import {
  listContainerOptions,
  listInventoryAreas,
  listLocationOptions,
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
  const [areas, locations, containers] = await Promise.all([
    listInventoryAreas(),
    listLocationOptions(),
    listContainerOptions(),
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
        description="Foto, Bereich, Name, Ort – der Rest geht später."
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
        <AssetForm
          mode="create"
          areas={areas}
          canManage={access.canManage}
          placementOptions={{ locations, containers }}
          initialValues={{ ...emptyAssetValues(area), placement }}
        />
      ) : (
        <p className="text-sm text-muted-foreground">
          Es gibt noch keine Bereiche. Lege sie unter „Bereiche“ an.
        </p>
      )}
    </div>
  );
}
