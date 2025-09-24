import { membersNavigationBreadcrumb } from "@/lib/members-breadcrumbs";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";

import InventoryStickersPageClient from "./inventory-stickers-page-client";

export default async function InventoryStickersPage() {
  await requireAuth();

  const hasDatabase = Boolean(process.env.DATABASE_URL);
  const breadcrumb =
    membersNavigationBreadcrumb("/mitglieder/inventar-aufkleber") ??
    ({ label: "Inventaraufkleber", href: "/mitglieder/inventar-aufkleber" } as const);

  let inventoryItems: {
    id: string;
    name: string;
    location: string | null;
    owner: string | null;
  }[] = [];

  if (hasDatabase) {
    const records = await prisma.inventoryItem.findMany({
      select: { id: true, name: true, location: true, owner: true },
      orderBy: [{ name: "asc" }, { id: "asc" }],
    });

    inventoryItems = records.map((item) => ({
      id: item.id,
      name: item.name,
      location: item.location ?? null,
      owner: item.owner ?? null,
    }));
  }

  return (
    <InventoryStickersPageClient
      breadcrumb={breadcrumb}
      inventoryItems={inventoryItems}
      hasDatabase={hasDatabase}
    />
  );
}
