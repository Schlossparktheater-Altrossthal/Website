"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cva, type VariantProps } from "class-variance-authority";
import { ArrowLeft, Menu } from "lucide-react";

import {
  Sidebar,
  SidebarInset,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { MembersNav, type AssignmentFocus } from "@/components/members-nav";
import { cn } from "@/lib/utils";
import type { ImpersonationDetails } from "@/lib/auth/impersonation";
import { ImpersonationBanner } from "@/components/members/impersonation-banner/impersonation-banner";
import {
  filterMembersNavigationByPermissions,
  selectMembersNavigation,
} from "@/lib/members-navigation";
import {
  defaultMembersNavIcon,
  type MembersNavItem,
} from "@/config/members-navigation";

const membersContentSectionVariants = cva("py-6 sm:py-8", {
  variants: {
    spacing: {
      none: "py-0",
      compact: "py-4 sm:py-6",
      comfortable: "py-6 sm:py-8",
      relaxed: "py-8 sm:py-12",
    },
  },
  defaultVariants: {
    spacing: "comfortable",
  },
});

const membersContentContainerVariants = cva(
  "members-container members-container--padding-default",
  {
    variants: {
      width: {
        sm: "members-container--width-sm",
        md: "members-container--width-md",
        lg: "members-container--width-lg",
        xl: "members-container--width-xl",
        "2xl": "members-container--width-2xl",
        full: "members-container--width-full",
      },
      padding: {
        none: "members-container--padding-none",
        compact: "members-container--padding-compact",
        default: "members-container--padding-default",
        relaxed: "members-container--padding-relaxed",
      },
    },
    defaultVariants: {
      width: "2xl",
      padding: "default",
    },
  },
);

const membersContentStackVariants = cva("space-y-8", {
  variants: {
    gap: {
      none: "space-y-0",
      xs: "space-y-4",
      sm: "space-y-6",
      md: "space-y-8",
      lg: "space-y-10",
      xl: "space-y-12",
    },
  },
  defaultVariants: {
    gap: "md",
  },
});

type MembersContentSpacing = NonNullable<
  VariantProps<typeof membersContentSectionVariants>["spacing"]
>;
type MembersContentWidth = NonNullable<
  VariantProps<typeof membersContentContainerVariants>["width"]
>;
type MembersContentPadding = NonNullable<
  VariantProps<typeof membersContentContainerVariants>["padding"]
>;
type MembersContentGap = NonNullable<
  VariantProps<typeof membersContentStackVariants>["gap"]
>;

export interface MembersContentLayoutConfig {
  spacing?: MembersContentSpacing;
  width?: MembersContentWidth;
  padding?: MembersContentPadding;
  gap?: MembersContentGap;
}

type MembersContentLayoutState = Required<MembersContentLayoutConfig>;

export type MembersContentLayoutSnapshot = MembersContentLayoutState;

const DEFAULT_CONTENT_LAYOUT: MembersContentLayoutState = {
  spacing: "comfortable",
  width: "2xl",
  padding: "default",
  gap: "md",
};

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

function mergeContentLayout(
  base: MembersContentLayoutState,
  patch?: MembersContentLayoutConfig | null,
): MembersContentLayoutState {
  if (!patch) {
    return base;
  }

  let changed = false;
  const next: MembersContentLayoutState = { ...base };

  if (patch.spacing && patch.spacing !== next.spacing) {
    next.spacing = patch.spacing;
    changed = true;
  }

  if (patch.width && patch.width !== next.width) {
    next.width = patch.width;
    changed = true;
  }

  if (patch.padding && patch.padding !== next.padding) {
    next.padding = patch.padding;
    changed = true;
  }

  if (patch.gap && patch.gap !== next.gap) {
    next.gap = patch.gap;
    changed = true;
  }

  return changed ? next : base;
}

function isContentLayoutEqual(
  a: MembersContentLayoutState,
  b: MembersContentLayoutState,
) {
  return (
    a.spacing === b.spacing &&
    a.width === b.width &&
    a.padding === b.padding &&
    a.gap === b.gap
  );
}

function computeContentLayout(
  base: MembersContentLayoutState,
  overrides: Iterable<MembersContentLayoutConfig>,
): MembersContentLayoutState {
  let layout = base;
  for (const override of overrides) {
    layout = mergeContentLayout(layout, override);
  }
  return layout;
}

function getContentClasses(layout: MembersContentLayoutState) {
  return {
    section: membersContentSectionVariants({ spacing: layout.spacing }),
    container: membersContentContainerVariants({
      width: layout.width,
      padding: layout.padding,
    }),
    stack: membersContentStackVariants({ gap: layout.gap }),
  };
}

interface MembersAppShellProps {
  children: React.ReactNode;
  permissions: readonly string[];
  activeProduction?: { id: string; title: string | null; year: number };
  assignmentFocus: AssignmentFocus;
  hasDepartmentMemberships: boolean;
  contentLayout?: MembersContentLayoutConfig;
  globalFooter?: React.ReactNode;
  impersonation?: ImpersonationDetails | null;
  defaultBottomNavTab?: MembersBottomNavTabId;
  appBarSlots?: Partial<MembersTopbarSlots>;
}

interface MembersTopbarSlots {
  breadcrumbs: React.ReactNode | null;
  title: React.ReactNode | null;
  quickActions: React.ReactNode | null;
  status: React.ReactNode | null;
}

const INITIAL_TOPBAR: MembersTopbarSlots = {
  breadcrumbs: null,
  title: null,
  quickActions: null,
  status: null,
};

function areTopbarSlotsEqual(
  a: MembersTopbarSlots,
  b: MembersTopbarSlots,
) {
  return (
    a.breadcrumbs === b.breadcrumbs &&
    a.title === b.title &&
    a.quickActions === b.quickActions &&
    a.status === b.status
  );
}

const MEMBERS_TOPBAR_STICKY_STYLE: React.CSSProperties = {
  top: "var(--members-topbar-offset, 0px)",
};

interface MembersAppShellContextValue {
  setTopbarContent: (content: MembersTopbarSlots | null) => void;
  setContentHeader: (content: React.ReactNode | null) => void;
  setContentFooter: (content: React.ReactNode | null) => void;
  registerContentLayout: (
    layout: MembersContentLayoutConfig,
  ) => () => void;
  contentLayout: MembersContentLayoutState;
}

const MembersAppShellContext =
  React.createContext<MembersAppShellContextValue | null>(null);

function useMembersAppShellContext() {
  const context = React.useContext(MembersAppShellContext);
  if (!context) {
    throw new Error(
      "Members layout helpers must be used within MembersAppShell.",
    );
  }

  return context;
}

function SidebarMobileAutoClose() {
  const pathname = usePathname();
  const sidebar = useSidebar();
  const { isMobile, setOpenMobile } = sidebar;

  React.useEffect(() => {
    if (!isMobile) {
      return;
    }

    // Close the mobile sheet after navigation so the menu remains usable while
    // it is open and collapses once a new page is shown.
    setOpenMobile(false);
  }, [isMobile, pathname, setOpenMobile]);

  return null;
}

function isPathActive(pathname: string, href: string) {
  if (pathname === href) return true;
  if (href === "/mitglieder") return pathname === "/mitglieder";
  return pathname.startsWith(`${href}/`);
}

interface MembersBottomNavProps {
  permissions: readonly string[];
  assignmentFocus: AssignmentFocus;
  hasDepartmentMemberships: boolean;
  activeProduction?: { id: string; title: string | null; year: number };
  defaultTab?: MembersBottomNavTabId;
}

function MembersBottomNav({
  permissions,
  assignmentFocus,
  hasDepartmentMemberships,
  activeProduction,
  defaultTab,
}: MembersBottomNavProps) {
  const pathname = usePathname() ?? "";
  const sidebar = useSidebar();
  const { isMobile, setOpenMobile } = sidebar;

  const navigation = React.useMemo(() => {
    const groups = selectMembersNavigation({
      hasDepartmentMemberships,
      activeProduction: activeProduction ?? null,
    });
    return filterMembersNavigationByPermissions(groups, permissions);
  }, [
    permissions,
    hasDepartmentMemberships,
    activeProduction,
  ]);

  const { groups: navGroups, flat } = navigation;

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
                  aria-expanded={sidebar.openMobile}
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

function MembersTopbarContent({
  content,
  containerClassName,
}: {
  content: MembersTopbarSlots;
  containerClassName: string;
}) {
  const { isMobile } = useSidebar();
  const hasQuickActions = Boolean(content.quickActions);
  const hasStatus = Boolean(content.status);
  const hasBreadcrumbs = Boolean(content.breadcrumbs);

  const desktopStatus = hasStatus ? (
    <div className="flex flex-wrap items-center gap-2">
      {content.status}
    </div>
  ) : null;

  const desktopQuickActions = hasQuickActions ? (
    <div className="flex flex-wrap items-center gap-2">
      {content.quickActions}
    </div>
  ) : null;

  const mobileQuickActions = hasQuickActions ? (
    <div className="flex basis-full flex-wrap justify-end gap-2 gap-y-2 sm:basis-auto">
      {content.quickActions}
    </div>
  ) : null;

  const homeLink = (
    <Button
      asChild
      variant="ghost"
      size="sm"
      className="gap-1.5 whitespace-nowrap"
    >
      <Link href="/" aria-label="Zur Hauptseite">
        <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span>Zur Hauptseite</span>
      </Link>
    </Button>
  );

  return (
    <header
      className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60"
      style={MEMBERS_TOPBAR_STICKY_STYLE}
    >
      <div
        className={cn(
          "flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12",
          containerClassName,
        )}
      >
        <SidebarTrigger className="-ml-1" aria-label="Navigationsmenü umschalten" />
        <Separator
          orientation="vertical"
          className="mr-2 data-[orientation=vertical]:h-4"
        />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          {hasBreadcrumbs ? (
            <div className="flex min-w-0 items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {content.breadcrumbs}
            </div>
          ) : null}
          <div className="flex min-w-0 items-center gap-2">
            {content.title ?? (
              <span className="truncate text-sm font-semibold text-foreground">
                Mitgliederbereich
              </span>
            )}
          </div>
        </div>
        {!isMobile ? (
          <div className="flex flex-shrink-0 items-center gap-2">
            {desktopStatus}
            {desktopQuickActions}
            {homeLink}
          </div>
        ) : (
          <div className="flex flex-1 flex-wrap items-center justify-end gap-2 gap-y-2">
            {mobileQuickActions}
            {homeLink}
          </div>
        )}
      </div>
      {isMobile && hasStatus ? (
        <div
          className={cn(
            "flex flex-wrap items-center gap-2 pb-3",
            containerClassName,
          )}
        >
          {content.status}
        </div>
      ) : null}
    </header>
  );
}

export function MembersAppShell({
  children,
  permissions,
  activeProduction,
  assignmentFocus,
  hasDepartmentMemberships,
  contentLayout,
  globalFooter,
  impersonation,
  defaultBottomNavTab,
  appBarSlots,
}: MembersAppShellProps) {
  const initialTopbar = React.useMemo<MembersTopbarSlots>(
    () => ({ ...INITIAL_TOPBAR, ...appBarSlots }),
    [appBarSlots],
  );
  const initialTopbarRef = React.useRef(initialTopbar);

  const [topbarContent, setTopbarContentState] = React.useState<MembersTopbarSlots>(
    initialTopbar,
  );

  React.useEffect(() => {
    const previousInitial = initialTopbarRef.current;
    initialTopbarRef.current = initialTopbar;

    setTopbarContentState((current) =>
      areTopbarSlotsEqual(current, previousInitial) ? initialTopbar : current,
    );
  }, [initialTopbar]);
  const [contentHeader, setContentHeaderState] =
    React.useState<React.ReactNode>(null);
  const [contentFooter, setContentFooterState] =
    React.useState<React.ReactNode>(null);

  const baseContentLayout = React.useMemo(
    () => mergeContentLayout(DEFAULT_CONTENT_LAYOUT, contentLayout),
    [contentLayout],
  );
  const [contentLayoutState, setContentLayoutState] =
    React.useState<MembersContentLayoutState>(baseContentLayout);
  const layoutOverridesRef = React.useRef<
    Map<number, MembersContentLayoutConfig>
  >(new Map());
  const layoutOverrideIdRef = React.useRef(0);

  const updateContentLayout = React.useCallback(() => {
    const merged = computeContentLayout(
      baseContentLayout,
      layoutOverridesRef.current.values(),
    );
    setContentLayoutState((current) =>
      isContentLayoutEqual(current, merged) ? current : merged,
    );
  }, [baseContentLayout]);

  React.useEffect(() => {
    updateContentLayout();
  }, [updateContentLayout]);

  const registerContentLayout = React.useCallback(
    (options: MembersContentLayoutConfig) => {
      const id = ++layoutOverrideIdRef.current;
      layoutOverridesRef.current.set(id, options);
      updateContentLayout();
      return () => {
        layoutOverridesRef.current.delete(id);
        updateContentLayout();
      };
    },
    [updateContentLayout],
  );

  const contentClasses = React.useMemo(
    () => getContentClasses(contentLayoutState),
    [contentLayoutState],
  );

  const setTopbarContent = React.useCallback((value: MembersTopbarSlots | null) => {
    setTopbarContentState(value ?? initialTopbarRef.current);
  }, []);

  const setContentHeader = React.useCallback((value: React.ReactNode | null) => {
    setContentHeaderState(value ?? null);
  }, []);

  const setContentFooter = React.useCallback((value: React.ReactNode | null) => {
    setContentFooterState(value ?? null);
  }, []);

  const contextValue = React.useMemo(
    () => ({
      setTopbarContent,
      setContentHeader,
      setContentFooter,
      registerContentLayout,
      contentLayout: contentLayoutState,
    }),
    [
      setTopbarContent,
      setContentHeader,
      setContentFooter,
      registerContentLayout,
      contentLayoutState,
    ],
  );

  return (
    <>
      <SidebarMobileAutoClose />
      <Sidebar collapsible="icon">
        <MembersNav
          permissions={permissions}
          activeProduction={activeProduction}
          assignmentFocus={assignmentFocus}
          hasDepartmentMemberships={hasDepartmentMemberships}
        />
        <SidebarRail className="hidden lg:flex" />
      </Sidebar>
      <MembersAppShellContext.Provider value={contextValue}>
        <SidebarInset id="main" className="min-h-svh">
          <MembersTopbarContent
            content={topbarContent}
            containerClassName={contentClasses.container}
          />
          {impersonation?.active ? (
            <div className={cn(contentClasses.container, "py-4 sm:py-5")}>
              <ImpersonationBanner details={impersonation} />
            </div>
          ) : null}
          <main className="flex-1 pb-24 lg:pb-12">
            {contentHeader ? (
              <header className="border-b border-border/60 bg-background/60">
                <div
                  className={cn(contentClasses.container, "py-6 sm:py-8")}
                >
                  {contentHeader}
                </div>
              </header>
            ) : null}
            <section className={contentClasses.section}>
              <div
                className={cn(
                  contentClasses.container,
                  contentClasses.stack,
                )}
              >
                {children}
              </div>
            </section>
            {contentFooter ? (
              <footer className="border-t border-border/60 bg-background/60">
                <div
                  className={cn(contentClasses.container, "py-6 sm:py-8")}
                >
                  {contentFooter}
                </div>
              </footer>
            ) : null}
          </main>
          <MembersBottomNav
            permissions={permissions}
            assignmentFocus={assignmentFocus}
            hasDepartmentMemberships={hasDepartmentMemberships}
            activeProduction={activeProduction}
            defaultTab={defaultBottomNavTab}
          />
          {globalFooter ? (
            <div className="pb-24 lg:pb-0">{globalFooter}</div>
          ) : null}
        </SidebarInset>
      </MembersAppShellContext.Provider>
    </>
  );
}

interface MembersTopbarProps {
  children: React.ReactNode;
}

function combineSlot(
  current: React.ReactNode | null,
  next: React.ReactNode,
): React.ReactNode {
  if (!current) return next;
  return (
    <>
      {current}
      {next}
    </>
  );
}

function collectTopbarSlots(children: React.ReactNode): MembersTopbarSlots {
  const slots: MembersTopbarSlots = { ...INITIAL_TOPBAR };

  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) {
      return;
    }

    if (child.type === MembersTopbarBreadcrumbs) {
      slots.breadcrumbs = combineSlot(slots.breadcrumbs, child);
      return;
    }

    if (child.type === MembersTopbarTitle) {
      slots.title = combineSlot(slots.title, child);
      return;
    }

    if (child.type === MembersTopbarQuickActions) {
      slots.quickActions = combineSlot(slots.quickActions, child);
      return;
    }

    if (child.type === MembersTopbarStatus) {
      slots.status = combineSlot(slots.status, child);
    }
  });

  return slots;
}

