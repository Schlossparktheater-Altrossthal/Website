import { CheckoutCreate } from "@/components/inventory/checkout-create";
import { LagerNav } from "@/components/inventory/lager-nav";
import { NoInventoryAccess } from "@/components/inventory/no-access";
import { ToneBadge } from "@/components/inventory/tone-badge";
import { PageHeader } from "@/components/members/page-header";
import { ArrowRightIcon } from "@/components/ui/action-icons";
import { ListRow, ListRowGroup } from "@/components/ui/list-row";
import { SectionHeader } from "@/components/ui/section-header";
import { formatInventoryDate, INVENTORY_BASE_PATH, isOverdue } from "@/lib/inventory/constants";
import { getInventoryAccess } from "@/lib/inventory/service";
import { membersNavigationBreadcrumb } from "@/lib/members-breadcrumbs";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";

export default async function CheckoutsPage() {
  const session = await requireAuth();
  const access = await getInventoryAccess(session.user);
  if (!access.canUse) return <NoInventoryAccess />;

  const [open, closed, shows] = await Promise.all([
    prisma.inventoryCheckout.findMany({
      where: { status: "open" },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        borrowerName: true,
        dueAt: true,
        createdAt: true,
        show: { select: { title: true, year: true } },
        lines: { select: { quantity: true, returnedQuantity: true } },
      },
    }),
    prisma.inventoryCheckout.findMany({
      where: { status: "closed" },
      orderBy: { closedAt: "desc" },
      take: 20,
      select: { id: true, title: true, closedAt: true, _count: { select: { lines: true } } },
    }),
    prisma.show.findMany({
      orderBy: { year: "desc" },
      take: 10,
      select: { id: true, title: true, year: true },
    }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ausgaben"
        description="Was ist gerade draußen – für Proben, Aufführungen oder als Leihe."
        breadcrumbs={[membersNavigationBreadcrumb(INVENTORY_BASE_PATH)]}
      />
      <LagerNav active="ausgaben" canManage={access.canManage} />
      <div className="flex flex-wrap gap-2">
        <CheckoutCreate
          shows={shows.map((show) => ({
            id: show.id,
            label: `${show.year} · ${show.title ?? "Produktion"}`,
          }))}
        />
      </div>

      <section className="space-y-3">
        <SectionHeader title={`Offen (${open.length})`} />
        {open.length ? (
          <ListRowGroup variant="inset" className="bg-card">
            {open.map((checkout) => {
              const outstanding = checkout.lines.filter(
                (line) => line.returnedQuantity < line.quantity,
              ).length;
              const overdue = isOverdue(checkout.dueAt) && outstanding > 0;
              return (
                <ListRow
                  key={checkout.id}
                  href={`${INVENTORY_BASE_PATH}/ausgaben/${checkout.id}`}
                  leading={<ArrowRightIcon className="h-5 w-5 text-info" />}
                  title={checkout.title}
                  description={
                    [
                      checkout.show ? `${checkout.show.year} · ${checkout.show.title ?? ""}` : null,
                      checkout.borrowerName,
                      checkout.dueAt ? `bis ${formatInventoryDate(checkout.dueAt)}` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ") || `seit ${formatInventoryDate(checkout.createdAt)}`
                  }
                  trailing={
                    <ToneBadge tone={overdue ? "destructive" : outstanding ? "info" : "success"}>
                      {outstanding ? `${outstanding} draußen` : "alles zurück"}
                    </ToneBadge>
                  }
                />
              );
            })}
          </ListRowGroup>
        ) : (
          <p className="text-sm text-muted-foreground">Gerade ist nichts ausgegeben.</p>
        )}
      </section>

      {closed.length ? (
        <section className="space-y-3">
          <SectionHeader title="Abgeschlossen" />
          <ListRowGroup variant="inset" className="bg-card">
            {closed.map((checkout) => (
              <ListRow
                key={checkout.id}
                density="compact"
                href={`${INVENTORY_BASE_PATH}/ausgaben/${checkout.id}`}
                title={checkout.title}
                description={`${checkout._count.lines} Positionen · ${formatInventoryDate(checkout.closedAt)}`}
              />
            ))}
          </ListRowGroup>
        </section>
      ) : null}
    </div>
  );
}
