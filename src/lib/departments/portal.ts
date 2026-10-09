import { normalizeModules } from "@/lib/departments/modules";
import type { DepartmentMembershipRole, TaskStatus } from "@prisma/client";

import { toEventResponseStatus } from "@/lib/calendar/responses";
import { AVATAR_USER_SELECT, toAvatarFields, type AvatarFields } from "@/lib/avatar-fields";
import { getUserDisplayName } from "@/lib/names";
import { departmentEventWhere } from "@/lib/departments/events";
import { prisma } from "@/lib/prisma";

const ROLE_ORDER: DepartmentMembershipRole[] = ["lead", "deputy", "member", "guest"];

export type TeamCard = {
  id: string;
  slug: string;
  name: string;
  color: string | null;
  role: DepartmentMembershipRole | null;
  leads: string[];
  memberCount: number;
  openTasks: number;
  myOpenTasks: number;
  nextEvent: { title: string; start: Date } | null;
  /** Nächste offene Frist des Gewerks im Produktionsplan. */
  nextDeadline: { title: string; dueAt: Date } | null;
  requestCount: number;
  /** Offene Anforderungen aus Szenen im Eingang. */
  inboxCount: number;
};

/** Gewerke der Produktion, in denen die Person aktiv ist (oder alle, für Regie/Board). */
export async function loadMyTeams(userId: string, showId: string, includeAll: boolean) {
  const now = new Date();
  const departments = await prisma.department.findMany({
    where: {
      showId,
      archivedAt: null,
      ...(includeAll ? {} : { memberships: { some: { userId, status: "active" } } }),
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      slug: true,
      name: true,
      color: true,
      memberships: {
        where: { status: { in: ["active", "requested"] }, user: { deactivatedAt: null } },
        select: {
          userId: true,
          role: true,
          status: true,
          user: { select: { firstName: true, lastName: true, name: true, email: true } },
        },
      },
      tasks: {
        where: { status: { not: "done" } },
        select: { assignments: { select: { userId: true } } },
      },
      milestones: {
        where: { doneAt: null, dueAt: { not: null } },
        orderBy: { dueAt: "asc" },
        take: 1,
        select: { title: true, dueAt: true },
      },
      _count: { select: { sceneRequirements: { where: { status: "open" } } } },
    },
  });

  // Nächster Termin je Gewerk, einschließlich gemeinsamer Termine mit Einladung.
  const upcoming = await prisma.calendarEvent.findMany({
    where: {
      AND: [
        departmentEventWhere(departments.map((department) => department.id)),
        { start: { gte: now } },
      ],
    },
    orderBy: { start: "asc" },
    select: {
      title: true,
      start: true,
      departmentId: true,
      audienceRules: { where: { type: "DEPARTMENT" }, select: { targetId: true } },
    },
  });
  const nextEvent = (departmentId: string) =>
    upcoming.find(
      (event) =>
        event.departmentId === departmentId ||
        event.audienceRules.some((rule) => rule.targetId === departmentId),
    ) ?? null;

  return departments.map<TeamCard>((department) => {
    const active = department.memberships.filter((entry) => entry.status === "active");
    const next = nextEvent(department.id);
    return {
      id: department.id,
      slug: department.slug,
      name: department.name,
      color: department.color,
      role: active.find((entry) => entry.userId === userId)?.role ?? null,
      leads: active
        .filter((entry) => entry.role === "lead")
        .map((entry) => getUserDisplayName(entry.user)),
      memberCount: active.length,
      openTasks: department.tasks.length,
      myOpenTasks: department.tasks.filter((task) =>
        task.assignments.some((entry) => entry.userId === userId),
      ).length,
      nextEvent: next ? { title: next.title, start: next.start } : null,
      nextDeadline: department.milestones[0]?.dueAt
        ? { title: department.milestones[0].title, dueAt: department.milestones[0].dueAt }
        : null,
      requestCount: department.memberships.length - active.length,
      inboxCount: department._count.sceneRequirements,
    };
  });
}

export type PortalMember = AvatarFields & {
  id: string;
  name: string;
  role: DepartmentMembershipRole;
  title: string | null;
};

