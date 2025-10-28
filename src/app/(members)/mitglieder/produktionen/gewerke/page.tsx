import Link from "next/link";
import { DepartmentMembershipRole, TaskStatus } from "@prisma/client";
import { Sparkles, Users, ListTodo, ShieldCheck, CalendarDays } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { addDays, startOfToday, format } from "date-fns";
import { de } from "date-fns/locale/de";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";
import { hasPermission } from "@/lib/permissions";
import { getActiveProduction } from "@/lib/active-production";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ProductionWorkspaceHeader } from "@/components/production/workspace-header";
import { ProductionWorkspaceEmptyState } from "@/components/production/workspace-empty-state";

import {
  formatUserName,
  ROLE_LABELS,
  TASK_STATUS_LABELS,
  TASK_STATUS_BADGES,
} from "../../meine-gewerke/utils";

import {
  createDepartmentAction,
  updateDepartmentAction,
  deleteDepartmentAction,
  addDepartmentMemberAction,
  updateDepartmentMemberAction,
  removeDepartmentMemberAction,
} from "../actions";

const selectClassName =
  "h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const collapsibleClassName =
  "group rounded-lg border border-border/60 bg-background/70 p-4 shadow-sm transition [&_summary::-webkit-details-marker]:hidden";

type PageProps = {
  searchParams?: Promise<{ department?: string | string[] | null }>;
};

const EVENT_WINDOW_DAYS = 30;
const UPCOMING_TASK_WINDOW_DAYS = 21;

