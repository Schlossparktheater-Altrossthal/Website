import Link from "next/link";
import { notFound } from "next/navigation";
import { addDays, format, formatDistance, startOfToday } from "date-fns";
import { de } from "date-fns/locale/de";
import { DepartmentMembershipRole, TaskStatus } from "@prisma/client";
import type { ComponentProps } from "react";

import { PageHeader } from "@/components/members/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";
import { hasPermission } from "@/lib/permissions";

const ROLE_LABELS: Record<DepartmentMembershipRole, string> = {
  lead: "Leitung",
  member: "Mitglied",
  deputy: "Vertretung",
  guest: "Gast",
};

const ROLE_BADGE_VARIANTS: Record<DepartmentMembershipRole, ComponentProps<typeof Badge>["variant"]> = {
  lead: "success",
  member: "muted",
  deputy: "info",
  guest: "secondary",
};

const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  todo: "Offen",
  doing: "In Arbeit",
  done: "Erledigt",
};

const TASK_STATUS_BADGES: Record<TaskStatus, ComponentProps<typeof Badge>["variant"]> = {
  todo: "muted",
  doing: "info",
  done: "success",
};

const TASK_STATUS_ORDER: Record<TaskStatus, number> = {
  todo: 0,
  doing: 1,
  done: 2,
};

const PLANNING_FREEZE_DAYS = 7;
const PLANNING_LOOKAHEAD_DAYS = 60;
const DATE_KEY_FORMAT = "yyyy-MM-dd";

function formatUserName(user: { name: string | null; email: string | null }) {
  if (user.name && user.name.trim()) return user.name;
  if (user.email) return user.email;
  return "Unbekannt";
}

function getDueMeta(date: Date, reference: Date) {
  return {
    relative: formatDistance(date, reference, { addSuffix: true, locale: de }),
    absolute: format(date, "EEEE, d. MMMM yyyy", { locale: de }),
    isOverdue: date.getTime() < reference.getTime(),
  };
}

type MeetingSuggestion = { key: string; date: Date; label: string; shortLabel: string };

function findMeetingSuggestions(
  memberIds: string[],
  planningStart: Date,
  planningEnd: Date,
  blockedByUser: Map<string, Set<string>>,
) {
  if (memberIds.length === 0) return [] as MeetingSuggestion[];

  const results: MeetingSuggestion[] = [];
  let current = planningStart;
  while (results.length < 3 && current <= planningEnd) {
    const key = format(current, DATE_KEY_FORMAT);
    const hasConflict = memberIds.some((id) => blockedByUser.get(id)?.has(key));
    if (!hasConflict) {
      results.push({
        key,
        date: new Date(current),
        label: format(current, "EEEE, d. MMMM yyyy", { locale: de }),
        shortLabel: format(current, "dd.MM.yyyy", { locale: de }),
      });
    }
    current = addDays(current, 1);
  }
  return results;
}

function countBlockedDays(memberIds: string[], blockedByUser: Map<string, Set<string>>) {
  const blocked = new Set<string>();
  for (const memberId of memberIds) {
    const entries = blockedByUser.get(memberId);
    if (!entries) continue;
    for (const key of entries) {
      blocked.add(key);
    }
  }
  return blocked.size;
}

