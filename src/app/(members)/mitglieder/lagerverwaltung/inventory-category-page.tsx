import { PageHeader } from "@/components/members/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { requireAuth } from "@/lib/rbac";
import { membersNavigationBreadcrumb } from "@/lib/members-breadcrumbs";

const NUMBER_FORMATTER = new Intl.NumberFormat("de-DE");

export type InventoryCategory = "technik" | "kostueme";

type InventoryCategoryConfig = {
  title: string;
  description: string;
  permissionKey: string;
  href: string;
  emptyDescription: string;
  emptyHint: string;
  matchingHint: string;
  matchKeywords: string[];
};

type InventoryItemRow = {
  id: string;
  name: string;
  quantity: number;
  location: string | null;
  owner: string | null;
  condition: string | null;
};

const CATEGORY_CONFIG: Record<InventoryCategory, InventoryCategoryConfig> = {
  technik: {
    title: "Technik-Lager",
    description:
      "Alle Geräte, Kabel und Bühnenkomponenten des Techniklagers im Blick – perfekt für Vorbereitung und Rückgabe.",
    permissionKey: "mitglieder.lager.technik",
    href: "/mitglieder/lagerverwaltung/technik",
    emptyDescription: "Noch keine Inventarposten für das Technik-Lager hinterlegt.",
    emptyHint:
      "Ergänze neue Artikel im Inventar und hinterlege als Standort oder Verantwortliche das Stichwort Technik, um sie automatisch hier zu sehen.",
    matchingHint:
      "Artikel werden nach Stichworten wie „Technik“, „Ton“, „Licht“ oder „Bühne“ in Standort oder Verantwortlichkeit zugeordnet.",
    matchKeywords: ["technik", "ton", "licht", "bühne"],
  },
  kostueme: {
    title: "Kostüm-Lager",
    description:
      "Kostümfundus, Accessoires und Pflegehinweise gebündelt – ideal für Anproben, Änderungen und Ausgaben.",
    permissionKey: "mitglieder.lager.kostueme",
    href: "/mitglieder/lagerverwaltung/kostueme",
    emptyDescription: "Noch keine Inventarposten für das Kostüm-Lager hinterlegt.",
    emptyHint:
      "Lege Kostümteile im Inventar an und verwende Begriffe wie Kostüm oder Fundus beim Standort, damit sie hier erscheinen.",
    matchingHint:
      "Artikel mit Begriffen wie „Kostüm“, „Fundus“ oder „Garderobe“ im Standort oder Verantwortungsfeld werden automatisch zugeordnet.",
    matchKeywords: ["kost", "fundus", "garderobe"],
  },
};

function matchesCategory(item: InventoryItemRow, keywords: string[]) {
  if (!keywords.length) {
    return true;
  }

  const fields = [item.location, item.owner].filter(Boolean).map((value) => value!.toLowerCase());
  if (!fields.length) {
    return false;
  }

  return fields.some((field) => keywords.some((keyword) => field.includes(keyword)));
}

function InventoryTable({ items }: { items: InventoryItemRow[] }) {
  if (!items.length) {
    return null;
  }

  return (
    <div className="overflow-hidden rounded-md border border-border/60">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Artikel</TableHead>
            <TableHead className="w-[100px] text-right">Bestand</TableHead>
            <TableHead>Standort</TableHead>
            <TableHead>Verantwortung</TableHead>
            <TableHead>Zustand</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id}>
              <TableCell className="font-medium">{item.name}</TableCell>
              <TableCell className="text-right">
                {NUMBER_FORMATTER.format(item.quantity)}
              </TableCell>
              <TableCell>{item.location ?? "–"}</TableCell>
              <TableCell>{item.owner ?? "–"}</TableCell>
              <TableCell>{item.condition ?? "–"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function createInventoryCategoryPage(category: InventoryCategory) {
  const config = CATEGORY_CONFIG[category];

  return async function InventoryCategoryPage() {
    const session = await requireAuth();
    const allowed = await hasPermission(session.user, config.permissionKey);

    if (!allowed) {
      return (
        <div className="rounded-md border border-border/60 bg-background/80 p-4 text-sm text-red-600">
          Kein Zugriff auf diesen Lagerbereich.
        </div>
      );
    }

    const records = await prisma.inventoryItem.findMany({
      orderBy: [
        { name: "asc" },
        { id: "asc" },
      ],
      select: {
        id: true,
        name: true,
        qty: true,
        location: true,
        owner: true,
        condition: true,
      },
    });

    const items = records
      .map((record) => ({
        id: record.id,
        name: record.name,
        quantity: record.qty,
        location: record.location,
        owner: record.owner,
        condition: record.condition,
      }))
      .filter((item) => matchesCategory(item, config.matchKeywords));
    const itemCount = items.length;
    const totalQuantity = items.reduce((acc, item) => acc + item.quantity, 0);
    const breadcrumb = membersNavigationBreadcrumb(config.href);

    return (
      <div className="space-y-6">
        <PageHeader
          title={config.title}
          description={config.description}
          breadcrumbs={[breadcrumb]}
        />
        <Card>
          <CardHeader>
            <CardTitle>Bestandsübersicht</CardTitle>
            <p className="text-sm text-muted-foreground">
              {itemCount
                ? `${itemCount} Inventarposten, Gesamtbestand ${NUMBER_FORMATTER.format(totalQuantity)} Einheiten.`
                : config.emptyDescription}
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {itemCount ? (
              <InventoryTable items={items} />
            ) : (
              <p className="text-sm text-muted-foreground">{config.emptyHint}</p>
            )}
            <p className="text-xs text-muted-foreground">{config.matchingHint}</p>
          </CardContent>
        </Card>
      </div>
    );
  };
}
