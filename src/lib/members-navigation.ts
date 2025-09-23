import type { MembersNavGroup, MembersNavItem } from "@/config/members-navigation";
import {
  MEMBERS_NAV_ASSIGNMENTS_GROUP_ID,
  MEMBERS_NAV_PRODUCTION_GROUP_ID,
  defaultMembersNavIcon,
  membersAssignmentsTodoItem,
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

function ensureTodoItem(items: MembersNavItem[]) {
  const todoHref = membersAssignmentsTodoItem.href;
  const existingIndex = items.findIndex((item) => item.href === todoHref);
  if (existingIndex !== -1) {
    return items;
  }

  const baseIndex = items.findIndex((item) => item.href === "/mitglieder/meine-gewerke");
  const todoItem: MembersNavItem = { ...membersAssignmentsTodoItem };
  if (baseIndex >= 0) {
    items.splice(baseIndex + 1, 0, todoItem);
  } else {
    items.push(todoItem);
  }
  return items;
}

function removeTodoItem(items: MembersNavItem[]) {
  const todoHref = membersAssignmentsTodoItem.href;
  const existingIndex = items.findIndex((item) => item.href === todoHref);
  if (existingIndex !== -1) {
    items.splice(existingIndex, 1);
  }
  return items;
}

export function selectMembersNavigation({
  groups = membersNavigation,
  hasDepartmentMemberships = false,
  activeProduction = null,
}: MembersNavigationSelectorOptions = {}): MembersNavGroup[] {
  return groups.map((group) => {
    if (group.id === MEMBERS_NAV_ASSIGNMENTS_GROUP_ID) {
      const items = cloneGroupItems(group.items);
      if (hasDepartmentMemberships) {
        ensureTodoItem(items);
      } else {
        removeTodoItem(items);
      }
      return { ...group, items };
    }

    if (group.id === MEMBERS_NAV_PRODUCTION_GROUP_ID) {
      const items = cloneGroupItems(group.items);
      if (activeProduction) {
        const href = `/mitglieder/produktionen/${activeProduction.id}`;
        const alreadyIncluded = items.some((item) => item.href === href);
        if (!alreadyIncluded) {
          const ariaLabelSuffix =
            activeProduction.title && activeProduction.title.trim()
              ? activeProduction.title
              : String(activeProduction.year);
          const overviewIcon =
            items.find((item) => item.href === "/mitglieder/produktionen")?.icon ??
            defaultMembersNavIcon;

          const activeItem: MembersNavItem = {
            href,
            label: "Aktive Produktion",
            permissionKey: "mitglieder.produktionen",
            icon: overviewIcon,
            badge: String(activeProduction.year),
            ariaLabel: `Aktive Produktion ${ariaLabelSuffix}`,
          };

          const overviewIndex = items.findIndex((item) => item.href === "/mitglieder/produktionen");
          if (overviewIndex >= 0) {
            items.splice(overviewIndex + 1, 0, activeItem);
          } else {
            items.unshift(activeItem);
          }
        }
      }
      return { ...group, items };
    }

    return { ...group, items: cloneGroupItems(group.items) };
  });
}

export function resolveAssignmentsGroupLabel(
  focus: AssignmentFocus,
  permissions: readonly string[] | Set<string> | undefined,
) {
  if (focus === "both") return "Proben & Gewerke";
  if (focus === "departments") return "Gewerke";
  if (focus === "rehearsals") return "Proben";

  const permissionSet =
    permissions instanceof Set ? permissions : new Set(permissions ?? []);
  const canSeeRehearsals = permissionSet.has("mitglieder.meine-proben");
  const canSeeDepartments = permissionSet.has("mitglieder.meine-gewerke");

  if (canSeeRehearsals && canSeeDepartments) return "Proben & Gewerke";
  if (canSeeDepartments) return "Gewerke";
  return "Proben";
}

export function filterMembersNavigationByPermissions(
  groups: readonly MembersNavGroup[],
  permissions: readonly string[] | undefined,
): MembersNavigationFilterResult {
  const permissionSet = permissions ? new Set(permissions) : null;

  const filteredGroups = groups
    .map((group) => {
      const items = group.items.filter((item) => {
        if (!item.permissionKey || !permissionSet) return true;
        return permissionSet.has(item.permissionKey);
      });
      return { ...group, items };
    })
    .filter((group) => group.items.length > 0);

  const flat = filteredGroups.flatMap((group) => group.items);
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
      return { ...group, items };
    })
    .filter((group) => group.items.length > 0);

  const flat = filteredGroups.flatMap((group) => group.items);
  return { groups: filteredGroups, flat };
}