export function MembersTopbar({ children }: MembersTopbarProps) {
  const { setTopbarContent } = useMembersAppShellContext();
  const slots = React.useMemo(() => collectTopbarSlots(children), [children]);

  React.useEffect(() => {
    setTopbarContent(slots);
    return () => setTopbarContent(null);
  }, [setTopbarContent, slots]);

  return null;
}

interface MembersTopbarBreadcrumbsProps
  extends React.HTMLAttributes<HTMLElement> {
  ariaLabel?: string;
}

export function MembersTopbarBreadcrumbs({
  ariaLabel,
  className,
  children,
  ...props
}: MembersTopbarBreadcrumbsProps) {
  return (
    <nav
      aria-label={ariaLabel ?? "Brotkrumen"}
      className={cn(
        "flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground",
        className,
      )}
      {...props}
    >
      {children}
    </nav>
  );
}

interface MembersTopbarTitleProps {
  children: React.ReactNode;
  className?: string;
}

export function MembersTopbarTitle({
  children,
  className,
}: MembersTopbarTitleProps) {
  return (
    <span className={cn("truncate text-sm font-semibold text-foreground", className)}>
      {children}
    </span>
  );
}

interface MembersTopbarQuickActionsProps {
  children: React.ReactNode;
  className?: string;
}

