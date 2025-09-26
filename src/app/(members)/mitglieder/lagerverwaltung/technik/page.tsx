import Link from "next/link";

import { PageHeader } from "@/components/members/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { membersNavigationBreadcrumb } from "@/lib/members-breadcrumbs";
import { requireAuth } from "@/lib/rbac";
import type { InventoryItemCategory } from "@prisma/client";

import { AddTechnikItemDialog } from "./add-item-dialog";
import { EditTechnikItemDialog } from "./edit-item-dialog";
import { InventoryCategoryPanel } from "./inventory-category-panel";
import {
  TECH_CATEGORY_VALUES,
  TECH_INVENTORY_CATEGORIES,
  type TechnikInventoryCategory,
} from "./config";

export const dynamic = "force-dynamic";

const QUANTITY_FORMATTER = new Intl.NumberFormat("de-DE");
const CURRENCY_FORMATTER = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
});
const DATE_FORMATTER = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" });

function deriveTotalValue(
  quantity: number,
  acquisitionCost: number | null,
  storedTotalValue: number | null,
): number | null {
  if (storedTotalValue !== null && !Number.isNaN(storedTotalValue)) {
    return storedTotalValue;
  }

  if (acquisitionCost === null || Number.isNaN(acquisitionCost)) {
    return null;
  }

  const raw = quantity * acquisitionCost;

  return Math.round(raw * 100) / 100;
}

