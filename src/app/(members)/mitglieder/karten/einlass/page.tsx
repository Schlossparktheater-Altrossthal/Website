import { DoorPage } from "@/components/karten/door/door-page";
import { getTicketActor } from "@/lib/karten/access";
import { MEMBERS_TICKETS_PATH } from "@/lib/karten/constants";
import { membersNavigationBreadcrumb } from "@/lib/members-breadcrumbs";
import { requireAuth } from "@/lib/rbac";

export default async function MembersDoorPage({
  searchParams,
}: {
  searchParams: Promise<{ produktion?: string; vorstellung?: string }>;
}) {
  await requireAuth();
  const actor = await getTicketActor();
  if (!actor || actor.kind !== "member" || !actor.canCheckIn) {
    return (
      <div className="space-y-6">
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          Kein Zugriff auf den Einlass.
        </div>
      </div>
    );
  }
  return (
    <DoorPage
      actor={actor}
      basePath={MEMBERS_TICKETS_PATH}
      searchParams={await searchParams}
      breadcrumbs={[membersNavigationBreadcrumb(MEMBERS_TICKETS_PATH)]}
    />
  );
}
