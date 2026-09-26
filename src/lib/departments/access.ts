import { getActiveProduction } from "@/lib/active-production";
import { hasPermission } from "@/lib/permissions";
import { requireAuth } from "@/lib/rbac";

/** Angemeldete Person, aktive Produktion und ob sie alle Gewerke sehen darf (Regie/Board). */
export async function resolveTeamsViewer() {
  const session = await requireAuth();
  const userId = session.user?.id ?? null;
  const [isManager, production] = await Promise.all([
    hasPermission(session.user, "PRIVATE.PRODUCTION.SHOW.MANAGE"),
    getActiveProduction(userId),
  ]);
  return { userId, isManager, production };
}
