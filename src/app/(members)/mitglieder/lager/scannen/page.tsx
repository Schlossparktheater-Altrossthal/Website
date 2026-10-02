import { LagerNav } from "@/components/inventory/lager-nav";
import { NoInventoryAccess } from "@/components/inventory/no-access";
import { ScanWorkbench, type ScanMode } from "@/components/inventory/scan-workbench";
import { PageHeader } from "@/components/members/page-header";
import { INVENTORY_BASE_PATH, parseInventoryCode } from "@/lib/inventory/constants";
import { buildScanResult } from "@/lib/inventory/scan";
import { getInventoryAccess } from "@/lib/inventory/service";
import { membersNavigationBreadcrumb } from "@/lib/members-breadcrumbs";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const MODE_PARAMS: Record<string, ScanMode> = {
  info: "lookup",
  einlagern: "store",
  ausgeben: "checkout",
  zurueck: "return",
  pruefen: "inspect",
};

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ScanPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await requireAuth();
  const access = await getInventoryAccess(session.user);
  if (!access.canUse) return <NoInventoryAccess />;

  const params = await searchParams;
  const mode = MODE_PARAMS[first(params.modus) ?? ""] ?? "lookup";
  const targetCode = parseInventoryCode(first(params.ziel) ?? "");
  const target = targetCode ? await buildScanResult(targetCode) : null;
  const openCheckouts = await prisma.inventoryCheckout.findMany({
    where: { status: "open" },
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true },
  });
  const requestedCheckout = first(params.ausgabe);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Scannen"
        breadcrumbs={[membersNavigationBreadcrumb(INVENTORY_BASE_PATH)]}
      />
      <LagerNav active="scannen" canManage={access.canManage} />
      <ScanWorkbench
        initialMode={mode}
        openCheckouts={openCheckouts}
        initialCheckoutId={
          openCheckouts.some((entry) => entry.id === requestedCheckout)
            ? (requestedCheckout ?? null)
            : null
        }
        initialTarget={
          target?.type === "location"
            ? { type: "location", id: target.id, code: target.code, label: target.path }
            : target?.type === "asset" && target.kind === "container"
              ? {
                  type: "container",
                  id: target.id,
                  code: target.code,
                  label: `${target.code} ${target.name}`,
                }
              : null
        }
      />
    </div>
  );
}
