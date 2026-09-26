import Link from "next/link";
import { notFound } from "next/navigation";
import type { TaskStatus } from "@prisma/client";

import { PageHeader } from "@/components/members/page-header";
import { ChevronRightIcon } from "@/components/ui/action-icons";
import { Badge } from "@/components/ui/badge";
import { resolveTeamsViewer } from "@/lib/departments/access";
import { loadDepartmentPortal } from "@/lib/departments/portal";
import { cn } from "@/lib/utils";

import { formatDue, formatEventDate, Initials, TEAM_ROLE_LABELS, ViewSwitcher } from "../team-ui";

type View = "uebersicht" | "aufgaben" | "team";

const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: "Offen",
  doing: "In Arbeit",
  done: "Erledigt",
};

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ ansicht?: string }>;
};

export default async function GewerkPortalPage({ params, searchParams }: PageProps) {
  const [{ slug }, { ansicht }] = await Promise.all([params, searchParams]);
  const { userId, isManager, production } = await resolveTeamsViewer();
  if (!userId || !production) notFound();

  const portal = await loadDepartmentPortal(production.id, decodeURIComponent(slug), userId);
  // Sichtbar für Mitglieder des Gewerks sowie Regie/Board.
  if (!portal || (!portal.viewerRole && !isManager)) notFound();

  const view: View = ansicht === "aufgaben" || ansicht === "team" ? ansicht : "uebersicht";
  const basePath = `/mitglieder/meine-gewerke/${encodeURIComponent(portal.slug)}`;
  const canManage = isManager || portal.viewerRole === "lead";
  const leads = portal.members.filter((member) => member.role === "lead");

  return (
    <div className="space-y-6">
      <PageHeader
        title={portal.name}
        description={
          portal.viewerRole
            ? `Du bist hier ${TEAM_ROLE_LABELS[portal.viewerRole]}.`
            : "Du siehst dieses Gewerk als Regie."
        }
        breadcrumbs={[{ id: "teams", label: "Meine Teams", href: "/mitglieder/meine-gewerke" }]}
      />

      <ViewSwitcher<View>
        basePath={basePath}
        current={view}
        options={[
          { value: "uebersicht", label: "Übersicht" },
          { value: "aufgaben", label: `Aufgaben ${portal.openTasks.length}` },
          { value: "team", label: `Team ${portal.members.length}` },
        ]}
      />

      {view === "uebersicht" ? (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="space-y-4">
            {portal.description ? (
              <p className="rounded-xl border border-border bg-card p-4 text-sm">
                {portal.description}
              </p>
            ) : null}

            <Section
              title="Für mich"
              action={{ href: `${basePath}?ansicht=aufgaben`, label: "Alle Aufgaben" }}
            >
              {portal.myTasks.length ? (
                <TaskList tasks={portal.myTasks} />
              ) : (
                <Empty>Dir ist gerade keine offene Aufgabe zugewiesen.</Empty>
              )}
            </Section>

            <Section title="Nächste Termine">
              {portal.events.length ? (
                <ul className="divide-y divide-border/60">
                  {portal.events.slice(0, 5).map((event) => (
                    <li key={event.id} className="flex min-h-12 flex-col justify-center py-2">
                      <span className="text-sm font-medium">{event.title}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatEventDate(event.start)}
                        {event.location ? ` · ${event.location}` : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <Empty>Noch keine Termine geplant.</Empty>
              )}
            </Section>
          </div>

          <aside className="space-y-4">
            <Section title="Ansprechpartner">
              {leads.length ? (
                <ul className="space-y-2">
                  {leads.map((member) => (
                    <MemberRow key={member.id} member={member} />
                  ))}
                </ul>
              ) : (
                <Empty>Die Leitung ist noch nicht bestimmt.</Empty>
              )}
            </Section>
            <Section title="Stand der Aufgaben">
              <div className="grid grid-cols-3 gap-2 text-center">
                {(["todo", "doing", "done"] as const).map((status) => (
                  <span key={status} className="rounded-lg bg-muted/60 py-2">
                    <span className="block text-lg font-semibold">{portal.taskCounts[status]}</span>
                    <span className="block text-xs text-muted-foreground">
                      {STATUS_LABELS[status]}
                    </span>
                  </span>
                ))}
              </div>
            </Section>
          </aside>
        </div>
      ) : null}

      {view === "aufgaben" ? (
        <Section title="Offene Aufgaben">
          {portal.openTasks.length ? (
            <TaskList tasks={portal.openTasks} mine={new Set(portal.myTasks.map((t) => t.id))} />
          ) : (
            <Empty>Keine offenen Aufgaben. Das Aufgaben-Board folgt als Nächstes.</Empty>
          )}
        </Section>
      ) : null}

      {view === "team" ? (
        <div className="space-y-4">
          {canManage && portal.requests.length ? (
            <Section
              title={`Anfragen (${portal.requests.length})`}
              action={{ href: "/mitglieder/produktionen/zuweisung", label: "Entscheiden" }}
            >
              <ul className="space-y-2">
                {portal.requests.map((member) => (
                  <MemberRow key={member.id} member={member} hint="möchte mitmachen" />
                ))}
              </ul>
            </Section>
          ) : null}
          <Section
            title="Mitglieder"
            action={
              canManage
                ? { href: "/mitglieder/produktionen/zuweisung", label: "Personen zuweisen" }
                : undefined
            }
          >
            {portal.members.length ? (
              <ul className="grid gap-2 sm:grid-cols-2">
                {portal.members.map((member) => (
                  <MemberRow key={member.id} member={member} showMail={canManage} />
                ))}
              </ul>
            ) : (
              <Empty>Noch niemand zugewiesen.</Empty>
            )}
          </Section>
        </div>
      ) : null}
    </div>
  );
}

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: { href: string; label: string };
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3 rounded-xl border border-border bg-card p-4">
      <header className="flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold">{title}</h2>
        {action ? (
          <Link
            href={action.href}
            className="inline-flex min-h-10 items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            {action.label}
            <ChevronRightIcon className="h-4 w-4" aria-hidden />
          </Link>
        ) : null}
      </header>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-6 text-center text-sm text-muted-foreground">{children}</p>;
}

function TaskList({
  tasks,
  mine,
}: {
  tasks: { id: string; title: string; status: TaskStatus; dueAt: Date | null; overdue: boolean }[];
  mine?: Set<string>;
}) {
  return (
    <ul className="divide-y divide-border/60">
      {tasks.map((task) => {
        return (
          <li key={task.id} className="flex min-h-12 items-center gap-3 py-2">
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{task.title}</span>
              <span
                className={cn(
                  "text-xs",
                  task.overdue ? "text-destructive" : "text-muted-foreground",
                )}
              >
                {task.dueAt ? `fällig ${formatDue(task.dueAt)}` : "ohne Frist"}
                {mine?.has(task.id) ? " · dir zugewiesen" : ""}
              </span>
            </span>
            <Badge variant={task.status === "doing" ? "info" : "muted"}>
              {STATUS_LABELS[task.status]}
            </Badge>
          </li>
        );
      })}
    </ul>
  );
}

function MemberRow({
  member,
  hint,
  showMail,
}: {
  member: {
    id: string;
    name: string;
    initials: string;
    email: string | null;
    role: keyof typeof TEAM_ROLE_LABELS;
    title: string | null;
  };
  hint?: string;
  showMail?: boolean;
}) {
  return (
    <li className="flex min-h-12 items-center gap-3 rounded-lg bg-muted/40 px-3 py-2">
      <Initials initials={member.initials} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{member.name}</span>
        <span className="block truncate text-xs text-muted-foreground">
          {hint ?? member.title ?? TEAM_ROLE_LABELS[member.role]}
        </span>
      </span>
      {showMail && member.email ? (
        <a
          href={`mailto:${member.email}`}
          className="shrink-0 text-xs text-primary hover:underline"
          aria-label={`E-Mail an ${member.name}`}
        >
          E-Mail
        </a>
      ) : null}
    </li>
  );
}
