"use client";

import { ChevronDownIcon, ChevronsUpDownIcon, CloseIcon } from "@/components/ui/action-icons";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { LinkPendingIndicator } from "@/components/link-pending-indicator";
import {
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInput,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Text } from "@/components/ui/typography";
import {
  MEMBERS_NAV_ASSIGNMENTS_GROUP_ID,
  defaultMembersNavIcon,
  membersNavigation,
  type MembersNavGroup,
  type MembersNavItem,
} from "@/config/members-navigation";
import {
  MEMBERS_NAV_CLOSED_GROUPS_COOKIE,
  MEMBERS_NAV_DEFAULT_CLOSED_GROUPS,
  filterMembersNavigationByPermissions,
  filterMembersNavigationByQuery,
  resolveAssignmentsGroupLabel,
  selectMembersNavigation,
  type ActiveProductionNavInfo,
  type AssignmentFocus,
} from "@/lib/members-navigation";
import { cn } from "@/lib/utils";

export type { AssignmentFocus } from "@/lib/members-navigation";

export function isMembersNavItemActive(pathname: string, href: string) {
  if (pathname === href) return true;
  if (href === "/mitglieder") return false;
  return pathname.startsWith(`${href}/`);
}

interface ProductionAction {
  href: string;
  label: string;
  description?: string;
}

