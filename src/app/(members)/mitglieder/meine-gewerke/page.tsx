import Link from "next/link";
import { notFound } from "next/navigation";
import { addDays, format, formatDistance, startOfToday } from "date-fns";
import { de } from "date-fns/locale/de";
import { DepartmentMembershipRole, TaskStatus } from "@prisma/client";
import type { ComponentProps, CSSProperties } from "react";
import type { LucideIcon } from "lucide-react";
import { CalendarDays, CheckCircle2, Clock, ListTodo, Sparkles, Users } from "lucide-react";

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

function hexToRgba(hex: string | null | undefined, alpha: number) {
  if (!hex) {
    return `rgba(99, 102, 241, ${alpha})`;
  }
  let normalized = hex.replace("#", "");
  if (normalized.length === 3) {
    normalized = normalized
      .split("")
      .map((char) => char + char)
      .join("");
  }
  if (normalized.length !== 6) {
    return hex;
  }
  const num = Number.parseInt(normalized, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

type MeetingSuggestion = { key: string; date: Date; label: string; shortLabel: string };

type SummaryStat = { label: string; value: number; hint?: string; icon: LucideIcon };

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

  const summaryStats: SummaryStat[] = [
    { label: "Gewerke", value: memberships.length, hint: "Aktive Zuordnungen", icon: Users },
    { label: "Aktive Aufgaben", value: openTaskCount, hint: "Status offen & in Arbeit", icon: ListTodo },
    { label: "Abgeschlossen", value: taskTotals.done, hint: "Eigene erledigte Aufgaben", icon: CheckCircle2 },
  ];

  const headerActions = (
    <>
      <Button
        asChild
        size="sm"
        variant="outline"
        className="gap-2 rounded-full border-border/70 bg-background/80 px-4 backdrop-blur transition hover:border-primary/50 hover:bg-primary/10"
      >
        <Link href="/mitglieder/sperrliste" title="Sperrliste öffnen">
          <CalendarDays aria-hidden className="h-4 w-4" />
          <span>Sperrliste</span>
        </Link>
      </Button>
      <Button
        asChild
        size="sm"
        variant="secondary"
        className="gap-2 rounded-full bg-gradient-to-br from-primary via-primary/90 to-primary/80 px-4 text-primary-foreground shadow-[0_18px_40px_-28px_rgba(99,102,241,0.9)] transition hover:from-primary/90 hover:via-primary/80 hover:to-primary"
      >
        <Link href="/mitglieder/produktionen/gewerke" title="Gewerke &amp; Teams öffnen">
          <Users aria-hidden className="h-4 w-4" />
          <span>Gewerke &amp; Teams</span>
        </Link>
      </Button>
    </>
  );

  const heroDescription = memberships.length
    ? "Behalte deine Zuständigkeiten im Blick, choreografiere Aufgaben und sichere kollisionsfreie Zeitfenster für dein Team."
    : "Sobald du einem Gewerk zugeordnet bist, findest du hier Aufgaben, Ansprechpartner:innen und Terminvorschläge.";

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
              <h1 className="font-serif text-3xl leading-tight text-foreground sm:text-4xl">Meine Gewerke</h1>
              <p className="max-w-2xl text-sm text-muted-foreground sm:text-base">{heroDescription}</p>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-3">{headerActions}</div>
        </div>
        {memberships.length ? (
          <>
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
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground sm:text-sm">
              <span className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/80 px-3 py-1.5">
                <Clock aria-hidden className="h-4 w-4" />
                Planungsfenster: {freezeUntilLabel} – {planningWindowLabel}
              </span>
              <Link
                href="/mitglieder/sperrliste"
                className="inline-flex items-center gap-2 font-semibold text-primary transition hover:text-primary/80"
              >
                <CalendarDays aria-hidden className="h-4 w-4" />
                Sperrliste aktualisieren
              </Link>
            </div>
          </>
        ) : null}
      </div>
    </section>
  );

  if (memberships.length === 0) {
    return (
      <div className="space-y-10">
        {hero}
        <section className="rounded-3xl border border-dashed border-primary/30 bg-background/70 p-6 text-sm text-muted-foreground shadow-inner sm:p-10 sm:text-base">
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-foreground sm:text-xl">Noch keine Gewerke</h2>
            <p>
              Aktuell bist du keinem Gewerk zugeordnet. Sprich das Produktionsteam an, wenn du Verantwortung übernehmen möchtest.
            </p>
            <p>
              Du kannst jederzeit deine{" "}
              <Link href="/mitglieder/sperrliste" className="font-semibold text-primary hover:text-primary/80">
                Sperrliste
              </Link>{" "}
              aktualisieren oder in der{" "}
              <Link href="/mitglieder/produktionen/gewerke" className="font-semibold text-primary hover:text-primary/80">
                Gewerkeübersicht
              </Link>{" "}
              stöbern.
            </p>
            <p>
              Terminvorschläge berücksichtigen Sperrlisten nach dem Freeze bis {freezeUntilLabel} sowie den Planungshorizont bis
              {" "}
              {planningWindowLabel}.
            </p>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {hero}

      <div className="space-y-8">
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
          const accentStyle = {
            "--card-accent": department.color ?? "#6366f1",
            "--card-accent-overlay": hexToRgba(department.color, 0.2),
          } as CSSProperties;

          return (
            <Card
              key={membership.id}
              className="relative overflow-hidden rounded-3xl border border-border/60 bg-background/80 shadow-[0_30px_120px_-60px_rgba(99,102,241,0.65)]"
              style={accentStyle}
            >
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--card-accent-overlay),_transparent_70%)]"
              />
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-10 top-0 h-px"
                style={{
                  background: `linear-gradient(90deg, transparent, ${hexToRgba(department.color, 0.5)}, transparent)`,
                }}
              />

              <CardHeader className="relative z-[1] space-y-6 pb-6">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex items-start gap-4">
                    <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl border border-border/60 bg-background/90 shadow-inner">
                      <span className="h-3.5 w-3.5 rounded-full" style={{ backgroundColor: department.color ?? "#94a3b8" }} />
                    </div>
                    <div className="space-y-2">
                      <CardTitle className="text-xl font-semibold text-foreground">{department.name}</CardTitle>
                      {department.description ? (
                        <p className="text-sm text-muted-foreground">{department.description}</p>
                      ) : null}
                    </div>
                  </div>
                  <Button
                    asChild
                    size="sm"
                    variant="outline"
                    className="rounded-full border-border/60 bg-background/80 px-4 backdrop-blur hover:border-primary/40"
                  >
                    <Link href="/mitglieder/produktionen/gewerke">Team öffnen</Link>
                  </Button>
                </div>
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
                    <span className="rounded-full border border-border/50 bg-background/80 px-3 py-1 text-[11px]">
                      Notiz: {membership.note}
                    </span>
                  ) : null}
                </div>
              </CardHeader>

              <CardContent className="relative z-[1] space-y-6">
                <div className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                  <section className="rounded-2xl border border-border/60 bg-background/80 p-4 shadow-inner">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-sm font-semibold text-foreground">Teamübersicht</h3>
                      <Badge variant="muted" size="sm">
                        {sortedMembers.length} Personen
                      </Badge>
                    </div>
                    <ul className="mt-4 space-y-3">
                      {sortedMembers.map((member) => {
                        const isCurrentUser = member.userId === userId;
                        return (
                          <li
                            key={member.id}
                            className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-background/90 px-3 py-3 transition hover:border-primary/40"
                          >
                            <div className="space-y-1">
                              <p className="text-sm font-medium text-foreground">{formatUserName(member.user)}</p>
                              {member.title ? (
                                <p className="text-xs text-muted-foreground">{member.title}</p>
                              ) : null}
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant={ROLE_BADGE_VARIANTS[member.role]} size="sm">
                                {ROLE_LABELS[member.role]}
                              </Badge>
                              {isCurrentUser ? (
                                <Badge variant="outline" size="sm" className="border-primary/40 text-primary">
                                  Du
                                </Badge>
                              ) : null}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </section>

                  <section className="space-y-4 rounded-2xl border border-border/60 bg-background/80 p-4 shadow-inner">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-sm font-semibold text-foreground">Terminvorschläge</h3>
                      <Badge variant="muted" size="sm">
                        {blockedDatesCount} blockierte Tage
                      </Badge>
                    </div>
                    {meetingSuggestions.length ? (
                      <ul className="grid gap-3 sm:grid-cols-2">
                        {meetingSuggestions.map((suggestion) => (
                          <li
                            key={suggestion.key}
                            className="group flex items-center justify-between gap-4 rounded-xl border border-border/60 bg-background/90 p-3 transition hover:border-primary/50"
                          >
                            <div className="flex items-center gap-3">
                              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                                <CalendarDays aria-hidden className="h-5 w-5" />
                              </span>
                              <div className="space-y-1">
                                <p className="text-sm font-medium text-foreground">{suggestion.label}</p>
                                <p className="text-xs text-muted-foreground">Frei für alle Mitglieder</p>
                              </div>
                            </div>
                            <Badge variant="outline" size="sm" className="rounded-full border-primary/40 text-primary">
                              {suggestion.shortLabel}
                            </Badge>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Aktuell gibt es keinen Termin ohne Sperrlisten-Konflikte. Prüfe deine Sperrtage und die deines Teams.
                      </p>
                    )}
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                      <span>Fenster: {freezeUntilLabel} – {planningWindowLabel}</span>
                      <Link
                        href="/mitglieder/sperrliste"
                        className="inline-flex items-center gap-1 font-semibold text-primary transition hover:text-primary/80"
                      >
                        <CalendarDays aria-hidden className="h-4 w-4" />
                        Sperrliste öffnen
                      </Link>
                    </div>
                  </section>
                </div>

                <section className="rounded-2xl border border-border/60 bg-background/80 p-4 shadow-inner">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-foreground">Meine Aufgaben</h3>
                    <Badge variant="muted" size="sm">
                      {sortedTasks.length} Aufgaben
                    </Badge>
                  </div>
                  {activeTasks.length ? (
                    <ul className="mt-4 grid gap-3 md:grid-cols-2">
                      {activeTasks.map((task) => {
                        const dueMeta = task.dueAt ? getDueMeta(task.dueAt, now) : null;
                        return (
                          <li
                            key={task.id}
                            className="group rounded-2xl border border-border/60 bg-background/90 p-4 transition hover:border-primary/50"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="space-y-2">
                                <p className="text-sm font-medium leading-6 text-foreground">{task.title}</p>
                                {task.description ? (
                                  <p className="text-sm text-muted-foreground">{task.description}</p>
                                ) : null}
                                {dueMeta ? (
                                  <p
                                    className={cn(
                                      "flex items-center gap-2 text-xs transition",
                                      dueMeta.isOverdue ? "text-destructive" : "text-muted-foreground",
                                    )}
                                  >
                                    <Clock aria-hidden className="h-4 w-4" />
                                    Fällig {dueMeta.relative} ({dueMeta.absolute})
                                  </p>
                                ) : null}
                              </div>
                              <Badge variant={TASK_STATUS_BADGES[task.status]} size="sm" className="rounded-full">
                                {TASK_STATUS_LABELS[task.status]}
                              </Badge>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="mt-4 text-sm text-muted-foreground">
                      Keine offenen Aufgaben in diesem Gewerk – du bist auf dem aktuellen Stand.
                    </p>
                  )}

                  {completedTasks.length ? (
                    <details className="group mt-4 rounded-2xl border border-border/50 bg-background/80 p-4 shadow-inner transition open:border-primary/40">
                      <summary className="flex cursor-pointer items-center justify-between gap-2 text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">
                        <span>Abgeschlossene Aufgaben</span>
                        <span className="text-[11px] text-muted-foreground group-open:hidden">Öffnen</span>
                        <span className="hidden text-[11px] text-muted-foreground group-open:inline">Schließen</span>
                      </summary>
                      <ul className="mt-4 space-y-3 text-sm">
                        {completedTasks.map((task) => {
                          const dueMeta = task.dueAt ? getDueMeta(task.dueAt, now) : null;
                          return (
                            <li
                              key={task.id}
                              className="rounded-xl border border-border/60 bg-background/90 p-3"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="space-y-1">
                                  <p className="font-medium text-foreground">{task.title}</p>
                                  {dueMeta ? (
                                    <p className="text-xs text-muted-foreground">Fällig war {dueMeta.absolute}</p>
                                  ) : null}
                                </div>
                                <Badge variant={TASK_STATUS_BADGES[task.status]} size="sm" className="rounded-full">
                                  {TASK_STATUS_LABELS[task.status]}
                                </Badge>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </details>
                  ) : null}
                </section>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
