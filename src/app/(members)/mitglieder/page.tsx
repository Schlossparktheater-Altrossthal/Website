import { requireAuth } from "@/lib/rbac";
import { MembersDashboard } from "@/components/members-dashboard";
import { EventTaskList } from "@/components/calendar/event-task-list";
import { Card } from "@/components/ui/card";
import { SectionHeader } from "@/components/ui/section-header";
import { readMyTasks } from "@/lib/calendar/my-tasks";

export default async function MembersPage() {
  const session = await requireAuth();
  const userId = session.user?.id;
  const tasks = userId ? await readMyTasks(userId) : [];
  const open = tasks.filter((task) => !task.doneAt).length;

  return (
    <MembersDashboard
      tasksSlot={
        tasks.length ? (
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
        ) : null
      }
    />
  );
}
