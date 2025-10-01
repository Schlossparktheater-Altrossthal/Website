"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

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
import type { MembersNavGroup, MembersNavItem } from "@/config/members-navigation";
import {
  MEMBERS_NAV_ASSIGNMENTS_GROUP_ID,
  defaultMembersNavIcon,
  membersNavigation,
} from "@/config/members-navigation";
import {
  filterMembersNavigationByPermissions,
  filterMembersNavigationByQuery,
  resolveAssignmentsGroupLabel,
  selectMembersNavigation,
  type ActiveProductionNavInfo,
  type AssignmentFocus,
} from "@/lib/members-navigation";
import { cn } from "@/lib/utils";
import { ChevronsUpDown, Search } from "lucide-react";
import { DropdownMenu } from "@/components/ui/dropdown-menu";

export type { AssignmentFocus } from "@/lib/members-navigation";

function isActive(pathname: string, href: string) {
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
    : "In der Übersicht auswählen";

  const actions = useMemo<ProductionAction[]>(() => {
    const items: ProductionAction[] = [
      {
        href: "/mitglieder/produktionen",
        label: activeProduction ? "Produktion wechseln" : "Produktion auswählen",
        description: "Öffne die Produktionsübersicht und lege die aktive Saison fest.",
      },
    ];

    if (activeProduction) {
      items.push({
        href: `/mitglieder/produktionen/${activeProduction.id}`,
        label: "Aktive Produktion öffnen",
        description: "Direkter Zugriff auf Rollen, Szenen und Aufgaben dieser Produktion.",
      });
    }

    items.push({
      href: "/mitglieder/produktionen#produktion-anlegen",
      label: "Neue Produktion anlegen",
      description: "Starte eine neue Saison und strukturiere Teams, Szenen und Zuständigkeiten.",
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
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-sidebar-border/60 bg-sidebar/70 text-[13px] font-semibold uppercase text-sidebar-foreground/80">
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
              <ChevronsUpDown
                className={cn(
                  "ml-auto h-4 w-4 shrink-0 text-sidebar-foreground/60 transition-transform",
                  isOpen && !isCollapsed && "rotate-180",
                )}
              />
            </SidebarMenuButton>
            {isOpen ? (
              <div
                id={menuId}
                role="menu"
                aria-labelledby={labelId}
                className="absolute left-0 right-0 top-full z-50 mt-[var(--space-3xs)] rounded-lg border border-sidebar-border/60 bg-popover text-popover-foreground shadow-lg"
              >
                <div className="px-[var(--space-sm)] py-[var(--space-xs)]">
                  <Text
                    asChild
                    variant="eyebrow"
                    className="text-muted-foreground/80"
                  >
                    <span>Aktive Produktion</span>
                  </Text>
                  <p className="mt-1 text-sm font-semibold leading-5">
                    {primaryLabel}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {activeProduction
                      ? `Jahrgang ${activeProduction.year}`
                      : "Wähle in der Übersicht eine aktive Produktion aus."}
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

function MembersNavigationGroups({
  groups,
  pathname,
  isCollapsed,
  onNavigate,
}: {
  groups: readonly MembersNavGroup[];
  pathname: string;
  isCollapsed: boolean;
  onNavigate?: () => void;
}) {
  return groups.map((group) => (
    <SidebarGroup key={group.id}>
      <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {group.items.map((item) => {
            const active = isActive(pathname, item.href);
            const Icon = item.icon ?? defaultMembersNavIcon;
            const badgeContent = item.badge;
            const hasBadgeValue =
              badgeContent !== undefined &&
              badgeContent !== null &&
              badgeContent !== false;
            const showBadge = !isCollapsed && hasBadgeValue;
            const isPrimitiveBadge =
              typeof badgeContent === "string" ||
              typeof badgeContent === "number";
            const reserveBadgeSpace = showBadge && isPrimitiveBadge;

            return (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                  asChild
                  isActive={active}
                  tooltip={item.label}
                  className={cn(
                    "gap-[var(--space-2xs)]",
                    isCollapsed && "justify-center",
                  )}
                >
                  <Link
                    href={item.href}
                    aria-label={item.ariaLabel ?? item.label}
                    aria-current={active ? "page" : undefined}
                    onClick={onNavigate}
                  >
                    <Icon
                      className={cn(
                        "h-4 w-4 shrink-0 transition-opacity",
                        active ? "opacity-100" : "opacity-70",
                        !isCollapsed && "mt-0.5",
                      )}
                    />
                    {!isCollapsed ? (
                      <div
                        className={cn(
                          "flex min-w-0 flex-1 flex-col",
                          reserveBadgeSpace && "pr-8",
                        )}
                      >
                        <span className="break-words text-sidebar-foreground leading-5">
                          {item.label}
                        </span>
                      </div>
                    ) : null}
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
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  ));
}

function MembersPrimaryRailItem({
  tab,
  pathname,
  onNavigate,
}: {
  tab: MembersNavGroup;
  pathname: string;
  onNavigate?: () => void;
}) {
  const router = useRouter();
  const [primaryItem, ...overflowItems] = tab.items;
  if (!primaryItem) {
    return null;
  }

  const Icon = primaryItem.icon ?? defaultMembersNavIcon;
  const tabIsActive = tab.items.some((item) => isActive(pathname, item.href));

  return (
    <SidebarMenuItem>
      <div className="flex w-full items-center justify-center gap-1">
        <SidebarMenuButton
          asChild
          isActive={tabIsActive}
          tooltip={tab.label}
          className="h-9 w-9 justify-center"
        >
          <Link
            href={primaryItem.href}
            aria-label={primaryItem.ariaLabel ?? tab.label}
            aria-current={tabIsActive ? "page" : undefined}
            onClick={onNavigate}
          >
            <Icon
              className={cn(
                "h-4 w-4",
                tabIsActive ? "opacity-100" : "opacity-70",
              )}
            />
          </Link>
        </SidebarMenuButton>
        {overflowItems.length > 0 ? (
          <DropdownMenu
            className="shrink-0"
            align="left"
            items={overflowItems.map((item) => {
              const ItemIcon = item.icon ?? defaultMembersNavIcon;
              return {
                label: item.label,
                icon: <ItemIcon className="h-4 w-4" aria-hidden="true" />,
                onClick: () => {
                  router.push(item.href);
                  onNavigate?.();
                },
              };
            })}
          />
        ) : null}
      </div>
    </SidebarMenuItem>
  );
}

function MembersPrimaryTabs({
  tabs,
  pathname,
  isCollapsed,
  isMobile,
  onNavigate,
}: {
  tabs: readonly MembersNavGroup[];
  pathname: string;
  isCollapsed: boolean;
  isMobile: boolean;
  onNavigate?: () => void;
}) {
  if (tabs.length === 0) {
    return null;
  }

  const showRail = isCollapsed && !isMobile;

  if (showRail) {
    return (
      <nav aria-label="Primäre Bereiche" className="mt-[var(--space-sm)]">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="flex flex-col gap-[var(--space-3xs)]">
              {tabs.map((tab) => (
                <MembersPrimaryRailItem
                  key={tab.id}
                  tab={tab}
                  pathname={pathname}
                  onNavigate={onNavigate}
                />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </nav>
    );
  }

  return (
    <div className="flex flex-col gap-[var(--space-sm)]">
      <MembersNavigationGroups
        groups={tabs}
        pathname={pathname}
        isCollapsed={isCollapsed}
        onNavigate={onNavigate}
      />
    </div>
  );
}

function MembersSecondaryDrawer({
  groups,
  pathname,
  isCollapsed,
  onNavigate,
}: {
  groups: readonly MembersNavGroup[];
  pathname: string;
  isCollapsed: boolean;
  onNavigate?: () => void;
}) {
  const [open, setOpen] = useState(false);

  if (groups.length === 0) {
    return null;
  }

  if (isCollapsed) {
    return (
      <div className="mt-[var(--space-sm)]">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="w-full rounded-md border border-sidebar-border/60 bg-sidebar/60 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-sidebar-foreground/70 transition hover:bg-sidebar/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-expanded={open}
        >
          Weitere Bereiche
        </button>
        {open ? (
          <div className="mt-[var(--space-xs)] space-y-[var(--space-sm)] rounded-lg border border-sidebar-border/60 bg-sidebar/80 p-[var(--space-sm)] shadow-lg">
            <MembersNavigationGroups
              groups={groups}
              pathname={pathname}
              isCollapsed={false}
              onNavigate={() => {
                setOpen(false);
                onNavigate?.();
              }}
            />
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="mt-[var(--space-sm)] flex flex-col gap-[var(--space-sm)]">
      <MembersNavigationGroups
        groups={groups}
        pathname={pathname}
        isCollapsed={isCollapsed}
        onNavigate={onNavigate}
      />
    </div>
  );
}

function MembersContextActions({
  quickActions,
  pathname,
  isCollapsed,
  onNavigate,
  onOpenCommandPalette,
  showCommandAction = true,
}: {
  quickActions: readonly MembersNavItem[];
  pathname: string;
  isCollapsed: boolean;
  onNavigate?: () => void;
  onOpenCommandPalette?: () => void;
  showCommandAction?: boolean;
}) {
  const hasQuickActions = quickActions.length > 0;
  const showSearchAction = Boolean(onOpenCommandPalette) && showCommandAction;

  if (!hasQuickActions && !showSearchAction) {
    return null;
  }

  if (isCollapsed) {
    return (
      <SidebarGroup>
        <SidebarGroupContent>
          <SidebarMenu className="flex flex-col gap-[var(--space-3xs)]">
            {quickActions.map((action) => {
              const Icon = action.icon ?? defaultMembersNavIcon;
              const active = isActive(pathname, action.href);
              return (
                <SidebarMenuItem key={action.href}>
                  <SidebarMenuButton
                    asChild
                    tooltip={action.label}
                    isActive={active}
                    className="h-9 w-9 justify-center"
                  >
                    <Link
                      href={action.href}
                      aria-label={action.ariaLabel ?? action.label}
                      aria-current={active ? "page" : undefined}
                      onClick={onNavigate}
                    >
                      <Icon
                        className={cn(
                          "h-4 w-4",
                          active ? "opacity-100" : "opacity-70",
                        )}
                      />
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
            {showSearchAction ? (
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => {
                    onOpenCommandPalette?.();
                    onNavigate?.();
                  }}
                  tooltip="Navigation durchsuchen"
                  className="h-9 w-9 justify-center"
                >
                  <Search className="h-4 w-4" aria-hidden="true" />
                </SidebarMenuButton>
              </SidebarMenuItem>
            ) : null}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    );
  }

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Schnellzugriffe</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {quickActions.map((action) => {
            const Icon = action.icon ?? defaultMembersNavIcon;
            const active = isActive(pathname, action.href);
            return (
              <SidebarMenuItem key={action.href}>
                <SidebarMenuButton
                  asChild
                  isActive={active}
                  className="gap-[var(--space-2xs)]"
                >
                  <Link
                    href={action.href}
                    aria-label={action.ariaLabel ?? action.label}
                    aria-current={active ? "page" : undefined}
                    onClick={onNavigate}
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                    <span className="truncate text-sm leading-5">{action.label}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
          {showSearchAction ? (
            <SidebarMenuItem>
              <SidebarMenuButton
                type="button"
                onClick={() => {
                  onOpenCommandPalette?.();
                  onNavigate?.();
                }}
                className="gap-[var(--space-2xs)]"
              >
                <Search className="h-4 w-4" aria-hidden="true" />
                <span className="truncate text-sm leading-5">
                  Navigation durchsuchen
                </span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ) : null}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

export function MembersNav({
  permissions,
  activeProduction,
  assignmentFocus = "none",
  hasDepartmentMemberships = false,
  onOpenCommandPalette,
}: {
  permissions?: readonly string[];
  activeProduction?: ActiveProductionNavInfo;
  assignmentFocus?: AssignmentFocus;
  hasDepartmentMemberships?: boolean;
  onOpenCommandPalette?: () => void;
}) {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();
  const isFiltering = normalizedQuery.length > 0;
  const searchInputId = useId();
  const { state, isMobile, setOpenMobile } = useSidebar();
  const isCollapsed = !isMobile && state === "collapsed";

  const assignmentLabel = useMemo(
    () => resolveAssignmentsGroupLabel(assignmentFocus, permissions ?? []),
    [assignmentFocus, permissions],
  );

  const baseSelection = useMemo(
    () =>
      selectMembersNavigation({
        structure: membersNavigation,
        hasDepartmentMemberships,
        activeProduction: activeProduction ?? null,
      }),
    [activeProduction, hasDepartmentMemberships],
  );

  const labelledSelection = useMemo(() => {
    const updateGroupLabel = (group: MembersNavGroup) =>
      group.id === MEMBERS_NAV_ASSIGNMENTS_GROUP_ID
        ? { ...group, label: assignmentLabel }
        : group;

    return {
      primaryTabs: baseSelection.primaryTabs.map(updateGroupLabel),
      secondaryMenu: baseSelection.secondaryMenu.map(updateGroupLabel),
      quickActions: baseSelection.quickActions.map((item) => ({ ...item })),
    };
  }, [assignmentLabel, baseSelection]);

  const permittedSelection = useMemo(
    () => filterMembersNavigationByPermissions(labelledSelection, permissions),
    [labelledSelection, permissions],
  );

  const filteredSelection = useMemo(() => {
    if (!isFiltering) {
      return permittedSelection;
    }

    return filterMembersNavigationByQuery(permittedSelection, normalizedQuery);
  }, [permittedSelection, isFiltering, normalizedQuery]);

  const emptyStateMessage = isFiltering
    ? "Keine Bereiche gefunden. Passe die Suche an."
    : "Keine Bereiche verfügbar.";

  const firstMatch = useMemo(() => {
    const flatItems = filteredSelection.flat;
    if (flatItems.length > 0) {
      return flatItems[0];
    }
    const quick = filteredSelection.quickActions;
    return quick.length > 0 ? quick[0] : null;
  }, [filteredSelection]);

  const activeProductionTitle = activeProduction
    ? activeProduction.title && activeProduction.title.trim()
      ? activeProduction.title
      : `Produktion ${activeProduction.year}`
    : null;

  const handleNavigate = useCallback(() => {
    if (isMobile) {
      setOpenMobile(false);
    }
  }, [isMobile, setOpenMobile]);

  const combinedGroups = useMemo(
    () => [...filteredSelection.primaryTabs, ...filteredSelection.secondaryMenu],
    [filteredSelection.primaryTabs, filteredSelection.secondaryMenu],
  );

  return (
    <>
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
                    handleNavigate();
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
        className={cn(
          "pb-[var(--space-sm)]",
          isCollapsed && "px-[var(--space-2xs)] py-[var(--space-sm)]",
        )}
      >
        <MembersNavProductionSwitcher
          activeProduction={activeProduction}
          activeProductionTitle={activeProductionTitle}
          isCollapsed={isCollapsed}
          currentPath={pathname}
        />

        <MembersContextActions
          quickActions={filteredSelection.quickActions}
          pathname={pathname}
          isCollapsed={isCollapsed}
          onNavigate={handleNavigate}
          onOpenCommandPalette={onOpenCommandPalette}
          showCommandAction={!isFiltering}
        />

        {combinedGroups.length === 0 ? (
          <div className="mx-[var(--space-xs)] rounded-lg border border-dashed border-sidebar-border/60 bg-sidebar/40 p-[var(--space-xs)] text-sidebar-foreground/70">
            <Text variant="small" className="text-sidebar-foreground/70">
              {emptyStateMessage}
            </Text>
          </div>
        ) : isFiltering ? (
          <MembersNavigationGroups
            groups={combinedGroups}
            pathname={pathname}
            isCollapsed={isCollapsed}
            onNavigate={() => {
              handleNavigate();
              setQuery("");
            }}
          />
        ) : (
          <>
            <MembersPrimaryTabs
              tabs={filteredSelection.primaryTabs}
              pathname={pathname}
              isCollapsed={isCollapsed}
              isMobile={isMobile}
              onNavigate={handleNavigate}
            />
            <MembersSecondaryDrawer
              groups={filteredSelection.secondaryMenu}
              pathname={pathname}
              isCollapsed={isCollapsed}
              onNavigate={handleNavigate}
            />
          </>
        )}
      </SidebarContent>
    </>
  );
}