function MembersNavProductionSwitcher({
  activeProduction,
  activeProductionTitle,
  isCollapsed,
  currentPath,
}: {
  activeProduction?: ActiveProductionNavInfo;
  activeProductionTitle: string | null;
  isCollapsed: boolean;
  currentPath: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLLIElement | null>(null);
  const labelId = useId();
  const menuId = `${labelId}-production-menu`;

  useEffect(() => {
    setIsOpen(false);
  }, [currentPath]);

  useEffect(() => {
    if (isCollapsed) {
      setIsOpen(false);
    }
  }, [isCollapsed]);

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: MouseEvent | PointerEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const productionBadge = activeProduction
    ? String(activeProduction.year).slice(-2).padStart(2, "0")
    : "–";

  const primaryLabel = activeProductionTitle ?? "Produktion wählen";
  const secondaryLabel = activeProduction
    ? `Jahrgang ${activeProduction.year}`
    : "Produktion wählen";

  const actions = useMemo<ProductionAction[]>(() => {
    const items: ProductionAction[] = [];
    if (activeProduction) {
      items.push({
        href: "/mitglieder/produktionen",
        label: "Zur Produktion",
        description: "Plan, Gewerke, Stück und Zuweisung der aktiven Produktion.",
      });
    }
    items.push({
      href: "/mitglieder/produktionen?verwalten=1",
      label: "Produktionen verwalten",
      description: "Wechseln, neu anlegen oder archivieren.",
    });
    return items;
  }, [activeProduction]);

  return (
    <SidebarGroup className={cn(!isCollapsed && "pt-[var(--space-2xs)]")}>
      <SidebarGroupContent>
        <SidebarMenu>
          <SidebarMenuItem ref={containerRef}>
            <SidebarMenuButton
              id={labelId}
              size="lg"
              aria-expanded={isOpen}
              aria-controls={menuId}
              onClick={() => setIsOpen((value) => !value)}
              className={cn(
                "h-auto items-center gap-[var(--space-2xs)] px-[var(--space-xs)] py-[var(--space-2xs)]",
                isCollapsed && "justify-center px-0",
              )}
              tooltip={isCollapsed ? primaryLabel : undefined}
            >
              <div
                className={cn(
                  "flex shrink-0 items-center justify-center rounded-md border border-sidebar-border/60 bg-sidebar/70 font-semibold uppercase text-sidebar-foreground/80",
                  isCollapsed ? "size-8 text-xs" : "size-9 text-[13px]",
                )}
              >
                {productionBadge}
              </div>
              {!isCollapsed && (
                <div className="flex min-w-0 flex-1 flex-col text-left">
                  <span className="truncate text-sm font-semibold leading-5 text-sidebar-foreground">
                    {primaryLabel}
                  </span>
                  <span className="truncate text-xs text-sidebar-foreground/70">
                    {secondaryLabel}
                  </span>
                </div>
              )}
              {!isCollapsed && (
                <ChevronsUpDownIcon
                  className={cn(
                    "ml-auto h-4 w-4 shrink-0 text-sidebar-foreground/60 transition-transform",
                    isOpen && "rotate-180",
                  )}
                />
              )}
            </SidebarMenuButton>
            {isOpen ? (
              <div
                id={menuId}
                role="menu"
                aria-labelledby={labelId}
                className="absolute left-0 right-0 top-full z-50 mt-[var(--space-3xs)] rounded-lg border border-sidebar-border/60 bg-popover text-popover-foreground shadow-lg"
              >
                <div className="px-[var(--space-sm)] py-[var(--space-xs)]">
                  <Text asChild variant="eyebrow" className="text-muted-foreground/80">
                    <span>Aktive Produktion</span>
                  </Text>
                  <p className="mt-1 text-sm font-semibold leading-5">{primaryLabel}</p>
                  <p className="text-xs text-muted-foreground">
                    {activeProduction
                      ? `Jahrgang ${activeProduction.year}`
                      : "Noch keine aktive Produktion ausgewählt."}
                  </p>
                </div>
                <Separator className="bg-sidebar-border/60" />
                <ul className="flex flex-col gap-1 p-2">
                  {actions.map((action) => (
                    <li key={action.href}>
                      <Link
                        href={action.href}
                        onClick={() => setIsOpen(false)}
                        className="block rounded-md px-3 py-2 text-sm font-medium text-foreground transition hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                      >
                        <span className="block truncate">{action.label}</span>
                        {action.description ? (
                          <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                            {action.description}
                          </span>
                        ) : null}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

function renderItem(pathname: string, isCollapsed: boolean, item: MembersNavItem) {
  const active = isMembersNavItemActive(pathname, item.href);
  const Icon = item.icon ?? defaultMembersNavIcon;
  const badgeContent = item.badge;
  const hasBadgeValue =
    badgeContent !== undefined && badgeContent !== null && badgeContent !== false;
  const showBadge = !isCollapsed && hasBadgeValue;
  const isPrimitiveBadge = typeof badgeContent === "string" || typeof badgeContent === "number";
  const reserveBadgeSpace = showBadge && isPrimitiveBadge;
  return (
    <SidebarMenuItem key={item.href}>
      <SidebarMenuButton
        asChild
        isActive={active}
        tooltip={item.label}
        className={cn("gap-[var(--space-2xs)]", isCollapsed && "justify-center")}
      >
        <Link
          href={item.href}
          aria-label={item.ariaLabel ?? item.label}
          aria-current={active ? "page" : undefined}
        >
          <Icon
            className={cn(
              "h-4 w-4 shrink-0 transition-opacity",
              active ? "opacity-100" : "opacity-70",
              !isCollapsed && "mt-0.5",
            )}
          />
          {!isCollapsed ? (
            <div className={cn("flex min-w-0 flex-1 flex-col", reserveBadgeSpace && "pr-8")}>
              <span className="break-words text-sidebar-foreground leading-5">{item.label}</span>
            </div>
          ) : null}
          <LinkPendingIndicator
            className={cn("self-center", isCollapsed && "absolute right-1 top-1")}
          />
          {showBadge ? (
            isPrimitiveBadge ? (
              <SidebarMenuBadge className="border border-sidebar-border/60 bg-sidebar/50 text-eyebrow text-sidebar-foreground/70">
                {badgeContent}
              </SidebarMenuBadge>
            ) : (
              <span className="ml-auto flex shrink-0 items-center">{badgeContent}</span>
            )
          ) : null}
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

export interface MembersNavData {
  permissions?: readonly string[];
  activeProduction?: ActiveProductionNavInfo;
  assignmentFocus?: AssignmentFocus;
  hasDepartmentMemberships?: boolean;
  isBoard?: boolean;
  isDepartmentLead?: boolean;
  /** Seitensteuerung – kommt vom Server, damit ausgeblendete Einträge nicht erst kurz aufblitzen. */
  pageVisibility?: Record<string, boolean>;
}

/** Erlaubte und sichtbare Menügruppen – gemeinsam für Seitenleiste und mobile Leiste unten. */
export function useMembersNavGroups({
  permissions,
  activeProduction,
  assignmentFocus = "none",
  hasDepartmentMemberships = false,
  isBoard = false,
  isDepartmentLead = false,
  pageVisibility,
}: MembersNavData): MembersNavGroup[] {
  return useMemo(() => {
    const assignmentLabel = resolveAssignmentsGroupLabel(assignmentFocus, permissions ?? []);
    const labelledGroups = selectMembersNavigation({
      groups: membersNavigation,
      hasDepartmentMemberships,
      activeProduction: activeProduction ?? null,
    }).map((group) =>
      group.id === MEMBERS_NAV_ASSIGNMENTS_GROUP_ID ? { ...group, label: assignmentLabel } : group,
    );
    const { groups } = filterMembersNavigationByPermissions(labelledGroups, permissions, {
      isBoard,
      isDepartmentLead,
    });
    const visibilityMap = pageVisibility ?? {};
    return groups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => visibilityMap[item.href] ?? true),
        subgroups: group.subgroups
          ?.map((subgroup) => ({
            ...subgroup,
            items: subgroup.items.filter((item) => visibilityMap[item.href] ?? true),
          }))
          .filter((subgroup) => subgroup.items.length > 0),
      }))
      .filter((group) => group.items.length > 0 || (group.subgroups?.length ?? 0) > 0);
  }, [
    activeProduction,
    assignmentFocus,
    hasDepartmentMemberships,
    isBoard,
    isDepartmentLead,
    pageVisibility,
    permissions,
  ]);
}

function groupContainsPath(group: MembersNavGroup, pathname: string) {
  return [...group.items, ...(group.subgroups?.flatMap((sub) => sub.items) ?? [])].some((item) =>
    isMembersNavItemActive(pathname, item.href),
  );
}

export function MembersNav({
  closedGroups: initialClosedGroups,
  ...data
}: MembersNavData & {
  /** Zugeklappte Gruppen aus dem Cookie (serverseitig gelesen, damit nichts springt). */
  closedGroups?: readonly string[];
}) {
  const { activeProduction } = data;
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();
  const isFiltering = normalizedQuery.length > 0;
  const searchInputId = useId();
  const { state, isMobile, setOpenMobile } = useSidebar();
  const isCollapsed = !isMobile && state === "collapsed";

  const permittedGroups = useMembersNavGroups(data);

  const [closedGroups, setClosedGroups] = useState<ReadonlySet<string>>(() => {
    const closed = new Set(initialClosedGroups ?? MEMBERS_NAV_DEFAULT_CLOSED_GROUPS);
    // Die Gruppe der aktuellen Seite startet immer offen.
    for (const group of permittedGroups) {
      if (groupContainsPath(group, pathname)) closed.delete(group.id);
    }
    return closed;
  });

  const toggleGroup = useCallback((groupId: string) => {
    setClosedGroups((current) => {
      const next = new Set(current);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      document.cookie = `${MEMBERS_NAV_CLOSED_GROUPS_COOKIE}=${encodeURIComponent(
        [...next].join(","),
      )}; path=/; max-age=31536000; samesite=lax`;
      return next;
    });
  }, []);

  const { groups: visibleGroups, flat } = useMemo(
    () => filterMembersNavigationByQuery(permittedGroups, normalizedQuery),
    [permittedGroups, normalizedQuery],
  );

  const emptyStateMessage = isFiltering
    ? "Keine Bereiche gefunden. Passe die Suche an."
    : "Keine Bereiche verfügbar.";
  const firstMatch = flat[0];

  const activeProductionTitle = activeProduction
    ? activeProduction.title && activeProduction.title.trim()
      ? activeProduction.title
      : `Produktion ${activeProduction.year}`
    : null;

  return (
    <>
      {isMobile ? (
        <div className="flex items-center justify-between gap-2 border-b border-sidebar-border/60 px-4 py-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
          <span className="text-base font-semibold text-sidebar-foreground">Menü</span>
          <button
            type="button"
            onClick={() => setOpenMobile(false)}
            className="-mr-2 inline-flex size-10 items-center justify-center rounded-md text-sidebar-foreground/80 transition hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
            aria-label="Menü schließen"
          >
            <CloseIcon className="size-5" />
          </button>
        </div>
      ) : null}
      {!isCollapsed && (
        <>
          <SidebarHeader className="gap-[var(--space-xs)]">
            <label htmlFor={searchInputId} className="sr-only">
              Mitgliederbereiche durchsuchen
            </label>
            <SidebarInput
              id={searchInputId}
              type="search"
              inputMode="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape" && query) {
                  event.preventDefault();
                  setQuery("");
                  return;
                }

                if (event.key === "Enter" && firstMatch) {
                  event.preventDefault();
                  if (firstMatch.href && firstMatch.href !== pathname) {
                    router.push(firstMatch.href);
                  }
                }
              }}
              placeholder="Bereiche suchen"
              aria-label="Mitgliederbereiche durchsuchen"
            />
          </SidebarHeader>
          <SidebarSeparator />
        </>
      )}
      <SidebarContent
        className={cn("pb-[var(--space-sm)]", isCollapsed && "gap-0 py-[var(--space-2xs)]")}
      >
        <MembersNavProductionSwitcher
          activeProduction={activeProduction}
          activeProductionTitle={activeProductionTitle}
          isCollapsed={isCollapsed}
          currentPath={pathname}
        />

        {visibleGroups.length === 0 ? (
          <div className="mx-[var(--space-xs)] rounded-lg border border-dashed border-sidebar-border/60 bg-sidebar/40 p-[var(--space-xs)] text-sidebar-foreground/70">
            <Text variant="small" className="text-sidebar-foreground/70">
              {emptyStateMessage}
            </Text>
          </div>
        ) : (
          visibleGroups.map((group, index) => {
            // Eingeklappte Leiste und Suche zeigen immer alle Einträge.
            const isOpen = isCollapsed || isFiltering || !closedGroups.has(group.id);
            const contentId = `${searchInputId}-group-${group.id}`;
            return (
              <SidebarGroup key={group.id} className={cn(isCollapsed && "py-1")}>
                {isCollapsed && index > 0 ? <SidebarSeparator className="mx-0 mb-2" /> : null}
                <SidebarGroupLabel asChild className="group-data-[collapsible=icon]:hidden">
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.id)}
                    aria-expanded={isOpen}
                    aria-controls={contentId}
                    className="w-full cursor-pointer justify-between hover:text-sidebar-foreground"
                  >
                    {group.label}
                    <ChevronDownIcon
                      className={cn("size-3.5 transition-transform", !isOpen && "-rotate-90")}
                    />
                  </button>
                </SidebarGroupLabel>
                {isOpen ? (
                  <SidebarGroupContent id={contentId}>
                    <SidebarMenu>
                      {group.items.map((item) => renderItem(pathname, isCollapsed, item))}
                      {group.subgroups?.map((subgroup) => (
                        <details key={subgroup.id} open className="space-y-1">
                          <summary className="cursor-pointer list-none rounded-md px-2 py-1 text-xs font-medium text-sidebar-foreground/75 group-data-[collapsible=icon]:hidden">
                            {subgroup.label}
                          </summary>
                          {subgroup.items.map((item) => renderItem(pathname, isCollapsed, item))}
                        </details>
                      ))}
                    </SidebarMenu>
                  </SidebarGroupContent>
                ) : null}
              </SidebarGroup>
            );
          })
        )}
      </SidebarContent>
    </>
  );
}
