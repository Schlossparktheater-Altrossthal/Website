import Link from "next/link";

import { BulkCapture } from "@/components/inventory/bulk-capture";
import { NoInventoryAccess } from "@/components/inventory/no-access";
import { PageHeader } from "@/components/members/page-header";
import { Button } from "@/components/ui/button";
import { loadInventoryCatalog } from "@/lib/inventory/catalog";
import { INVENTORY_BASE_PATH } from "@/lib/inventory/constants";
import { listContainerOptions, listLocationOptions } from "@/lib/inventory/queries";
import { getInventoryAccess } from "@/lib/inventory/service";
import { membersNavigationBreadcrumb } from "@/lib/members-breadcrumbs";
import { requireAuth } from "@/lib/rbac";

export default async function BulkCapturePage() {
  const session = await requireAuth();
  const access = await getInventoryAccess(session.user);
  if (!access.canUse) return <NoInventoryAccess />;

  const [areas, locations, containers] = await Promise.all([
    loadInventoryCatalog(),
    listLocationOptions(),
    listContainerOptions(),
  ]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Sammelerfassung"
        description="Viele Objekte als Tabelle eintragen und in einem Rutsch anlegen. Fotos danach per Handy."
        breadcrumbs={[membersNavigationBreadcrumb(INVENTORY_BASE_PATH)]}
      />
      <div className="space-y-3 rounded-lg border border-dashed border-border bg-card p-4 text-sm text-muted-foreground lg:hidden">
        <p>
          Die Tabelle ist für große Bildschirme gedacht. Am Handy geht das Erfassen mit Foto
          schneller.
        </p>
        <Button asChild size="sm" variant="outline">
          <Link href={`${INVENTORY_BASE_PATH}/neu`}>Zum Erfassen mit Foto</Link>
        </Button>
      </div>
      <div className="hidden lg:block">
        {areas.length ? (
          <BulkCapture
            areas={areas}
            placement={{ locations, containers }}
            canManage={access.canManage}
          />
        ) : (
          <p className="text-sm text-muted-foreground">
            Es gibt noch keine Bereiche. Lege sie unter „Bereiche“ an.
          </p>
        )}
      </div>
    </div>
  );
}
