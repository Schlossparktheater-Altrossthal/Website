"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";

import {
  filterMembersNavigationByPermissions,
  selectMembersNavigation,
} from "@/lib/members-navigation";
import {
  defaultMembersNavIcon,
  membersNavigation,
  type MembersNavItem,
} from "@/config/members-navigation";
import { useSidebar } from "@/components/ui/sidebar";
import type { AssignmentFocus } from "@/components/members-nav";
import { cn } from "@/lib/utils";

export const MEMBERS_BOTTOM_NAV_COOKIE_NAME = "members_bottom_nav_tab";
const MEMBERS_BOTTOM_NAV_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;

export type MembersBottomNavTabId =
  | "home"
  | "assignments"
  | "production"
  | "profile";

type MembersBottomNavItemId = MembersBottomNavTabId | "menu";

type MembersBottomNavItem = {
  id: MembersBottomNavItemId;
  label: string;
  href?: string;
  icon: React.ComponentType<{ className?: string }>;
  ariaLabel?: string;
  badge?: string;
};

function convertBadgeToString(
  badge: MembersNavItem["badge"],
): string | undefined {
  if (typeof badge === "string" || typeof badge === "number") {
    return String(badge);
  }
  return undefined;
}

function createBottomNavItem(
  id: MembersBottomNavTabId,
  item: MembersNavItem,
): MembersBottomNavItem {
  return {
    id,
    label: item.label,
    href: item.href,
    icon: item.icon ?? defaultMembersNavIcon,
    ariaLabel: item.ariaLabel,
    badge: convertBadgeToString(item.badge),
  };
}

function isPathActive(pathname: string, href: string) {
  if (pathname === href) return true;
  if (href === "/mitglieder") return pathname === "/mitglieder";
  return pathname.startsWith(`${href}/`);
}

function useMembersNavigationSections({
  permissions,
  hasDepartmentMemberships,
  activeProduction,
}: {
  permissions: readonly string[];
  hasDepartmentMemberships: boolean;
  activeProduction?: { id: string; title: string | null; year: number };
}) {
  return React.useMemo(() => {
    const selection = selectMembersNavigation({
      structure: membersNavigation,
      hasDepartmentMemberships,
      activeProduction: activeProduction ?? null,
    });
    return filterMembersNavigationByPermissions(selection, permissions);
  }, [permissions, hasDepartmentMemberships, activeProduction]);
}

interface MembersBottomNavProps {
  permissions: readonly string[];
  assignmentFocus: AssignmentFocus;
  hasDepartmentMemberships: boolean;
  activeProduction?: { id: string; title: string | null; year: number };
  defaultTab?: MembersBottomNavTabId;
}

