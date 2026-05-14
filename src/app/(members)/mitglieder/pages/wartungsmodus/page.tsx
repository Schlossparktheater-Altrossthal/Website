import { redirect } from "next/navigation";
import { hasPermission } from "@/lib/permissions";
import { requireAuth } from "@/lib/rbac";

export default async function WartungsmodusPage() {
  const session = await requireAuth();
  const allowed = await hasPermission(session.user, "pages.manage");
  if (!allowed) redirect("/mitglieder");
  return <div className="space-y-6"><h1 className="text-3xl font-semibold tracking-tight">Wartungsmodus</h1><p className="text-sm text-muted-foreground">Wartungsmodus wird über Website-Einstellungen gesteuert.</p></div>;
}
