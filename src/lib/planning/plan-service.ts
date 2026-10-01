import type { MilestoneAnchor, MilestoneKind, Prisma } from "@prisma/client";

import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import {
  computeDueDates,
  computeSchedule,
  toDay,
  todayInTimeZone,
  type MilestoneHealth,
  type ScheduleDependency,
  type ScheduleMilestone,
} from "@/lib/planning/schedule";

/** Produktionsplan: Laden, Neuberechnen und Rechte (docs/Plan/projektplanung-plan.md). */

export const PLAN_MANAGE_PERMISSION = "PRIVATE.PRODUCTION.PLAN.MANAGE";

export const MILESTONE_KIND_LABELS: Record<MilestoneKind, string> = {
  milestone: "Meilenstein",
  deadline: "Frist",
  handover: "Abgabe",
  review: "Abnahme",
};

export const MILESTONE_ANCHOR_LABELS: Record<MilestoneAnchor, string> = {
  premiere: "Premiere",
  finalRehearsalStart: "Beginn Endprobenwoche",
  milestone: "anderer Meilenstein",
  fixed: "festes Datum",
};

type UserLike = Parameters<typeof hasPermission>[0];

const milestoneInclude = {
  department: { select: { id: true, name: true, color: true } },
  predecessors: { select: { fromId: true, lagDays: true } },
  _count: { select: { tasks: true } },
} satisfies Prisma.ShowMilestoneInclude;

export type PlanMilestone = {
  id: string;
  title: string;
  description: string | null;
  kind: MilestoneKind;
  anchorType: MilestoneAnchor;
  anchorMilestoneId: string | null;
  offsetDays: number;
  fixedDate: string | null;
  dueAt: string | null;
  doneAt: string | null;
  department: { id: string; name: string; color: string | null } | null;
  predecessors: { fromId: string; lagDays: number }[];
  slackDays: number | null;
  projectedAt: string | null;
  endangeredBy: string[];
  health: MilestoneHealth;
  tasksTotal: number;
  tasksDone: number;
  canComplete: boolean;
};

export type PlanRehearsal = { id: string; title: string; start: string; kind: string };

export type ProductionPlan = {
  showId: string;
  premiereAt: string | null;
  finalRehearsalStart: string | null;
  finalRehearsalEnd: string | null;
  today: string;
  milestones: PlanMilestone[];
  rehearsals: PlanRehearsal[];
  departments: { id: string; name: string; color: string | null }[];
  canManage: boolean;
  cycleError: string | null;
};

export async function canManagePlan(user: UserLike): Promise<boolean> {
  return hasPermission(user, PLAN_MANAGE_PERMISSION);
}

/** Lesen dürfen alle Produktionsmitglieder sowie Produktions- und Planverwaltung. */
export async function canViewPlan(user: UserLike, showId: string): Promise<boolean> {
  if (!user?.id) return false;
  if (
    (await hasPermission(user, "PRIVATE.PRODUCTION.SHOW.MANAGE")) ||
    (await canManagePlan(user))
  ) {
    return true;
  }
  const membership = await prisma.productionMembership.findFirst({
    where: { showId, userId: user.id, status: "active" },
    select: { id: true },
  });
  return Boolean(membership);
}

/** Gewerk-Leitungen, die einen Meilenstein ihres Gewerks abhaken dürfen. */
async function loadLeadDepartmentIds(userId: string | null | undefined, showId: string) {
  if (!userId) return new Set<string>();
  const rows = await prisma.departmentMembership.findMany({
    where: { userId, role: "lead", status: "active", department: { showId } },
    select: { departmentId: true },
  });
  return new Set(rows.map((row) => row.departmentId));
}

export async function canCompleteMilestone(user: UserLike, milestoneId: string) {
  if (!user?.id) return false;
  if (await canManagePlan(user)) return true;
  const milestone = await prisma.showMilestone.findUnique({
    where: { id: milestoneId },
    select: { showId: true, departmentId: true },
  });
  if (!milestone?.departmentId) return false;
  const leads = await loadLeadDepartmentIds(user.id, milestone.showId);
  return leads.has(milestone.departmentId);
}

function toScheduleInput(
  rows: {
    id: string;
    anchorType: MilestoneAnchor;
    anchorMilestoneId: string | null;
    offsetDays: number;
    fixedDate: Date | null;
    doneAt: Date | null;
  }[],
): ScheduleMilestone[] {
  return rows.map((row) => ({
    id: row.id,
    anchorType: row.anchorType,
    anchorMilestoneId: row.anchorMilestoneId,
    offsetDays: row.offsetDays,
    fixedDate: row.fixedDate,
    doneAt: row.doneAt,
  }));
}

