import { collectServerAnalytics } from "@/lib/server-analytics";
import { hasPermission } from "@/lib/permissions";
import { requireAuth } from "@/lib/rbac";

import { ServerAnalyticsContent } from "./server-analytics-content";

export default async function ServerAnalyticsPage() {
  const session = await requireAuth();
  const allowed = await hasPermission(session.user, "mitglieder.server.analytics");
  if (!allowed) {
    return <div className="text-sm text-red-600">Kein Zugriff auf die Server-Statistiken</div>;
  }

  const analytics = await collectServerAnalytics();

  return <ServerAnalyticsContent initialAnalytics={analytics} />;
}
