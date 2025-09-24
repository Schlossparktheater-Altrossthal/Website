import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { addDays, format, startOfToday } from "date-fns";
import { de } from "date-fns/locale/de";
import type { LucideIcon } from "lucide-react";
import { CalendarDays, CheckCircle2, ListTodo, Ruler, Sparkles, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/prisma";
import { hasRole, requireAuth } from "@/lib/rbac";
import { hasPermission } from "@/lib/permissions";
import { sortMeasurements, type MeasurementType, type MeasurementUnit } from "@/data/measurements";

import {
  DATE_KEY_FORMAT,
  PLANNING_FREEZE_DAYS,
  PLANNING_LOOKAHEAD_DAYS,
  ROLE_BADGE_VARIANTS,
  ROLE_LABELS,
  type DepartmentMembershipWithDepartment,
} from "../utils";
import { DepartmentCard, type DepartmentMeasurementsByUser } from "../department-card";

type SummaryStat = { label: string; value: number; hint?: string; icon: LucideIcon };

type PageProps = { params: Promise<{ slug: string }> };

export default async function GewerkDetailPage({ params }: PageProps) {
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

  const resolvedParams = await params;
  const rawSlug = resolvedParams?.slug;
  if (!rawSlug) {
    notFound();
  }

  const slug = decodeURIComponent(rawSlug);

  const membershipRaw = await prisma.departmentMembership.findFirst({
    where: { userId, department: { slug } },
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

  if (!membershipRaw || !membershipRaw.department) {
    notFound();
  }

  const membership = membershipRaw as DepartmentMembershipWithDepartment;

  if (canManageDepartments) {
    redirect(`/mitglieder/produktionen/gewerke/${membership.department.id}`);
  }

  const today = startOfToday();
  const planningStart = addDays(today, PLANNING_FREEZE_DAYS);
  const planningEnd = addDays(planningStart, PLANNING_LOOKAHEAD_DAYS);

  const memberIds = membership.department.memberships.map((entry) => entry.userId);

  let departmentMeasurementsByUser: DepartmentMeasurementsByUser | undefined;
  if (membership.department.slug === "kostuem" && memberIds.length) {
    const measurementRecords = await prisma.memberMeasurement.findMany({
      where: { userId: { in: memberIds } },
      orderBy: { type: "asc" },
    });

    departmentMeasurementsByUser = {};
    for (const record of measurementRecords) {
      const existing = departmentMeasurementsByUser[record.userId] ?? [];
      existing.push({
        id: record.id,
        type: record.type as MeasurementType,
        value: record.value,
        unit: record.unit as MeasurementUnit,
        note: record.note,
        updatedAt: record.updatedAt,
      });
      departmentMeasurementsByUser[record.userId] = existing;
    }

    for (const [userId, entries] of Object.entries(departmentMeasurementsByUser)) {
      departmentMeasurementsByUser[userId] = sortMeasurements(entries);
    }
  }

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
  const now = new Date();

  const isEnsembleDepartment = membership.department.slug?.toLowerCase() === "ensemble";
  const tasksForStats = isEnsembleDepartment ? [] : membership.department.tasks;
  const activeTasksCount = tasksForStats.filter((task) => task.status !== "done").length;
  const completedTasksCount = tasksForStats.filter((task) => task.status === "done").length;

  const summaryStats: SummaryStat[] = [
    { label: "Teammitglieder", value: membership.department.memberships.length, hint: "Aktive Personen", icon: Users },
    { label: "Aktive Aufgaben", value: activeTasksCount, hint: "Offen & in Arbeit im Gewerk", icon: ListTodo },
    { label: "Abgeschlossen", value: completedTasksCount, hint: "Erledigte Gewerke-Aufgaben", icon: CheckCircle2 },
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
        <Link href="/mitglieder/meine-gewerke" title="Zur Übersicht">
          <Users aria-hidden className="h-4 w-4" />
          <span>Zur Übersicht</span>
        </Link>
      </Button>
    </>
  );

  const heroDescription =
    membership.department.description ??
    "Alle Aufgaben, Termine und Teamkontakte dieses Gewerks im Fokus.";

  const hero = (
    <section className="relative overflow-hidden rounded-3xl border border-border/60 bg-background/70 p-6 shadow-[0_28px_90px_-50px_rgba(99,102,241,0.8)] sm:p-10">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 -left-24 h-72 w-72 rounded-full bg-primary/25 blur-3xl" />
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
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: membership.department.color ?? "#94a3b8" }} />
                {membership.department.slug ?? "Gewerk"}
              </span>
            </div>
            <div className="space-y-4">
              <h1 className="font-serif text-3xl leading-tight text-foreground sm:text-4xl">{membership.department.name}</h1>
              <p className="max-w-2xl text-sm text-muted-foreground sm:text-base">{heroDescription}</p>
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
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-3">{headerActions}</div>
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
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground sm:text-sm">
          <span className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/80 px-3 py-1.5">
            <CalendarDays aria-hidden className="h-4 w-4" />
            Vorschläge berücksichtigen Sperrlisten bis {freezeUntilLabel}
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/80 px-3 py-1.5">
            Planungsfenster: {freezeUntilLabel} – {planningWindowLabel}
          </span>
        </div>
      </div>
    </section>
  );

  return (
    <div className="space-y-10">
      {hero}
      <DepartmentCard
        membership={membership}
        userId={userId}
        planningStart={planningStart}
        planningEnd={planningEnd}
        blockedByUser={blockedByUser}
        freezeUntilLabel={freezeUntilLabel}
        planningWindowLabel={planningWindowLabel}
        now={now}
        measurementsByUser={departmentMeasurementsByUser}
      />
    </div>
  );
}
