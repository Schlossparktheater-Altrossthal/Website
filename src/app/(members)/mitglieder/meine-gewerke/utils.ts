import { addDays, format, formatDistance } from "date-fns";
import { de } from "date-fns/locale/de";
import type { ComponentProps } from "react";
import type { Prisma, DepartmentMembershipRole, TaskStatus } from "@prisma/client";

import { Badge } from "@/components/ui/badge";

export const ROLE_LABELS: Record<DepartmentMembershipRole, string> = {
  lead: "Leitung",
  member: "Mitglied",
  deputy: "Vertretung",
  guest: "Gast",
};

type BadgeVariant = ComponentProps<typeof Badge>["variant"];

export const ROLE_BADGE_VARIANTS: Record<DepartmentMembershipRole, BadgeVariant> = {
  lead: "success",
  member: "muted",
  deputy: "info",
  guest: "secondary",
};

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  todo: "Offen",
  doing: "In Arbeit",
  done: "Erledigt",
};

export const TASK_STATUS_BADGES: Record<TaskStatus, BadgeVariant> = {
  todo: "muted",
  doing: "info",
  done: "success",
};

export const TASK_STATUS_ORDER: Record<TaskStatus, number> = {
  todo: 0,
  doing: 1,
  done: 2,
};

export const PLANNING_FREEZE_DAYS = 7;
export const PLANNING_LOOKAHEAD_DAYS = 60;
export const DATE_KEY_FORMAT = "yyyy-MM-dd";

export type MeetingSuggestion = { key: string; date: Date; label: string; shortLabel: string };

export function findMeetingSuggestions(
  memberIds: string[],
  planningStart: Date,
  planningEnd: Date,
  blockedByUser: Map<string, Set<string>>,
) {
  if (memberIds.length === 0) return [] as MeetingSuggestion[];

  const results: MeetingSuggestion[] = [];
  let current = planningStart;
  while (results.length < 3 && current <= planningEnd) {
    const key = format(current, DATE_KEY_FORMAT);
    const hasConflict = memberIds.some((id) => blockedByUser.get(id)?.has(key));
    if (!hasConflict) {
      results.push({
        key,
        date: new Date(current),
        label: format(current, "EEEE, d. MMMM yyyy", { locale: de }),
        shortLabel: format(current, "dd.MM.yyyy", { locale: de }),
      });
    }
    current = addDays(current, 1);
  }
  return results;
}

export function countBlockedDays(memberIds: string[], blockedByUser: Map<string, Set<string>>) {
  const blocked = new Set<string>();
  for (const memberId of memberIds) {
    const entries = blockedByUser.get(memberId);
    if (!entries) continue;
    for (const key of entries) {
      blocked.add(key);
    }
  }
  return blocked.size;
}

export function formatUserName(user?: { name: string | null; email: string | null }) {
  if (user?.name && user.name.trim()) return user.name;
  if (user?.email) return user.email;
  return "Unbekannt";
}

export function getDueMeta(date: Date, reference: Date) {
  return {
    relative: formatDistance(date, reference, { addSuffix: true, locale: de }),
    absolute: format(date, "EEEE, d. MMMM yyyy", { locale: de }),
    isOverdue: date.getTime() < reference.getTime(),
  };
}

export function hexToRgba(hex: string | null | undefined, alpha: number) {
  if (!hex) {
    return `rgba(99, 102, 241, ${alpha})`;
  }
  let normalized = hex.replace("#", "");
  if (normalized.length === 3) {
    normalized = normalized
      .split("")
      .map((char) => char + char)
      .join("");
  }
  if (normalized.length !== 6) {
    return hex;
  }
  const num = Number.parseInt(normalized, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export type DepartmentMembershipWithDepartment = Prisma.DepartmentMembershipGetPayload<{
  include: {
    department: {
      select: {
        id: true;
        name: true;
        description: true;
        color: true;
        slug: true;
        memberships: {
          include: {
            user: {
              select: {
                id: true;
                name: true;
                email: true;
              };
            };
          };
        };
        tasks: true;
      };
    };
  };
}>;
