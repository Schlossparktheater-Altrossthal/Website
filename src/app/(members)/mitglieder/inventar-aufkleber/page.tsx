import { requireAuth } from "@/lib/rbac";

export default async function InventoryStickersPage() {
  await requireAuth();

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">Hier entsteht etwas neues</p>
    </div>
  );
}
