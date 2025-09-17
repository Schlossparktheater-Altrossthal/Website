import { MembersDashboard } from "@/components/members-dashboard";
import { Metadata } from "next";
import { requireAuth } from "@/lib/rbac";
import { hasPermission } from "@/lib/permissions";

export const metadata: Metadata = {
  title: "Mitglieder-Dashboard - Schlossparktheater",
  description: "Live-Dashboard für Theater-Mitglieder mit Online-Status und aktuellen Aktivitäten",
};

export default async function MembersDashboardPage() {
  const session = await requireAuth();
  const allowed = await hasPermission(session.user, "mitglieder.dashboard");
  if (!allowed) {
    return <div className="text-sm text-red-600">Kein Zugriff auf das Mitglieder-Dashboard</div>;
  }
  return <MembersDashboard />;
}
