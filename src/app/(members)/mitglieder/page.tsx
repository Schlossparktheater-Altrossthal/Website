import { requireAuth } from "@/lib/rbac";
import { MembersDashboard } from "@/components/members-dashboard";

export default async function MembersPage() {
  await requireAuth();

  return <MembersDashboard />;
}
