import { CatalogEditor } from "@/components/inventory/catalog-editor";
import { NoInventoryAccess } from "@/components/inventory/no-access";
import { PageHeader } from "@/components/members/page-header";
import { loadCatalogForEditing } from "@/lib/inventory/catalog";
import { INVENTORY_BASE_PATH } from "@/lib/inventory/constants";
import { getInventoryAccess } from "@/lib/inventory/service";
import { membersNavigationBreadcrumb } from "@/lib/members-breadcrumbs";
import { requireAuth } from "@/lib/rbac";

export default async function InventoryCatalogPage() {
  const session = await requireAuth();
  const access = await getInventoryAccess(session.user);
  if (!access.canCatalog) return <NoInventoryAccess manage />;
  const areas = await loadCatalogForEditing();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Kategorien & Merkmale"
        description="Welche Arten von Artikeln es gibt und was man zu ihnen eintragen kann – z. B. Ton › Endstufen mit Kanälen und Leistung."
        breadcrumbs={[
          membersNavigationBreadcrumb(INVENTORY_BASE_PATH),
          { id: "katalog", label: "Kategorien & Merkmale" },
        ]}
      />
      <div className="mx-auto max-w-3xl">
        <CatalogEditor areas={areas} />
      </div>
    </div>
  );
}
