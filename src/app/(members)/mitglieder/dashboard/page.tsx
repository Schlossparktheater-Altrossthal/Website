import { MembersDashboard } from "@/components/members-dashboard";
import { requireAuth } from "@/lib/rbac";

export default async function MembersDashboardPage() {
  await requireAuth();
  return <MembersDashboard />;
}
