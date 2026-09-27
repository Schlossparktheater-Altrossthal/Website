import { PageHeader } from "@/components/members/page-header";
import { requireAuth } from "@/lib/rbac";

import { NotificationsPageClient } from "./page-client";

export const metadata = { title: "Benachrichtigungen" };

export default async function NotificationsPage() {
  await requireAuth();
  return (
    <div className="space-y-6">
      <PageHeader
        title="Benachrichtigungen"
        description="Was zu tun ist, was neu ist – und alles Frühere."
      />
      <NotificationsPageClient />
    </div>
  );
}
