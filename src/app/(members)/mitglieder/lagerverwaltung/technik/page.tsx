import { hasPermission } from "@/lib/permissions";
import { requireAuth } from "@/lib/rbac";

export const dynamic = "force-dynamic";

export default async function TechnikLagerPage() {
  const session = await requireAuth();
  const allowed = await hasPermission(session.user, "PRIVATE.INVENTORY.TECH.MANAGE");

  if (!allowed) {
    return (
      <div className="space-y-6">
        <div className="rounded-md border border-border/60 bg-background/80 p-4 text-sm text-red-600">
          Kein Zugriff auf das Technik-Lager.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">Hier entsteht etwas neues</p>
    </div>
  );
}
