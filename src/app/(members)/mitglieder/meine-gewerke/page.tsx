import Link from "next/link";
import { notFound } from "next/navigation";
import { addDays, format, startOfToday } from "date-fns";
import { de } from "date-fns/locale/de";
import type { LucideIcon } from "lucide-react";
import { CalendarDays, CheckCircle2, Clock, ListTodo, Ruler, Sparkles, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/prisma";
import { hasRole, requireAuth } from "@/lib/rbac";
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

type SummaryStat = { label: string; value: number; hint?: string; icon: LucideIcon };

export default async function MeineGewerkePage() {
  const session = await requireAuth();
  const allowed = await hasPermission(session.user, "mitglieder.meine-gewerke");
  const hasMeasurementPermission = await hasPermission(
    session.user,
    "mitglieder.koerpermasse",
  );
  const canManageDepartments = await hasPermission(
    session.user,
    "mitglieder.produktionen",
  );
  const isEnsembleMember = hasRole(session.user, "cast");
  const canManageMeasurements = hasMeasurementPermission && isEnsembleMember;
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
            orderBy: { createdAt: "asc" },
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

  const openTaskCount = taskTotals.todo + taskTotals.doing;
  const freezeUntilLabel = format(planningStart, "d. MMMM yyyy", { locale: de });
  const planningWindowLabel = format(planningEnd, "d. MMMM yyyy", { locale: de });
  const now = new Date();

  const summaryStats: SummaryStat[] = [
    { label: "Gewerke", value: memberships.length, hint: "Aktive Zuordnungen", icon: Users },
    { label: "Aktive Aufgaben", value: openTaskCount, hint: "Offen & in Arbeit in deinen Gewerken", icon: ListTodo },
    { label: "Abgeschlossen", value: taskTotals.done, hint: "Erledigte Gewerke-Aufgaben", icon: CheckCircle2 },
  ];

  const headerActions = (
    <>
      {canManageMeasurements ? (
        <Button
          asChild
          size="sm"
          variant="outline"
          className="gap-2 rounded-full border-border/70 bg-background/80 px-4 backdrop-blur transition hover:border-primary/50 hover:bg-primary/10"
        >
          <Link href="/mitglieder/koerpermasse" title="Körpermaße verwalten">
            <Ruler aria-hidden className="h-4 w-4" />
            <span>Körpermaße</span>
          </Link>
        </Button>
      ) : null}
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
              Terminvorschläge berücksichtigen Sperrlisten nach dem Freeze bis {freezeUntilLabel} sowie den Planungshorizont bis{" "}
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
            />
          );
        })}
      </div>
    </div>
  );
}
