import { MembersDashboard } from "@/components/members-dashboard";
import {
  getDashboardOverview,
  DashboardOverviewAccessError,
} from "@/lib/dashboard-overview";
import { requireAuth } from "@/lib/rbac";

export default async function MitgliederPage() {
  const session = await requireAuth();

  try {
    const overview = await getDashboardOverview(session);
    return <MembersDashboard initialData={overview} />;
  } catch (error) {
    if (error instanceof DashboardOverviewAccessError && error.statusCode === 403) {
      return (
        <div className="p-6 text-sm text-muted-foreground">
          Du hast keinen Zugriff auf das Mitglieder-Dashboard.
        </div>
      );
    }
    throw error;
  }
}
