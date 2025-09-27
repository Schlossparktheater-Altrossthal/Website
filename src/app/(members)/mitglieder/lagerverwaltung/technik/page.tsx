import Link from "next/link";

import { PageHeader } from "@/components/members/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { membersNavigationBreadcrumb } from "@/lib/members-breadcrumbs";
import { requireAuth } from "@/lib/rbac";
import type { InventoryItemCategory } from "@prisma/client";

import { AddTechnikItemDialog } from "./add-item-dialog";
import { EditTechnikItemDialog } from "./edit-item-dialog";
import {
  TECH_CATEGORY_LABEL,
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

  const rawCategoryParam =
    typeof resolvedSearch.category === "string" ? resolvedSearch.category : "all";
  const selectedCategory: TechnikInventoryCategory | "all" = (
    TECH_CATEGORY_VALUES as readonly string[]
  ).includes(rawCategoryParam)
    ? (rawCategoryParam as TechnikInventoryCategory)
    : "all";

  const prismaCategoryFilter: InventoryItemCategory[] =
    selectedCategory === "all"
      ? TECH_CATEGORY_VALUES.map((value) => value as InventoryItemCategory)
      : [selectedCategory as InventoryItemCategory];

  const records = await prisma.inventoryItem.findMany({
    where: { category: { in: prismaCategoryFilter } },
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

  const filteredItems = normalizedQuery.length
    ? items.filter((item) => matchesQuery(item, normalizedQuery))
    : items;

  const totalItems = items.length;
  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
  const filteredItemCount = filteredItems.length;
  const filteredQuantity = filteredItems.reduce(
    (sum, item) => sum + item.quantity,
    0,
  );

  const filterContext =
    selectedCategory === "all"
      ? "über alle Kategorien"
      : `in der Kategorie ${TECH_CATEGORY_LABEL[selectedCategory]}`;

  const overviewText = normalizedQuery.length
    ? filteredItemCount > 0
      ? `${filteredItemCount} Treffer für „${query}“ ${filterContext}, Gesamtbestand ${QUANTITY_FORMATTER.format(filteredQuantity)} Einheiten innerhalb des Filters (Basis: ${totalItems} Artikel).`
      : `Keine Treffer für „${query}“ ${filterContext}. ${totalItems} Artikel mit ${QUANTITY_FORMATTER.format(totalQuantity)} Einheiten im Filter.`
    : totalItems > 0
      ? `${totalItems} Artikel ${filterContext}, Gesamtbestand ${QUANTITY_FORMATTER.format(totalQuantity)} Einheiten.`
      : selectedCategory === "all"
        ? "Noch keine Technik-Artikel erfasst."
        : `Noch keine Technik-Artikel in der Kategorie ${TECH_CATEGORY_LABEL[selectedCategory]} erfasst.`;

  const defaultDialogCategory =
    selectedCategory === "all" ? undefined : selectedCategory;
  const hasItems = totalItems > 0;
  const hasVisibleItems = filteredItemCount > 0;

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
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Schnellsuche &amp; Filter</CardTitle>
            <p className="text-sm text-muted-foreground">
              Kombiniere Kategorie-Filter und Stichworte für präzise Ergebnisse.
            </p>
          </div>
          <AddTechnikItemDialog defaultCategory={defaultDialogCategory} />
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px_auto] md:items-end"
            action="/mitglieder/lagerverwaltung/technik"
            method="get"
          >
            <div className="grid gap-1.5">
              <Label htmlFor="technik-search">Suche</Label>
              <Input
                id="technik-search"
                type="search"
                name="q"
                defaultValue={query}
                placeholder="Hersteller, Modell, Typ oder Inventarnummer suchen"
                className="w-full"
              />
            </div>
            <div className="grid gap-1.5 md:max-w-xs">
              <Label htmlFor="technik-category-filter">Kategorie</Label>
              <select
                id="technik-category-filter"
                name="category"
                defaultValue={selectedCategory === "all" ? "all" : selectedCategory}
                className="flex h-10 w-full rounded-md border border-input bg-card px-3 py-2 text-sm shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60"
              >
                <option value="all">Alle Kategorien</option>
                {TECH_INVENTORY_CATEGORIES.map((categoryOption) => (
                  <option key={categoryOption.value} value={categoryOption.value}>
                    {categoryOption.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end gap-2 md:justify-end">
              <Button type="submit">Filtern</Button>
              {query.length || selectedCategory !== "all" ? (
                <Button variant="ghost" type="button" asChild>
                  <Link href="/mitglieder/lagerverwaltung/technik">Zurücksetzen</Link>
                </Button>
              ) : null}
            </div>
          </form>
          <p className="mt-3 text-xs text-muted-foreground">
            Filter wirken auf die gesamte Liste. Lass beide Felder leer, um alle Artikel zu sehen.
          </p>
        </CardContent>
      </Card>
      {!hasItems ? (
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">
              {selectedCategory === "all"
                ? "Lege den ersten Artikel an, um den Technik-Bestand zu pflegen."
                : `In der Kategorie ${TECH_CATEGORY_LABEL[selectedCategory]} sind noch keine Artikel angelegt.`}
            </p>
          </CardContent>
        </Card>
      ) : !hasVisibleItems ? (
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">
              {`Keine Treffer für „${query}“ ${
                selectedCategory === "all"
                  ? "über alle Kategorien."
                  : `in der Kategorie ${TECH_CATEGORY_LABEL[selectedCategory]}.`
              }`}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Passe Kategorie oder Suchbegriff an, um weitere Artikel einzublenden.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-hidden rounded-md border border-border/60">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kategorie &amp; Artikel</TableHead>
                  <TableHead className="min-w-[220px]">Bestand &amp; Kosten</TableHead>
                  <TableHead className="min-w-[240px]">Historie</TableHead>
                  <TableHead className="w-[80px] text-right">Aktionen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="align-top">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline">
                            {TECH_CATEGORY_LABEL[item.category]}
                          </Badge>
                          <p className="font-semibold text-foreground">
                            {item.manufacturer ?? "Unbekannter Hersteller"}
                          </p>
                        </div>
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
                            <span className="block whitespace-pre-line">{item.details}</span>
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
  );
}