type TechnikInventoryItem = {
  id: string;
  sku: string;
  name: string;
  manufacturer: string | null;
  itemType: string | null;
  quantity: number;
  acquisitionCost: number | null;
  totalValue: number | null;
  purchaseDate: Date | null;
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

function formatCurrency(value: number | null): string {
  if (value === null || Number.isNaN(value)) {
    return "–";
  }

  return CURRENCY_FORMATTER.format(value);
}

function matchesQuery(item: TechnikInventoryItem, query: string): boolean {
  if (!query.length) {
    return true;
  }

  const haystack = [
    item.sku,
    item.name,
    item.manufacturer ?? "",
    item.itemType ?? "",
    item.details ?? "",
    item.purchaseDate ? item.purchaseDate.toISOString().slice(0, 10) : "",
  ]
    .join("\n")
    .toLowerCase();

  return haystack.includes(query);
}

interface TechnikInventoryPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export default async function TechnikInventoryPage({
  searchParams,
}: TechnikInventoryPageProps) {
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

  const resolvedSearch = (await searchParams) ?? {};
  const rawQuery = typeof resolvedSearch.q === "string" ? resolvedSearch.q : "";
  const query = rawQuery.trim();
  const normalizedQuery = query.toLowerCase();

  const categoryFilter = TECH_CATEGORY_VALUES.map(
    (value) => value as InventoryItemCategory,
  );

  const records = await prisma.inventoryItem.findMany({
    where: { category: { in: categoryFilter } },
    orderBy: [{ category: "asc" }, { sku: "asc" }],
    select: {
      id: true,
      sku: true,
      name: true,
      manufacturer: true,
      itemType: true,
      qty: true,
      acquisitionCost: true,
      totalValue: true,
      purchaseDate: true,
      category: true,
      details: true,
      lastUsedAt: true,
      lastInventoryAt: true,
    },
  });

  const items: TechnikInventoryItem[] = records.map((item) => ({
    id: item.id,
    sku: item.sku,
    name: item.name,
    manufacturer: item.manufacturer ?? null,
    itemType: item.itemType ?? null,
    quantity: item.qty,
    acquisitionCost: item.acquisitionCost ?? null,
    totalValue: deriveTotalValue(
      item.qty,
      item.acquisitionCost ?? null,
      item.totalValue ?? null,
    ),
    purchaseDate: item.purchaseDate ?? null,
    details: item.details ?? null,
    category: item.category as TechnikInventoryCategory,
    lastUsedAt: item.lastUsedAt ?? null,
    lastInventoryAt: item.lastInventoryAt ?? null,
  }));

  const grouped = TECH_INVENTORY_CATEGORIES.map((categoryConfig) => {
    const categoryItems = items.filter(
      (item) => item.category === categoryConfig.value,
    );
    const filteredItems = normalizedQuery.length
      ? categoryItems.filter((item) => matchesQuery(item, normalizedQuery))
      : categoryItems;

    const itemCount = categoryItems.length;
    const totalQuantity = categoryItems.reduce(
      (sum, item) => sum + item.quantity,
      0,
    );
    const filteredQuantity = filteredItems.reduce(
      (sum, item) => sum + item.quantity,
      0,
    );

    const summary = normalizedQuery.length
      ? filteredItems.length
        ? `${filteredItems.length} Treffer für „${query}“, ${itemCount} Artikel mit ${QUANTITY_FORMATTER.format(totalQuantity)} Einheiten insgesamt.`
        : `Keine Treffer für „${query}“. ${itemCount} Artikel, ${QUANTITY_FORMATTER.format(totalQuantity)} Einheiten insgesamt.`
      : itemCount > 0
        ? `${itemCount} Artikel, ${QUANTITY_FORMATTER.format(totalQuantity)} Einheiten insgesamt.`
        : "Noch keine Artikel in dieser Kategorie angelegt.";

    const defaultOpen = normalizedQuery.length > 0 ? filteredItems.length > 0 : true;

    return {
      config: categoryConfig,
      items: filteredItems,
      allItems: categoryItems,
      itemCount,
      totalQuantity,
      filteredCount: filteredItems.length,
      filteredQuantity,
      summary,
      defaultOpen,
    };
  });

  const totalItems = items.length;
  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
  const filteredItemCount = normalizedQuery.length
    ? grouped.reduce((sum, group) => sum + group.filteredCount, 0)
    : totalItems;
  const filteredQuantity = normalizedQuery.length
    ? grouped.reduce((sum, group) => sum + group.filteredQuantity, 0)
    : totalQuantity;

  const overviewText = normalizedQuery.length
    ? filteredItemCount > 0
      ? `${filteredItemCount} Treffer für „${query}“, Gesamtbestand ${QUANTITY_FORMATTER.format(filteredQuantity)} Einheiten innerhalb des Filters (insgesamt ${totalItems} Artikel).`
      : `Keine Treffer für „${query}“. Gesamtbestand ${QUANTITY_FORMATTER.format(totalQuantity)} Einheiten über ${totalItems} Artikel.`
    : totalItems > 0
      ? `${totalItems} Artikel, Gesamtbestand ${QUANTITY_FORMATTER.format(totalQuantity)} Einheiten.`
      : "Noch keine Technik-Artikel erfasst.";

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
          <p className="text-sm text-muted-foreground">{overviewText}</p>
        </CardHeader>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Schnellsuche</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-3 sm:flex-row sm:items-center" action="/mitglieder/lagerverwaltung/technik" method="get">
            <Input
              type="search"
              name="q"
              defaultValue={query}
              placeholder="Hersteller, Modell, Typ oder Inventarnummer suchen"
              className="w-full sm:max-w-md"
            />
            <div className="flex items-center gap-2">
              <Button type="submit">Suchen</Button>
              {query.length ? (
                <Button variant="ghost" type="button" asChild>
                  <Link href="/mitglieder/lagerverwaltung/technik">Zurücksetzen</Link>
                </Button>
              ) : null}
            </div>
          </form>
          {query.length ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Ergebnisse werden live gefiltert. Suchbegriffe gelten für alle Kategorien.
            </p>
          ) : (
            <p className="mt-2 text-xs text-muted-foreground">
              Tippe einen Suchbegriff ein, um alle Kategorien gleichzeitig zu durchsuchen.
            </p>
          )}
        </CardContent>
      </Card>
      <div className="grid gap-6">
        {grouped.map(({
          config,
          items: categoryItems,
          allItems,
          summary,
          defaultOpen,
        }) => (
          <InventoryCategoryPanel
            key={config.value}
            title={config.label}
            description={config.description}
            summary={summary}
            defaultOpen={defaultOpen}
            actions={<AddTechnikItemDialog category={config.value} />}
          >
            <div className="space-y-4 p-4 sm:p-6">
              {allItems.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Lege den ersten Artikel für die Kategorie {config.label} an, um den Bestand zu tracken.
                </p>
              ) : categoryItems.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Keine Treffer für „{query}“ in dieser Kategorie.
                </p>
              ) : (
                <div className="overflow-hidden rounded-md border border-border/60">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Artikel</TableHead>
                          <TableHead className="min-w-[220px]">Bestand &amp; Kosten</TableHead>
                          <TableHead className="min-w-[240px]">Historie</TableHead>
                          <TableHead className="w-[80px] text-right">Aktionen</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {categoryItems.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="align-top">
                              <div className="space-y-1">
                                <p className="font-semibold text-foreground">
                                  {item.manufacturer ?? "Unbekannter Hersteller"}
                                </p>
                                <p className="text-sm text-muted-foreground">{item.name}</p>
                                <p className="text-sm text-muted-foreground">
                                  {item.itemType ?? "Kein Typ angegeben"}
                                </p>
                                <p className="font-mono text-xs text-muted-foreground">#{item.sku}</p>
                              </div>
                            </TableCell>
                            <TableCell className="align-top">
                              <div className="space-y-1 text-sm text-muted-foreground">
                                <p>
                                  <span className="font-medium text-foreground">Menge:</span>{" "}
                                  {QUANTITY_FORMATTER.format(item.quantity)}
                                </p>
                                <p>
                                  <span className="font-medium text-foreground">Kosten bei Anschaffung:</span>{" "}
                                  {formatCurrency(item.acquisitionCost)}
                                </p>
                                <p>
                                  <span className="font-medium text-foreground">Gesamtwert:</span>{" "}
                                  {formatCurrency(item.totalValue)}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell className="align-top">
                              <div className="space-y-1 text-sm text-muted-foreground">
                                <p>
                                  <span className="font-medium text-foreground">Kaufdatum:</span>{" "}
                                  {formatDate(item.purchaseDate)}
                                </p>
                                <p>
                                  <span className="font-medium text-foreground">Letzte Inventur:</span>{" "}
                                  {formatDate(item.lastInventoryAt)}
                                </p>
                                <p>
                                  <span className="font-medium text-foreground">Zuletzt benutzt:</span>{" "}
                                  {formatDate(item.lastUsedAt)}
                                </p>
                                {item.details ? (
                                  <p>
                                    <span className="font-medium text-foreground">Anmerkungen:</span>{" "}
                                    <span className="block whitespace-pre-line">
                                      {item.details}
                                    </span>
                                  </p>
                                ) : null}
                              </div>
                            </TableCell>
                            <TableCell className="align-top text-right">
                              <EditTechnikItemDialog item={item} />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </div>
          </InventoryCategoryPanel>
        ))}
      </div>
    </div>
  );
}
