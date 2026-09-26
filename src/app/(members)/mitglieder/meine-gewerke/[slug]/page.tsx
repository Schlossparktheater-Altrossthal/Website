import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/members/page-header";
import {
  AlertTriangleIcon,
  CalendarIcon,
  ChevronRightIcon,
  ListTodoIcon,
} from "@/components/ui/action-icons";
import { resolveTeamsViewer } from "@/lib/departments/access";
import { loadBoard } from "@/lib/departments/board";
import { loadDepartmentPortal } from "@/lib/departments/portal";
import { cn } from "@/lib/utils";

import { DepartmentBoard } from "../board/board";
import {
  formatDue,
  formatEventDate,
  Initials,
  TEAM_ROLE_LABELS,
  tint,
  ViewSwitcher,
} from "../team-ui";

type View = "uebersicht" | "aufgaben" | "team";

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

  // Eigene offene Aufgaben und Termine in einer Zeitleiste: Überfälliges zuerst, ohne Frist ans Ende.
  const timeline = [
    ...portal.myTasks.map((task) => ({
      key: `task-${task.id}`,
      kind: "task" as const,
      title: task.title,
      at: task.dueAt,
      overdue: task.overdue,
      when: task.overdue ? "überfällig" : task.dueAt ? formatDue(task.dueAt) : "ohne Frist",
      detail: task.status === "doing" ? "In Arbeit" : null,
    })),
    ...portal.events.slice(0, 5).map((event) => ({
      key: `event-${event.id}`,
      kind: "event" as const,
      title: event.title,
      at: event.start,
      overdue: false,
      when: formatEventDate(event.start),
      detail: event.location,
    })),
  ].sort(
    (a, b) =>
      Number(b.overdue) - Number(a.overdue) ||
      (a.at?.getTime() ?? Number.MAX_SAFE_INTEGER) - (b.at?.getTime() ?? Number.MAX_SAFE_INTEGER),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={portal.name}
        breadcrumbs={[{ id: "teams", label: "Meine Teams", href: "/mitglieder/meine-gewerke" }]}
      />

      <section
        className="overflow-hidden rounded-2xl border border-border bg-card"
        style={{
          backgroundImage: `linear-gradient(135deg, ${tint(portal.color, 32)}, transparent 75%)`,
        }}
        aria-label={portal.name}
      >
        <div className="flex items-start gap-3 p-4">
          <span
            aria-hidden
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-lg font-bold"
            style={{ backgroundColor: tint(portal.color, 50) }}
          >
            {portal.name.slice(0, 1)}
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-semibold leading-tight">{portal.name}</h2>
            <p className="truncate text-sm text-muted-foreground">
              {leads.length
                ? `Leitung: ${leads.map((member) => member.name).join(", ")}`
                : "Leitung noch offen"}
            </p>
            {portal.description ? (
              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                {portal.description}
              </p>
            ) : null}
          </div>
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-border/60 px-4 py-2.5">
          <Link href={`${basePath}?ansicht=team`} className="flex min-h-9 items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {portal.members.length} {portal.members.length === 1 ? "Person" : "Personen"} · Du:{" "}
              {portal.viewerRole ? TEAM_ROLE_LABELS[portal.viewerRole] : "Einblick als Regie"}
            </span>
          </Link>
          {canManage && portal.requests.length ? (
            <Link
              href={`${basePath}?ansicht=team`}
              className="rounded-full bg-warning px-2.5 py-1 text-xs font-semibold text-warning-foreground"
            >
              {portal.requests.length} {portal.requests.length === 1 ? "Anfrage" : "Anfragen"}
            </Link>
          ) : null}
        </div>
      </section>

      <ViewSwitcher<View>
        basePath={basePath}
        current={view}
        options={[
          { value: "uebersicht", label: "Als Nächstes" },
          { value: "aufgaben", label: `Aufgaben (${portal.openTasks.length})` },
          { value: "team", label: `Team (${portal.members.length})` },
        ]}
      />

      {view === "uebersicht" ? (
        <section className="space-y-2" aria-labelledby="next-heading">
          <div className="flex items-center justify-between">
            <h2 id="next-heading" className="text-sm font-semibold">
              Als Nächstes
            </h2>
            <span className="text-xs text-muted-foreground">
              {portal.taskCounts.todo + portal.taskCounts.doing} offen · {portal.taskCounts.done}{" "}
              erledigt
            </span>
          </div>
          {timeline.length ? (
            <ol className="relative space-y-2 before:absolute before:bottom-3 before:left-[1.1rem] before:top-3 before:w-px before:bg-border">
              {timeline.map((item) => (
                <li key={item.key} className="relative flex items-center gap-3">
                  <span
                    aria-hidden
                    className={cn(
                      "relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ring-4 ring-background",
                      item.kind === "event"
                        ? "bg-info/15 text-info"
                        : item.overdue
                          ? "bg-destructive/15 text-destructive"
                          : "bg-muted text-muted-foreground",
                    )}
                  >
                    {item.kind === "event" ? (
                      <CalendarIcon className="h-4 w-4" />
                    ) : item.overdue ? (
                      <AlertTriangleIcon className="h-4 w-4" />
                    ) : (
                      <ListTodoIcon className="h-4 w-4" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1 rounded-xl border border-border bg-card px-3 py-2">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-sm font-medium">{item.title}</span>
                      <span
                        className={cn(
                          "shrink-0 text-xs",
                          item.overdue ? "font-medium text-destructive" : "text-muted-foreground",
                        )}
                      >
                        {item.when}
                      </span>
                    </span>
                    {item.detail ? (
                      <span className="block truncate text-xs text-muted-foreground">
                        {item.detail}
                      </span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <Empty>Gerade steht nichts an – keine Aufgaben für dich und keine Termine.</Empty>
          )}
        </section>
      ) : null}

      {view === "aufgaben" ? (
        <DepartmentBoard
          data={await loadBoard(portal.id)}
          viewerId={userId}
          canEdit={isManager || (portal.viewerRole !== null && portal.viewerRole !== "guest")}
          canManage={isManager || portal.viewerRole === "lead" || portal.viewerRole === "deputy"}
        />
      ) : null}

      {view === "team" ? (
        <div className="space-y-4">
          {canManage && portal.requests.length ? (
            <Section
              title={`Anfragen (${portal.requests.length})`}
              action={{ href: "/mitglieder/produktionen/zuweisung", label: "Entscheiden" }}
            >
              <ul className="divide-y divide-border/60">
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
              <ul className="divide-y divide-border/60 sm:grid sm:grid-cols-2 sm:gap-x-6 sm:divide-y-0">
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
    <section className="space-y-1 rounded-xl border border-border bg-card px-3 py-2.5 sm:px-4 sm:py-3">
      <header className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">{title}</h2>
        {action ? (
          <Link
            href={action.href}
            className="-mr-1 inline-flex min-h-10 items-center gap-0.5 px-1 text-sm font-medium text-primary hover:underline"
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
  return <p className="py-3 text-center text-sm text-muted-foreground">{children}</p>;
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
    <li className="flex min-h-11 items-center gap-3 py-1.5">
      <Initials initials={member.initials} className="h-8 w-8" />
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
