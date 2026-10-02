import { notFound } from "next/navigation";

import { NoInventoryAccess } from "@/components/inventory/no-access";
import { StocktakeCounter } from "@/components/inventory/stocktake-counter";
import { StocktakeReviewView } from "@/components/inventory/stocktake-review";
import { ToneBadge } from "@/components/inventory/tone-badge";
import { PageHeader } from "@/components/members/page-header";
import { SectionNav } from "@/components/ui/section-nav";
import { INVENTORY_BASE_PATH } from "@/lib/inventory/constants";
import { getInventoryAccess, loadLocationLabeler } from "@/lib/inventory/service";
import { buildStocktakeReview, getStocktakeProgress } from "@/lib/inventory/stocktake";
import { membersNavigationBreadcrumb } from "@/lib/members-breadcrumbs";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function StocktakePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: SearchParams;
}) {
  const session = await requireAuth();
  const access = await getInventoryAccess(session.user);
  if (!access.canUse) return <NoInventoryAccess />;
  const { id } = await params;
  const query = await searchParams;
  const stocktake = await prisma.inventoryStocktake.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      status: true,
      area: { select: { name: true } },
      location: { select: { name: true } },
    },
  });
  if (!stocktake) notFound();
  const isOpen = stocktake.status === "open";
  const view = !isOpen || query.ansicht === "abgleich" ? "abgleich" : "zaehlen";
  const base = `${INVENTORY_BASE_PATH}/inventur/${stocktake.id}`;

  return (
    <div className="space-y-6">
      <PageHeader
        title={stocktake.title}
        description={`${stocktake.area?.name ?? "Alle Bereiche"} · ${stocktake.location?.name ?? "alle Orte"}`}
        breadcrumbs={[
          membersNavigationBreadcrumb(INVENTORY_BASE_PATH),
          { id: "inventur", label: "Inventur", href: `${INVENTORY_BASE_PATH}/inventur` },
          { id: "lauf", label: stocktake.title },
        ]}
      />
      <div className="flex flex-wrap items-center gap-3">
        <ToneBadge tone={isOpen ? "info" : "muted"}>{isOpen ? "Läuft" : "Abgeschlossen"}</ToneBadge>
        {isOpen ? (
          <SectionNav
            ariaLabel="Inventur"
            activeId={view}
            items={[
              { id: "zaehlen", label: "Zählen", href: base },
              { id: "abgleich", label: "Abgleich", href: `${base}?ansicht=abgleich` },
            ]}
          />
        ) : null}
      </div>
      {view === "zaehlen" ? (
        <CounterView stocktakeId={stocktake.id} />
      ) : (
        <ReviewView stocktakeId={stocktake.id} open={isOpen} canManage={access.canManage} />
      )}
    </div>
  );
}

async function CounterView({ stocktakeId }: { stocktakeId: string }) {
  const [progress, labeler] = await Promise.all([
    getStocktakeProgress(stocktakeId),
    loadLocationLabeler(),
  ]);
  if (!progress) notFound();
  const locations = Object.fromEntries(
    labeler.locations.map((location) => [
      location.code,
      { id: location.id, code: location.code, name: labeler.label(location.id) ?? location.name },
    ]),
  );
  return (
    <StocktakeCounter stocktakeId={stocktakeId} initialProgress={progress} locations={locations} />
  );
}

async function ReviewView({
  stocktakeId,
  open,
  canManage,
}: {
  stocktakeId: string;
  open: boolean;
  canManage: boolean;
}) {
  const review = await buildStocktakeReview(stocktakeId);
  if (!review) notFound();
  return (
    <StocktakeReviewView
      stocktakeId={stocktakeId}
      review={review}
      open={open}
      canManage={canManage}
    />
  );
}
