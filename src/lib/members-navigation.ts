import type {
  MembersNavGroup,
  MembersNavItem,
  MembersNavigationStructure,
} from "@/config/members-navigation";
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

export interface MembersNavigationSelection {
  primaryTabs: MembersNavGroup[];
  secondaryMenu: MembersNavGroup[];
  quickActions: MembersNavItem[];
}

export interface MembersNavigationSelectorOptions {
  structure?: MembersNavigationStructure;
  hasDepartmentMemberships?: boolean;
  activeProduction?: ActiveProductionNavInfo | null;
}

export interface MembersNavigationFilterResult
  extends MembersNavigationSelection {
  flat: MembersNavItem[];
}

function cloneGroupItems(items: readonly MembersNavItem[]) {
  return items.map((item) => ({ ...item }));
}

function cloneGroup(group: MembersNavGroup): MembersNavGroup {
  return { ...group, items: cloneGroupItems(group.items) };
}

function cloneGroups(groups: readonly MembersNavGroup[]) {
  return groups.map((group) => cloneGroup(group));
}

function cloneItems(items: readonly MembersNavItem[]) {
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
  structure = membersNavigation,
  hasDepartmentMemberships = false,
  activeProduction = null,
}: MembersNavigationSelectorOptions = {}): MembersNavigationSelection {
  const applyGroupTransforms = (group: MembersNavGroup): MembersNavGroup => {
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

    return cloneGroup(group);
  };

  const primaryTabs = structure.primaryTabs.map(applyGroupTransforms);
  const secondaryMenu = structure.secondaryMenu.map(applyGroupTransforms);

  let quickActions = cloneItems(structure.quickActions);
  if (!hasDepartmentMemberships) {
    quickActions = quickActions.filter(
      (item) => item.href !== membersAssignmentsTodoItem.href,
    );
  } else {
    const todoIncluded = quickActions.some(
      (item) => item.href === membersAssignmentsTodoItem.href,
    );
    if (!todoIncluded) {
      quickActions.unshift({ ...membersAssignmentsTodoItem });
    }
  }

  return { primaryTabs, secondaryMenu, quickActions };
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
  const canSeeRehearsals =
    permissionSet.has("mitglieder.meine-proben") ||
    permissionSet.has("mitglieder.kalender");
  const canSeeDepartments = permissionSet.has("mitglieder.meine-gewerke");

  if (canSeeRehearsals && canSeeDepartments) return "Proben & Gewerke";
  if (canSeeDepartments) return "Gewerke";
  return "Proben";
}

function filterGroupByPermissions(
  group: MembersNavGroup,
  permissionSet: Set<string> | null,
): MembersNavGroup {
  const items = group.items.filter((item) => {
    if (!item.permissionKey || !permissionSet) return true;
    return permissionSet.has(item.permissionKey);
  });
  return { ...group, items };
}

function filterQuickActionsByPermissions(
  actions: readonly MembersNavItem[],
  permissionSet: Set<string> | null,
): MembersNavItem[] {
  return actions
    .filter((item) => {
      if (!item.permissionKey || !permissionSet) return true;
      return permissionSet.has(item.permissionKey);
    })
    .map((item) => ({ ...item }));
}

function filterNavigationGroups(
  groups: readonly MembersNavGroup[],
  permissionSet: Set<string> | null,
): MembersNavGroup[] {
  return groups
    .map((group) => filterGroupByPermissions(group, permissionSet))
    .filter((group) => group.items.length > 0);
}

export function filterMembersNavigationByPermissions(
  selection: MembersNavigationSelection,
  permissions: readonly string[] | undefined,
): MembersNavigationFilterResult {
  const permissionSet = permissions ? new Set(permissions) : null;

  const primaryTabs = filterNavigationGroups(selection.primaryTabs, permissionSet);
  const secondaryMenu = filterNavigationGroups(selection.secondaryMenu, permissionSet);
  const quickActions = filterQuickActionsByPermissions(
    selection.quickActions,
    permissionSet,
  );

  const flat = [...primaryTabs, ...secondaryMenu].flatMap((group) => group.items);
  return { primaryTabs, secondaryMenu, quickActions, flat };
}

export function filterMembersNavigationByQuery(
  selection: MembersNavigationSelection,
  normalizedQuery: string,
): MembersNavigationFilterResult {
  if (!normalizedQuery) {
    const primaryTabs = cloneGroups(selection.primaryTabs);
    const secondaryMenu = cloneGroups(selection.secondaryMenu);
    const quickActions = cloneItems(selection.quickActions);
    const flat = [...primaryTabs, ...secondaryMenu].flatMap((group) => group.items);
    return { primaryTabs, secondaryMenu, quickActions, flat };
  }

  const includesQuery = (item: MembersNavItem) =>
    item.label.toLowerCase().includes(normalizedQuery);

  const primaryTabs = selection.primaryTabs
    .map((group) => {
      const items = group.items.filter(includesQuery);
      return { ...group, items };
    })
    .filter((group) => group.items.length > 0);

  const secondaryMenu = selection.secondaryMenu
    .map((group) => {
      const items = group.items.filter(includesQuery);
      return { ...group, items };
    })
    .filter((group) => group.items.length > 0);

  const quickActions = selection.quickActions
    .filter(includesQuery)
    .map((item) => ({ ...item }));

  const flat = [...primaryTabs, ...secondaryMenu].flatMap((group) => group.items);
  return { primaryTabs, secondaryMenu, quickActions, flat };
}

export interface MembersNavigationItemMatch {
  group: MembersNavGroup;
  item: MembersNavItem;
}

export function findMembersNavigationItem(
  href: string,
  options: { structure?: MembersNavigationStructure } = {},
): MembersNavigationItemMatch | null {
  const structure = options.structure ?? membersNavigation;
  const groupsToSearch = [...structure.primaryTabs, ...structure.secondaryMenu];

  for (const group of groupsToSearch) {
    const item = group.items.find((candidate) => candidate.href === href);
    if (item) {
      return { group, item };
    }
  }

  return null;
}

export function collectMembersNavigationItems(
  selection: MembersNavigationSelection | MembersNavigationFilterResult,
): MembersNavItem[] {
  return [
    ...selection.primaryTabs.flatMap((group) => group.items.map((item) => ({ ...item }))),
    ...selection.secondaryMenu.flatMap((group) => group.items.map((item) => ({ ...item }))),
    ...selection.quickActions.map((item) => ({ ...item })),
  ];
}
