import type {
  MembersNavGroup,
  MembersNavItem,
  MembersNavSubgroup,
} from "@/config/members-navigation";
import {
  MEMBERS_NAV_FLAT_MAX_ITEMS,
  MEMBERS_NAV_PRODUCTION_GROUP_ID,
  defaultMembersNavIcon,
  membersNavigation,
  type MembersNavIcon,
} from "@/config/members-navigation";

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
    if (group.id === MEMBERS_NAV_PRODUCTION_GROUP_ID) {
      const items = cloneGroupItems(group.items);
      if (activeProduction) {
        const overviewIndex = items.findIndex((item) => item.href === "/mitglieder/produktionen");
        const overviewItem = overviewIndex !== -1 ? items[overviewIndex] : null;
        if (overviewIndex !== -1) {
          items.splice(overviewIndex, 1);
        }

        const activeHref = "/mitglieder/produktionen";
        const activeIndex = items.findIndex((item) => item.href === activeHref);
        if (activeIndex !== -1) {
          items.splice(activeIndex, 1);
        }

        const activeItem: MembersNavItem = {
          ...(overviewItem ?? {}),
          href: activeHref,
          label: overviewItem?.label ?? activeProduction.title ?? "Angezeigte Produktion",
          badge: String(activeProduction.year),
          ariaLabel: activeProduction.title
            ? `Angezeigte Produktion: ${activeProduction.title}`
            : "Angezeigte Produktion",
        };

        items.unshift(activeItem);
      }
      return { ...group, items, subgroups: cloneSubgroups(group.subgroups) };
    }

    return {
      ...group,
      items: cloneGroupItems(group.items),
      subgroups: cloneSubgroups(group.subgroups),
    };
  });
}

/**
 * Wer nur wenige Seiten sieht (typisch: Ensemble), bekommt eine flache Liste ohne
 * Gruppenüberschriften – einzelne Einträge unter eigener Überschrift wirken zerstückelt.
 */
export function flattenSmallMembersNavigation(
  groups: readonly MembersNavGroup[],
): MembersNavGroup[] {
  const items = groups.flatMap((group) => [
    ...group.items,
    ...(group.subgroups?.flatMap((sub) => sub.items) ?? []),
  ]);
  if (groups.length <= 1 || items.length > MEMBERS_NAV_FLAT_MAX_ITEMS) return [...groups];
  return [{ id: groups[0]!.id, label: "", items }];
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
        if (item.showForDepartmentLead && isDepartmentLead) return true;
        if (item.requiresBoardRole && !isBoard) return false;
        if (item.requiresDepartmentLead && !isDepartmentLead) return false;
        if (!item.permissionKey || !permissionSet) return true;
        return (
          permissionSet.has(item.permissionKey) ||
          Boolean(item.alsoPermissionKeys?.some((key) => permissionSet.has(key)))
        );
      });
      return { ...group, items, subgroups: cloneSubgroups(group.subgroups) };
    })
    .filter((group) => group.items.length > 0 || (group.subgroups?.length ?? 0) > 0);

  const flat = filteredGroups.flatMap((group) => [
    ...group.items,
    ...(group.subgroups?.flatMap((sub) => sub.items) ?? []),
  ]);
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

  const flat = filteredGroups.flatMap((group) => [
    ...group.items,
    ...(group.subgroups?.flatMap((sub) => sub.items) ?? []),
  ]);
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

/**
 * Symbol der Seite zu einer Route – dieselbe Quelle wie die Navigation
 * (docs/Plan/seiten-icons-plan.md). Listen, die auf eine Seite verlinken, holen ihr Icon hier.
 */
export function membersNavIcon(href: string): MembersNavIcon {
  return findMembersNavigationItem(href)?.item.icon ?? defaultMembersNavIcon;
}

/** Gruppen, die ohne gespeicherte Wahl zugeklappt starten (Admin-Bereiche). */
export const MEMBERS_NAV_DEFAULT_CLOSED_GROUPS = ["pages", "admin"] as const;
export const MEMBERS_NAV_CLOSED_GROUPS_COOKIE = "members_nav_closed";

/** Liest den Cookie-Wert; `undefined` (kein Cookie) ergibt die Voreinstellung. */
export function parseClosedNavGroups(value: string | undefined): string[] {
  if (value === undefined) return [...MEMBERS_NAV_DEFAULT_CLOSED_GROUPS];
  return decodeURIComponent(value)
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}