/** Ein Gewerk der Produktion mit allem, was Übersicht und Team-Tab brauchen. */
export async function loadDepartmentPortal(showId: string, slug: string, userId: string) {
  const now = new Date();
  const department = await prisma.department.findUnique({
    where: { showId_slug: { showId, slug } },
    select: {
      id: true,
      slug: true,
      name: true,
      description: true,
      color: true,
      requiresJoinApproval: true,
      archivedAt: true,
      template: { select: { modules: true } },
      documents: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          fileName: true,
          mimeType: true,
          fileSize: true,
          createdAt: true,
          uploadedBy: {
            select: { id: true, firstName: true, lastName: true, name: true, email: true },
          },
        },
      },
      memberships: {
        where: { status: { in: ["active", "requested"] }, user: { deactivatedAt: null } },
        select: {
          role: true,
          status: true,
          title: true,
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              name: true,
              ...AVATAR_USER_SELECT,
            },
          },
        },
      },
      milestones: {
        where: { doneAt: null, dueAt: { not: null } },
        orderBy: { dueAt: "asc" },
        take: 1,
        select: {
          id: true,
          title: true,
          dueAt: true,
          tasks: { select: { status: true } },
        },
      },
      tasks: {
        orderBy: [{ dueAt: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
        select: {
          id: true,
          title: true,
          status: true,
          dueAt: true,
          milestone: { select: { dueAt: true } },
          assignments: { select: { userId: true } },
        },
      },
    },
  });
  if (!department || department.archivedAt) return null;

  const events = await prisma.calendarEvent.findMany({
    where: { AND: [departmentEventWhere([department.id]), { start: { gte: now } }] },
    orderBy: { start: "asc" },
    take: 10,
    select: {
      id: true,
      title: true,
      start: true,
      end: true,
      location: true,
      participants: { where: { userId }, select: { response: true } },
    },
  });

  const toMember = (entry: (typeof department.memberships)[number]): PortalMember => ({
    id: entry.user.id,
    name: getUserDisplayName(entry.user),
    ...toAvatarFields(entry.user),
    role: entry.role,
    title: entry.title,
  });
  const members = department.memberships
    .filter((entry) => entry.status === "active")
    .map(toMember)
    .sort(
      (a, b) =>
        ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role) ||
        a.name.localeCompare(b.name, "de"),
    );
  const requests = department.memberships
    .filter((entry) => entry.status === "requested")
    .map(toMember);

  // Karten ohne eigenes Datum erben die Frist ihres Meilensteins (docs/Plan/projektplanung-plan.md).
  const toTaskItem = ({
    id,
    title,
    status,
    dueAt,
    milestone,
  }: (typeof department.tasks)[number]) => {
    const due = dueAt ?? milestone?.dueAt ?? null;
    return {
      id,
      title,
      status,
      dueAt: due,
      inherited: !dueAt && Boolean(milestone?.dueAt),
      // Geerbte Fristen sind Kalendertage: überfällig erst nach Ablauf des Tages.
      overdue: Boolean(due && (dueAt ? due < now : due.getTime() + 86_400_000 <= now.getTime())),
    };
  };
  const openTasks = department.tasks.filter((task) => task.status !== "done");
  const myTasks = openTasks.filter((task) =>
    task.assignments.some((entry) => entry.userId === userId),
  );

  return {
    id: department.id,
    slug: department.slug,
    name: department.name,
    description: department.description,
    color: department.color,
    requiresJoinApproval: department.requiresJoinApproval,
    modules: normalizeModules(department.template.modules),
    files: department.documents.map((document) => ({
      id: document.id,
      fileName: document.fileName,
      mimeType: document.mimeType,
      fileSize: document.fileSize,
      createdAt: document.createdAt.toISOString(),
      uploaderId: document.uploadedBy?.id ?? null,
      uploaderName: document.uploadedBy ? getUserDisplayName(document.uploadedBy) : null,
    })),
    members,
    requests,
    viewerRole: members.find((member) => member.id === userId)?.role ?? null,
    events: events.map(({ participants, ...event }) => ({
      ...event,
      myResponse: toEventResponseStatus(participants[0]?.response ?? null),
    })),
    taskCounts: countTasks(department.tasks.map((task) => task.status)),
    myTasks: myTasks.map(toTaskItem),
    openTasks: openTasks.map(toTaskItem),
    nextMilestone: department.milestones[0]
      ? {
          id: department.milestones[0].id,
          title: department.milestones[0].title,
          dueAt: department.milestones[0].dueAt,
          tasksTotal: department.milestones[0].tasks.length,
          tasksDone: department.milestones[0].tasks.filter((task) => task.status === "done").length,
        }
      : null,
  };
}

function countTasks(statuses: TaskStatus[]) {
  return {
    todo: statuses.filter((status) => status === "todo").length,
    doing: statuses.filter((status) => status === "doing").length,
    done: statuses.filter((status) => status === "done").length,
  };
}

export type JoinableTeam = {
  id: string;
  name: string;
  color: string | null;
  description: string | null;
  requiresJoinApproval: boolean;
  requested: boolean;
};

/** Gewerke der Produktion, in denen die Person (noch) nicht aktiv ist – zum Beitreten/Anfragen. */
export async function loadJoinableTeams(userId: string, showId: string) {
  const departments = await prisma.department.findMany({
    where: {
      showId,
      archivedAt: null,
      memberships: { none: { userId, status: "active" } },
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      color: true,
      description: true,
      requiresJoinApproval: true,
      memberships: { where: { userId, status: "requested" }, select: { id: true } },
    },
  });
  return departments.map<JoinableTeam>(({ memberships, ...department }) => ({
    ...department,
    requested: memberships.length > 0,
  }));
}
