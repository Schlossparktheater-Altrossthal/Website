import Link from "next/link";

import { requireAuth } from "@/lib/rbac";
import { MembersDashboard } from "@/components/members-dashboard";
import { EventTaskList } from "@/components/calendar/event-task-list";
import { Card } from "@/components/ui/card";
import { SectionHeader } from "@/components/ui/section-header";
import { readMyTasks } from "@/lib/calendar/my-tasks";
import { readProtocolShortcuts } from "@/lib/calendar/protocol-server";
import { Button } from "@/components/ui/button";
import { DeadlineBadge } from "@/components/production/deadline-badge";
import { DateBadge } from "@/components/ui/date-badge";
import { ListRow, ListRowGroup } from "@/components/ui/list-row";
import { getActiveProduction } from "@/lib/active-production";
import { loadUpcomingDeadlines } from "@/lib/planning/plan-service";

export default async function MembersPage() {
  const session = await requireAuth();
  const userId = session.user?.id;
  const [tasks, production, rehearsals] = await Promise.all([
    userId ? readMyTasks(userId) : Promise.resolve([]),
    getActiveProduction(userId),
    readProtocolShortcuts(session.user),
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

  // Wer Proben protokolliert oder als Gewerk-Leitung Hinweise gibt, kommt hier direkt hinein.
  const rehearsalCard = rehearsals.length ? (
    <Card variant="plain" size="flush" id="probenmodus" className="order-first lg:order-none">
      <div className="p-4 pb-2">
        <SectionHeader
          title={
            rehearsals.some((entry) => entry.phase === "run") ? "Probe gleich" : "Nächste Proben"
          }
          description="Probenmodus: vorbereiten, protokollieren, Hinweise geben"
        />
      </div>
      <ListRowGroup className="pb-2">
        {rehearsals.map((entry) => (
          <ListRow
            key={entry.id}
            leading={<DateBadge date={new Date(entry.start)} />}
            title={entry.title}
            description={
              entry.access === "notes"
                ? "Hinweise und Aufgaben für dein Gewerk"
                : entry.phase === "run"
                  ? "Anwesenheit und Ablauf erfassen"
                  : "Notizen und Aufgaben vorab"
            }
            trailing={
              <Button asChild size="sm" variant={entry.phase === "run" ? "default" : "outline"}>
                <Link href={entry.href}>
                  {entry.access === "notes"
                    ? "Hinweise"
                    : entry.phase === "run"
                      ? "Probenmodus"
                      : "Vorbereiten"}
                </Link>
              </Button>
            }
          />
        ))}
      </ListRowGroup>
    </Card>
  ) : null;

  return (
    <MembersDashboard
      tasksSlot={
        <>
          {rehearsalCard}
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