export function MembersBottomNav({
  permissions,
  assignmentFocus,
  hasDepartmentMemberships,
  activeProduction,
  defaultTab,
}: MembersBottomNavProps) {
  const pathname = usePathname() ?? "";
  const sidebar = useSidebar();
  const { isMobile, openMobile, setOpenMobile } = sidebar;

  const navigation = useMembersNavigationSections({
    permissions,
    hasDepartmentMemberships,
    activeProduction,
  });

  const { flat } = navigation;
  const navGroups = React.useMemo(
    () => [...navigation.primaryTabs, ...navigation.secondaryMenu],
    [navigation.primaryTabs, navigation.secondaryMenu],
  );

  const itemsByHref = React.useMemo(() => {
    const map = new Map<string, MembersNavItem>();
    for (const item of flat) {
      map.set(item.href, item);
    }
    return map;
  }, [flat]);

  const findFirstAvailable = React.useCallback(
    (candidates: readonly (string | null | undefined)[]) => {
      for (const candidate of candidates) {
        if (!candidate) continue;
        const item = itemsByHref.get(candidate);
        if (item) {
          return item;
        }
      }
      return null;
    },
    [itemsByHref],
  );

  const generalGroup = React.useMemo(
    () => navGroups.find((group) => group.id === "general") ?? null,
    [navGroups],
  );

  const assignmentsCandidates = React.useMemo(() => {
    const order: string[] = [];
    const push = (href: string) => {
      if (!order.includes(href)) {
        order.push(href);
      }
    };

    if (assignmentFocus === "departments") {
      push("/mitglieder/meine-gewerke");
      push("/mitglieder/meine-proben");
    } else if (assignmentFocus === "rehearsals") {
      push("/mitglieder/meine-proben");
      push("/mitglieder/kalender");
    } else if (assignmentFocus === "both") {
      push("/mitglieder/kalender");
      push("/mitglieder/meine-proben");
      push("/mitglieder/meine-gewerke");
    } else {
      push("/mitglieder/kalender");
      push("/mitglieder/meine-proben");
      push("/mitglieder/meine-gewerke");
    }

    push("/mitglieder/probenplanung");
    push("/mitglieder/koerpermasse");

    return order;
  }, [assignmentFocus]);

  const homeNavItem = React.useMemo(() => {
    return (
      findFirstAvailable(["/mitglieder"]) ??
      (generalGroup?.items.find((item) => itemsByHref.has(item.href)) ?? null)
    );
  }, [findFirstAvailable, generalGroup, itemsByHref]);

  const assignmentsNavItem = React.useMemo(() => {
    const item = findFirstAvailable(assignmentsCandidates);
    if (item) return item;
    const assignmentsGroup =
      navGroups.find((group) => group.id === "assignments") ?? null;
    return (
      assignmentsGroup?.items.find((groupItem) =>
        itemsByHref.has(groupItem.href),
      ) ?? null
    );
  }, [assignmentsCandidates, findFirstAvailable, navGroups, itemsByHref]);

  const productionNavItem = React.useMemo(() => {
    const dynamicHref = activeProduction
      ? `/mitglieder/produktionen/${activeProduction.id}`
      : null;
    const item = findFirstAvailable([
      dynamicHref,
      "/mitglieder/produktionen",
      "/mitglieder/produktionen/gewerke",
    ]);
    if (item) return item;
    const productionGroup =
      navGroups.find((group) => group.id === "production") ?? null;
    return (
      productionGroup?.items.find((groupItem) =>
        itemsByHref.has(groupItem.href),
      ) ?? null
    );
  }, [findFirstAvailable, activeProduction, navGroups, itemsByHref]);

  const profileNavItem = React.useMemo(() => {
    const item = findFirstAvailable(["/mitglieder/profil"]);
    if (item) return item;
    const fallback = generalGroup?.items.find(
      (groupItem) =>
        groupItem.href !== homeNavItem?.href && itemsByHref.has(groupItem.href),
    );
    return fallback ?? null;
  }, [findFirstAvailable, generalGroup, homeNavItem, itemsByHref]);

  const sections = React.useMemo(() => {
    const list: MembersBottomNavItem[] = [];
    const usedHrefs = new Set<string>();

    if (homeNavItem) {
      list.push(createBottomNavItem("home", homeNavItem));
      usedHrefs.add(homeNavItem.href);
    }

    if (assignmentsNavItem && !usedHrefs.has(assignmentsNavItem.href)) {
      list.push(createBottomNavItem("assignments", assignmentsNavItem));
      usedHrefs.add(assignmentsNavItem.href);
    }

    if (productionNavItem && !usedHrefs.has(productionNavItem.href)) {
      list.push(createBottomNavItem("production", productionNavItem));
      usedHrefs.add(productionNavItem.href);
    }

    if (profileNavItem && !usedHrefs.has(profileNavItem.href)) {
      list.push(createBottomNavItem("profile", profileNavItem));
      usedHrefs.add(profileNavItem.href);
    }

    return list;
  }, [homeNavItem, assignmentsNavItem, productionNavItem, profileNavItem]);

  const sectionsWithMenu = React.useMemo(() => {
    if (sections.length === 0) {
      return sections;
    }

    const menuItem: MembersBottomNavItem = {
      id: "menu",
      label: "Menü",
      icon: Menu,
      ariaLabel: "Navigation öffnen",
    };

    return [...sections, menuItem];
  }, [sections]);

  const initialActiveSection = React.useMemo<MembersBottomNavItemId>(() => {
    const matched = sections.find((section) => {
      const href = section.href;
      if (typeof href !== "string") {
        return false;
      }
      return isPathActive(pathname, href);
    });
    if (matched) {
      return matched.id;
    }

    if (defaultTab) {
      const defaultSection = sections.find(
        (section) => section.id === defaultTab && section.href,
      );
      if (defaultSection) {
        return defaultSection.id;
      }
    }

    const firstNavigable = sections.find((section) => Boolean(section.href));
    return firstNavigable ? firstNavigable.id : "menu";
  }, [sections, pathname, defaultTab]);

  const [activeSection, setActiveSection] = React.useState<MembersBottomNavItemId>(
    initialActiveSection,
  );

  React.useEffect(() => {
    setActiveSection(initialActiveSection);
  }, [initialActiveSection]);

  React.useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    if (
      !sections.some((section) =>
        section.id === activeSection ? Boolean(section.href) : false,
      )
    ) {
      return;
    }

    document.cookie = `${MEMBERS_BOTTOM_NAV_COOKIE_NAME}=${activeSection}; path=/; max-age=${MEMBERS_BOTTOM_NAV_COOKIE_MAX_AGE}`;
  }, [activeSection, sections]);

  if (!isMobile || sectionsWithMenu.length === 0) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 lg:hidden">
      <div className="pointer-events-auto border-t border-border/60 bg-background/90 shadow-lg shadow-black/5 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <nav className="mx-auto flex max-w-lg items-stretch gap-1 px-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-2">
          {sectionsWithMenu.map((section) => {
            const Icon = section.icon;
            const isActive = activeSection === section.id && section.id !== "menu";

            if (!section.href) {
              return (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => setOpenMobile(true)}
                  className={cn(
                    "flex flex-1 flex-col items-center justify-center gap-1 rounded-full px-2 py-2 text-xs font-medium text-muted-foreground transition-colors",
                    "hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  )}
                  aria-label={section.ariaLabel ?? section.label}
                  aria-haspopup="dialog"
                  aria-expanded={openMobile}
                >
                  <Icon className="h-5 w-5" aria-hidden="true" />
                  <span className="text-[11px] leading-4">{section.label}</span>
                </button>
              );
            }

            return (
              <Link
                key={section.id}
                href={section.href}
                className={cn(
                  "relative flex flex-1 flex-col items-center justify-center gap-1 rounded-full px-2 py-2 text-xs font-medium transition-colors",
                  "text-muted-foreground hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  isActive && "bg-primary/10 text-primary",
                )}
                data-active={isActive}
                aria-label={section.ariaLabel ?? section.label}
                aria-current={isActive ? "page" : undefined}
                onClick={() => setActiveSection(section.id)}
              >
                <Icon className="h-5 w-5" aria-hidden="true" />
                <span className="text-[11px] leading-4">{section.label}</span>
                {section.badge ? (
                  <span className="absolute right-2 top-1 rounded-full bg-primary px-1.5 text-[10px] font-semibold leading-none text-primary-foreground">
                    {section.badge}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
