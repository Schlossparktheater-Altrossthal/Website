import { notFound } from "next/navigation";

import { CheckoutPacklist } from "@/components/inventory/checkout-packlist";
import { NoInventoryAccess } from "@/components/inventory/no-access";
import { ToneBadge } from "@/components/inventory/tone-badge";
import { PageHeader } from "@/components/members/page-header";
import { ListRow, ListRowGroup } from "@/components/ui/list-row";
import { SectionHeader } from "@/components/ui/section-header";
import Link from "next/link";
import {
  assetDisplayName,
  type AssetKind,
  formatInventoryDate,
  INVENTORY_BASE_PATH,
  inventoryProductPath,
  isOverdue,
} from "@/lib/inventory/constants";
import { inventoryProjectPath } from "@/lib/inventory/project-constants";
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
      project: {
        select: {
          id: true,
          publicId: true,
          title: true,
          lines: {
            orderBy: { sortOrder: "asc" },
            select: {
              quantity: true,
              product: {
                select: {
                  id: true,
                  publicId: true,
                  name: true,
                  kind: true,
                  unit: true,
                  components: {
                    select: {
                      quantity: true,
                      component: {
                        select: { id: true, publicId: true, name: true, kind: true, unit: true },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
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
              label: true,
              productId: true,
              product: {
                select: {
                  name: true,
                  unit: true,
                  photos: { select: { id: true }, orderBy: { sortOrder: "asc" }, take: 1 },
                },
              },
              kind: true,
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
      {checkout.project ? (
        <ProjectPackProgress
          project={checkout.project}
          packed={checkout.lines.reduce((map, line) => {
            const outstanding = line.quantity - line.returnedQuantity;
            map.set(line.asset.productId, (map.get(line.asset.productId) ?? 0) + outstanding);
            return map;
          }, new Map<string, number>())}
        />
      ) : null}
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
            name: assetDisplayName(line.asset),
            kind: line.asset.kind as AssetKind,
            unit: line.asset.product.unit,
            photoId: line.asset.photos[0]?.id ?? line.asset.product.photos[0]?.id ?? null,
            place,
            quantity: line.quantity,
            returnedQuantity: line.returnedQuantity,
          };
        })}
      />
    </div>
  );
}

type PackProduct = {
  id: string;
  publicId: string;
  name: string;
  kind: string;
  unit: string | null;
};

/** Soll/Ist je Artikeltyp für Projekt-Ausgaben; Sets zählen über ihre Bestandteile. */
function ProjectPackProgress({
  project,
  packed,
}: {
  project: {
    publicId: string;
    title: string;
    lines: {
      quantity: number;
      product: PackProduct & { components: { quantity: number; component: PackProduct }[] };
    }[];
  };
  packed: Map<string, number>;
}) {
  const needed = new Map<string, { product: PackProduct; quantity: number; via: string[] }>();
  const need = (product: PackProduct, quantity: number, via?: string) => {
    const entry = needed.get(product.id) ?? { product, quantity: 0, via: [] };
    entry.quantity += quantity;
    if (via && !entry.via.includes(via)) entry.via.push(via);
    needed.set(product.id, entry);
  };
  for (const line of project.lines) {
    if (line.product.kind === "set") {
      for (const part of line.product.components) {
        need(
          part.component,
          part.quantity * line.quantity,
          `${line.quantity} × ${line.product.name}`,
        );
      }
    } else {
      need(line.product, line.quantity);
    }
  }
  const rows = [...needed.values()];
  const done = rows.filter((row) => (packed.get(row.product.id) ?? 0) >= row.quantity).length;
  return (
    <section className="space-y-3 rounded-xl border border-border bg-card p-4 shadow-sm">
      <SectionHeader
        title={`Packliste · ${done}/${rows.length} vollständig`}
        description={
          <>
            Bedarf aus dem Projekt{" "}
            <Link
              href={inventoryProjectPath(project.publicId)}
              className="font-medium text-primary hover:underline"
            >
              {project.title}
            </Link>
          </>
        }
      />
      {rows.length ? (
        <ListRowGroup>
          {rows.map((row) => {
            const count = packed.get(row.product.id) ?? 0;
            const tone =
              count >= row.quantity ? "success" : count > 0 ? "info" : ("muted" as const);
            return (
              <ListRow
                key={row.product.id}
                density="compact"
                href={inventoryProductPath(row.product.publicId)}
                title={row.product.name}
                description={row.via.length ? `für ${row.via.join(", ")}` : undefined}
                trailing={
                  <ToneBadge tone={tone}>
                    {count}/{row.quantity}
                    {row.product.kind === "bulk" ? ` ${row.product.unit ?? "Stk."}` : ""}
                  </ToneBadge>
                }
              />
            );
          })}
        </ListRowGroup>
      ) : (
        <p className="text-sm text-muted-foreground">Im Projekt ist noch kein Material geplant.</p>
      )}
    </section>
  );
}
