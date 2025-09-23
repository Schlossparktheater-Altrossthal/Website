"use client";

import { useId, useMemo, useState } from "react";
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
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar";
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

export type { AssignmentFocus } from "@/lib/members-navigation";

function isActive(pathname: string, href: string) {
  if (pathname === href) return true;
  if (href === "/mitglieder") return false;
  return pathname.startsWith(`${href}/`);
}

export function MembersNav({
  permissions,
  activeProduction,
  assignmentFocus = "none",
  hasDepartmentMemberships = false,
}: {
  permissions?: readonly string[];
  activeProduction?: ActiveProductionNavInfo;
  assignmentFocus?: AssignmentFocus;
  hasDepartmentMemberships?: boolean;
}) {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();
  const isFiltering = normalizedQuery.length > 0;
  const searchInputId = useId();
  const { state, isMobile } = useSidebar();
  const isCollapsed = !isMobile && state === "collapsed";

  const assignmentLabel = useMemo(
    () => resolveAssignmentsGroupLabel(assignmentFocus, permissions ?? []),
    [assignmentFocus, permissions],
  );

  const baseGroups = useMemo(
    () =>
      selectMembersNavigation({
        groups: membersNavigation,
        hasDepartmentMemberships,
        activeProduction: activeProduction ?? null,
      }),
    [activeProduction, hasDepartmentMemberships],
  );

  const labelledGroups = useMemo(
    () =>
      baseGroups.map((group) =>
        group.id === MEMBERS_NAV_ASSIGNMENTS_GROUP_ID
          ? { ...group, label: assignmentLabel }
          : group,
      ),
    [assignmentLabel, baseGroups],
  );

  const { groups: permittedGroups, flat: permittedFlat } = useMemo(
    () => filterMembersNavigationByPermissions(labelledGroups, permissions),
    [labelledGroups, permissions],
  );

  const { groups, flat } = useMemo(() => {
    if (!isFiltering) {
      return { groups: permittedGroups, flat: permittedFlat };
    }

    return filterMembersNavigationByQuery(permittedGroups, normalizedQuery);
  }, [permittedFlat, permittedGroups, isFiltering, normalizedQuery]);

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
      {!isCollapsed && (
        <>
          <SidebarHeader className="gap-3">
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
      <SidebarContent className={cn("pb-4", isCollapsed && "px-2 py-4")}>
        {!isCollapsed && (
          <div className="px-3">
            <div className="rounded-lg border border-sidebar-border/60 bg-sidebar/70 p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-sidebar-foreground/60">
                    Aktive Produktion
                  </div>
                  {activeProduction && activeProductionTitle ? (
                    <>
                      <div className="mt-1 text-sm font-semibold text-sidebar-foreground">
                        {activeProductionTitle}
                      </div>
                      <div className="text-xs text-sidebar-foreground/70">
                        Jahrgang {activeProduction.year}
                      </div>
                    </>
                  ) : (
                    <p className="mt-1 text-xs text-sidebar-foreground/70">
                      Noch keine Produktion ausgewählt. Wähle in der Übersicht eine aktive Produktion aus.
                    </p>
                  )}
                </div>
                <Link
                  href="/mitglieder/produktionen"
                  className="text-xs font-medium text-sidebar-foreground/80 transition hover:text-sidebar-foreground"
                >
                  Übersicht öffnen
                </Link>
              </div>
            </div>
          </div>
        )}

        {groups.length === 0 ? (
          <div className="mx-3 rounded-lg border border-dashed border-sidebar-border/60 bg-sidebar/40 p-3 text-sm text-sidebar-foreground/70">
            {emptyStateMessage}
          </div>
        ) : (
          groups.map((group) => (
            <SidebarGroup key={group.id}>
              <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {group.items.map((item) => {
                    const active = isActive(pathname, item.href);
                    const Icon = item.icon ?? defaultMembersNavIcon;
                    const badgeContent = item.badge;
                    const showBadge =
                      !isCollapsed && badgeContent !== undefined && badgeContent !== null && badgeContent !== false;

                    return (
                      <SidebarMenuItem key={item.href}>
                        <SidebarMenuButton
                          asChild
                          isActive={active}
                          tooltip={item.label}
                          className={cn("gap-2", isCollapsed && "justify-center")}
                        >
                          <Link href={item.href} aria-label={item.ariaLabel ?? item.label}>
                            <Icon
                              className={cn(
                                "h-4 w-4 shrink-0 transition-opacity",
                                active ? "opacity-100" : "opacity-70",
                              )}
                            />
                            <span className={cn("truncate", isCollapsed && "sr-only")}>{item.label}</span>
                            {showBadge ? (
                              typeof badgeContent === "string" || typeof badgeContent === "number" ? (
                                <span className="ml-auto inline-flex items-center rounded-full border border-sidebar-border/60 bg-sidebar/50 px-2 text-[11px] font-semibold uppercase tracking-wide text-sidebar-foreground/70">
                                  {badgeContent}
                                </span>
                              ) : (
                                <span className="ml-auto flex items-center">{badgeContent}</span>
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
          ))
        )}
      </SidebarContent>
    </>
  );
}
