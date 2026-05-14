import { redirect } from "next/navigation";
import { hasPermission } from "@/lib/permissions";
import { requireAuth } from "@/lib/rbac";

export default async function SeitensteuerungPage() {
  const session = await requireAuth();
  const allowed = await hasPermission(session.user, "pages.manage");
  if (!allowed) redirect("/mitglieder");
  return <div className="space-y-6"><h1 className="text-3xl font-semibold tracking-tight">Seitensteuerung</h1><p className="text-sm text-muted-foreground">Die Verwaltung wird im nächsten Schritt an die Website-Einstellungen angebunden.</p></div>;
}
