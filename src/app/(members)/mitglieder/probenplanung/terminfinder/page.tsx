export const dynamic = "force-dynamic";

import { PageHeader } from "@/components/members/page-header";
import { getActiveProduction } from "@/lib/active-production";
import { loadAudienceContext } from "@/lib/calendar/audience-server";
import { DEFAULT_TIME_ZONE, formatIsoDateInTimeZone } from "@/lib/date-time";
import { membersNavigationBreadcrumb } from "@/lib/members-breadcrumbs";
import { hasPermission } from "@/lib/permissions";
import { requireAuth } from "@/lib/rbac";

import { DateFinder } from "./date-finder";

export default async function DateFinderPage() {
  const session = await requireAuth();
  const production = await getActiveProduction(session.user?.id);
  const showId = production?.id ?? null;
  const allowed = await hasPermission(session.user, "PRIVATE.REHEARSAL.PLANNING.MANAGE", {
    showId,
  });
  if (!allowed) {
    return <div className="text-sm text-destructive">Kein Zugriff auf die Probenplanung</div>;
  }

  const context = await loadAudienceContext(showId);
  const today = formatIsoDateInTimeZone(new Date().toISOString(), DEFAULT_TIME_ZONE);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Terminfinder"
        description="Wähle, wer dabei sein soll, und finde die Tage, an denen laut Sperrliste und vorhandenen Terminen die meisten können."
        breadcrumbs={[
          membersNavigationBreadcrumb("/mitglieder/probenplanung"),
          { id: "terminfinder", label: "Terminfinder", isCurrent: true },
        ]}
      />
      <DateFinder context={context} today={today} />
    </div>
  );
}