export function MembersTopbarQuickActions({
  children,
  className,
}: MembersTopbarQuickActionsProps) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {children}
    </div>
  );
}

interface MembersTopbarStatusProps {
  children: React.ReactNode;
  className?: string;
}

export function MembersTopbarStatus({
  children,
  className,
}: MembersTopbarStatusProps) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>{children}</div>
  );
}

interface MembersContentHeaderProps {
  children: React.ReactNode;
  className?: string;
}

export function MembersContentHeader({
  children,
  className,
}: MembersContentHeaderProps) {
  const { setContentHeader } = useMembersAppShellContext();
  const content = React.useMemo(
    () => (
      <div
        className={cn(
          "flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between lg:gap-6",
          className,
        )}
      >
        {children}
      </div>
    ),
    [children, className],
  );

  React.useEffect(() => {
    setContentHeader(content);
    return () => setContentHeader(null);
  }, [content, setContentHeader]);

  return null;
}

interface MembersPageActionsProps {
  children: React.ReactNode;
  className?: string;
}

export function MembersPageActions({
  children,
  className,
}: MembersPageActionsProps) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 sm:justify-end",
        className,
      )}
    >
      {children}
    </div>
  );
}

interface MembersContentFooterProps {
  children: React.ReactNode;
  className?: string;
}

