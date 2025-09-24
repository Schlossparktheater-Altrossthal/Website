import Link from "next/link";
import { notFound } from "next/navigation";
import { addDays, format, startOfToday } from "date-fns";
import { de } from "date-fns/locale/de";
import type { CSSProperties } from "react";
import type { LucideIcon } from "lucide-react";
import { CalendarDays, CheckCircle2, Clock, ListTodo, Sparkles, Users } from "lucide-react";
import { TaskStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";
import { hasPermission } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import {
  DATE_KEY_FORMAT,
  PLANNING_FREEZE_DAYS,
  PLANNING_LOOKAHEAD_DAYS,
  ROLE_LABELS,
  TASK_STATUS_BADGES,
  TASK_STATUS_LABELS,
  TASK_STATUS_ORDER,
  countBlockedDays,
  findMeetingSuggestions,
  formatUserName,
  getDueMeta,
  hexToRgba,
} from "@/app/(members)/mitglieder/meine-gewerke/utils";

import {
  createDepartmentTaskAction,
  deleteDepartmentTaskAction,
  updateDepartmentTaskAction,
} from "../../actions";

const selectClassName =
  "h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const subtleSurfaceClassName =
  "rounded-2xl border border-border/60 bg-background/80 shadow-inner";

type PageProps = { params: Promise<{ departmentId: string }> };

type SummaryStat = { label: string; value: number; hint?: string; icon: LucideIcon };

type MeetingSuggestion = ReturnType<typeof findMeetingSuggestions>[number];

type DepartmentWithRelations = Awaited<
  ReturnType<typeof loadDepartmentWithRelations>
>;

async function loadDepartmentWithRelations(id: string) {
  return prisma.department.findUnique({
    where: { id },
    include: {
      memberships: {
        include: {
          user: { select: { id: true, firstName: true, lastName: true, name: true, email: true } },
        },
        orderBy: { createdAt: "asc" },
      },
      tasks: {
        include: {
          assignee: { select: { id: true, name: true, email: true } },
          creator: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });
}

export default async function DepartmentMissionControlPage({ params }: PageProps) {
  const session = await requireAuth();
  const allowed = await hasPermission(session.user, "mitglieder.produktionen");
  if (!allowed) {
    return (
      <div className="rounded-lg border border-border/70 bg-background/60 p-6 text-sm text-muted-foreground">
        Du hast keinen Zugriff auf die Produktionsplanung.
      </div>
    );
  }

  const resolvedParams = await params;
  const departmentId = resolvedParams?.departmentId;
  if (!departmentId) {
    notFound();
  }

  const department = (await loadDepartmentWithRelations(departmentId)) as DepartmentWithRelations | null;
  if (!department) {
    notFound();
  }

  const today = startOfToday();
  const planningStart = addDays(today, PLANNING_FREEZE_DAYS);
  const planningEnd = addDays(planningStart, PLANNING_LOOKAHEAD_DAYS);
  const now = new Date();

  const memberIds = department.memberships.map((membership) => membership.user.id);
  const blockedDays = memberIds.length
    ? await prisma.blockedDay.findMany({
        where: {
          userId: { in: memberIds },
          date: { gte: today, lte: planningEnd },
          kind: "BLOCKED",
        },
        orderBy: { date: "asc" },
      })
    : [];

  const blockedByUser = new Map<string, Set<string>>();
  for (const entry of blockedDays) {
    if (entry.kind !== "BLOCKED") continue;
    const key = format(entry.date, DATE_KEY_FORMAT);
    const existing = blockedByUser.get(entry.userId);
    if (existing) {
      existing.add(key);
    } else {
      blockedByUser.set(entry.userId, new Set([key]));
    }
  }

  const freezeUntilLabel = format(planningStart, "d. MMMM yyyy", { locale: de });
  const planningWindowLabel = format(planningEnd, "d. MMMM yyyy", { locale: de });

  const meetingSuggestions = findMeetingSuggestions(memberIds, planningStart, planningEnd, blockedByUser);
  const blockedDatesCount = countBlockedDays(memberIds, blockedByUser);
  const hasMembers = memberIds.length > 0;

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

  const summaryStats: SummaryStat[] = [
    { label: "Aktive Aufgaben", value: activeTasks.length, hint: "Offen & in Arbeit", icon: ListTodo },
    { label: "Teammitglieder", value: department.memberships.length, hint: "Eingetragene Personen", icon: Users },
    { label: "Abgeschlossen", value: completedTasks.length, hint: "Erledigte Aufgaben", icon: CheckCircle2 },
  ];

  const accentStyle = {
    "--card-accent": department.color ?? "#6366f1",
    "--card-accent-overlay": hexToRgba(department.color, 0.2),
  } as CSSProperties;

  const detailPath = `/mitglieder/produktionen/gewerke/${department.id}`;
  const heroDescription =
    department.description ?? "Planung, Aufgaben und Teamsteuerung dieses Gewerks im Fokus.";

  return (
    <div className="space-y-10">
      <section className="relative overflow-hidden rounded-3xl border border-border/60 bg-background/80 p-6 shadow-[0_30px_120px_-60px_rgba(99,102,241,0.65)] sm:p-10">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute -top-36 -left-24 h-72 w-72 rounded-full bg-primary/25 blur-3xl" />
          <div className="absolute -bottom-32 right-0 h-64 w-64 rounded-full bg-secondary/20 blur-3xl" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.08),transparent_55%)]" />
        </div>
        <div className="relative flex flex-col gap-8">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
            <div className="space-y-5">
              <div className="flex flex-wrap items-center gap-3 text-xs font-semibold uppercase tracking-[0.3em] text-primary">
                <span className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-3 py-1">
                  <Sparkles aria-hidden className="h-4 w-4" />
                  <span className="tracking-[0.2em]">Mission Control</span>
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/80 px-3 py-1 text-[11px] font-medium tracking-[0.2em] text-muted-foreground">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: department.color ?? "#94a3b8" }} />
                  {department.slug ?? "Gewerk"}
                </span>
              </div>
              <div className="space-y-4">
                <h1 className="font-serif text-3xl leading-tight text-foreground sm:text-4xl">{department.name}</h1>
                <p className="max-w-2xl text-sm text-muted-foreground sm:text-base">{heroDescription}</p>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/80 px-3 py-1.5">
                    <CalendarDays aria-hidden className="h-4 w-4" />
                    Planungsfenster: {freezeUntilLabel} – {planningWindowLabel}
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/80 px-3 py-1.5">
                    <Users aria-hidden className="h-4 w-4" />
                    {department.memberships.length} Teammitglieder
                  </span>
                </div>
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-3">
              <Button
                asChild
                variant="outline"
                size="sm"
                className="rounded-full border-border/60 bg-background/80 px-4 backdrop-blur transition hover:border-primary/40"
              >
                <Link href="/mitglieder/produktionen/gewerke">Zurück zur Übersicht</Link>
              </Button>
              <Button
                asChild
                size="sm"
                variant="secondary"
                className="gap-2 rounded-full bg-gradient-to-br from-primary via-primary/90 to-primary/80 px-4 text-primary-foreground shadow-[0_18px_40px_-28px_rgba(99,102,241,0.9)] transition hover:from-primary/90 hover:via-primary/80 hover:to-primary"
              >
                <Link href="/mitglieder/sperrliste" title="Sperrliste öffnen">
                  <CalendarDays aria-hidden className="h-4 w-4" />
                  <span>Sperrliste</span>
                </Link>
              </Button>
            </div>
          </div>
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
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
        <Card
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
          <CardHeader className="relative z-[1] space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle className="text-lg font-semibold text-foreground">Aufgaben &amp; To-Dos</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Koordiniere Aufgaben, Verantwortlichkeiten und Fortschritt deines Gewerks.
                </p>
              </div>
              <Badge variant="muted" size="sm" className="rounded-full border-border/60">
                {sortedTasks.length} {sortedTasks.length === 1 ? "Aufgabe" : "Aufgaben"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="relative z-[1] space-y-6">
            {activeTasks.length ? (
              <ul className="space-y-3">
                {activeTasks.map((task) => {
                  const assigneeName = task.assignee ? formatUserName(task.assignee) : null;
                  const creatorName = task.creator ? formatUserName(task.creator) : "System";
                  const dueMeta = task.dueAt ? getDueMeta(task.dueAt, now) : null;
                  const dueDateValue = task.dueAt ? format(task.dueAt, DATE_KEY_FORMAT) : "";

                  return (
                    <li
                      key={task.id}
                      className="group space-y-3 rounded-2xl border border-border/60 bg-background/90 p-4 shadow-inner transition hover:border-primary/40"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <Badge variant={TASK_STATUS_BADGES[task.status]} size="sm" className="rounded-full">
                              {TASK_STATUS_LABELS[task.status]}
                            </Badge>
                            {dueMeta ? (
                              <span
                                className={cn(
                                  "inline-flex items-center gap-1 rounded-full border border-border/50 px-2 py-0.5 transition",
                                  dueMeta.isOverdue ? "text-destructive" : "text-muted-foreground",
                                )}
                              >
                                <Clock aria-hidden className="h-3.5 w-3.5" />
                                {dueMeta.relative}
                              </span>
                            ) : null}
                            <span className="inline-flex items-center gap-1 rounded-full border border-border/50 px-2 py-0.5">
                              {assigneeName ? `Zuständig: ${assigneeName}` : "Noch keine Zuordnung"}
                            </span>
                          </div>
                          <p className="text-base font-medium leading-snug text-foreground">{task.title}</p>
                          {task.description ? (
                            <p className="text-sm text-muted-foreground">{task.description}</p>
                          ) : null}
                          <p className="text-xs text-muted-foreground">Erstellt von {creatorName}</p>
                        </div>
                        <form action={deleteDepartmentTaskAction}>
                          <input type="hidden" name="taskId" value={task.id} />
                          <input type="hidden" name="redirectPath" value={detailPath} />
                          <Button type="submit" variant="ghost" size="sm">
                            Entfernen
                          </Button>
                        </form>
                      </div>

                      <details className={`${subtleSurfaceClassName} group border-border/50 bg-background/80 p-4 [&_summary::-webkit-details-marker]:hidden`}>
                        <summary className="flex cursor-pointer items-center justify-between text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">
                          <span>Aufgabe bearbeiten</span>
                          <span className="text-[11px] text-muted-foreground group-open:hidden">Öffnen</span>
                          <span className="hidden text-[11px] text-muted-foreground group-open:inline">Schließen</span>
                        </summary>
                        <form action={updateDepartmentTaskAction} className="mt-3 grid gap-3 md:grid-cols-2">
                          <input type="hidden" name="taskId" value={task.id} />
                          <input type="hidden" name="redirectPath" value={detailPath} />
                          <div className="space-y-1 md:col-span-2">
                            <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Titel</label>
                            <Input name="title" defaultValue={task.title} minLength={2} maxLength={160} required />
                          </div>
                          <div className="space-y-1 md:col-span-2">
                            <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Beschreibung</label>
                            <Textarea name="description" rows={3} maxLength={2000} defaultValue={task.description ?? ""} />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Status</label>
                            <select name="status" defaultValue={task.status} className={selectClassName}>
                              {Object.values(TaskStatus).map((status) => (
                                <option key={status} value={status}>
                                  {TASK_STATUS_LABELS[status]}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Fällig bis</label>
                            <Input type="date" name="dueAt" defaultValue={dueDateValue} />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                              Zuständiges Mitglied
                            </label>
                            <select name="assigneeId" defaultValue={task.assignee?.id ?? ""} className={selectClassName}>
                              <option value="">Noch offen</option>
                              {department.memberships.map((membership) => (
                                <option key={membership.user.id} value={membership.user.id}>
                                  {formatUserName(membership.user)}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="md:col-span-2 flex justify-end">
                            <Button type="submit" variant="outline" size="sm">
                              Aufgabe speichern
                            </Button>
                          </div>
                        </form>
                      </details>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                Keine offenen Aufgaben – starte mit einer neuen Aufgabe, um dein Team auszurichten.
              </p>
            )}

            {completedTasks.length ? (
              <details className={`${subtleSurfaceClassName} border-border/50 bg-background/70 p-4 transition open:border-primary/40`}>
                <summary className="flex cursor-pointer items-center justify-between text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">
                  <span>Abgeschlossene Aufgaben</span>
                  <span className="text-[11px] text-muted-foreground group-open:hidden">Öffnen</span>
                  <span className="hidden text-[11px] text-muted-foreground group-open:inline">Schließen</span>
                </summary>
                <ul className="mt-3 space-y-3 text-sm">
                  {completedTasks.map((task) => {
                    const dueMeta = task.dueAt ? getDueMeta(task.dueAt, now) : null;
                    return (
                      <li key={task.id} className="rounded-xl border border-border/60 bg-background/90 p-3">
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

            <div className={`${subtleSurfaceClassName} border-dashed border-border/60 bg-background/70 p-4`}>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Neue Aufgabe hinzufügen</h3>
              <form className="mt-3 grid gap-3 md:grid-cols-2" action={createDepartmentTaskAction}>
                <input type="hidden" name="departmentId" value={department.id} />
                <input type="hidden" name="redirectPath" value={detailPath} />
                <div className="space-y-1 md:col-span-2">
                  <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Titel</label>
                  <Input
                    name="title"
                    placeholder="z.B. Lichtplan aktualisieren"
                    required
                    minLength={2}
                    maxLength={160}
                  />
                </div>
                <div className="space-y-1 md:col-span-2">
                  <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Beschreibung</label>
                  <Textarea
                    name="description"
                    rows={3}
                    maxLength={2000}
                    placeholder="Optionale Details zur Aufgabe"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Status</label>
                  <select name="status" className={selectClassName} defaultValue={TaskStatus.todo}>
                    {Object.values(TaskStatus).map((status) => (
                      <option key={status} value={status}>
                        {TASK_STATUS_LABELS[status]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Fällig bis</label>
                  <Input type="date" name="dueAt" />
                </div>
                <div className="space-y-1 md:col-span-2">
                  <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Zuständiges Mitglied</label>
                  <select name="assigneeId" className={selectClassName} defaultValue="">
                    <option value="">Noch offen</option>
                    {department.memberships.map((membership) => (
                      <option key={membership.user.id} value={membership.user.id}>
                        {formatUserName(membership.user)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="md:col-span-2 flex justify-end">
                  <Button type="submit" size="sm">
                    Aufgabe hinzufügen
                  </Button>
                </div>
              </form>
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden rounded-3xl border border-border/60 bg-background/75 shadow-[0_30px_120px_-60px_rgba(59,130,246,0.45)]">
          <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.12),transparent_70%)]" />
          <CardHeader className="relative z-[1] space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle className="text-lg font-semibold text-foreground">Planung &amp; Termine</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Verfügbare Slots ab {freezeUntilLabel} und innerhalb der nächsten {PLANNING_LOOKAHEAD_DAYS} Tage.
                </p>
              </div>
              <Badge variant="outline" size="sm" className="rounded-full border-primary/40 text-primary">
                {meetingSuggestions.length} Vorschläge
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="relative z-[1] space-y-4">
            {!hasMembers ? (
              <p className="text-sm text-muted-foreground">
                Füge Teammitglieder hinzu, um gemeinsame Termine zu planen.
              </p>
            ) : (
              <>
                <div className={`${subtleSurfaceClassName} flex items-center justify-between gap-3 border-border/50 bg-background/85 px-4 py-3`}>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sperrtage im Zeitraum</p>
                    <p className="text-sm text-foreground">{blockedDatesCount}</p>
                  </div>
                  <Button
                    asChild
                    variant="ghost"
                    size="sm"
                    className="gap-2 rounded-full border border-border/60 bg-background/80 px-3"
                  >
                    <Link href="/mitglieder/sperrliste">
                      <CalendarDays aria-hidden className="h-4 w-4" />
                      <span>Sperrliste öffnen</span>
                    </Link>
                  </Button>
                </div>
                {renderSuggestions(meetingSuggestions, department.memberships.length)}
              </>
            )}
            <p className="text-xs text-muted-foreground">
              Fenster: {freezeUntilLabel} – {planningWindowLabel}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="relative overflow-hidden rounded-3xl border border-border/60 bg-background/75 shadow-[0_30px_120px_-60px_rgba(148,163,184,0.5)]">
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(148,163,184,0.16),transparent_70%)]" />
        <CardHeader className="relative z-[1] space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="text-lg font-semibold text-foreground">Teamübersicht</CardTitle>
              <p className="text-sm text-muted-foreground">
                Rollen, Beschreibungen und Notizen aller Mitglieder auf einen Blick.
              </p>
            </div>
            <Button
              asChild
              variant="outline"
              size="sm"
              className="rounded-full border-border/60 bg-background/80 px-4 backdrop-blur transition hover:border-primary/40"
            >
              <Link href="/mitglieder/produktionen/gewerke">Teamverwaltung öffnen</Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="relative z-[1] space-y-3">
          {sortedMembers.length === 0 ? (
            <p className="text-sm text-muted-foreground">Noch keine Teammitglieder hinterlegt.</p>
          ) : (
            <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {sortedMembers.map((membership) => (
                <li key={membership.id} className={`${subtleSurfaceClassName} border-border/50 bg-background/85 p-4`}>
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-foreground">{formatUserName(membership.user)}</p>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant="outline" size="sm" className="rounded-full border-border/60">
                        {ROLE_LABELS[membership.role]}
                      </Badge>
                      {membership.title ? (
                        <span className="rounded-full border border-border/50 bg-background/80 px-2 py-0.5">
                          {membership.title}
                        </span>
                      ) : null}
                    </div>
                    {membership.note ? (
                      <p className="text-xs text-muted-foreground">Notiz: {membership.note}</p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function renderSuggestions(suggestions: MeetingSuggestion[], memberCount: number) {
  if (suggestions.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-amber-300 bg-amber-50/80 p-4 text-xs text-amber-900 dark:border-amber-400/60 dark:bg-amber-500/10 dark:text-amber-100">
        Kein gemeinsamer freier Termin gefunden. Aktualisiert Sperrlisten oder erweitert den Zeitrahmen.
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {suggestions.map((slot) => (
        <li
          key={slot.key}
          className="flex items-center justify-between gap-3 rounded-2xl border border-border/60 bg-background/85 p-3 shadow-inner transition hover:border-primary/40"
        >
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <CalendarDays aria-hidden className="h-5 w-5" />
            </span>
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">{slot.label}</p>
              <p className="text-xs text-muted-foreground">Alle {memberCount} Mitglieder sind verfügbar.</p>
            </div>
          </div>
          <Badge variant="success" size="sm" className="rounded-full">
            {slot.shortLabel}
          </Badge>
        </li>
      ))}
    </ul>
  );
}
