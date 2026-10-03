import { notFound } from "next/navigation";

import { NoInventoryAccess } from "@/components/inventory/no-access";
import { ProductForm } from "@/components/inventory/product-form";
import { PageHeader } from "@/components/members/page-header";
import { specsToFormValues } from "@/lib/inventory/asset-form-values";
import { loadInventoryCatalog } from "@/lib/inventory/catalog";
import { INVENTORY_BASE_PATH, inventoryProductPath } from "@/lib/inventory/constants";
import { getInventoryProductDetail } from "@/lib/inventory/queries";
import { getInventoryAccess } from "@/lib/inventory/service";
import { membersNavigationBreadcrumb } from "@/lib/members-breadcrumbs";
import { requireAuth } from "@/lib/rbac";

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ publicId: string }>;
}) {
  const session = await requireAuth();
  const access = await getInventoryAccess(session.user);
  if (!access.canUse) return <NoInventoryAccess />;
  const { publicId } = await params;
  const [product, areas] = await Promise.all([
    getInventoryProductDetail(decodeURIComponent(publicId)),
    loadInventoryCatalog(),
  ]);
  if (!product) notFound();
  const href = inventoryProductPath(product.publicId);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${product.name} bearbeiten`}
        breadcrumbs={[
          membersNavigationBreadcrumb(INVENTORY_BASE_PATH),
          { id: "product", label: product.name, href },
          { id: "edit", label: "Bearbeiten" },
        ]}
      />
      <div className="mx-auto max-w-3xl">
        <ProductForm
          productId={product.id}
          returnHref={href}
          areas={areas}
          exemplarCount={product.exemplars.filter((entry) => entry.status !== "retired").length}
          initialValues={{
            areaId: product.area.id,
            categoryId: product.categoryId,
            kind: product.kind,
            name: product.name,
            manufacturer: product.manufacturer ?? "",
            model: product.model ?? "",
            description: product.description ?? "",
            publicNote: product.publicNote ?? "",
            specs: specsToFormValues(product.specs),
            unit: product.unit ?? "",
            minQuantity: product.minQuantity?.toString() ?? "",
            inspectionRequired: product.inspectionRequired,
            inspectionIntervalMonths: product.inspectionIntervalMonths?.toString() ?? "12",
          }}
        />
      </div>
    </div>
  );
}
