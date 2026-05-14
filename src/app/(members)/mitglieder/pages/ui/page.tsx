import { hasRole, requireAuth } from "@/lib/rbac";
import { redirect } from "next/navigation";

export default async function PagesUiOverviewPage() {
  const session = await requireAuth();
  if (!hasRole(session.user, "owner") && !hasRole(session.user, "admin")) {
    redirect("/mitglieder");
  }
  return <div className="space-y-6"><h1 className="text-3xl font-semibold tracking-tight">UI</h1><p className="text-sm text-muted-foreground">Read-only Übersicht für Buttons, Icons und responsive Referenzen.</p></div>;
}
