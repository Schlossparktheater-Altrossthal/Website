import { PageHeader } from "@/components/members/page-header";
import { WishBoard } from "@/components/regie/wish-board";
import { getActiveProduction } from "@/lib/active-production";
import { membersNavigationBreadcrumb } from "@/lib/members-breadcrumbs";
import { requireAuth } from "@/lib/rbac";
import { formatDay, formatTime, loadDirectionEvents } from "@/lib/regie/data";
import { canPlanForShow, listPlannerWishes } from "@/lib/regie/wishes";

export const metadata = { title: "Regie-Wünsche" };

/** Sicht der Planung auf die Wünsche des Regieteams (docs/Plan/regie-plan.md, Phase 5). */
export default async function PlannerDirectionWishesPage() {
  const session = await requireAuth();
  const userId = session.user?.id;
  const production = await getActiveProduction(userId);
  if (!userId || !production || !(await canPlanForShow({ id: userId }, production.id))) {
    return <div className="text-sm text-destructive">Kein Zugriff auf die Regie-Wünsche.</div>;
  }
  const [wishes, events] = await Promise.all([
    listPlannerWishes(production.id, userId),
    loadDirectionEvents(production.id),
  ]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Regie-Wünsche"
        description={`Wünsche des Regieteams an die Probenplanung für „${production.title ?? production.year}“. Einplanen, beantworten oder mit Grund ablehnen.`}
        breadcrumbs={[membersNavigationBreadcrumb("/mitglieder/terminplanung")]}
      />
      <div className="max-w-2xl">
        <WishBoard
          wishes={wishes}
          currentUserId={userId}
          mode="planner"
          events={events
            .filter((event) => event.status !== "CANCELLED")
            .map((event) => ({
              id: event.id,
              label: `${formatDay(event.start)} ${event.allDay ? "" : formatTime(event.start)} · ${event.title}`,
            }))}
        />
      </div>
    </div>
  );
}
