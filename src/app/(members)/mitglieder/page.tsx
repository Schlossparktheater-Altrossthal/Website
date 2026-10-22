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
import { RECIPIENT_WISHES_PATH, listRecipientWishes } from "@/lib/regie/wishes";
import { Badge } from "@/components/ui/badge";
import { loadUpcomingDeadlines } from "@/lib/planning/plan-service";
import { loadDashboardScript } from "@/lib/skript/learn/dashboard";
import { ProgressRing } from "@/components/ui/progress-ring";

export default async function MembersPage() {
  const session = await requireAuth();
  const userId = session.user?.id;
  const [tasks, production, rehearsals] = await Promise.all([
    userId ? readMyTasks(userId) : Promise.resolve([]),
    getActiveProduction(userId),
    readProtocolShortcuts(session.user),
  ]);
  const open = tasks.filter((task) => !task.doneAt).length;
  const [deadlines, script, wishes] = production
    ? await Promise.all([
        loadUpcomingDeadlines(session.user, production.id),
        userId ? loadDashboardScript(production.id, userId) : Promise.resolve(null),
        userId ? listRecipientWishes(production.id, userId) : Promise.resolve([]),
      ])
    : [[], null, []];
  // Wünsche der Regie, bei denen ich (bzw. meine Rolle/mein Gewerk) noch etwas tun kann.
  const openWishes = wishes.filter((wish) =>
    wish.targets.some(
      (target) => target.mine && (target.status === "open" || target.status === "accepted"),
    ),
  );
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

  const wishesCard = openWishes.length ? (
    <Card variant="plain" size="flush" id="wuensche" className="order-first lg:order-none">
      <div className="p-4 pb-2">
        <SectionHeader
          title="Wünsche der Regie"
          description={`${openWishes.length} offen – an dich, deine Rollen oder Gewerke`}
        />
      </div>
      <ListRowGroup className="pb-2">
        {openWishes.slice(0, 4).map((wish) => {
          const mine = wish.targets.filter((target) => target.mine);
          return (
            <ListRow
              key={wish.id}
              href={`${RECIPIENT_WISHES_PATH}#wunsch-${wish.id}`}
              title={wish.text.split("\n")[0]}
              description={mine.map((target) => target.label).join(", ")}
              trailing={
                <Badge variant={mine.some((t) => t.status === "open") ? "warning" : "info"}>
                  {mine.some((t) => t.status === "open") ? "offen" : "angenommen"}
                </Badge>
              }
            />
          );
        })}
      </ListRowGroup>
      <div className="px-4 pb-4">
        <Button asChild size="sm" variant="outline">
          <Link href={RECIPIENT_WISHES_PATH}>Alle Wünsche</Link>
        </Button>
      </div>
    </Card>
  ) : null;

  const learn = script?.learn;
  const scriptCard = script ? (
    <Card variant="plain" size="flush" id="skript">
      <div className="flex items-center gap-3 p-4 pb-2">
        {learn ? (
          <ProgressRing
            value={learn.solid}
            max={learn.total}
            label={`${learn.total ? Math.round((learn.solid / learn.total) * 100) : 0}%`}
          />
        ) : null}
        <SectionHeader
          title={learn ? "Mein Text" : "Skript"}
          description={
            learn
              ? `${script.roleNames.join(", ")} · ${learn.solid} von ${learn.total} Stellen sitzen`
              : `Aktuelle Fassung: ${script.label}`
          }
        />
      </div>
      {learn ? (
        <p className="px-4 text-sm text-muted-foreground">
          {learn.changed ? `${learn.changed} geänderte Stellen · ` : ""}
          {learn.due ? `${learn.due} heute zu wiederholen` : "Heute nichts fällig"}
          {learn.fresh ? ` · ${learn.fresh} noch neu` : ""}
          <br />
          Fassung: {script.label}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2 p-4 pt-3">
        {learn ? (
          <Button asChild size="sm">
            <Link href={`/mitglieder/lernen/${script.showId}`}>Text lernen</Link>
          </Button>
        ) : null}
        <Button asChild size="sm" variant="outline">
          <Link href={`/mitglieder/skript/${script.versionId}`}>Skript lesen</Link>
        </Button>
      </div>
    </Card>
  ) : null;

  return (
    <MembersDashboard
      tasksSlot={
        <>
          {rehearsalCard}
          {wishesCard}
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
          {scriptCard}
          {deadlinesCard}
        </>
      }
    />
  );
}
