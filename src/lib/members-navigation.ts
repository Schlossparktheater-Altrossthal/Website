import type { MembersNavGroup, MembersNavItem, MembersNavSubgroup } from "@/config/members-navigation";
import {
  MEMBERS_NAV_ASSIGNMENTS_GROUP_ID,
  MEMBERS_NAV_PRODUCTION_GROUP_ID,
  membersNavigation,
} from "@/config/members-navigation";

export type AssignmentFocus = "none" | "rehearsals" | "departments" | "both";

export interface ActiveProductionNavInfo {
  id: string;
  title: string | null;
  year: number;
}

export interface MembersNavigationSelectorOptions {
  groups?: readonly MembersNavGroup[];
  hasDepartmentMemberships?: boolean;
  activeProduction?: ActiveProductionNavInfo | null;
}

export interface MembersNavigationFilterResult {
  groups: MembersNavGroup[];
  flat: MembersNavItem[];
}

function cloneGroupItems(items: readonly MembersNavItem[]) {
  return items.map((item) => ({ ...item }));
}

function cloneSubgroups(subgroups: readonly MembersNavSubgroup[] | undefined) {
  return subgroups?.map((subgroup) => ({ ...subgroup, items: cloneGroupItems(subgroup.items) }));
}

export function selectMembersNavigation({
  groups = membersNavigation,
  activeProduction = null,
}: MembersNavigationSelectorOptions = {}): MembersNavGroup[] {
  return groups.map((group) => {
    if (group.id === MEMBERS_NAV_ASSIGNMENTS_GROUP_ID) {
      const items = cloneGroupItems(group.items);
      return { ...group, items, subgroups: cloneSubgroups(group.subgroups) };
    }

    if (group.id === MEMBERS_NAV_PRODUCTION_GROUP_ID) {
      const items = cloneGroupItems(group.items);
      if (activeProduction) {
        const overviewIndex = items.findIndex((item) => item.href === "/mitglieder/produktionen");
        const overviewItem = overviewIndex !== -1 ? items[overviewIndex] : null;
        if (overviewIndex !== -1) {
          items.splice(overviewIndex, 1);
        }

        const activeHref = `/mitglieder/produktionen/${activeProduction.id}`;
        const activeIndex = items.findIndex((item) => item.href === activeHref);
        if (activeIndex !== -1) {
          items.splice(activeIndex, 1);
        }

        const activeItem: MembersNavItem = {
          ...(overviewItem ?? {}),
          href: activeHref,
          label: overviewItem?.label ?? activeProduction.title ?? "Aktive Produktion",
          badge: String(activeProduction.year),
          ariaLabel:
            activeProduction.title
              ? `Aktive Produktion: ${activeProduction.title}`
              : "Aktive Produktion",
        };

        items.unshift(activeItem);
      }
      return { ...group, items, subgroups: cloneSubgroups(group.subgroups) };
    }

    return { ...group, items: cloneGroupItems(group.items), subgroups: cloneSubgroups(group.subgroups) };
  });
}

export function resolveAssignmentsGroupLabel(
  focus: AssignmentFocus,
  permissions: readonly string[] | Set<string> | undefined,
) {
  if (focus === "both") return "Gewerke";
  if (focus === "departments") return "Gewerke";
  if (focus === "rehearsals") return "Proben";

  const permissionSet =
    permissions instanceof Set ? permissions : new Set(permissions ?? []);
  const canSeeRehearsals =
    permissionSet.has("mitglieder.meine-proben");
  const canSeeDepartments = permissionSet.has("mitglieder.meine-gewerke");

  if (canSeeRehearsals && canSeeDepartments) return "Gewerke";
  if (canSeeDepartments) return "Gewerke";
  return "Proben";
}

export function filterMembersNavigationByPermissions(
  groups: readonly MembersNavGroup[],
  permissions: readonly string[] | undefined,
  options?: { isBoard?: boolean; isDepartmentLead?: boolean },
): MembersNavigationFilterResult {
  const permissionSet = permissions ? new Set(permissions) : null;
  const isBoard = Boolean(options?.isBoard);
  const isDepartmentLead = Boolean(options?.isDepartmentLead);

  const filteredGroups = groups
    .map((group) => {
      const items = group.items.filter((item) => {
        if (item.requiresBoardRole && !isBoard) return false;
        if (item.requiresDepartmentLead && !isDepartmentLead) return false;
        if (!item.permissionKey || !permissionSet) return true;
        return permissionSet.has(item.permissionKey);
      });
      return { ...group, items, subgroups: cloneSubgroups(group.subgroups) };
    })
    .filter((group) => group.items.length > 0 || (group.subgroups?.length ?? 0) > 0);

  const flat = filteredGroups.flatMap((group) => [...group.items, ...(group.subgroups?.flatMap((sub) => sub.items) ?? [])]);
  return { groups: filteredGroups, flat };
}

export function filterMembersNavigationByQuery(
  groups: readonly MembersNavGroup[],
  normalizedQuery: string,
): MembersNavigationFilterResult {
  if (!normalizedQuery) {
    const clonedGroups = groups.map((group) => ({ ...group, items: cloneGroupItems(group.items) }));
    const flat = clonedGroups.flatMap((group) => group.items);
    return { groups: clonedGroups, flat };
  }

  const filteredGroups = groups
    .map((group) => {
      const items = group.items.filter((item) =>
        item.label.toLowerCase().includes(normalizedQuery),
      );
      return { ...group, items, subgroups: cloneSubgroups(group.subgroups) };
    })
    .filter((group) => group.items.length > 0 || (group.subgroups?.length ?? 0) > 0);

  const flat = filteredGroups.flatMap((group) => [...group.items, ...(group.subgroups?.flatMap((sub) => sub.items) ?? [])]);
  return { groups: filteredGroups, flat };
}

export interface MembersNavigationItemMatch {
  group: MembersNavGroup;
  item: MembersNavItem;
}

export function findMembersNavigationItem(
  href: string,
  options: { groups?: readonly MembersNavGroup[] } = {},
): MembersNavigationItemMatch | null {
  const groupsToSearch = options.groups ?? membersNavigation;

  for (const group of groupsToSearch) {
    const item = group.items.find((candidate) => candidate.href === href);
    if (item) {
      return { group, item };
    }
  }

  return null;
}
