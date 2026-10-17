import { cache } from "react";

import { prisma } from "@/lib/prisma";
import { DIRECTION_PERMISSION_KEYS, hasPermission } from "@/lib/permissions";
import {
  CURRENT_PRODUCTION_STATUSES,
  currentDepartmentMembershipWhere,
} from "@/lib/produktionen/status";
import {
  loadDepartmentGrantSources,
  resolveMembershipKeys,
} from "@/lib/departments/permission-inheritance";

export { DIRECTION_HOME_PATH, isDirectionViewPathAllowed } from "@/lib/regie/paths";

export type DirectionShow = {
  id: string;
  title: string | null;
  year: number;
  /** Gewerk, über das das Recht kommt; `null` bei Rechten aus einer Rolle (z. B. Admin). */
  departmentName: string | null;
};

/**
 * Produktionen, deren Regie-Dashboard die Person sehen darf: aktuelle Gewerk-Mitgliedschaften,
 * die das Recht geben (Regie, Regieassistenz oder per Abweichung). Wer das Recht über eine
 * Rolle hat (Admin, Vorstand), sieht alle aktuellen Produktionen.
 */
export const getDirectionShows = cache(async (userId: string): Promise<DirectionShow[]> => {
  const memberships = await prisma.departmentMembership.findMany({
    where: { userId, ...currentDepartmentMembershipWhere() },
    select: {
      departmentId: true,
      role: true,
      department: {
        select: {
          name: true,
          templateId: true,
          show: { select: { id: true, title: true, year: true } },
        },
      },
    },
  });

  const contexts = memberships.map((membership) => ({
    departmentId: membership.departmentId,
    templateId: membership.department.templateId,
    role: membership.role,
  }));
  const { templateGrants, overrides } = await loadDepartmentGrantSources(contexts);

  const byShow = new Map<string, DirectionShow>();
  memberships.forEach((membership, index) => {
    const keys = resolveMembershipKeys(contexts[index], templateGrants, overrides);
    if (!keys.has(DIRECTION_PERMISSION_KEYS.dashboard)) return;
    const show = membership.department.show;
    if (!byShow.has(show.id)) {
      byShow.set(show.id, { ...show, departmentName: membership.department.name });
    }
  });
  if (byShow.size > 0) return sortDirectionShows([...byShow.values()]);

  if (!(await hasPermission({ id: userId }, DIRECTION_PERMISSION_KEYS.dashboard))) return [];
  const shows = await prisma.show.findMany({
    where: { status: { in: [...CURRENT_PRODUCTION_STATUSES] } },
    select: { id: true, title: true, year: true },
  });
  return sortDirectionShows(shows.map((show) => ({ ...show, departmentName: null })));
});

/** Neueste Produktion zuerst. */
export function sortDirectionShows(shows: DirectionShow[]): DirectionShow[] {
  return [...shows].sort(
    (a, b) => b.year - a.year || (a.title ?? "").localeCompare(b.title ?? "", "de"),
  );
}

/** Gewählte Produktion aus `?show=`, sonst die neueste. */
export function pickDirectionShow(
  shows: readonly DirectionShow[],
  requestedId: string | null | undefined,
): DirectionShow | null {
  if (!shows.length) return null;
  return shows.find((show) => show.id === requestedId) ?? shows[0];
}