export function MembersContentFooter({
  children,
  className,
}: MembersContentFooterProps) {
  const { setContentFooter } = useMembersAppShellContext();
  const content = React.useMemo(
    () => (
      <div className={cn("flex flex-col gap-4", className)}>{children}</div>
    ),
    [children, className],
  );

  React.useEffect(() => {
    setContentFooter(content);
    return () => setContentFooter(null);
  }, [content, setContentFooter]);

  return null;
}

function normalizeContentLayoutConfig(
  config: MembersContentLayoutConfig,
): MembersContentLayoutConfig | null {
  const normalized: MembersContentLayoutConfig = {};

  if (config.spacing) {
    normalized.spacing = config.spacing;
  }

  if (config.width) {
    normalized.width = config.width;
  }

  if (config.padding) {
    normalized.padding = config.padding;
  }

  if (config.gap) {
    normalized.gap = config.gap;
  }

  return Object.keys(normalized).length > 0 ? normalized : null;
}

export function useMembersContentLayout(): MembersContentLayoutSnapshot {
  const { contentLayout } = useMembersAppShellContext();
  return contentLayout;
}

export function MembersContentLayout({
  spacing,
  width,
  padding,
  gap,
}: MembersContentLayoutConfig) {
  const { registerContentLayout } = useMembersAppShellContext();

  const options = React.useMemo(
    () =>
      normalizeContentLayoutConfig({
        spacing,
        width,
        padding,
        gap,
      }),
    [spacing, width, padding, gap],
  );

  React.useEffect(() => {
    if (!options) {
      return;
    }

    const unregister = registerContentLayout(options);
    return unregister;
  }, [options, registerContentLayout]);

  return null;
}
