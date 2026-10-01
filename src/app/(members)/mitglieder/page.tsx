import { requireAuth } from "@/lib/rbac";
import { MembersDashboard } from "@/components/members-dashboard";
import { EventTaskList } from "@/components/calendar/event-task-list";
import { Card } from "@/components/ui/card";
import { SectionHeader } from "@/components/ui/section-header";
import { readMyTasks } from "@/lib/calendar/my-tasks";
import { DeadlineBadge } from "@/components/production/deadline-badge";
import { DateBadge } from "@/components/ui/date-badge";
import { ListRow, ListRowGroup } from "@/components/ui/list-row";
import { getActiveProduction } from "@/lib/active-production";
import { loadUpcomingDeadlines } from "@/lib/planning/plan-service";

export default async function MembersPage() {
  const session = await requireAuth();
  const userId = session.user?.id;
  const [tasks, production] = await Promise.all([
    userId ? readMyTasks(userId) : Promise.resolve([]),
    getActiveProduction(userId),
  ]);
  const open = tasks.filter((task) => !task.doneAt).length;
  const deadlines = production ? await loadUpcomingDeadlines(session.user, production.id) : [];
  const now = new Date();

  const deadlinesCard = deadlines.length ? (
    <Card variant="plain" size="flush" id="fristen">
      <div className="p-4 pb-2">
        <SectionHeader title="Nächste Fristen" description="Aus dem Produktionsplan" />
      </div>
      <ListRowGroup className="pb-2">
        {deadlines.map((deadline) => (
          <ListRow
            key={deadline.id}
            href="/mitglieder/produktionen"
            leading={<DateBadge date={deadline.dueAt} />}
            title={deadline.title}
            description={deadline.departmentName ?? undefined}
            trailing={<DeadlineBadge dueAt={deadline.dueAt} now={now} />}
          />
        ))}
      </ListRowGroup>
    </Card>
  ) : null;

  return (
    <MembersDashboard
      tasksSlot={
        <>
          {tasks.length ? (
            <Card variant="plain" size="flush" id="aufgaben" className="order-first lg:order-none">
              <div className="p-4 pb-2">
                <SectionHeader
                  title="Meine Aufgaben"
                  description={open ? `${open} offen – aus den Proben` : "Alles erledigt"}
                />
              </div>
              <div className="pb-2">
                <EventTaskList tasks={tasks} />
              </div>
            </Card>
          ) : null}
          {deadlinesCard}
        </>
      }
    />
  );
}
