import { notFound } from "next/navigation";

import { ExemplarForm } from "@/components/inventory/exemplar-form";
import { NoInventoryAccess } from "@/components/inventory/no-access";
import { PageHeader } from "@/components/members/page-header";
import {
  INVENTORY_BASE_PATH,
  inventoryAssetPath,
  inventoryProductPath,
  toDateInputValue,
} from "@/lib/inventory/constants";
import { getInventoryAssetDetail } from "@/lib/inventory/queries";
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

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${asset.code} bearbeiten`}
        description={asset.name}
        breadcrumbs={[
          membersNavigationBreadcrumb(INVENTORY_BASE_PATH),
          { id: "asset", label: asset.code, href: inventoryAssetPath(asset.code) },
          { id: "edit", label: "Bearbeiten" },
        ]}
      />
      <div className="mx-auto max-w-3xl">
        <ExemplarForm
          assetId={asset.id}
          returnHref={inventoryAssetPath(asset.code)}
          productHref={inventoryProductPath(asset.product.publicId)}
          productName={asset.product.name}
          inspectionRequired={asset.product.inspectionRequired}
          canManage={access.canManage}
          initialValues={{
            label: asset.label ?? "",
            serialNumber: asset.serialNumber ?? "",
            internalNote: asset.internalNote ?? "",
            condition: asset.condition,
            nextInspectionAt: toDateInputValue(asset.nextInspectionAt),
            acquisitionCost: asset.acquisitionCost?.toString().replace(".", ",") ?? "",
            purchaseDate: toDateInputValue(asset.purchaseDate),
            supplier: asset.supplier ?? "",
            ownership: asset.ownership ?? "",
          }}
        />
      </div>
    </div>
  );
}
