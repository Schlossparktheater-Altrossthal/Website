import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/members/page-header";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { membersNavigationBreadcrumb } from "@/lib/members-breadcrumbs";
import { requireAuth } from "@/lib/rbac";
import type { InventoryItemCategory } from "@prisma/client";

import { AddTechnikItemDialog } from "./add-item-dialog";
import {
  TECH_CATEGORY_VALUES,
  TECH_INVENTORY_CATEGORIES,
  type TechnikInventoryCategory,
} from "./config";

export const dynamic = "force-dynamic";

const QUANTITY_FORMATTER = new Intl.NumberFormat("de-DE");
const DATE_FORMATTER = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" });

type TechnikInventoryItem = {
  id: string;
  sku: string;
  name: string;
  quantity: number;
  details: string | null;
  category: TechnikInventoryCategory;
  lastUsedAt: Date | null;
  lastInventoryAt: Date | null;
};

function formatDate(value: Date | null): string {
  if (!value) {
    return "–";
  }

  return DATE_FORMATTER.format(value);
}

export default async function TechnikInventoryPage() {
  const session = await requireAuth();
  const allowed = await hasPermission(session.user, "mitglieder.lager.technik");

  if (!allowed) {
    return (
      <div className="rounded-md border border-border/60 bg-background/80 p-4 text-sm text-red-600">
        Kein Zugriff auf diesen Lagerbereich.
      </div>
    );
  }

  const breadcrumb =
    membersNavigationBreadcrumb("/mitglieder/lagerverwaltung/technik") ??
    ({ label: "Technik-Lager", href: "/mitglieder/lagerverwaltung/technik" } as const);

  const categoryFilter = TECH_CATEGORY_VALUES.map(
    (value) => value as InventoryItemCategory,
  );

  const items = await prisma.inventoryItem.findMany({
    where: { category: { in: categoryFilter } },
    orderBy: [{ category: "asc" }, { sku: "asc" }],
    select: {
      id: true,
      sku: true,
      name: true,
      qty: true,
      category: true,
      details: true,
      lastUsedAt: true,
      lastInventoryAt: true,
    },
  });

  const grouped = TECH_INVENTORY_CATEGORIES.map((categoryConfig) => {
    const categoryItems: TechnikInventoryItem[] = items
      .filter((item) => item.category === categoryConfig.value)
      .map((item) => ({
        id: item.id,
        sku: item.sku,
        name: item.name,
        quantity: item.qty,
        details: item.details ?? null,
        category: item.category as TechnikInventoryCategory,
        lastUsedAt: item.lastUsedAt,
        lastInventoryAt: item.lastInventoryAt,
      }));

    const itemCount = categoryItems.length;
    const totalQuantity = categoryItems.reduce((sum, item) => sum + item.quantity, 0);

    return {
      config: categoryConfig,
      items: categoryItems,
      itemCount,
      totalQuantity,
    };
  });

  const totalItems = grouped.reduce((sum, group) => sum + group.itemCount, 0);
  const totalQuantity = grouped.reduce((sum, group) => sum + group.totalQuantity, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Technik-Lager"
        description="Alle Geräte, Kabel und Zubehör des Techniklagers in strukturierten Kategorien – ideal für Inventur und schnelle Ausgaben."
        breadcrumbs={[breadcrumb]}
      />
      <Card>
        <CardHeader>
          <CardTitle>Gesamtübersicht</CardTitle>
          <p className="text-sm text-muted-foreground">
            {totalItems > 0
              ? `${totalItems} Artikel, Gesamtbestand ${QUANTITY_FORMATTER.format(totalQuantity)} Einheiten.`
              : "Noch keine Technik-Artikel erfasst."}
          </p>
        </CardHeader>
      </Card>
      <div className="grid gap-6">
        {grouped.map(({ config, items: categoryItems, itemCount, totalQuantity: categoryQuantity }) => (
          <Card key={config.value}>
            <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-1">
                <CardTitle>{config.label}</CardTitle>
                <p className="text-sm text-muted-foreground">{config.description}</p>
                <p className="text-sm text-muted-foreground">
                  {itemCount > 0
                    ? `${itemCount} Artikel, ${QUANTITY_FORMATTER.format(categoryQuantity)} Einheiten insgesamt.`
                    : "Noch keine Artikel in dieser Kategorie angelegt."}
                </p>
              </div>
              <AddTechnikItemDialog category={config.value} />
            </CardHeader>
            <CardContent>
              {categoryItems.length > 0 ? (
                <div className="overflow-hidden rounded-md border border-border/60">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Artikel</TableHead>
                        <TableHead className="w-[120px]">Art.-Nr.</TableHead>
                        <TableHead className="w-[100px] text-right">Menge</TableHead>
                        <TableHead>Details</TableHead>
                        <TableHead className="w-[140px]">Zuletzt benutzt</TableHead>
                        <TableHead className="w-[160px]">Letzte Inventur</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {categoryItems.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">{item.name}</TableCell>
                          <TableCell className="font-mono text-sm">{item.sku}</TableCell>
                          <TableCell className="text-right">
                            {QUANTITY_FORMATTER.format(item.quantity)}
                          </TableCell>
                          <TableCell className="max-w-[320px]">
                            {item.details ? (
                              <span className="block whitespace-pre-line text-sm text-muted-foreground">
                                {item.details}
                              </span>
                            ) : (
                              <span className="text-sm text-muted-foreground">–</span>
                            )}
                          </TableCell>
                          <TableCell>{formatDate(item.lastUsedAt)}</TableCell>
                          <TableCell>{formatDate(item.lastInventoryAt)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Lege den ersten Artikel für die Kategorie {config.label} an, um den Bestand zu tracken.
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
