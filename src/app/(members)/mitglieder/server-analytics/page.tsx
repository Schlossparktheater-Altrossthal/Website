import { collectServerAnalytics } from "@/lib/server-analytics";
import { hasPermission } from "@/lib/permissions";
import { requireAuth } from "@/lib/rbac";

import { ServerAnalyticsContent } from "./server-analytics-content";

function userHasOwnerRole(
  user: { role?: string | null; roles?: unknown } | null | undefined,
): boolean {
  if (!user) {
    return false;
  }

  if (user.role === "owner") {
    return true;
  }

  if (Array.isArray(user.roles)) {
    return user.roles.some((role) => {
      if (typeof role === "string") {
        return role === "owner";
      }
      if (role && typeof role === "object" && "role" in role) {
        return (role as { role?: string | null }).role === "owner";
      }
      return false;
    });
  }

  return false;
}

export default async function ServerAnalyticsPage() {
  const session = await requireAuth();
  const allowed = await hasPermission(session.user, "PRIVATE.ADMIN.SERVER.ANALYTICS");
  if (!allowed) {
    return (
      <div className="space-y-6">
        <div className="text-sm text-destructive">Kein Zugriff auf die Server-Statistiken</div>
      </div>
    );
  }

  const user = session.user!;
  const isOwner = userHasOwnerRole(user);
  const analytics = await collectServerAnalytics();

  return (
    <ServerAnalyticsContent
      initialAnalytics={analytics}
      canReset={isOwner}
      canManageSettings={isOwner}
    />
  );
}
