import Link from "next/link";
import { notFound } from "next/navigation";
import { addDays, format, startOfToday } from "date-fns";
import { de } from "date-fns/locale/de";
import { CheckCircle2, ListTodo, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { PageHeader } from "@/components/members/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";
import { hasPermission } from "@/lib/permissions";
import { sortMeasurements, type MeasurementType, type MeasurementUnit } from "@/data/measurements";

import {
  DATE_KEY_FORMAT,
  PLANNING_FREEZE_DAYS,
  PLANNING_LOOKAHEAD_DAYS,
  type DepartmentMembershipWithDepartment,
  isCastDepartmentUser,
} from "./utils";
import { DepartmentCard, type DepartmentMeasurementsByUser } from "./department-card";
import { DepartmentSelect } from "./department-select";

type SummaryStat = { label: string; value: number; hint?: string; icon: LucideIcon };

export default async function MeineGewerkePage() {
  const session = await requireAuth();
  const allowed = await hasPermission(session.user, "mitglieder.meine-gewerke");
  const canManageDepartments = await hasPermission(
    session.user,
    "mitglieder.produktionen",
  );
  if (!allowed) {
    return (
      <div className="space-y-6">
        <div className="text-sm text-red-600">Kein Zugriff auf die persönliche Gewerkeübersicht.</div>
      </div>
    );
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
              assignments: {
                include: {
                  user: {
                    select: {
                      id: true,
                      name: true,
                      email: true,
                      firstName: true,
                      lastName: true,
                    },
                  },
                },
              },
            },
            orderBy: { createdAt: "asc" },
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
          documents: {
            include: {
              uploadedBy: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  firstName: true,
                  lastName: true,
                },
              },
            },
            orderBy: { createdAt: "desc" },
          },
        },
      },
    },
  });

  const memberships = membershipsRaw
    .sort((a, b) => a.department.name.localeCompare(b.department.name, "de", { sensitivity: "base" }))
    .map((membership) => membership as DepartmentMembershipWithDepartment);

  let costumeMeasurementsByUser: DepartmentMeasurementsByUser | undefined;
  const costumeMemberships = memberships.filter((membership) => membership.department.slug === "kostuem");

  if (costumeMemberships.length) {
    costumeMeasurementsByUser = {};
    const costumeCastUserIds = new Set<string>();
    for (const membership of costumeMemberships) {
      for (const entry of membership.department.memberships) {
        if (isCastDepartmentUser(entry.user)) {
          costumeCastUserIds.add(entry.userId);
        }
      }
    }

    if (costumeCastUserIds.size) {
      const measurementRecords = await prisma.memberMeasurement.findMany({
        where: { userId: { in: Array.from(costumeCastUserIds) } },
        orderBy: { type: "asc" },
      });

      for (const record of measurementRecords) {
        const existing = costumeMeasurementsByUser[record.userId] ?? [];
        existing.push({
          id: record.id,
          type: record.type as MeasurementType,
          value: record.value,
          unit: record.unit as MeasurementUnit,
          note: record.note,
          updatedAt: record.updatedAt,
        });
        costumeMeasurementsByUser[record.userId] = existing;
      }

      for (const [userId, entries] of Object.entries(costumeMeasurementsByUser)) {
        costumeMeasurementsByUser[userId] = sortMeasurements(entries);
      }
    }
  }

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

  const taskTotals: Record<"todo" | "doing" | "done", number> = { todo: 0, doing: 0, done: 0 };
  for (const membership of memberships) {
    const isEnsembleDepartment = membership.department.slug?.toLowerCase() === "ensemble";
    if (isEnsembleDepartment) {
      continue;
    }
    for (const task of membership.department.tasks) {
      taskTotals[task.status] += 1;
    }
  }

  const freezeUntilLabel = format(planningStart, "d. MMMM yyyy", { locale: de });
  const planningWindowLabel = format(planningEnd, "d. MMMM yyyy", { locale: de });
  const now = new Date();
  const openTaskCount = taskTotals.todo + taskTotals.doing;

  const summaryStats: SummaryStat[] = [
    { label: "Teams", value: memberships.length, hint: "Aktive Gewerke", icon: Users },
    { label: "Offene Aufgaben", value: openTaskCount, hint: "Über alle Gewerke", icon: ListTodo },
    { label: "Erledigt", value: taskTotals.done, hint: "Abgeschlossen", icon: CheckCircle2 },
  ];

  const headerDescription =
    "Deine zentrale Übersicht für Teams, Aufgaben, Termine und Ansprechpartner in deinen Gewerken.";

  const hero = (
    <div className="space-y-6">
      <PageHeader title="Meine Gewerke" description={headerDescription} />
      <div className="border-b border-border/60" />
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
  );

  const departmentOptions = memberships
    .map((membership) => {
      const href = canManageDepartments
        ? `/mitglieder/produktionen/gewerke/${membership.department.id}`
        : membership.department.slug
          ? `/mitglieder/meine-gewerke/${encodeURIComponent(membership.department.slug)}`
          : null;

      if (!href) {
        return null;
      }

      return {
        label: membership.department.name,
        value: membership.department.id,
        href,
      };
    })
    .filter((option): option is NonNullable<typeof option> => Boolean(option));

  if (memberships.length === 0) {
    return (
      <div className="space-y-10">
        {hero}
        <section className="rounded-3xl border border-dashed border-primary/30 bg-background/70 p-6 text-sm text-muted-foreground shadow-inner sm:p-10 sm:text-base">
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-foreground sm:text-xl">Noch keine Gewerke</h2>
            <p>
              Aktuell bist du keinem Gewerk zugeordnet. In der Gewerkeübersicht kannst du beitreten und sofort Zugriff auf Aufgaben
              und Termine erhalten – bei Fragen hilft dir das Produktionsteam weiter.
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
              Terminvorschläge berücksichtigen Sperrlisten nach dem Freeze bis {freezeUntilLabel} sowie den Planungshorizont bis{" "}
              {planningWindowLabel}.
            </p>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {hero}
      {departmentOptions.length ? (
        <Card>
          <CardHeader>
            <CardTitle>Gewerk auswählen</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Wähle das Gewerk aus, in dem du Aufgaben hinzufügen oder deine zugewiesenen und erledigten Aufgaben prüfen willst.
              </p>
              <DepartmentSelect options={departmentOptions} />
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="space-y-8">
        {memberships.map((membership) => {
          const teamLinkHref = canManageDepartments
            ? `/mitglieder/produktionen/gewerke/${membership.department.id}`
            : membership.department.slug
              ? `/mitglieder/meine-gewerke/${encodeURIComponent(membership.department.slug)}`
              : undefined;
          const teamLinkLabel = canManageDepartments ? "Gewerk-Hub öffnen" : "Team ansehen";

          return (
            <DepartmentCard
              key={membership.id}
              membership={membership}
              userId={userId}
              planningStart={planningStart}
              planningEnd={planningEnd}
              blockedByUser={blockedByUser}
              freezeUntilLabel={freezeUntilLabel}
              planningWindowLabel={planningWindowLabel}
              now={now}
              teamLinkHref={teamLinkHref}
              teamLinkLabel={teamLinkLabel}
              measurementsByUser={costumeMeasurementsByUser}
              refreshPath="/mitglieder/meine-gewerke"
            />
          );
        })}
      </div>
    </div>
  );
}
