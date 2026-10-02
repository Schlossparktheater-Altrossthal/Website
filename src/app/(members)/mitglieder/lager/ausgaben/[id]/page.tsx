import { notFound } from "next/navigation";

import { CheckoutPacklist } from "@/components/inventory/checkout-packlist";
import { NoInventoryAccess } from "@/components/inventory/no-access";
import { ToneBadge } from "@/components/inventory/tone-badge";
import { PageHeader } from "@/components/members/page-header";
import { formatInventoryDate, INVENTORY_BASE_PATH, isOverdue } from "@/lib/inventory/constants";
import { getInventoryAccess, loadLocationLabeler } from "@/lib/inventory/service";
import { membersNavigationBreadcrumb } from "@/lib/members-breadcrumbs";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";

export default async function CheckoutDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireAuth();
  const access = await getInventoryAccess(session.user);
  if (!access.canUse) return <NoInventoryAccess />;
  const { id } = await params;
  const checkout = await prisma.inventoryCheckout.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      status: true,
      borrowerName: true,
      dueAt: true,
      note: true,
      createdAt: true,
      closedAt: true,
      show: { select: { title: true, year: true } },
      lines: {
        orderBy: { checkedOutAt: "asc" },
        select: {
          id: true,
          quantity: true,
          returnedQuantity: true,
          asset: {
            select: {
              id: true,
              code: true,
              name: true,
              kind: true,
              unit: true,
              locationId: true,
              container: { select: { code: true } },
              stocks: {
                select: { locationId: true, container: { select: { code: true } } },
                take: 1,
              },
              photos: { select: { id: true }, orderBy: { sortOrder: "asc" }, take: 1 },
            },
          },
        },
      },
    },
  });
  if (!checkout) notFound();
  const { label } = await loadLocationLabeler();
  const outstanding = checkout.lines.filter((line) => line.returnedQuantity < line.quantity).length;
  const overdue = checkout.status === "open" && isOverdue(checkout.dueAt) && outstanding > 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title={checkout.title}
        breadcrumbs={[
          membersNavigationBreadcrumb(INVENTORY_BASE_PATH),
          { id: "ausgaben", label: "Ausgaben", href: `${INVENTORY_BASE_PATH}/ausgaben` },
          { id: "ausgabe", label: checkout.title },
        ]}
      />
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <ToneBadge tone={checkout.status === "open" ? (overdue ? "destructive" : "info") : "muted"}>
          {checkout.status === "open" ? (overdue ? "Überfällig" : "Offen") : "Abgeschlossen"}
        </ToneBadge>
        {checkout.show ? (
          <span>{`${checkout.show.year} · ${checkout.show.title ?? ""}`}</span>
        ) : null}
        {checkout.borrowerName ? <span>an {checkout.borrowerName}</span> : null}
        <span>seit {formatInventoryDate(checkout.createdAt)}</span>
        {checkout.dueAt ? <span>zurück bis {formatInventoryDate(checkout.dueAt)}</span> : null}
      </div>
      {checkout.note ? (
        <p className="text-sm whitespace-pre-line text-foreground">{checkout.note}</p>
      ) : null}
      <CheckoutPacklist
        checkoutId={checkout.id}
        status={checkout.status}
        lines={checkout.lines.map((line) => {
          const stock = line.asset.stocks[0];
          const place = line.asset.container
            ? line.asset.container.code
            : stock
              ? (stock.container?.code ?? label(stock.locationId))
              : label(line.asset.locationId);
          return {
            id: line.id,
            assetId: line.asset.id,
            code: line.asset.code,
            name: line.asset.name,
            kind: line.asset.kind,
            unit: line.asset.unit,
            photoId: line.asset.photos[0]?.id ?? null,
            place,
            quantity: line.quantity,
            returnedQuantity: line.returnedQuantity,
          };
        })}
      />
    </div>
  );
}
