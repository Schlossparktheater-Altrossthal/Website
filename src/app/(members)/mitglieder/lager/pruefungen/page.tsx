import Link from "next/link";

import { InspectionBoard } from "@/components/inventory/inspection-board";
import { LagerNav } from "@/components/inventory/lager-nav";
import { NoInventoryAccess } from "@/components/inventory/no-access";
import { ToneBadge } from "@/components/inventory/tone-badge";
import { PageHeader } from "@/components/members/page-header";
import { ScanLineIcon } from "@/components/ui/action-icons";
import { Button } from "@/components/ui/button";
import { ListRow, ListRowGroup } from "@/components/ui/list-row";
import { SectionHeader } from "@/components/ui/section-header";
import {
  formatInventoryDate,
  INSPECTION_RESULT_LABELS,
  INVENTORY_BASE_PATH,
  inventoryAssetPath,
} from "@/lib/inventory/constants";
import { listInventoryAssets } from "@/lib/inventory/queries";
import { getInventoryAccess } from "@/lib/inventory/service";
import { membersNavigationBreadcrumb } from "@/lib/members-breadcrumbs";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";

export default async function InspectionsPage() {
  const session = await requireAuth();
  const access = await getInventoryAccess(session.user);
  if (!access.canUse) return <NoInventoryAccess />;

  const [due, recent, required] = await Promise.all([
    listInventoryAssets({ view: "inspection", page: 1 }),
    prisma.inventoryInspection.findMany({
      orderBy: { inspectedAt: "desc" },
      take: 15,
      select: {
        id: true,
        kind: true,
        result: true,
        inspectedAt: true,
        inspectorName: true,
        asset: { select: { code: true, name: true } },
      },
    }),
    prisma.inventoryAsset.count({
      where: { inspectionRequired: true, status: { not: "retired" } },
    }),
  ]);
  const nextDates = await prisma.inventoryAsset.findMany({
    where: { id: { in: due.items.map((item) => item.id) } },
    select: { id: true, nextInspectionAt: true },
  });
  const nextById = new Map(
    nextDates.map((entry) => [entry.id, entry.nextInspectionAt?.toISOString() ?? null]),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Prüfungen"
        description={`Elektroprüfung nach DGUV V3 – ${required} prüfpflichtige Geräte. Eintragen darf jede Person mit Lagerzugriff.`}
        breadcrumbs={[membersNavigationBreadcrumb(INVENTORY_BASE_PATH)]}
      />
      <LagerNav active="pruefungen" canManage={access.canManage} />
      <Button asChild variant="outline">
        <Link href={`${INVENTORY_BASE_PATH}/scannen?modus=pruefen`}>
          <ScanLineIcon className="mr-2 h-4 w-4" />
          Prüftag: Geräte scannen
        </Link>
      </Button>

      <section className="space-y-3">
        <SectionHeader
          title={`Fällig oder bald fällig (${due.total})`}
          description="Überfällige zuerst. Geräte ohne Prüfdatum gelten als überfällig."
        />
        <InspectionBoard
          rows={due.items.map((item) => ({
            id: item.id,
            code: item.code,
            name: item.name,
            place: item.place,
            state: item.inspection,
            nextInspectionAt: nextById.get(item.id) ?? null,
          }))}
        />
      </section>

      {recent.length ? (
        <section className="space-y-3">
          <SectionHeader title="Zuletzt geprüft" />
          <ListRowGroup variant="inset" className="bg-card">
            {recent.map((inspection) => (
              <ListRow
                key={inspection.id}
                density="compact"
                href={inventoryAssetPath(inspection.asset.code)}
                title={`${inspection.asset.code} · ${inspection.asset.name}`}
                description={`${inspection.kind} · ${formatInventoryDate(inspection.inspectedAt)}${inspection.inspectorName ? ` · ${inspection.inspectorName}` : ""}`}
                trailing={
                  <ToneBadge tone={inspection.result === "passed" ? "success" : "destructive"}>
                    {INSPECTION_RESULT_LABELS[inspection.result]}
                  </ToneBadge>
                }
              />
            ))}
          </ListRowGroup>
        </section>
      ) : null}
    </div>
  );
}
