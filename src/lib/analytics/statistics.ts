import { AVATAR_USER_SELECT } from "@/lib/avatar-fields";
import { getUserDisplayName } from "@/lib/names";
import { prisma } from "@/lib/prisma";

import { loadPerformanceSummary } from "./performance-summary";
import type { PerformanceSummary } from "./performance-samples";
import {
  summarizeUsage,
  type UsageMember,
  type UsagePeriod,
  type UsageSummary,
} from "./usage-summary";

// Datenquelle für die Statistik-Seite (/mitglieder/server-analytics): Nutzung, Ladezeiten, Fehler.

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_PAGE_VIEWS = 100_000;

export type ErrorGroup = {
  source: "server" | "client";
  route: string;
  message: string;
  count: number;
  persons: number;
  lastSeen: string;
  browsers: string[];
  detail: string | null;
};

export type ErrorSummary = {
  total: number;
  previousTotal: number;
  groups: ErrorGroup[];
  byRoute: Record<string, number>;
};

export type StatisticsMember = UsageMember & {
  email: string | null;
  avatarSource: string | null;
  avatarUpdatedAt: string | null;
};

export type MemberStatistics = {
  days: UsagePeriod;
  generatedAt: string;
  usage: Omit<UsageSummary, "members"> & {
    members: StatisticsMember[];
    /** Aktive Konten ohne Besuch im Zeitraum */
    absentMembers: Array<{ userId: string; name: string }>;
  };
  performance: PerformanceSummary;
  errors: ErrorSummary;
};

async function loadUsage(days: UsagePeriod, now: Date): Promise<MemberStatistics["usage"]> {
  const since = new Date(now.getTime() - 2 * days * DAY_MS);
  const views = await prisma.analyticsPageView.findMany({
    where: { createdAt: { gte: since } },
    select: {
      path: true,
      createdAt: true,
      timeOnPageMs: true,
      deviceHint: true,
      analyticsSessionId: true,
      analyticsSession: { select: { userId: true } },
    },
    orderBy: { createdAt: "desc" },
    take: MAX_PAGE_VIEWS,
  });

  const userIds = [
    ...new Set(views.map((view) => view.analyticsSession?.userId).filter(Boolean)),
  ] as string[];
  const users = userIds.length
    ? await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, firstName: true, lastName: true, name: true, ...AVATAR_USER_SELECT },
      })
    : [];
  const names = new Map(users.map((user) => [user.id, getUserDisplayName(user)]));

  const byId = new Map(users.map((user) => [user.id, user]));

  const summary = summarizeUsage(
    views.map((view) => ({
      path: view.path,
      createdAt: view.createdAt,
      timeOnPageMs: view.timeOnPageMs,
      deviceHint: view.deviceHint,
      userId: view.analyticsSession?.userId ?? null,
      sessionKey: view.analyticsSessionId,
    })),
    days,
    now,
    names,
  );
  const absentUsers = await prisma.user.findMany({
    where: { deactivatedAt: null, id: { notIn: summary.members.map((member) => member.userId) } },
    select: { id: true, firstName: true, lastName: true, name: true, email: true },
  });
  return {
    ...summary,
    absentMembers: absentUsers
      .filter((user) => !user.email?.endsWith("@example.com"))
      .map((user) => ({ userId: user.id, name: getUserDisplayName(user) }))
      .sort((a, b) => a.name.localeCompare(b.name, "de")),
    members: summary.members.map((member) => {
      const user = byId.get(member.userId);
      return {
        ...member,
        email: user?.email ?? null,
        avatarSource: user?.avatarSource ?? null,
        avatarUpdatedAt: user?.avatarImageUpdatedAt?.toISOString() ?? null,
      };
    }),
  };
}

async function loadErrors(days: UsagePeriod, now: Date): Promise<ErrorSummary> {
  const since = new Date(now.getTime() - days * DAY_MS);
  const previousSince = new Date(now.getTime() - 2 * days * DAY_MS);
  const [events, previousTotal] = await Promise.all([
    prisma.analyticsErrorEvent.findMany({
      where: { createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
      take: 5_000,
    }),
    prisma.analyticsErrorEvent.count({
      where: { createdAt: { gte: previousSince, lt: since } },
    }),
  ]);

  const groups = new Map<string, ErrorGroup & { userIds: Set<string> }>();
  const byRoute: Record<string, number> = {};
  for (const event of events) {
    byRoute[event.route] = (byRoute[event.route] ?? 0) + 1;
    const key = `${event.source}\u0000${event.route}\u0000${event.message}`;
    let group = groups.get(key);
    if (!group) {
      // Ereignisse sind absteigend sortiert: das erste ist das neueste.
      group = {
        source: event.source === "server" ? "server" : "client",
        route: event.route,
        message: event.message,
        count: 0,
        persons: 0,
        lastSeen: event.createdAt.toISOString(),
        browsers: [],
        detail: event.detail,
        userIds: new Set(),
      };
      groups.set(key, group);
    }
    group.count += 1;
    if (event.userId) group.userIds.add(event.userId);
    if (event.browser && !group.browsers.includes(event.browser) && group.browsers.length < 5) {
      group.browsers.push(event.browser);
    }
  }

  return {
    total: events.length,
    previousTotal,
    groups: [...groups.values()]
      .map(({ userIds, ...group }) => ({ ...group, persons: userIds.size }))
      .sort((a, b) => b.count - a.count),
    byRoute,
  };
}

export async function loadMemberStatistics(days: UsagePeriod): Promise<MemberStatistics> {
  const now = new Date();
  const [usage, performance, errors] = await Promise.all([
    loadUsage(days, now),
    loadPerformanceSummary(days),
    loadErrors(days, now),
  ]);
  return { days, generatedAt: now.toISOString(), usage, performance, errors };
}
