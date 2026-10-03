import { LabelDesigner, type LabelCandidate } from "@/components/inventory/label-designer";
import { NoInventoryAccess } from "@/components/inventory/no-access";
import { PageHeader } from "@/components/members/page-header";
import {
  assetDisplayName,
  INVENTORY_BASE_PATH,
  parseInventoryCode,
} from "@/lib/inventory/constants";
import { ASSET_NAME_SELECT } from "@/lib/inventory/selects";
import { getInventoryAccess, loadLocationLabeler } from "@/lib/inventory/service";
import { membersNavigationBreadcrumb } from "@/lib/members-breadcrumbs";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function LabelsPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await requireAuth();
  const access = await getInventoryAccess(session.user);
  if (!access.canUse) return <NoInventoryAccess />;

  const params = await searchParams;
  const rawCodes = Array.isArray(params.codes) ? params.codes.join(",") : (params.codes ?? "");
  const requested = rawCodes
    .split(",")
    .map(parseInventoryCode)
    .filter((code): code is string => Boolean(code));

  const [unlabeled, containers, labeler, requestedAssets] = await Promise.all([
    prisma.inventoryAsset.findMany({
      where: { labelPrintedAt: null, status: { not: "retired" } },
      orderBy: { code: "asc" },
      take: 1000,
      select: { code: true, ...ASSET_NAME_SELECT },
    }),
    prisma.inventoryAsset.findMany({
      where: { kind: "container", status: { not: "retired" } },
      orderBy: { code: "asc" },
      select: { code: true, ...ASSET_NAME_SELECT },
    }),
    loadLocationLabeler(),
    requested.length
      ? prisma.inventoryAsset.findMany({
          where: { code: { in: requested } },
          select: { code: true, ...ASSET_NAME_SELECT },
        })
      : Promise.resolve([]),
  ]);
  const toCandidate = (asset: {
    code: string;
    label: string | null;
    product: { name: string };
  }) => ({
    code: asset.code,
    name: assetDisplayName(asset),
  });
  const locations: LabelCandidate[] = labeler.locations
    .map((location) => ({ code: location.code, name: labeler.label(location.id) ?? location.name }))
    .sort((a, b) => a.code.localeCompare(b.code));

  const names = new Map<string, string>([
    ...requestedAssets.map((asset) => [asset.code, assetDisplayName(asset)] as const),
    ...locations.map((location) => [location.code, location.name] as const),
  ]);
  const initial = (params.quelle === "orte" ? locations.map((l) => l.code) : requested).map(
    (code) => ({
      code,
      name: names.get(code) ?? "",
    }),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Etiketten drucken"
        description="QR-Etiketten für A4-Bögen. Wer den Code scannt, sieht das Objekt – Mitglieder mit allen Details."
        breadcrumbs={[
          membersNavigationBreadcrumb(INVENTORY_BASE_PATH),
          { id: "etiketten", label: "Etiketten" },
        ]}
      />
      <LabelDesigner
        initial={initial}
        presets={[
          { id: "unlabeled", label: "Ohne Etikett", items: unlabeled.map(toCandidate) },
          { id: "containers", label: "Alle Kisten", items: containers.map(toCandidate) },
          { id: "locations", label: "Alle Lagerorte", items: locations },
        ]}
      />
    </div>
  );
}
