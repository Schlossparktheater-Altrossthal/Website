import Link from "next/link";
import { DepartmentMembershipRole, TaskStatus } from "@prisma/client";
import { addDays, format, startOfToday } from "date-fns";
import { de } from "date-fns/locale/de";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";
import { hasPermission } from "@/lib/permissions";
import { getActiveProduction } from "@/lib/active-production";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProductionWorkspaceHeader } from "@/components/production/workspace-header";

import {
  createDepartmentAction,
  updateDepartmentAction,
  deleteDepartmentAction,
  addDepartmentMemberAction,
  updateDepartmentMemberAction,
  removeDepartmentMemberAction,
  createDepartmentTaskAction,
  updateDepartmentTaskAction,
  deleteDepartmentTaskAction,
} from "../actions";

const ROLE_LABELS: Record<DepartmentMembershipRole, string> = {
  lead: "Leitung",
  member: "Mitglied",
  deputy: "Vertretung",
  guest: "Gast",
};

const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  todo: "Offen",
  doing: "In Arbeit",
  done: "Erledigt",
};

const TASK_STATUS_VARIANT: Record<TaskStatus, "muted" | "info" | "success"> = {
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

const selectClassName =
  "h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const collapsibleClassName =
  "group rounded-lg border border-border/60 bg-background/70 p-4 shadow-sm transition [&_summary::-webkit-details-marker]:hidden";

export default async function ProduktionsGewerkePage() {
  const session = await requireAuth();
  const allowed = await hasPermission(session.user, "mitglieder.produktionen");
  if (!allowed) {
    return (
      <div className="rounded-lg border border-border/70 bg-background/60 p-6 text-sm text-muted-foreground">
        Du hast keinen Zugriff auf die Produktionsplanung.
      </div>
    );
  }

  const [departments, users, activeProduction] = await Promise.all([
    prisma.department.findMany({
      orderBy: { name: "asc" },
      include: {
        memberships: {
          include: {
            user: { select: { id: true, name: true, email: true } },
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
    }),
    prisma.user.findMany({
      orderBy: [
        { name: "asc" },
        { email: "asc" },
      ],
      select: { id: true, name: true, email: true },
    }),
    getActiveProduction(),
  ]);

  const today = startOfToday();
  const planningStart = addDays(today, PLANNING_FREEZE_DAYS);
  const planningEnd = addDays(planningStart, PLANNING_LOOKAHEAD_DAYS);

  const memberUserIds = new Set<string>();
  for (const department of departments) {
    for (const membership of department.memberships) {
      memberUserIds.add(membership.user.id);
    }
  }

  const blockedDays = memberUserIds.size
    ? await prisma.blockedDay.findMany({
        where: {
          userId: { in: Array.from(memberUserIds) },
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

  const freezeUntilLabel = format(planningStart, "d. MMMM yyyy", { locale: de });
  const planningWindowLabel = format(planningEnd, "d. MMMM yyyy", { locale: de });

  const findMeetingSuggestions = (memberIds: string[]) => {
    if (memberIds.length === 0) return [] as { key: string; date: Date; label: string; shortLabel: string }[];

    const results: { key: string; date: Date; label: string; shortLabel: string }[] = [];
    let current = planningStart;
    while (results.length < 3 && current <= planningEnd) {
      const key = format(current, DATE_KEY_FORMAT);
      const hasConflict = memberIds.some((id) => blockedByUser.get(id)?.has(key));
      if (!hasConflict) {
        results.push({
          key,
          date: current,
          label: format(current, "EEEE, d. MMMM yyyy", { locale: de }),
          shortLabel: format(current, "dd.MM.yyyy", { locale: de }),
        });
      }
      current = addDays(current, 1);
    }
    return results;
  };

  const totalMemberships = departments.reduce((count, department) => count + department.memberships.length, 0);
  const headerStats = [
    { label: "Gewerke", value: departments.length, hint: "Definierte Teams" },
    { label: "Zuordnungen", value: totalMemberships, hint: "Mitglieder mit Rollen" },
  ];

  const headerActions = (
    <Button asChild variant="outline" size="sm">
      <Link href="/mitglieder/produktionen">Zur Übersicht</Link>
    </Button>
  );

  const summaryActions = activeProduction ? (
    <>
      <Button asChild size="sm">
        <Link href="/mitglieder/produktionen/besetzung">Rollen &amp; Besetzung</Link>
      </Button>
      <Button asChild size="sm" variant="outline">
        <Link href="/mitglieder/produktionen/szenen">Szenen &amp; Breakdowns</Link>
      </Button>
    </>
  ) : null;

  return (
    <div className="space-y-10">
      <ProductionWorkspaceHeader
        title="Gewerke &amp; Zuständigkeiten"
        description="Strukturiere dein Produktionsteam, vergib Verantwortlichkeiten und halte Kontaktdaten zentral fest."
        activeWorkspace="departments"
        production={activeProduction}
        stats={headerStats}
        actions={headerActions}
        summaryActions={summaryActions}
      />

      <Card>
        <CardHeader className="space-y-2">
          <CardTitle className="text-lg font-semibold">Neues Gewerk anlegen</CardTitle>
          <p className="text-sm text-muted-foreground">
            Definiere Verantwortungsbereiche mit Farben, Beschreibungen und optionalem Slug für eine bessere Orientierung.
          </p>
        </CardHeader>
        <CardContent>
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
            </fieldset>
            <div className="space-y-1">
              <label className="text-sm font-medium">Beschreibung</label>
              <Textarea name="description" rows={2} maxLength={2000} placeholder="Kurzbeschreibung für das Gewerk" />
            </div>
            <div>
              <Button type="submit">Gewerk speichern</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        {departments.map((department) => {
          const departmentMemberIds = department.memberships.map((membership) => membership.user.id);
          const memberIdSet = new Set(departmentMemberIds);
          const availableUsers = users.filter((user) => !memberIdSet.has(user.id));
          const sortedTasks = [...department.tasks].sort((a, b) => {
            const statusDiff = TASK_STATUS_ORDER[a.status] - TASK_STATUS_ORDER[b.status];
            if (statusDiff !== 0) return statusDiff;
            const dueA = a.dueAt ? a.dueAt.getTime() : Number.MAX_SAFE_INTEGER;
            const dueB = b.dueAt ? b.dueAt.getTime() : Number.MAX_SAFE_INTEGER;
            if (dueA !== dueB) return dueA - dueB;
            return a.createdAt.getTime() - b.createdAt.getTime();
          });
          const meetingSuggestions = findMeetingSuggestions(departmentMemberIds);
          const blockedDatesForDepartment = new Set<string>();
          for (const memberId of departmentMemberIds) {
            const entries = blockedByUser.get(memberId);
            if (entries) {
              entries.forEach((key) => blockedDatesForDepartment.add(key));
            }
          }
          const blockedDatesCount = blockedDatesForDepartment.size;
          const hasMembers = departmentMemberIds.length > 0;

          return (
            <Card key={department.id} className="space-y-6">
              <CardHeader className="space-y-3">
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
              </CardHeader>

              <CardContent className="space-y-6">
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

                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-semibold">Teammitglieder</h3>
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

                  <div className="rounded-lg border border-dashed border-border/70 bg-background/50 p-4">
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Mitglied hinzufügen
                    </h4>
                    <form className="mt-3 grid gap-3 md:grid-cols-3" action={addDepartmentMemberAction}>
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
                  </div>
                </div>

                <div className="space-y-4 rounded-lg border border-border/60 bg-background/70 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold">Aufgaben &amp; ToDos</h3>
                      <p className="text-xs text-muted-foreground">
                        Koordiniere Aufgaben im Gewerk mit Status, Fälligkeiten und klaren Zuständigkeiten.
                      </p>
                    </div>
                    {sortedTasks.length ? (
                      <Badge variant="muted" size="sm">
                        {sortedTasks.length} {sortedTasks.length === 1 ? "Aufgabe" : "Aufgaben"}
                      </Badge>
                    ) : null}
                  </div>

                  {sortedTasks.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Noch keine Aufgaben erfasst. Lege die erste Aufgabe an, um fokussiert zu starten.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {sortedTasks.map((task) => {
                        const dueDateValue = task.dueAt ? format(task.dueAt, DATE_KEY_FORMAT) : "";
                        const dueDateReadable = task.dueAt
                          ? format(task.dueAt, "dd.MM.yyyy", { locale: de })
                          : null;
                        const assigneeName = task.assignee ? formatUserName(task.assignee) : null;
                        const creatorName = task.creator ? formatUserName(task.creator) : "System";

                        return (
                          <div
                            key={task.id}
                            className="space-y-3 rounded-md border border-border/60 bg-background/80 p-3 text-sm shadow-sm"
                          >
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="space-y-2">
                                <div className="flex flex-wrap items-center gap-2">
                                  <Badge variant={TASK_STATUS_VARIANT[task.status]} size="sm">
                                    {TASK_STATUS_LABELS[task.status]}
                                  </Badge>
                                  {dueDateReadable ? (
                                    <span className="text-xs text-muted-foreground">
                                      Fällig bis {dueDateReadable}
                                    </span>
                                  ) : null}
                                  <span className="text-xs text-muted-foreground">
                                    {assigneeName ? `Zuständig: ${assigneeName}` : "Noch keine Zuordnung"}
                                  </span>
                                </div>
                                <p className="text-base font-medium leading-snug">{task.title}</p>
                                {task.description ? (
                                  <p className="text-sm text-muted-foreground">{task.description}</p>
                                ) : null}
                                <p className="text-xs text-muted-foreground">Erstellt von {creatorName}</p>
                              </div>
                              <form action={deleteDepartmentTaskAction}>
                                <input type="hidden" name="taskId" value={task.id} />
                                <input
                                  type="hidden"
                                  name="redirectPath"
                                  value="/mitglieder/produktionen/gewerke"
                                />
                                <Button type="submit" variant="ghost" size="sm">
                                  Entfernen
                                </Button>
                              </form>
                            </div>

                            <details className="group rounded-md border border-border/50 bg-background/70 p-3 [&_summary::-webkit-details-marker]:hidden">
                              <summary className="flex cursor-pointer items-center justify-between text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                <span>Aufgabe bearbeiten</span>
                                <span className="text-[11px] text-muted-foreground group-open:hidden">Öffnen</span>
                                <span className="hidden text-[11px] text-muted-foreground group-open:inline">Schließen</span>
                              </summary>
                              <form
                                action={updateDepartmentTaskAction}
                                className="mt-3 grid gap-3 md:grid-cols-2"
                              >
                                <input type="hidden" name="taskId" value={task.id} />
                                <input
                                  type="hidden"
                                  name="redirectPath"
                                  value="/mitglieder/produktionen/gewerke"
                                />
                                <div className="space-y-1 md:col-span-2">
                                  <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                    Titel
                                  </label>
                                  <Input
                                    name="title"
                                    defaultValue={task.title}
                                    minLength={2}
                                    maxLength={160}
                                    required
                                  />
                                </div>
                                <div className="space-y-1 md:col-span-2">
                                  <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                    Beschreibung
                                  </label>
                                  <Textarea
                                    name="description"
                                    rows={3}
                                    maxLength={2000}
                                    defaultValue={task.description ?? ""}
                                  />
                                </div>
                                <div className="space-y-1">
                                  <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                    Status
                                  </label>
                                  <select name="status" defaultValue={task.status} className={selectClassName}>
                                    {Object.values(TaskStatus).map((status) => (
                                      <option key={status} value={status}>
                                        {TASK_STATUS_LABELS[status]}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                                <div className="space-y-1">
                                  <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                    Fällig bis
                                  </label>
                                  <Input type="date" name="dueAt" defaultValue={dueDateValue} />
                                </div>
                                <div className="space-y-1">
                                  <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                    Zuständiges Mitglied
                                  </label>
                                  <select
                                    name="assigneeId"
                                    defaultValue={task.assignee?.id ?? ""}
                                    className={selectClassName}
                                  >
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
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div className="rounded-md border border-dashed border-border/60 bg-background/60 p-4">
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Neue Aufgabe hinzufügen
                    </h4>
                    <form
                      className="mt-3 grid gap-3 md:grid-cols-2"
                      action={createDepartmentTaskAction}
                    >
                      <input type="hidden" name="departmentId" value={department.id} />
                      <input type="hidden" name="redirectPath" value="/mitglieder/produktionen/gewerke" />
                      <div className="space-y-1 md:col-span-2">
                        <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Titel
                        </label>
                        <Input
                          name="title"
                          placeholder="z.B. Lichtplan aktualisieren"
                          required
                          minLength={2}
                          maxLength={160}
                        />
                      </div>
                      <div className="space-y-1 md:col-span-2">
                        <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Beschreibung
                        </label>
                        <Textarea
                          name="description"
                          rows={3}
                          maxLength={2000}
                          placeholder="Optionale Details zur Aufgabe"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Status
                        </label>
                        <select name="status" className={selectClassName} defaultValue={TaskStatus.todo}>
                          {Object.values(TaskStatus).map((status) => (
                            <option key={status} value={status}>
                              {TASK_STATUS_LABELS[status]}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Fällig bis
                        </label>
                        <Input type="date" name="dueAt" />
                      </div>
                      <div className="space-y-1 md:col-span-2">
                        <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Zuständiges Mitglied
                        </label>
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
                </div>

                <div className="space-y-4 rounded-lg border border-border/60 bg-background/70 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold">Planung &amp; Termine</h3>
                      <p className="text-xs text-muted-foreground">
                        Terminvorschläge ab {freezeUntilLabel} und innerhalb der nächsten {PLANNING_LOOKAHEAD_DAYS} Tage
                        (bis {planningWindowLabel}).
                      </p>
                    </div>
                    <Button asChild variant="ghost" size="sm">
                      <Link href="/mitglieder/sperrliste">Sperrliste öffnen</Link>
                    </Button>
                  </div>

                  {!hasMembers ? (
                    <p className="text-sm text-muted-foreground">
                      Füge Mitglieder hinzu, um gemeinsame Termine zu planen.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-xs text-muted-foreground">
                        {blockedDatesCount > 0
                          ? `Markierte Sperrtage im Zeitraum: ${blockedDatesCount}`
                          : "Keine Sperrtage im Zeitraum – perfekte Gelegenheit für einen Termin."}
                      </p>
                      {meetingSuggestions.length === 0 ? (
                        <div className="rounded-md border border-dashed border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-400/60 dark:bg-amber-500/10 dark:text-amber-200">
                          Kein gemeinsamer freier Termin gefunden. Aktualisiert eure Sperrlisten oder erweitert den Zeitrahmen.
                        </div>
                      ) : (
                        <ul className="space-y-2">
                          {meetingSuggestions.map((slot) => (
                            <li
                              key={slot.key}
                              className="rounded-md border border-border/60 bg-background/80 p-3 text-sm shadow-sm"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-3">
                                <div>
                                  <p className="font-medium">{slot.label}</p>
                                  <p className="text-xs text-muted-foreground">
                                    Alle {departmentMemberIds.length} Mitglieder sind verfügbar.
                                  </p>
                                </div>
                                <Badge variant="success" size="sm">
                                  Alle verfügbar
                                </Badge>
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
