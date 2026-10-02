import { AreaSettings } from "@/components/inventory/area-settings";
import { NoInventoryAccess } from "@/components/inventory/no-access";
import { PageHeader } from "@/components/members/page-header";
import { INVENTORY_BASE_PATH } from "@/lib/inventory/constants";
import { listInventoryAreas } from "@/lib/inventory/queries";
import { getInventoryAccess } from "@/lib/inventory/service";
import { membersNavigationBreadcrumb } from "@/lib/members-breadcrumbs";
import { requireAuth } from "@/lib/rbac";

export default async function InventorySettingsPage() {
  const session = await requireAuth();
  const access = await getInventoryAccess(session.user);
  if (!access.canManage) return <NoInventoryAccess manage />;
  const areas = await listInventoryAreas();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bereiche & Kategorien"
        description="Jeder Bereich hat ein eigenes Kürzel – es steht vor jeder Nummer auf dem Etikett."
        breadcrumbs={[
          membersNavigationBreadcrumb(INVENTORY_BASE_PATH),
          { id: "bereiche", label: "Bereiche" },
        ]}
      />
      <AreaSettings
        areas={areas.map((area) => ({
          id: area.id,
          name: area.name,
          prefix: area.prefix,
          description: area.description,
          inspectionDefault: area.inspectionDefault,
          assetCount: area._count.assets,
          categories: area.categories,
        }))}
      />
    </div>
  );
}
