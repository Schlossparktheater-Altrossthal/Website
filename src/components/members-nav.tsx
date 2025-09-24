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
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar";
import { Text } from "@/components/ui/typography";
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
        className={cn(
          "pb-[var(--space-sm)]",
          isCollapsed && "px-[var(--space-2xs)] py-[var(--space-sm)]",
        )}
      >
        {!isCollapsed && (
          <div className="px-[var(--space-xs)]">
            <div className="rounded-lg border border-sidebar-border/60 bg-sidebar/70 p-[var(--space-sm)] shadow-sm">
              <div className="flex items-start justify-between gap-[var(--space-xs)]">
                <div>
                  <Text variant="eyebrow" className="block text-sidebar-foreground/60">
                    Aktive Produktion
                  </Text>
                  {activeProduction && activeProductionTitle ? (
                    <>
                      <Text
                        asChild
                        variant="small"
                        weight="semibold"
                        tone="primary"
                        className="mt-[var(--space-3xs)] inline-flex max-w-full items-center gap-[var(--space-3xs)] rounded-full border border-primary/30 bg-primary/10 px-[var(--space-xs)] py-0.5 shadow-sm"
                      >
                        <span className="truncate">{activeProductionTitle}</span>
                      </Text>
                      <Text
                        variant="caption"
                        tone="muted"
                        className="mt-0.5 block"
                      >
                        Jahrgang {activeProduction.year}
                      </Text>
                    </>
                  ) : (
                    <Text
                      variant="caption"
                      className="mt-[var(--space-3xs)] block text-sidebar-foreground/70"
                    >
                      Noch keine Produktion ausgewählt. Wähle in der Übersicht eine aktive Produktion aus.
                    </Text>
                  )}
                </div>
                <Text
                  asChild
                  variant="caption"
                  weight="medium"
                  className="text-sidebar-foreground/80 transition hover:text-sidebar-foreground"
                >
                  <Link href="/mitglieder/produktionen">Übersicht öffnen</Link>
                </Text>
              </div>
            </div>
          </div>
        )}

        {groups.length === 0 ? (
          <div className="mx-[var(--space-xs)] rounded-lg border border-dashed border-sidebar-border/60 bg-sidebar/40 p-[var(--space-xs)] text-sidebar-foreground/70">
            <Text variant="small" className="text-sidebar-foreground/70">
              {emptyStateMessage}
            </Text>
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
          ))
        )}
      </SidebarContent>
    </>
  );
}
