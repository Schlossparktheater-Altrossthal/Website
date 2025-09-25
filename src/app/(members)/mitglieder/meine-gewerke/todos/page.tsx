import Link from "next/link";
import { notFound } from "next/navigation";
import { ClipboardCheck, ListTodo, Sparkles, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";
import { hasPermission } from "@/lib/permissions";
import { cn } from "@/lib/utils";

import {
  ROLE_BADGE_VARIANTS,
  ROLE_LABELS,
  TASK_STATUS_BADGES,
  TASK_STATUS_LABELS,
  TASK_STATUS_ORDER,
  type DepartmentMembershipWithDepartment,
  formatUserName,
  getDueMeta,
} from "../utils";

const TEAM_OVERVIEW_LINK = "/mitglieder/meine-gewerke";

type AssignmentEntry = {
  task: DepartmentMembershipWithDepartment["department"]["tasks"][number];
  department: DepartmentMembershipWithDepartment["department"];
};

type SummaryStat = { label: string; value: number; hint?: string; icon: LucideIcon };

export default async function DepartmentTodosPage() {
  const session = await requireAuth();
  const allowed = await hasPermission(session.user, "mitglieder.meine-gewerke");
  if (!allowed) {
    return <div className="text-sm text-red-600">Kein Zugriff auf die Gewerke-Aufgabenübersicht.</div>;
  }

  const userId = session.user?.id;
  if (!userId) {
    notFound();
  }

  const canManageDepartments = await hasPermission(session.user, "mitglieder.produktionen");

  const membershipsRaw = await prisma.departmentMembership.findMany({
    where: { userId },
    include: {
      department: {
        select: {
          id: true,
          name: true,
          description: true,
          color: true,
          slug: true,
          memberships: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  firstName: true,
                  lastName: true,
                  role: true,
                  roles: { select: { role: true } },
                },
              },
            },
          },
          tasks: {
            include: {
              assignee: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  firstName: true,
                  lastName: true,
                },
              },
            },
            orderBy: [
              { status: "asc" },
              { dueAt: "asc" },
              { createdAt: "asc" },
            ],
          },
          events: {
            include: {
              createdBy: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  firstName: true,
                  lastName: true,
                },
              },
            },
            orderBy: { start: "asc" },
          },
        },
      },
    },
  });

  const memberships = membershipsRaw
    .filter((entry) => entry.department)
    .map((entry) => entry as DepartmentMembershipWithDepartment)
    .sort((a, b) => a.department.name.localeCompare(b.department.name, "de", { sensitivity: "base" }));

  const now = new Date();
  const totalStatusCounts = { todo: 0, doing: 0, done: 0 };
  const myOpenAssignments: AssignmentEntry[] = [];
  const myCompletedAssignments: AssignmentEntry[] = [];

  for (const membership of memberships) {
    for (const task of membership.department.tasks) {
      totalStatusCounts[task.status] += 1;
      if (task.assigneeId === userId) {
        if (task.status === "done") {
          myCompletedAssignments.push({ task, department: membership.department });
        } else {
          myOpenAssignments.push({ task, department: membership.department });
        }
      }
    }
  }

  myOpenAssignments.sort((a, b) => {
    const statusDiff = TASK_STATUS_ORDER[a.task.status] - TASK_STATUS_ORDER[b.task.status];
    if (statusDiff !== 0) return statusDiff;
    const dueA = a.task.dueAt ? a.task.dueAt.getTime() : Number.MAX_SAFE_INTEGER;
    const dueB = b.task.dueAt ? b.task.dueAt.getTime() : Number.MAX_SAFE_INTEGER;
    if (dueA !== dueB) return dueA - dueB;
    return a.task.createdAt.getTime() - b.task.createdAt.getTime();
  });

  myCompletedAssignments.sort((a, b) => b.task.updatedAt.getTime() - a.task.updatedAt.getTime());

  const openTaskCount = totalStatusCounts.todo + totalStatusCounts.doing;
  const myOpenTaskCount = myOpenAssignments.length;

  const summaryStats: SummaryStat[] = [
    { label: "Teams", value: memberships.length, hint: "Aktive Gewerke", icon: Users },
    { label: "Offene Todos", value: openTaskCount, hint: "Aufgaben in deinen Gewerken", icon: ListTodo },
    { label: "Eigene Todos", value: myOpenTaskCount, hint: "Dir zugewiesen", icon: ClipboardCheck },
  ];

  const heroDescription = memberships.length
    ? "Alle Aufgaben, Zuständigkeiten und Leitungen deiner Gewerke gebündelt an einem Ort."
    : "Sobald du einem Gewerk beitrittst, erscheinen hier deine Todos und Ansprechpartner.";

  const headerActions = (
    <>
      <Button
        asChild
        size="sm"
        variant="outline"
        className="rounded-full border-border/60 bg-background/80 px-4 backdrop-blur hover:border-primary/40"
      >
        <Link href={TEAM_OVERVIEW_LINK}>Zur Gewerke-Übersicht</Link>
      </Button>
      {canManageDepartments ? (
        <Button
          asChild
          size="sm"
          variant="secondary"
          className="rounded-full bg-gradient-to-br from-primary via-primary/90 to-primary/80 px-4 text-primary-foreground shadow-[0_18px_40px_-28px_rgba(99,102,241,0.9)] hover:from-primary/90 hover:via-primary/80 hover:to-primary"
        >
          <Link href="/mitglieder/produktionen/gewerke">Gewerk-Hub öffnen</Link>
        </Button>
      ) : null}
    </>
  );

  const hero = (
    <section className="relative overflow-hidden rounded-3xl border border-border/60 bg-background/70 p-6 shadow-[0_28px_90px_-50px_rgba(99,102,241,0.8)] sm:p-10">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 -left-24 h-72 w-72 rounded-full bg-primary/25 blur-3xl" />
        <div className="absolute -bottom-32 right-0 h-64 w-64 rounded-full bg-secondary/20 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.08),transparent_55%)]" />
      </div>
      <div className="relative flex flex-col gap-8">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-4">
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-primary">
              <Sparkles aria-hidden className="h-4 w-4" />
              <span className="tracking-[0.2em]">Mission Control</span>
            </span>
            <div className="space-y-3">
              <h1 className="font-serif text-3xl leading-tight text-foreground sm:text-4xl">Gewerk-Todos</h1>
              <p className="max-w-2xl text-sm text-muted-foreground sm:text-base">{heroDescription}</p>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-3">{headerActions}</div>
        </div>
        {memberships.length ? (
          <dl className="grid gap-4 md:grid-cols-3">
            {summaryStats.map((stat) => {
              const Icon = stat.icon;
              return (
                <div
                  key={stat.label}
                  className="group relative overflow-hidden rounded-2xl border border-border/50 bg-background/80 p-4 shadow-inner transition hover:border-primary/40"
                >
                  <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(99,102,241,0.18),transparent_70%)] opacity-0 transition duration-300 group-hover:opacity-100" />
                  <div className="relative flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Icon aria-hidden className="h-5 w-5" />
                    </span>
                    <div className="space-y-1">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/80">{stat.label}</p>
                      <p className="text-2xl font-semibold text-foreground">{stat.value}</p>
                      {stat.hint ? <p className="text-xs text-muted-foreground/80">{stat.hint}</p> : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </dl>
        ) : null}
      </div>
    </section>
  );

  if (memberships.length === 0) {
    return (
      <div className="space-y-10">
        {hero}
        <section className="rounded-3xl border border-dashed border-primary/30 bg-background/70 p-6 shadow-inner sm:p-10">
          <div className="space-y-4 text-sm text-muted-foreground sm:text-base">
            <h2 className="text-lg font-semibold text-foreground sm:text-xl">Noch keine Gewerke-Aufgaben</h2>
            <p>
              Tritt einem Gewerk bei, um hier Aufgaben, Zuständigkeiten und Ansprechpartner zu sehen.
            </p>
            <div>
              <Button asChild>
                <Link href={TEAM_OVERVIEW_LINK}>Zu &bdquo;Meine Gewerke&ldquo;</Link>
              </Button>
            </div>
          </div>
        </section>
      </div>
    );
  }

  const departmentLinkFor = (department: DepartmentMembershipWithDepartment["department"]) => {
    if (canManageDepartments) {
      return {
        href: `/mitglieder/produktionen/gewerke/${department.id}`,
        label: "Gewerk-Hub öffnen",
      } as const;
    }

    if (department.slug) {
      return {
        href: `/mitglieder/meine-gewerke/${encodeURIComponent(department.slug)}`,
        label: "Team ansehen",
      } as const;
    }

    return { href: undefined, label: "Team ansehen" } as const;
  };

  const aggregatedAssignments = (
    <section className="rounded-3xl border border-border/60 bg-background/70 p-6 shadow-inner sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-foreground sm:text-xl">Meine offenen Todos</h2>
          <p className="text-sm text-muted-foreground">
            Alle dir zugewiesenen Aufgaben über deine Gewerke hinweg, sortiert nach Status und Fälligkeit.
          </p>
        </div>
        <Badge variant="muted" size="sm">
          {myOpenAssignments.length} {myOpenAssignments.length === 1 ? "Aufgabe" : "Aufgaben"}
        </Badge>
      </div>
      {myOpenAssignments.length ? (
        <ul className="mt-6 space-y-3">
          {myOpenAssignments.map((entry) => {
            const dueMeta = entry.task.dueAt ? getDueMeta(entry.task.dueAt, now) : null;
            const link = departmentLinkFor(entry.department);
            return (
              <li
                key={entry.task.id}
                className="group rounded-2xl border border-border/60 bg-background/80 p-4 transition hover:border-primary/50"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-background/80 px-2.5 py-0.5">
                        {entry.department.name}
                      </span>
                      <Badge variant={TASK_STATUS_BADGES[entry.task.status]} size="sm" className="rounded-full">
                        {TASK_STATUS_LABELS[entry.task.status]}
                      </Badge>
                      {dueMeta ? (
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full border border-border/60 px-2.5 py-0.5",
                            dueMeta.isOverdue ? "border-destructive/60 text-destructive" : "text-muted-foreground",
                          )}
                        >
                          {dueMeta.relative}
                        </span>
                      ) : null}
                    </div>
                    <p className="text-sm font-medium leading-6 text-foreground">{entry.task.title}</p>
                    {entry.task.description ? (
                      <p className="text-sm text-muted-foreground">{entry.task.description}</p>
                    ) : null}
                    {dueMeta ? (
                      <p
                        className={cn(
                          "text-xs",
                          dueMeta.isOverdue ? "text-destructive" : "text-muted-foreground",
                        )}
                      >
                        Fällig am {dueMeta.absolute} ({dueMeta.relative})
                      </p>
                    ) : null}
                  </div>
                  {link.href ? (
                    <Button asChild size="sm" variant="ghost" className="h-8 self-start rounded-full px-3 text-xs font-semibold">
                      <Link href={link.href}>{link.label}</Link>
                    </Button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-6 text-sm text-muted-foreground">
          Aktuell sind dir keine offenen Aufgaben zugewiesen. Sobald dir Todos zugeordnet werden, erscheinen sie hier automatisch.
        </p>
      )}
      {myCompletedAssignments.length ? (
        <details className="group mt-6 rounded-2xl border border-border/60 bg-background/70 p-4 shadow-inner">
          <summary className="flex cursor-pointer items-center justify-between text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">
            <span>Abgeschlossene Todos</span>
            <span className="text-[11px] text-muted-foreground group-open:hidden">Öffnen</span>
            <span className="hidden text-[11px] text-muted-foreground group-open:inline">Schließen</span>
          </summary>
          <ul className="mt-4 space-y-3 text-sm">
            {myCompletedAssignments.slice(0, 12).map((entry) => {
              const link = departmentLinkFor(entry.department);
              return (
                <li key={entry.task.id} className="rounded-xl border border-border/50 bg-background/80 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-medium text-foreground">{entry.task.title}</p>
                      <p className="text-xs text-muted-foreground">{entry.department.name}</p>
                    </div>
                    {link.href ? (
                      <Link
                        href={link.href}
                        className="text-xs font-semibold text-primary transition hover:text-primary/80"
                      >
                        {link.label}
                      </Link>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </details>
      ) : null}
    </section>
  );

  return (
    <div className="space-y-10">
      {hero}
      {aggregatedAssignments}
      <div className="space-y-8">
        {memberships.map((membership) => {
          const link = departmentLinkFor(membership.department);
          const leadership = membership.department.memberships.filter((entry) =>
            entry.role === "lead" || entry.role === "deputy",
          );
          const myTasks = membership.department.tasks.filter((task) => task.assigneeId === userId);
          const myOpenTasks = myTasks.filter((task) => task.status !== "done");
          const myDoneTasks = myTasks.filter((task) => task.status === "done");
          const openCount = membership.department.tasks.filter((task) => task.status !== "done").length;

          return (
            <article
              key={membership.id}
              className="space-y-6 rounded-3xl border border-border/60 bg-background/80 p-6 shadow-[0_30px_120px_-60px_rgba(99,102,241,0.55)]"
            >
              <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex items-start gap-4">
                  <span
                    className="mt-1 inline-block h-3 w-3 rounded-full border border-border/80"
                    style={{ backgroundColor: membership.department.color ?? "#94a3b8" }}
                    aria-hidden
                  />
                  <div className="space-y-2">
                    <h2 className="text-lg font-semibold text-foreground sm:text-xl">{membership.department.name}</h2>
                    {membership.department.description ? (
                      <p className="text-sm text-muted-foreground">{membership.department.description}</p>
                    ) : null}
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant={ROLE_BADGE_VARIANTS[membership.role]} size="sm">
                        {ROLE_LABELS[membership.role]}
                      </Badge>
                      {membership.title ? (
                        <Badge variant="outline" size="sm" className="border-border/60">
                          {membership.title}
                        </Badge>
                      ) : null}
                      {membership.note ? (
                        <span className="rounded-full border border-border/50 bg-background/80 px-3 py-0.5 text-[11px]">
                          Notiz: {membership.note}
                        </span>
                      ) : null}
                      <Badge variant="muted" size="sm">
                        {openCount} offene Aufgaben
                      </Badge>
                    </div>
                  </div>
                </div>
                {link.href ? (
                  <Button asChild size="sm" variant="outline" className="rounded-full border-border/60 bg-background/80 px-4">
                    <Link href={link.href}>{link.label}</Link>
                  </Button>
                ) : null}
              </header>

              <div className="grid gap-6 lg:grid-cols-2">
                <section className="rounded-2xl border border-border/60 bg-background/70 p-4 shadow-inner">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-foreground">Leitung &amp; Ansprechpartner</h3>
                    <Badge variant="muted" size="sm">
                      {leadership.length} {leadership.length === 1 ? "Person" : "Personen"}
                    </Badge>
                  </div>
                  {leadership.length ? (
                    <ul className="mt-4 space-y-3">
                      {leadership.map((entry) => (
                        <li
                          key={entry.id}
                          className="rounded-xl border border-border/60 bg-background/80 px-3 py-3"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <p className="text-sm font-medium text-foreground">{formatUserName(entry.user)}</p>
                              {entry.title ? (
                                <p className="text-xs text-muted-foreground">{entry.title}</p>
                              ) : null}
                            </div>
                            <Badge variant={ROLE_BADGE_VARIANTS[entry.role]} size="sm">
                              {ROLE_LABELS[entry.role]}
                            </Badge>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-4 text-sm text-muted-foreground">
                      Für dieses Gewerk ist aktuell keine Leitung hinterlegt.
                    </p>
                  )}
                </section>

                <section className="rounded-2xl border border-border/60 bg-background/70 p-4 shadow-inner">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-foreground">Meine Todos in diesem Gewerk</h3>
                    <Badge variant="muted" size="sm">
                      {myOpenTasks.length} offen
                    </Badge>
                  </div>
                  {myOpenTasks.length ? (
                    <ul className="mt-4 space-y-3">
                      {myOpenTasks.map((task) => {
                        const dueMeta = task.dueAt ? getDueMeta(task.dueAt, now) : null;
                        return (
                          <li
                            key={task.id}
                            className="rounded-2xl border border-border/60 bg-background/80 p-4"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="space-y-2">
                                <Badge variant={TASK_STATUS_BADGES[task.status]} size="sm" className="rounded-full">
                                  {TASK_STATUS_LABELS[task.status]}
                                </Badge>
                                <p className="text-sm font-medium leading-6 text-foreground">{task.title}</p>
                                {task.description ? (
                                  <p className="text-sm text-muted-foreground">{task.description}</p>
                                ) : null}
                                {dueMeta ? (
                                  <p
                                    className={cn(
                                      "text-xs",
                                      dueMeta.isOverdue ? "text-destructive" : "text-muted-foreground",
                                    )}
                                  >
                                    Fällig am {dueMeta.absolute} ({dueMeta.relative})
                                  </p>
                                ) : null}
                              </div>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="mt-4 text-sm text-muted-foreground">
                      Keine offenen Todos für dich in diesem Gewerk.
                    </p>
                  )}

                  {myDoneTasks.length ? (
                    <details className="group mt-4 rounded-2xl border border-border/60 bg-background/60 p-4 shadow-inner">
                      <summary className="flex cursor-pointer items-center justify-between text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">
                        <span>Abgeschlossen</span>
                        <span className="text-[11px] text-muted-foreground group-open:hidden">Öffnen</span>
                        <span className="hidden text-[11px] text-muted-foreground group-open:inline">Schließen</span>
                      </summary>
                      <ul className="mt-3 space-y-2 text-sm">
                        {myDoneTasks.map((task) => (
                          <li key={task.id} className="rounded-xl border border-border/50 bg-background/80 p-3">
                            <p className="font-medium text-foreground">{task.title}</p>
                            <p className="text-xs text-muted-foreground">{TASK_STATUS_LABELS[task.status]}</p>
                          </li>
                        ))}
                      </ul>
                    </details>
                  ) : null}
                </section>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