/** Speichert die aus Anker + Offset berechneten Fälligkeiten aller Meilensteine einer Show. */
export async function recalculateShowPlan(
  showId: string,
  client: Prisma.TransactionClient | typeof prisma = prisma,
) {
  const show = await client.show.findUnique({
    where: { id: showId },
    select: { premiereAt: true, finalRehearsalWeekStart: true },
  });
  if (!show) return;
  const rows = await client.showMilestone.findMany({ where: { showId } });
  const dueDates = computeDueDates(toScheduleInput(rows), {
    premiereAt: show.premiereAt,
    finalRehearsalStart: show.finalRehearsalWeekStart,
  });
  for (const row of rows) {
    const next = dueDates.get(row.id) ?? null;
    if ((row.dueAt?.getTime() ?? null) === (next?.getTime() ?? null)) continue;
    await client.showMilestone.update({ where: { id: row.id }, data: { dueAt: next } });
  }
}

export async function loadProductionPlan(
  showId: string,
  user: UserLike,
  now: Date = new Date(),
): Promise<ProductionPlan | null> {
  const show = await prisma.show.findUnique({
    where: { id: showId },
    select: {
      id: true,
      premiereAt: true,
      finalRehearsalWeekStart: true,
      finalRehearsalWeekEnd: true,
    },
  });
  if (!show) return null;

  const [rows, dependencies, departments, rehearsals, canManage, leadIds, doneTasks] =
    await Promise.all([
      prisma.showMilestone.findMany({
        where: { showId },
        include: milestoneInclude,
        orderBy: [{ dueAt: "asc" }, { position: "asc" }],
      }),
      prisma.milestoneDependency.findMany({
        where: { from: { showId } },
        select: { fromId: true, toId: true, lagDays: true },
      }),
      prisma.department.findMany({
        where: { showId, archivedAt: null },
        select: { id: true, name: true, color: true },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      }),
      prisma.calendarEvent.findMany({
        where: {
          showId,
          departmentId: null,
          status: { not: "CANCELLED" },
          kind: { in: ["REHEARSAL", "PERFORMANCE"] },
          start: { gte: new Date(now.getTime() - 60 * 86_400_000) },
        },
        select: { id: true, title: true, start: true, kind: true },
        orderBy: { start: "asc" },
        take: 400,
      }),
      canManagePlan(user),
      loadLeadDepartmentIds(user?.id, showId),
      prisma.departmentTask.groupBy({
        by: ["milestoneId"],
        where: { milestone: { showId }, status: "done" },
        _count: { _all: true },
      }),
    ]);

  const anchors = {
    premiereAt: show.premiereAt,
    finalRehearsalStart: show.finalRehearsalWeekStart,
  };
  const scheduleDeps: ScheduleDependency[] = dependencies;
  let cycleError: string | null = null;
  let schedule: ReturnType<typeof computeSchedule> | null = null;
  try {
    schedule = computeSchedule(toScheduleInput(rows), scheduleDeps, anchors, now);
  } catch (error) {
    console.error("loadProductionPlan", error);
    cycleError = error instanceof Error ? error.message : "Plan konnte nicht berechnet werden.";
  }
  const doneByMilestone = new Map(
    doneTasks.map((entry) => [entry.milestoneId ?? "", entry._count._all]),
  );

  const iso = (date: Date | null | undefined) => (date ? date.toISOString() : null);
  const milestones: PlanMilestone[] = rows.map((row) => {
    const entry = schedule?.get(row.id);
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      kind: row.kind,
      anchorType: row.anchorType,
      anchorMilestoneId: row.anchorMilestoneId,
      offsetDays: row.offsetDays,
      fixedDate: iso(row.fixedDate),
      dueAt: iso(entry?.dueAt ?? row.dueAt),
      doneAt: iso(row.doneAt),
      department: row.department,
      predecessors: row.predecessors,
      slackDays: entry?.slackDays ?? null,
      projectedAt: iso(entry?.projectedAt),
      endangeredBy: entry?.endangeredBy ?? [],
      health: entry?.health ?? (row.doneAt ? "done" : "unscheduled"),
      tasksTotal: row._count.tasks,
      tasksDone: doneByMilestone.get(row.id) ?? 0,
      canComplete: canManage || Boolean(row.departmentId && leadIds.has(row.departmentId)),
    };
  });

  return {
    showId: show.id,
    premiereAt: iso(show.premiereAt),
    finalRehearsalStart: iso(show.finalRehearsalWeekStart),
    finalRehearsalEnd: iso(show.finalRehearsalWeekEnd),
    today: todayInTimeZone(now).toISOString(),
    milestones,
    rehearsals: rehearsals.map((event) => ({
      id: event.id,
      title: event.title,
      start: event.start.toISOString(),
      kind: event.kind,
    })),
    departments,
    canManage,
    cycleError,
  };
}