export default async function ProduktionsGewerkePage({ searchParams }: PageProps) {
  const session = await requireAuth();
  const allowed = await hasPermission(session.user, "mitglieder.produktionen");
  if (!allowed) {
    return (
      <div className="space-y-6">
        <div className="rounded-lg border border-border/70 bg-background/60 p-6 text-sm text-muted-foreground">
          Du hast keinen Zugriff auf die Produktionsplanung.
        </div>
      </div>
    );
  }

  const activeProduction = await getActiveProduction(session.user?.id);

  if (!activeProduction) {
    return (
      <div className="space-y-6">
        <ProductionWorkspaceHeader
          title="Gewerke &amp; Zuständigkeiten"
          description="Strukturiere dein Produktionsteam, vergib Verantwortlichkeiten und halte Kontaktdaten zentral fest."
          activeWorkspace="departments"
          production={null}
        />
        <ProductionWorkspaceEmptyState
          title="Keine aktive Produktion ausgewählt"
          description="Wähle in der Produktionsübersicht eine aktive Produktion aus, um Gewerke und Zuständigkeiten zu bearbeiten."
        />
      </div>
    );
  }

  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const departmentFilterRaw = resolvedSearchParams?.department;
  const departmentFilter = Array.isArray(departmentFilterRaw)
    ? departmentFilterRaw[0]
    : departmentFilterRaw;
  const selectedSlug = departmentFilter && departmentFilter !== "all" ? departmentFilter : null;

  const [departments, users] = await Promise.all([
    prisma.department.findMany({
      orderBy: { name: "asc" },
      include: {
        memberships: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true, name: true, email: true } },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    }),
    prisma.user.findMany({
      where: {
        deactivatedAt: null,
        ...(activeProduction
          ? {
              productionMemberships: {
                some: {
                  showId: activeProduction.id,
                  OR: [{ leftAt: null }, { leftAt: { gt: new Date() } }],
                },
              },
            }
          : {}),
      },
      orderBy: [
        { name: "asc" },
        { email: "asc" },
      ],
      select: { id: true, firstName: true, lastName: true, name: true, email: true },
    }),
  ]);

  const departmentIds = departments.map((department) => department.id);
  const today = startOfToday();
  const eventWindowEnd = addDays(today, EVENT_WINDOW_DAYS);
  const taskWindowEnd = addDays(today, UPCOMING_TASK_WINDOW_DAYS);

  const [taskGroups, upcomingTasksRaw, upcomingEventsRaw] = departmentIds.length
    ? await Promise.all([
        prisma.departmentTask.groupBy({
          by: ["departmentId", "status"],
          where: { departmentId: { in: departmentIds } },
          _count: { _all: true },
        }),
        prisma.departmentTask.findMany({
          where: {
            departmentId: { in: departmentIds },
            status: { in: [TaskStatus.todo, TaskStatus.doing] },
            OR: [
              { dueAt: null },
              {
                dueAt: {
                  gte: today,
                  lte: taskWindowEnd,
                },
              },
            ],
          },
          select: {
            id: true,
            title: true,
            dueAt: true,
            status: true,
            departmentId: true,
          },
          orderBy: [
            { dueAt: "asc" },
            { createdAt: "desc" },
          ],
        }),
        prisma.departmentEvent.findMany({
          where: {
            departmentId: { in: departmentIds },
            start: {
              gte: today,
              lte: eventWindowEnd,
            },
          },
          select: {
            id: true,
            title: true,
            start: true,
            location: true,
            departmentId: true,
          },
          orderBy: [
            { start: "asc" },
            { createdAt: "asc" },
          ],
        }),
      ])
    : [[], [], []] as const;

  type TaskCountRecord = Record<TaskStatus, number>;
  const defaultTaskCounts: TaskCountRecord = { todo: 0, doing: 0, done: 0 };
  const tasksByDepartment = new Map<string, TaskCountRecord>();
  for (const entry of taskGroups) {
    const current = tasksByDepartment.get(entry.departmentId) ?? { ...defaultTaskCounts };
    current[entry.status] = entry._count._all;
    tasksByDepartment.set(entry.departmentId, current);
  }

  const upcomingTasksByDepartment = new Map<string, typeof upcomingTasksRaw>();
  for (const task of upcomingTasksRaw) {
    const existing = upcomingTasksByDepartment.get(task.departmentId) ?? [];
    if (existing.length < 3) {
      existing.push(task);
    }
    upcomingTasksByDepartment.set(task.departmentId, existing);
  }

  const upcomingEventsByDepartment = new Map<string, typeof upcomingEventsRaw>();
  for (const event of upcomingEventsRaw) {
    const existing = upcomingEventsByDepartment.get(event.departmentId) ?? [];
    if (existing.length < 3) {
      existing.push(event);
    }
    upcomingEventsByDepartment.set(event.departmentId, existing);
  }

  const selectedDepartment = selectedSlug
    ? departments.find((department) => department.slug === selectedSlug)
    : null;
  const viewDepartments = selectedSlug
    ? selectedDepartment
      ? [selectedDepartment]
      : []
    : departments;

  const numberFormatter = new Intl.NumberFormat("de-DE");
  const selectionSummary = viewDepartments.reduce(
    (acc, department) => {
      const counts = tasksByDepartment.get(department.id) ?? { ...defaultTaskCounts };
      acc.todo += counts.todo;
      acc.doing += counts.doing;
      acc.done += counts.done;
      acc.members += department.memberships.length;
      acc.events += upcomingEventsByDepartment.get(department.id)?.length ?? 0;
      if (department.requiresJoinApproval) {
        acc.moderated += 1;
      }
      return acc;
    },
    { todo: 0, doing: 0, done: 0, members: 0, events: 0, moderated: 0 },
  );

  const formattedOpenTasks = numberFormatter.format(selectionSummary.todo + selectionSummary.doing);
  const formattedMemberCount = numberFormatter.format(selectionSummary.members);
  const formattedEventCount = numberFormatter.format(selectionSummary.events);
  const formattedModeratedCount = numberFormatter.format(selectionSummary.moderated);

  const headerStats = [
    {
      label: selectedDepartment ? "Ausgewähltes Gewerk" : "Gewerke insgesamt",
      value: selectedDepartment ? selectedDepartment.name : numberFormatter.format(departments.length),
      hint: selectedDepartment ? "Fokusansicht" : "Verfügbare Teams",
    },
    {
      label: "Aktive Mitglieder",
      value: formattedMemberCount,
      hint: selectedDepartment ? selectedDepartment.name : "Zugeordnete Personen",
    },
    {
      label: "Offene Aufgaben",
      value: formattedOpenTasks,
      hint: "Todo & in Arbeit",
    },
    {
      label: `Termine (${EVENT_WINDOW_DAYS} Tage)`,
      value: formattedEventCount,
      hint: "Anstehende Ereignisse",
    },
  ];

  type HighlightStat = { label: string; value: string; hint: string; icon: LucideIcon };
  const highlightItems: HighlightStat[] = [
    {
      label: "Offene Aufgaben",
      value: formattedOpenTasks,
      hint: "Todo & in Arbeit",
      icon: ListTodo,
    },
    {
      label: "Aktive Mitglieder",
      value: formattedMemberCount,
      hint: selectedDepartment ? selectedDepartment.name : "Zugeordnete Personen",
      icon: Users,
    },
    {
      label: `Termine (${EVENT_WINDOW_DAYS} Tage)`,
      value: formattedEventCount,
      hint: "Planungssicherheit",
      icon: CalendarDays,
    },
  ];

  if (!selectedDepartment && selectionSummary.moderated > 0) {
    highlightItems.push({
      label: "Moderierte Zugänge",
      value: formattedModeratedCount,
      hint: "Gewerke mit Freigabe",
      icon: ShieldCheck,
    });
  }

  const departmentOptions = [
    { value: "all", label: "Alle Gewerke" },
    ...departments.map((department) => ({ value: department.slug, label: department.name })),
  ];

  return (
    <div className="space-y-6">
      <ProductionWorkspaceHeader
        title="Gewerke &amp; Zuständigkeiten"
        description="Verwalte Verantwortlichkeiten, Wissen und Kommunikation in einem eigenständigen Gewerk-Hub."
        activeWorkspace="departments"
        production={activeProduction}
        stats={headerStats}
        hideProductionCard
      />
      <section className="grid gap-4 lg:grid-cols-[2fr,1fr]">
        <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-br from-primary/15 via-primary/5 to-background/80 p-6 shadow-[0_30px_120px_-60px_rgba(99,102,241,0.45)]">
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <div className="absolute -top-24 -left-20 h-64 w-64 rounded-full bg-primary/20 blur-3xl" />
            <div className="absolute -bottom-20 right-0 h-60 w-60 rounded-full bg-secondary/20 blur-3xl" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.12),transparent_65%)]" />
          </div>
          <div className="relative z-[1] flex flex-col gap-6">
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-primary">Regie &amp; Vorstand</p>
              <h2 className="text-2xl font-semibold text-foreground sm:text-3xl">Klarer Überblick für Entscheidungen</h2>
              <p className="max-w-2xl text-sm text-muted-foreground sm:text-base">
                Sammle Rollen, Dokumente und Kontaktdaten direkt im Gewerk-Hub. Die Übersicht zeigt Aufgabenstatus, aktive Mitglieder und Termine gebündelt – ideal für schnelle Abstimmungen in Regie und Vorstand.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {highlightItems.map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.label}
                    className="group relative overflow-hidden rounded-2xl border border-border/50 bg-background/80 p-4 shadow-inner transition hover:border-primary/40"
                  >
                    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(99,102,241,0.18),transparent_70%)] opacity-0 transition duration-300 group-hover:opacity-100" />
                    <div className="relative space-y-2">
                      <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <Icon aria-hidden className="h-4 w-4" />
                      </span>
                      <div>
                        <p className="text-lg font-semibold text-foreground">{item.value}</p>
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/80">{item.label}</p>
                      </div>
                      <p className="text-xs text-muted-foreground/80">{item.hint}</p>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Dialog>
                <DialogTrigger asChild>
                  <Button size="sm" className="rounded-full px-4">
                    Gewerk anlegen
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Neues Gewerk anlegen</DialogTitle>
                    <DialogDescription>
                      Definiere Verantwortungsbereiche mit Farben, Beschreibungen und optionalem Slug für eine bessere Orientierung.
                    </DialogDescription>
                  </DialogHeader>
                  <form action={createDepartmentAction} className="grid gap-6">
                    <input type="hidden" name="redirectPath" value="/mitglieder/produktionen/gewerke" />
                    <fieldset className="grid gap-3 rounded-lg border border-border/60 bg-background/70 p-4 sm:grid-cols-2">
                      <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Basisdaten
                      </legend>
                      <div className="space-y-1">
                        <label className="text-sm font-medium">Name</label>
                        <Input name="name" placeholder="z.B. Maske" required minLength={2} maxLength={80} />
                      </div>
                      <div className="space-y-1">
                        <label className="text-sm font-medium">Slug (optional)</label>
                        <Input name="slug" placeholder="maske" maxLength={80} />
                      </div>
                      <div className="space-y-1">
                        <label className="text-sm font-medium">Farbe</label>
                        <input
                          type="color"
                          name="color"
                          defaultValue="#9333ea"
                          className="h-10 w-full cursor-pointer rounded-md border border-input bg-background"
                        />
                      </div>
                      <div className="space-y-1 sm:col-span-2">
                        <span className="text-sm font-medium">Beitritt</span>
                        <label className="flex items-center gap-2 text-sm text-muted-foreground">
                          <input
                            type="checkbox"
                            name="requiresApproval"
                            className="h-4 w-4 rounded border border-border"
                          />
                          Leitung muss neue Mitglieder bestätigen, bevor sie beitreten.
                        </label>
                      </div>
                    </fieldset>
                    <div className="space-y-1">
                      <label className="text-sm font-medium">Beschreibung</label>
                      <Textarea name="description" rows={2} maxLength={2000} placeholder="Kurzbeschreibung für das Gewerk" />
                    </div>
                    <DialogFooter className="pt-2 sm:justify-end">
                      <Button type="submit">Gewerk speichern</Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
              <div className="text-xs text-muted-foreground">
                Tipp: Nutze klare Beschreibungen für einheitliche Kommunikation im Team.
              </div>
            </div>
          </div>
        </div>

        <Card className="relative overflow-hidden rounded-3xl border border-border/60 bg-background/80 p-6 shadow-[0_24px_90px_-48px_rgba(148,163,184,0.35)]">
          <div className="relative z-[1] space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">Arbeitsabläufe</p>
            <h3 className="text-lg font-semibold text-foreground">Wissen bewahren &amp; teilen</h3>
            <p className="text-sm text-muted-foreground">
              Halte Kontaktdaten, Dokumente und Entscheidungsnotizen direkt beim Gewerk fest. So behalten Leitung und Teammitglieder jederzeit den Überblick über Zuständigkeiten.
            </p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary/60" aria-hidden />
                <span>Dokumente lassen sich im Gewerk-Hub ablegen und versionieren.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary/60" aria-hidden />
                <span>Notizen zu Rollen oder Ansprechpersonen bleiben für das gesamte Team sichtbar.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary/60" aria-hidden />
                <span>Moderierte Zugänge sichern sensible Bereiche bei Bedarf zusätzlich ab.</span>
              </li>
            </ul>
          </div>
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <div className="absolute -bottom-16 right-0 h-40 w-40 rounded-full bg-primary/15 blur-3xl" />
            <div className="absolute -top-20 left-16 h-32 w-32 rounded-full bg-secondary/15 blur-3xl" />
          </div>
        </Card>
      </section>

      <form className="rounded-3xl border border-border/60 bg-background/70 p-4 shadow-sm" method="get">
        <div className="space-y-3">
          <label
            htmlFor="department-filter"
            className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
          >
            Gewerk-Fokus
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <select
              id="department-filter"
              name="department"
              defaultValue={selectedSlug ?? "all"}
              className={`${selectClassName} w-full sm:w-64`}
            >
              {departmentOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <Button type="submit" size="sm">
              Ansicht aktualisieren
            </Button>
            {selectedSlug ? (
              <Button asChild variant="ghost" size="sm">
                <Link href="/mitglieder/produktionen/gewerke">Gesamtübersicht</Link>
              </Button>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground">
            Filtere nach einzelnen Gewerken oder behalte alle Teams gleichzeitig im Blick.
          </p>
        </div>
      </form>

      {selectedSlug && !selectedDepartment ? (
        <div className="rounded-3xl border border-border/60 bg-background/80 p-6 text-sm text-muted-foreground">
          Das ausgewählte Gewerk konnte nicht gefunden werden. Bitte wähle eine gültige Option aus der Liste.
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-2">
        {viewDepartments.map((department) => {
          const departmentMemberIds = department.memberships.map((membership) => membership.user.id);
          const memberIdSet = new Set(departmentMemberIds);
          const availableUsers = users.filter((user) => !memberIdSet.has(user.id));
          const detailHref = `/mitglieder/produktionen/gewerke/${department.id}`;
          const taskCounts = tasksByDepartment.get(department.id) ?? { ...defaultTaskCounts };
          const openTasksCount = taskCounts.todo + taskCounts.doing;
          const completedTasksCount = taskCounts.done;
          const upcomingTasks = upcomingTasksByDepartment.get(department.id) ?? [];
          const upcomingEvents = upcomingEventsByDepartment.get(department.id) ?? [];

          return (
            <Card
              key={department.id}
              className="relative space-y-6 overflow-hidden rounded-3xl border border-border/60 bg-background/80 shadow-[0_24px_90px_-48px_rgba(59,130,246,0.35)] transition hover:border-primary/40"
            >
              <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(99,102,241,0.1),transparent_70%)]" />
              <div className="relative space-y-6">
                <CardHeader className="space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <span
                        className="mt-1 inline-block h-3 w-3 rounded-full border border-border/80"
                        style={{ backgroundColor: department.color ?? "#94a3b8" }}
                      />
                      <div className="space-y-1">
                        <CardTitle className="text-xl font-semibold">{department.name}</CardTitle>
                        {department.description ? (
                          <p className="text-sm text-muted-foreground">{department.description}</p>
                        ) : null}
                        {department.slug ? (
                          <p className="text-xs uppercase tracking-wide text-muted-foreground">Slug: {department.slug}</p>
                        ) : null}
                        {department.requiresJoinApproval ? (
                          <p className="text-xs uppercase tracking-wide text-muted-foreground">
                            Beitritt benötigt Zustimmung der Leitung
                          </p>
                        ) : null}
                      </div>
                    </div>
                    <form action={deleteDepartmentAction}>
                      <input type="hidden" name="id" value={department.id} />
                      <input type="hidden" name="redirectPath" value="/mitglieder/produktionen/gewerke" />
                      <Button type="submit" variant="ghost" size="sm">
                        Entfernen
                      </Button>
                    </form>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-lg border border-border/50 bg-background/70 p-3 text-sm shadow-sm">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Offene Aufgaben</p>
                      <p className="mt-1 text-lg font-semibold text-foreground">{numberFormatter.format(openTasksCount)}</p>
                      <p className="text-xs text-muted-foreground">Todo &amp; In Arbeit</p>
                    </div>
                    <div className="rounded-lg border border-border/50 bg-background/70 p-3 text-sm shadow-sm">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Aktive Mitglieder</p>
                      <p className="mt-1 text-lg font-semibold text-foreground">
                        {numberFormatter.format(department.memberships.length)}
                      </p>
                      <p className="text-xs text-muted-foreground">Zugeordnete Personen</p>
                    </div>
                    <div className="rounded-lg border border-border/50 bg-background/70 p-3 text-sm shadow-sm">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Termine ({EVENT_WINDOW_DAYS} Tage)
                      </p>
                      <p className="mt-1 text-lg font-semibold text-foreground">
                        {numberFormatter.format(upcomingEvents.length)}
                      </p>
                      <p className="text-xs text-muted-foreground">Anstehende Ereignisse</p>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-8">
                  <div className="grid gap-6 lg:grid-cols-2">
                    <section className="space-y-3">
                      <div>
                        <h3 className="text-sm font-semibold text-foreground">Aktuelle Aufgabenlage</h3>
                        <p className="text-xs text-muted-foreground">
                          Die wichtigsten offenen Aufgaben für dieses Gewerk.
                        </p>
                      </div>
                      <div className="space-y-3">
                        {upcomingTasks.length === 0 ? (
                          <p className="text-sm text-muted-foreground">Keine offenen Aufgaben im ausgewählten Zeitraum.</p>
                        ) : (
                          upcomingTasks.map((task) => (
                            <div
                              key={task.id}
                              className="rounded-lg border border-border/60 bg-background/80 p-3 text-sm shadow-sm"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <p className="font-medium text-foreground">{task.title}</p>
                                <Badge variant={TASK_STATUS_BADGES[task.status]}>
                                  {TASK_STATUS_LABELS[task.status]}
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {task.dueAt
                                  ? `Fällig am ${format(task.dueAt, "dd.MM.yyyy", { locale: de })}`
                                  : "Keine Fälligkeit hinterlegt"}
                              </p>
                            </div>
                          ))
                        )}
                      </div>
                      <details className={collapsibleClassName}>
                        <summary className="flex cursor-pointer items-center justify-between text-sm font-semibold text-foreground">
                          Aufgabenstatus im Detail
                          <span className="text-xs text-muted-foreground group-open:hidden">Öffnen</span>
                          <span className="hidden text-xs text-muted-foreground group-open:inline">Schließen</span>
                        </summary>
                        <div className="mt-4 space-y-2 text-sm">
                          <div className="flex items-center justify-between rounded-md border border-border/60 bg-background/80 p-2">
                            <span>Offen</span>
                            <span className="font-medium">{numberFormatter.format(taskCounts.todo)}</span>
                          </div>
                          <div className="flex items-center justify-between rounded-md border border-border/60 bg-background/80 p-2">
                            <span>In Arbeit</span>
                            <span className="font-medium">{numberFormatter.format(taskCounts.doing)}</span>
                          </div>
                          <div className="flex items-center justify-between rounded-md border border-border/60 bg-background/80 p-2">
                            <span>Erledigt</span>
                            <span className="font-medium">{numberFormatter.format(completedTasksCount)}</span>
                          </div>
                        </div>
                      </details>
                    </section>

                    <section className="space-y-3">
                      <div>
                        <h3 className="text-sm font-semibold text-foreground">Nächste Termine</h3>
                        <p className="text-xs text-muted-foreground">
                          Geplante Treffen und Deadlines der kommenden {EVENT_WINDOW_DAYS} Tage.
                        </p>
                      </div>
                      <div className="space-y-3">
                        {upcomingEvents.length === 0 ? (
                          <p className="text-sm text-muted-foreground">Keine Termine im ausgewählten Zeitraum.</p>
                        ) : (
                          upcomingEvents.map((event) => (
                            <div
                              key={event.id}
                              className="rounded-lg border border-border/60 bg-background/80 p-3 text-sm shadow-sm"
                            >
                              <p className="font-medium text-foreground">{event.title}</p>
                              <p className="text-xs text-muted-foreground">
                                {format(event.start, "EEEE, d. MMMM yyyy", { locale: de })}
                              </p>
                              {event.location ? (
                                <p className="text-xs text-muted-foreground">Ort: {event.location}</p>
                              ) : null}
                            </div>
                          ))
                        )}
                      </div>
                    </section>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <h3 className="text-sm font-semibold">Aktive Mitglieder</h3>
                      <p className="text-xs text-muted-foreground">
                        Verknüpfe Personen mit klaren Rollen und zusätzlichen Notizen.
                      </p>
                    </div>

                    <div className="space-y-3">
                      {department.memberships.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Noch keine Mitglieder zugeordnet.</p>
                      ) : (
                        department.memberships.map((membership) => (
                          <div
                            key={membership.id}
                            className="rounded-lg border border-border/60 bg-background/80 p-3 text-sm shadow-sm"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div>
                                <p className="font-medium">{formatUserName(membership.user)}</p>
                                <p className="text-xs text-muted-foreground">{ROLE_LABELS[membership.role]}</p>
                                {membership.title ? (
                                  <p className="text-xs text-muted-foreground">{membership.title}</p>
                                ) : null}
                                {membership.note ? (
                                  <p className="text-xs text-muted-foreground">Notiz: {membership.note}</p>
                                ) : null}
                              </div>
                              <form action={removeDepartmentMemberAction}>
                                <input type="hidden" name="membershipId" value={membership.id} />
                                <input type="hidden" name="redirectPath" value="/mitglieder/produktionen/gewerke" />
                                <Button type="submit" variant="ghost" size="sm">
                                  Entfernen
                                </Button>
                              </form>
                            </div>

                            <details
                              className="group mt-3 rounded-md border border-border/50 bg-background/70 p-3 [&_summary::-webkit-details-marker]:hidden"
                            >
                              <summary className="flex cursor-pointer items-center justify-between text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                <span>Zuweisung anpassen</span>
                                <span className="text-[11px] text-muted-foreground group-open:hidden">Öffnen</span>
                                <span className="hidden text-[11px] text-muted-foreground group-open:inline">Schließen</span>
                              </summary>
                              <form
                                action={updateDepartmentMemberAction}
                                className="mt-3 grid gap-2 md:grid-cols-3"
                              >
                                <input type="hidden" name="membershipId" value={membership.id} />
                                <input type="hidden" name="redirectPath" value="/mitglieder/produktionen/gewerke" />
                                <div className="space-y-1">
                                  <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                    Funktion
                                  </label>
                                  <select name="role" defaultValue={membership.role} className={selectClassName}>
                                    {Object.values(DepartmentMembershipRole).map((role) => (
                                      <option key={role} value={role}>
                                        {ROLE_LABELS[role]}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                                <div className="space-y-1">
                                  <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                    Bezeichnung
                                  </label>
                                  <Input name="title" defaultValue={membership.title ?? ""} maxLength={120} />
                                </div>
                                <div className="space-y-1">
                                  <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                    Notiz
                                  </label>
                                  <Input name="note" defaultValue={membership.note ?? ""} maxLength={200} />
                                </div>
                                <div className="md:col-span-3 flex justify-end">
                                  <Button type="submit" variant="outline" size="sm">
                                    Änderungen speichern
                                  </Button>
                                </div>
                              </form>
                            </details>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <details className={collapsibleClassName}>
                    <summary className="flex cursor-pointer items-center justify-between text-sm font-semibold text-foreground">
                      <span>Gewerk bearbeiten</span>
                      <span className="text-xs text-muted-foreground group-open:hidden">Öffnen</span>
                      <span className="hidden text-xs text-muted-foreground group-open:inline">Schließen</span>
                    </summary>
                    <form
                      action={updateDepartmentAction}
                      className="mt-4 grid gap-3 rounded-lg border border-border/50 bg-background/70 p-4 md:grid-cols-2"
                    >
                      <input type="hidden" name="id" value={department.id} />
                      <input type="hidden" name="redirectPath" value="/mitglieder/produktionen/gewerke" />
                      <div className="space-y-1">
                        <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Name</label>
                        <Input name="name" defaultValue={department.name} minLength={2} maxLength={80} required />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Slug</label>
                        <Input name="slug" defaultValue={department.slug ?? ""} maxLength={80} />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Farbe</label>
                        <input
                          type="color"
                          name="color"
                          defaultValue={department.color ?? "#94a3b8"}
                          className="h-10 w-full cursor-pointer rounded-md border border-input bg-background"
                        />
                      </div>
                      <div className="space-y-1 md:col-span-2">
                        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Beitritt</span>
                        <label className="flex items-center gap-2 text-xs text-muted-foreground">
                          <input
                            type="checkbox"
                            name="requiresApproval"
                            defaultChecked={department.requiresJoinApproval}
                            className="h-4 w-4 rounded border border-border"
                          />
                          Leitung muss neue Mitglieder bestätigen, bevor sie beitreten.
                        </label>
                      </div>
                      <div className="space-y-1 md:col-span-2">
                        <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Beschreibung
                        </label>
                        <Textarea
                          name="description"
                          rows={2}
                          maxLength={2000}
                          defaultValue={department.description ?? ""}
                        />
                      </div>
                      <div className="md:col-span-2 flex justify-end">
                        <Button type="submit" variant="outline" size="sm">
                          Gewerk aktualisieren
                        </Button>
                      </div>
                    </form>
                  </details>

                  <details className={collapsibleClassName}>
                    <summary className="flex cursor-pointer items-center justify-between text-sm font-semibold text-foreground">
                      <span>Mitglied hinzufügen</span>
                      <span className="text-xs text-muted-foreground group-open:hidden">Öffnen</span>
                      <span className="hidden text-xs text-muted-foreground group-open:inline">Schließen</span>
                    </summary>
                    <form className="mt-4 grid gap-3 md:grid-cols-3" action={addDepartmentMemberAction}>
                      <input type="hidden" name="departmentId" value={department.id} />
                      <input type="hidden" name="redirectPath" value="/mitglieder/produktionen/gewerke" />
                      <div className="space-y-1 md:col-span-1">
                        <label className="text-xs font-medium text-muted-foreground">Mitglied</label>
                        <select name="userId" className={selectClassName} required>
                          <option value="">Mitglied auswählen</option>
                          {availableUsers.map((user) => (
                            <option key={user.id} value={user.id}>
                              {formatUserName(user)}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground">Funktion</label>
                        <select name="role" className={selectClassName} defaultValue={DepartmentMembershipRole.member}>
                          {Object.values(DepartmentMembershipRole).map((role) => (
                            <option key={role} value={role}>
                              {ROLE_LABELS[role]}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground">Bezeichnung</label>
                        <Input name="title" maxLength={120} placeholder="z.B. Leitung" />
                      </div>
                      <div className="space-y-1 md:col-span-3">
                        <label className="text-xs font-medium text-muted-foreground">Notiz</label>
                        <Input name="note" maxLength={200} placeholder="optionale Notiz" />
                      </div>
                      <div className="md:col-span-3 flex justify-end">
                        <Button type="submit" size="sm">
                          Mitglied zuordnen
                        </Button>
                      </div>
                    </form>
                  </details>
                </CardContent>

                <div className="flex flex-col gap-3 border-t border-border/60 bg-background/60 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-foreground">Mission Control</p>
                    <p className="text-xs text-muted-foreground">
                      Aufgaben &amp; Termine findest du jetzt direkt im Gewerk-Hub.
                    </p>
                  </div>
                  <Button
                    asChild
                    size="sm"
                    className="inline-flex items-center gap-2 rounded-full bg-gradient-to-br from-primary via-primary/90 to-primary/80 px-4 text-primary-foreground shadow-[0_18px_40px_-28px_rgba(99,102,241,0.9)] transition hover:from-primary/90 hover:via-primary/80 hover:to-primary"
                  >
                    <Link href={detailHref} title={`${department.name} öffnen`}>
                      <Sparkles aria-hidden className="h-4 w-4" />
                      <span>Gewerk-Hub öffnen</span>
                    </Link>
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
