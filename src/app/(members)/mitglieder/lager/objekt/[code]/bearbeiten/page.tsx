import { notFound } from "next/navigation";

import { AssetForm } from "@/components/inventory/asset-form";
import { emptyAssetValues } from "@/lib/inventory/asset-form-values";
import { NoInventoryAccess } from "@/components/inventory/no-access";
import { PageHeader } from "@/components/members/page-header";
import {
  INVENTORY_BASE_PATH,
  inventoryAssetPath,
  toDateInputValue,
} from "@/lib/inventory/constants";
import { loadInventoryCatalog } from "@/lib/inventory/catalog";
import {
  getInventoryAssetDetail,
  listContainerOptions,
  listLocationOptions,
} from "@/lib/inventory/queries";
import { getInventoryAccess } from "@/lib/inventory/service";
import { membersNavigationBreadcrumb } from "@/lib/members-breadcrumbs";
import { requireAuth } from "@/lib/rbac";

export default async function EditAssetPage({ params }: { params: Promise<{ code: string }> }) {
  const session = await requireAuth();
  const access = await getInventoryAccess(session.user);
  if (!access.canUse) return <NoInventoryAccess />;
  const { code } = await params;
  const asset = await getInventoryAssetDetail(decodeURIComponent(code), {
    includeCost: access.canManage,
  });
  if (!asset) notFound();
  const [areas, locations, containers] = await Promise.all([
    loadInventoryCatalog(),
    listLocationOptions(),
    listContainerOptions(),
  ]);
  const area = areas.find((entry) => entry.id === asset.areaId);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${asset.code} bearbeiten`}
        breadcrumbs={[
          membersNavigationBreadcrumb(INVENTORY_BASE_PATH),
          { id: "asset", label: asset.code, href: inventoryAssetPath(asset.code) },
          { id: "edit", label: "Bearbeiten" },
        ]}
      />
      <AssetForm
        mode="edit"
        assetId={asset.id}
        assetCode={asset.code}
        areas={areas}
        canManage={access.canManage}
        placementOptions={{ locations, containers }}
        initialValues={{
          ...emptyAssetValues(area),
          areaId: asset.areaId,
          categoryId: asset.product.categoryId,
          kind: asset.kind,
          name: asset.product.name,
          label: asset.label ?? "",
          manufacturer: asset.product.manufacturer ?? "",
          model: asset.product.model ?? "",
          serialNumber: asset.serialNumber ?? "",
          description: asset.product.description ?? "",
          publicNote: asset.product.publicNote ?? "",
          internalNote: asset.internalNote ?? "",
          specs: Object.fromEntries(
            Object.entries(asset.product.specs).map(([key, value]) => [
              key,
              typeof value === "boolean" ? value : String(value),
            ]),
          ),
          condition: asset.condition,
          unit: asset.product.unit ?? "",
          minQuantity: asset.product.minQuantity?.toString() ?? "",
          inspectionRequired: asset.product.inspectionRequired,
          inspectionIntervalMonths: asset.product.inspectionIntervalMonths?.toString() ?? "",
          nextInspectionAt: toDateInputValue(asset.nextInspectionAt),
          acquisitionCost: asset.acquisitionCost?.toString().replace(".", ",") ?? "",
          purchaseDate: toDateInputValue(asset.purchaseDate),
          supplier: asset.supplier ?? "",
          ownership: asset.ownership ?? "",
        }}
      />
    </div>
  );
}
