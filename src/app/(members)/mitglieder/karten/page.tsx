import { redirect } from "next/navigation";

import { OfficePage } from "@/components/karten/office/office-page";
import { getTicketActor } from "@/lib/karten/access";
import { MEMBERS_TICKETS_PATH } from "@/lib/karten/constants";
import { withShowParam } from "@/lib/karten/context";
import { membersNavigationBreadcrumb } from "@/lib/members-breadcrumbs";
import { requireAuth } from "@/lib/rbac";

export default async function MembersTicketOfficePage({
  searchParams,
}: {
  searchParams: Promise<{ produktion?: string; vorstellung?: string }>;
}) {
  await requireAuth();
  const actor = await getTicketActor();
  const params = await searchParams;
  if (!actor || actor.kind !== "member") {
    return (
      <div className="space-y-6">
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          Kein Zugriff auf den Kartenverkauf.
        </div>
      </div>
    );
  }
  // Nur Einlass-Recht: direkt zum Einlass.
  if (!actor.canOffice)
    redirect(withShowParam(`${MEMBERS_TICKETS_PATH}/einlass`, params.produktion));
  return (
    <OfficePage
      actor={actor}
      basePath={MEMBERS_TICKETS_PATH}
      searchParams={params}
      breadcrumbs={[membersNavigationBreadcrumb(MEMBERS_TICKETS_PATH)]}
    />
  );
}
