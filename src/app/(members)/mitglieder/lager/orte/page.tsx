import { LagerNav } from "@/components/inventory/lager-nav";
import { LocationTree } from "@/components/inventory/location-tree";
import { NoInventoryAccess } from "@/components/inventory/no-access";
import { PageHeader } from "@/components/members/page-header";
import { INVENTORY_BASE_PATH } from "@/lib/inventory/constants";
import { getInventoryAccess } from "@/lib/inventory/service";
import { membersNavigationBreadcrumb } from "@/lib/members-breadcrumbs";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";

export default async function LocationsPage() {
  const session = await requireAuth();
  const access = await getInventoryAccess(session.user);
  if (!access.canUse) return <NoInventoryAccess />;

  const locations = await prisma.inventoryLocation.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      code: true,
      name: true,
      description: true,
      parentId: true,
      _count: { select: { assets: { where: { status: { not: "retired" } } }, stocks: true } },
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Lagerorte"
        description="Lager, Räume, Regale und Fächer. Jeder Ort hat ein eigenes Etikett zum Scannen."
        breadcrumbs={[membersNavigationBreadcrumb(INVENTORY_BASE_PATH)]}
      />
      <LagerNav active="orte" canManage={access.canManage} />
      <LocationTree
        canManage={access.canManage}
        nodes={locations.map((location) => ({
          id: location.id,
          code: location.code,
          name: location.name,
          description: location.description,
          parentId: location.parentId,
          itemCount: location._count.assets + location._count.stocks,
        }))}
      />
    </div>
  );
}