export default async function MeineGewerkePage() {
  const session = await requireAuth();
  const allowed = await hasPermission(session.user, "mitglieder.meine-gewerke");
  if (!allowed) {
    return <div className="text-sm text-red-600">Kein Zugriff auf die persönliche Gewerkeübersicht.</div>;
  }

  const userId = session.user?.id;
  if (!userId) {
    notFound();
  }

  const today = startOfToday();
  const planningStart = addDays(today, PLANNING_FREEZE_DAYS);
  const planningEnd = addDays(planningStart, PLANNING_LOOKAHEAD_DAYS);

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
              user: { select: { id: true, name: true, email: true } },
            },
          },
          tasks: {
            where: { assigneeId: userId },
            orderBy: { createdAt: "asc" },
          },
        },
      },
    },
  });

  const memberships = membershipsRaw.sort((a, b) =>
    a.department.name.localeCompare(b.department.name, "de", { sensitivity: "base" }),
  );

  const memberIds = new Set<string>();
  for (const membership of memberships) {
    for (const entry of membership.department.memberships) {
      memberIds.add(entry.userId);
    }
  }

  const blockedDays = memberIds.size
    ? await prisma.blockedDay.findMany({
        where: {
          userId: { in: Array.from(memberIds) },
          date: { gte: today, lte: planningEnd },
        },
        orderBy: { date: "asc" },
      })
    : [];

  const blockedByUser = new Map<string, Set<string>>();
  for (const entry of blockedDays) {
    const key = format(entry.date, DATE_KEY_FORMAT);
    const existing = blockedByUser.get(entry.userId);
    if (existing) {
      existing.add(key);
    } else {
      blockedByUser.set(entry.userId, new Set([key]));
    }
  }

  const taskTotals: Record<TaskStatus, number> = { todo: 0, doing: 0, done: 0 };
  for (const membership of memberships) {
    for (const task of membership.department.tasks) {
      taskTotals[task.status] += 1;
    }
  }

  const openTaskCount = taskTotals.todo + taskTotals.doing;
  const freezeUntilLabel = format(planningStart, "d. MMMM yyyy", { locale: de });
  const planningWindowLabel = format(planningEnd, "d. MMMM yyyy", { locale: de });
  const now = new Date();

  const headerActions = (
    <>
      <Button asChild size="sm" variant="outline">
        <Link href="/mitglieder/sperrliste">Sperrliste</Link>
      </Button>
      <Button asChild size="sm">
        <Link href="/mitglieder/produktionen/gewerke">Gewerke &amp; Teams</Link>
      </Button>
    </>
  );

  if (memberships.length === 0) {
    return (
      <div className="space-y-8">
        <PageHeader
          title="Meine Gewerke"
          description="Sobald du einem Gewerk zugeordnet bist, findest du hier Aufgaben, Ansprechpartner:innen und Terminvorschläge."
          actions={headerActions}
        />

        <Card className="border border-dashed border-border/60 bg-background/60">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Noch keine Gewerke</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>Aktuell bist du keinem Gewerk zugeordnet. Sprich das Produktionsteam an, wenn du Verantwortung übernehmen möchtest.</p>
            <p>
              Du kannst jederzeit deine <Link href="/mitglieder/sperrliste" className="text-primary underline-offset-2 hover:underline">Sperrliste</Link> aktualisieren oder in der
              <Link href="/mitglieder/produktionen/gewerke" className="ml-1 text-primary underline-offset-2 hover:underline">Gewerkübersicht</Link> stöbern.
            </p>
            <p>
              Terminvorschläge berücksichtigen Sperrlisten nach dem Freeze bis {freezeUntilLabel} sowie den Planungshorizont bis {planningWindowLabel}.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const summaryStats = [
    { label: "Gewerke", value: memberships.length, hint: "Aktive Zuordnungen" },
    { label: "Aktive Aufgaben", value: openTaskCount, hint: "Status offen & in Arbeit" },
    { label: "Abgeschlossen", value: taskTotals.done, hint: "Eigene erledigte Aufgaben" },
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        title="Meine Gewerke"
        description="Behalte deine Zuständigkeiten im Blick, sieh offene Aufgaben und finde passende Terminfelder für dein Team."
        actions={headerActions}
      />

      <Card className="border border-border/60 bg-background/60">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Überblick</CardTitle>
          <p className="text-sm text-muted-foreground">
            Terminvorschläge berücksichtigen Sperrlisten ab dem Freeze am {freezeUntilLabel} bis zum Planungshorizont am {planningWindowLabel}.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            {summaryStats.map((stat) => (
              <div key={stat.label} className="rounded-lg border border-border/60 bg-background/80 p-3 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/80">{stat.label}</p>
                <p className="mt-1 text-2xl font-semibold text-foreground">{stat.value}</p>
                {stat.hint ? <p className="text-xs text-muted-foreground">{stat.hint}</p> : null}
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
            <span>
              Planungsfenster: {freezeUntilLabel} – {planningWindowLabel}
            </span>
            <Link href="/mitglieder/sperrliste" className="font-medium text-primary hover:text-primary/80">
              Sperrliste aktualisieren
            </Link>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-6">
        {memberships.map((membership) => {
          const { department } = membership;
          const sortedMembers = [...department.memberships].sort((a, b) =>
            formatUserName(a.user).localeCompare(formatUserName(b.user), "de", { sensitivity: "base" }),
          );
          const sortedTasks = [...department.tasks].sort((a, b) => {
            const statusDiff = TASK_STATUS_ORDER[a.status] - TASK_STATUS_ORDER[b.status];
            if (statusDiff !== 0) return statusDiff;
            const dueA = a.dueAt ? a.dueAt.getTime() : Number.MAX_SAFE_INTEGER;
            const dueB = b.dueAt ? b.dueAt.getTime() : Number.MAX_SAFE_INTEGER;
            if (dueA !== dueB) return dueA - dueB;
            return a.createdAt.getTime() - b.createdAt.getTime();
          });
          const activeTasks = sortedTasks.filter((task) => task.status !== "done");
          const completedTasks = sortedTasks.filter((task) => task.status === "done");
          const memberIdsForDepartment = department.memberships.map((entry) => entry.userId);
          const meetingSuggestions = findMeetingSuggestions(
            memberIdsForDepartment,
            planningStart,
            planningEnd,
            blockedByUser,
          );
          const blockedDatesCount = countBlockedDays(memberIdsForDepartment, blockedByUser);

          return (
            <Card key={membership.id} className="space-y-6 border border-border/60 bg-background/70">
              <CardHeader className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <span
                      className="mt-1 inline-block h-3 w-3 rounded-full border border-border/80"
                      style={{ backgroundColor: department.color ?? "#94a3b8" }}
                    />
                    <div className="space-y-1">
                      <CardTitle className="text-lg font-semibold">{department.name}</CardTitle>
                      {department.description ? (
                        <p className="text-sm text-muted-foreground">{department.description}</p>
                      ) : null}
                    </div>
                  </div>
                  <Button asChild size="sm" variant="outline">
                    <Link href="/mitglieder/produktionen/gewerke">Team öffnen</Link>
                  </Button>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant={ROLE_BADGE_VARIANTS[membership.role]} size="sm">
                    {ROLE_LABELS[membership.role]}
                  </Badge>
                  {membership.title ? (
                    <Badge variant="outline" size="sm">
                      {membership.title}
                    </Badge>
                  ) : null}
                  {membership.note ? <span>Notiz: {membership.note}</span> : null}
                </div>
              </CardHeader>

              <CardContent className="space-y-6">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold">Teamübersicht</h3>
                    <Badge variant="muted" size="sm">
                      {sortedMembers.length} Personen
                    </Badge>
                  </div>
                  <ul className="space-y-2">
                    {sortedMembers.map((member) => {
                      const isCurrentUser = member.userId === userId;
                      return (
                        <li
                          key={member.id}
                          className="flex items-center justify-between gap-3 rounded-md border border-border/60 bg-background/80 p-3 text-sm shadow-sm"
                        >
                          <div>
                            <p className="font-medium">{formatUserName(member.user)}</p>
                            {member.title ? (
                              <p className="text-xs text-muted-foreground">{member.title}</p>
                            ) : null}
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={ROLE_BADGE_VARIANTS[member.role]} size="sm">
                              {ROLE_LABELS[member.role]}
                            </Badge>
                            {isCurrentUser ? (
                              <Badge variant="outline" size="sm">
                                Du
                              </Badge>
                            ) : null}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>

                <div className="space-y-3 rounded-lg border border-border/60 bg-background/80 p-4 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold">Terminvorschläge</h3>
                    <Badge variant="muted" size="sm">
                      {blockedDatesCount} blockierte Tage
                    </Badge>
                  </div>
                  {meetingSuggestions.length ? (
                    <ul className="grid gap-3 sm:grid-cols-2">
                      {meetingSuggestions.map((suggestion) => (
                        <li
                          key={suggestion.key}
                          className="rounded-md border border-border/60 bg-background p-3 text-sm shadow-sm"
                        >
                          <p className="font-medium">{suggestion.label}</p>
                          <p className="text-xs text-muted-foreground">Frei für alle Mitglieder</p>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Aktuell gibt es keinen Termin ohne Sperrlisten-Konflikte. Prüfe deine Sperrtage und die deines Teams.
                    </p>
                  )}
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span>
                      Fenster: {freezeUntilLabel} – {planningWindowLabel}
                    </span>
                    <Link href="/mitglieder/sperrliste" className="font-medium text-primary hover:text-primary/80">
                      Sperrliste öffnen
                    </Link>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold">Meine Aufgaben</h3>
                    <Badge variant="muted" size="sm">
                      {sortedTasks.length} Aufgaben
                    </Badge>
                  </div>
                  {activeTasks.length ? (
                    <ul className="space-y-3">
                      {activeTasks.map((task) => {
                        const dueMeta = task.dueAt ? getDueMeta(task.dueAt, now) : null;
                        return (
                          <li
                            key={task.id}
                            className="rounded-lg border border-border/60 bg-background/80 p-3 text-sm shadow-sm"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="space-y-2">
                                <p className="font-medium text-foreground">{task.title}</p>
                                {task.description ? (
                                  <p className="text-xs text-muted-foreground">{task.description}</p>
                                ) : null}
                                {dueMeta ? (
                                  <p
                                    className={cn(
                                      "text-xs",
                                      dueMeta.isOverdue ? "text-destructive" : "text-muted-foreground",
                                    )}
                                  >
                                    Fällig {dueMeta.relative} ({dueMeta.absolute})
                                  </p>
                                ) : null}
                              </div>
                              <Badge variant={TASK_STATUS_BADGES[task.status]} size="sm">
                                {TASK_STATUS_LABELS[task.status]}
                              </Badge>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Keine offenen Aufgaben in diesem Gewerk – du bist auf dem aktuellen Stand.
                    </p>
                  )}

                  {completedTasks.length ? (
                    <details className="group rounded-lg border border-border/50 bg-background/70 p-3 shadow-sm">
                      <summary className="flex cursor-pointer items-center justify-between text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        <span>Abgeschlossene Aufgaben</span>
                        <span className="text-[11px] text-muted-foreground group-open:hidden">Öffnen</span>
                        <span className="hidden text-[11px] text-muted-foreground group-open:inline">Schließen</span>
                      </summary>
                      <ul className="mt-3 space-y-2 text-sm">
                        {completedTasks.map((task) => {
                          const dueMeta = task.dueAt ? getDueMeta(task.dueAt, now) : null;
                          return (
                            <li
                              key={task.id}
                              className="rounded-md border border-border/60 bg-background/80 p-3"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="space-y-1">
                                  <p className="font-medium text-foreground">{task.title}</p>
                                  {dueMeta ? (
                                    <p className="text-xs text-muted-foreground">Fällig war {dueMeta.absolute}</p>
                                  ) : null}
                                </div>
                                <Badge variant={TASK_STATUS_BADGES[task.status]} size="sm">
                                  {TASK_STATUS_LABELS[task.status]}
                                </Badge>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </details>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
