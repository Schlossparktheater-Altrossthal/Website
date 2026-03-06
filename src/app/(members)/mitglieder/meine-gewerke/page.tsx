import Link from "next/link";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { addDays, format, startOfToday } from "date-fns";
import { de } from "date-fns/locale/de";
import { CalendarDays, CheckCircle2, Users } from "lucide-react";

import { PageHeader } from "@/components/members/page-header";
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
import { DepartmentSelect } from "./department-select";

type SummaryStat = { label: string; value: number; hint?: string; icon: ReactNode };

function HeaderStats({ stats }: { stats: SummaryStat[] }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card/60 p-4 shadow-sm">
      <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="flex items-start justify-between gap-3 rounded-xl border border-border/70 bg-gradient-to-br from-card/90 to-muted/50 px-4 py-3 shadow-sm"
            >
              <div className="space-y-1">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{stat.label}</p>
                <p className="text-xl font-bold leading-tight text-foreground">{stat.value}</p>
                {stat.hint ? <p className="text-xs text-muted-foreground">{stat.hint}</p> : null}
              </div>
              <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-border/80 bg-card/80 text-muted-foreground">
                {stat.icon}
              </span>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button size="sm" variant="outline" type="button" disabled>Aktion 1</Button>
          <Button size="sm" type="button" disabled>Aktion 2</Button>
        </div>
      </div>
    </div>
  );
}

export default async function MeineGewerkePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireAuth();
  const allowed = await hasPermission(session.user, "mitglieder.meine-gewerke");
  const canManageDepartments = await hasPermission(
    session.user,
    "mitglieder.produktionen",
  );
  const isBoard = hasRole(session.user, "board");
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

  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const selectedDepartmentParam = resolvedSearchParams?.department;
  const selectedDepartmentId = Array.isArray(selectedDepartmentParam)
    ? selectedDepartmentParam[0]
    : selectedDepartmentParam;

  if (!isBoard) {
    const isLead = await prisma.departmentMembership.count({
      where: { userId, role: "lead" },
    });

    if (isLead === 0) {
      return (
        <div className="space-y-6">
          <div className="text-sm text-red-600">Kein Zugriff auf die persönliche Gewerkeübersicht.</div>
        </div>
      );
    }
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
    .filter((membership) => isBoard || membership.role === "lead")
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

  const freezeUntilLabel = format(planningStart, "d. MMMM yyyy", { locale: de });
  const planningWindowLabel = format(planningEnd, "d. MMMM yyyy", { locale: de });
  const now = new Date();

  const selectedMembership = selectedDepartmentId
    ? memberships.find((membership) => membership.department.id === selectedDepartmentId)
    : null;

  const selectedDepartmentEventsCount = selectedMembership
    ? selectedMembership.department.events.filter((event) => event.end >= now).length
    : 0;

  const selectedDepartmentMemberCount = selectedMembership ? selectedMembership.department.memberships.length : 0;

  const summaryStats: SummaryStat[] = [
    { label: "Teams", value: memberships.length, hint: "Aktive Gewerke", icon: <Users className="h-4 w-4" aria-hidden /> },
    {
      label: "Termine",
      value: selectedDepartmentEventsCount,
      hint: "Anstehende Termine im gewählten Gewerk",
      icon: <CalendarDays className="h-4 w-4" aria-hidden />,
    },
    {
      label: "Mitglieder",
      value: selectedDepartmentMemberCount,
      hint: "Mitglieder im gewählten Gewerk",
      icon: <CheckCircle2 className="h-4 w-4" aria-hidden />,
    },
  ];

  const departmentOptions = memberships
    .map((membership) => {
      return {
        label: membership.department.name,
        value: membership.department.id,
      };
    })
    .filter((option): option is NonNullable<typeof option> => Boolean(option));

  if (memberships.length === 0) {
    return (
      <div className="space-y-10">
        <PageHeader
          title="Gewerkeplanung"
          description="Deine zentrale Übersicht für Teams, Aufgaben, Termine und Ansprechpartner in deinen Gewerken."
        />
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
      <PageHeader
        title="Gewerkeplanung"
        description="Deine zentrale Übersicht für Teams, Aufgaben, Termine und Ansprechpartner in deinen Gewerken."
      />
      {memberships.length ? <HeaderStats stats={summaryStats} /> : null}

      {departmentOptions.length ? <DepartmentSelect options={departmentOptions} selectedValue={selectedDepartmentId} /> : null}

      {selectedMembership ? (
        <div className="space-y-8">
          <DepartmentCard
            key={selectedMembership.id}
            membership={selectedMembership}
            userId={userId}
            planningStart={planningStart}
            planningEnd={planningEnd}
            blockedByUser={blockedByUser}
            freezeUntilLabel={freezeUntilLabel}
            planningWindowLabel={planningWindowLabel}
            now={now}
            teamLinkHref={canManageDepartments ? `/mitglieder/produktionen/gewerke/${selectedMembership.department.id}` : undefined}
            teamLinkLabel={canManageDepartments ? "Gewerk-Hub öffnen" : "Team ansehen"}
            measurementsByUser={costumeMeasurementsByUser}
            refreshPath="/mitglieder/meine-gewerke"
          />
        </div>
      ) : null}
    </div>
  );
}