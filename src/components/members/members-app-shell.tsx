"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { cva, type VariantProps } from "class-variance-authority";

import {
  Sidebar,
  SidebarInset,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { MembersNav, type AssignmentFocus } from "@/components/members-nav";
import { cn } from "@/lib/utils";

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

const membersContentContainerVariants = cva("mx-auto w-full px-4 sm:px-6 lg:px-8", {
  variants: {
    width: {
      sm: "max-w-screen-sm",
      md: "max-w-screen-md",
      lg: "max-w-screen-lg",
      xl: "max-w-screen-xl",
      "2xl": "max-w-screen-2xl",
      full: "max-w-none",
    },
    padding: {
      none: "px-0",
      compact: "px-3 sm:px-4 lg:px-6",
      default: "px-4 sm:px-6 lg:px-8",
      relaxed: "px-6 sm:px-8 lg:px-12",
    },
  },
  defaultVariants: {
    width: "2xl",
    padding: "default",
  },
});

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
  const { isMobile, openMobile, setOpenMobile } = useSidebar();

  React.useEffect(() => {
    if (isMobile && openMobile) {
      setOpenMobile(false);
    }
  }, [isMobile, openMobile, pathname, setOpenMobile]);

  return null;
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
        {!isMobile && (hasStatus || hasQuickActions) ? (
          <div className="flex flex-shrink-0 items-center gap-2">
            {hasStatus ? (
              <div className="flex flex-wrap items-center gap-2">
                {content.status}
              </div>
            ) : null}
            {hasQuickActions ? (
              <div className="flex flex-wrap items-center gap-2">
                {content.quickActions}
              </div>
            ) : null}
          </div>
        ) : null}
        {isMobile && hasQuickActions ? (
          <div className="flex flex-shrink-0 items-center gap-2">
            {content.quickActions}
          </div>
        ) : null}
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
}: MembersAppShellProps) {
  const [topbarContent, setTopbarContentState] =
    React.useState<MembersTopbarSlots>(INITIAL_TOPBAR);
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
    setTopbarContentState(value ?? INITIAL_TOPBAR);
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
        <SidebarRail />
      </Sidebar>
      <MembersAppShellContext.Provider value={contextValue}>
        <SidebarInset id="main" className="min-h-svh">
          <MembersTopbarContent
            content={topbarContent}
            containerClassName={contentClasses.container}
          />
          <main className="flex-1 pb-12">
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
