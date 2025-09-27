import { notFound } from "next/navigation";

import { PageHeader } from "@/components/members/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Text } from "@/components/ui/typography";
import { membersNavigationBreadcrumb } from "@/lib/members-breadcrumbs";
import { buildInventoryItemPath } from "@/lib/inventory/sticker-links";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";
import { cn } from "@/lib/utils";
import {
  TECH_CATEGORY_LABEL,
  type TechnikInventoryCategory,
} from "@/app/(members)/mitglieder/lagerverwaltung/technik/config";

const NUMBER_FORMATTER = new Intl.NumberFormat("de-DE");
const CURRENCY_FORMATTER = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
});
const DATE_FORMATTER = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" });
const DATE_TIME_FORMATTER = new Intl.DateTimeFormat("de-DE", {
  dateStyle: "medium",
  timeStyle: "short",
});

function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "–";
  }

  return CURRENCY_FORMATTER.format(value);
}

function formatDate(value: Date | null | undefined): string {
  if (!value) {
    return "–";
  }

  return DATE_FORMATTER.format(value);
}

function formatDateTime(value: Date | null | undefined): string {
  if (!value) {
    return "–";
  }

  return DATE_TIME_FORMATTER.format(value);
}

type PageProps = { params: Promise<{ code: string }> };

export default async function InventoryItemPage({ params }: PageProps) {
  const session = await requireAuth();
  const allowed = await hasPermission(session.user, "mitglieder.lager.technik");

  if (!allowed) {
    return (
      <div className="rounded-md border border-border/60 bg-background/80 p-4 text-sm text-red-600">
        Kein Zugriff auf diesen Lagerbereich.
      </div>
    );
  }

  const hasDatabase = Boolean(process.env.DATABASE_URL);
  if (!hasDatabase) {
    return (
      <div className="rounded-md border border-border/60 bg-background/80 p-4 text-sm text-muted-foreground">
        Keine Datenbankverbindung für das Inventar verfügbar.
      </div>
    );
  }

  const { code: rawCode } = await params;
  const decoded = decodeURIComponent(Array.isArray(rawCode) ? rawCode[0] : rawCode);
  const normalizedCode = decoded.trim();

  if (!normalizedCode) {
    notFound();
  }

  const item = await prisma.inventoryItem.findFirst({
    where: {
      OR: [{ sku: normalizedCode }, { id: normalizedCode }],
    },
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
      location: true,
      owner: true,
      condition: true,
      details: true,
      category: true,
      lastUsedAt: true,
      lastInventoryAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!item) {
    notFound();
  }

  const parentBreadcrumb =
    membersNavigationBreadcrumb("/mitglieder/lagerverwaltung/technik") ??
    ({ label: "Technik-Lager", href: "/mitglieder/lagerverwaltung/technik" } as const);
  const currentBreadcrumb = {
    label: item.name,
    href: buildInventoryItemPath(item.sku),
  } as const;

  const category = item.category as TechnikInventoryCategory;
  const categoryLabel = TECH_CATEGORY_LABEL[category] ?? category;
  const condition = item.condition?.trim() ?? null;
  const owner = item.owner?.trim() ?? null;
  const location = item.location?.trim() ?? null;
  const descriptionParts = [item.itemType?.trim(), item.manufacturer?.trim()].filter(Boolean);
  const description = descriptionParts.length
    ? descriptionParts.join(" • ")
    : "Inventarposten im Technik-Lager";

  const detailEntries = [
    { label: "Inventarnummer", value: item.sku, mono: true },
    { label: "Kategorie", value: categoryLabel },
    { label: "Gerätetyp", value: item.itemType?.trim() ?? "–" },
    { label: "Hersteller", value: item.manufacturer?.trim() ?? "–" },
    { label: "Bestand", value: NUMBER_FORMATTER.format(item.qty) },
    { label: "Anschaffungskosten (Stück)", value: formatCurrency(item.acquisitionCost) },
    { label: "Gesamtwert", value: formatCurrency(item.totalValue) },
    { label: "Anschaffungsdatum", value: formatDate(item.purchaseDate) },
  ];

  const statusEntries = [
    { label: "Standort", value: location ?? "–" },
    { label: "Verantwortlich", value: owner ?? "–" },
    { label: "Zustand", value: condition ?? "–" },
    { label: "Zuletzt verwendet", value: formatDateTime(item.lastUsedAt) },
    { label: "Letzte Inventur", value: formatDateTime(item.lastInventoryAt) },
  ];

  const timelineEntries = [
    { label: "Datenbank-ID", value: item.id, mono: true },
    { label: "Erstellt am", value: formatDateTime(item.createdAt) },
    { label: "Zuletzt aktualisiert", value: formatDateTime(item.updatedAt) },
  ];

  const breadcrumb = [parentBreadcrumb, currentBreadcrumb];

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        title={item.name}
        description={description}
        breadcrumbs={breadcrumb}
        status={
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="font-mono">
              Nr. {item.sku}
            </Badge>
            <Badge variant={item.qty > 0 ? "success" : "destructive"}>
              Bestand {NUMBER_FORMATTER.format(item.qty)}
            </Badge>
            <Badge variant="secondary">{categoryLabel}</Badge>
            {condition ? <Badge variant="info">{condition}</Badge> : null}
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Stammdaten</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-4 sm:grid-cols-2">
                {detailEntries.map((entry) => (
                  <div key={entry.label} className="space-y-1">
                    <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                      {entry.label}
                    </dt>
                    <dd className={cn("text-sm text-foreground", entry.mono ? "font-mono" : undefined)}>
                      {entry.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Status & Standort</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-4 sm:grid-cols-2">
                {statusEntries.map((entry) => (
                  <div key={entry.label} className="space-y-1">
                    <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                      {entry.label}
                    </dt>
                    <dd className="text-sm text-foreground">{entry.value}</dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Beschreibung & Notizen</CardTitle>
            </CardHeader>
            <CardContent>
              {item.details?.trim() ? (
                <Text className="whitespace-pre-wrap text-sm text-foreground">
                  {item.details.trim()}
                </Text>
              ) : (
                <Text variant="caption" tone="muted">
                  Keine zusätzlichen Notizen hinterlegt.
                </Text>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Verlauf</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-4">
                {timelineEntries.map((entry) => (
                  <div key={entry.label} className="space-y-1">
                    <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                      {entry.label}
                    </dt>
                    <dd className={cn("text-sm text-foreground", entry.mono ? "font-mono" : undefined)}>
                      {entry.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
