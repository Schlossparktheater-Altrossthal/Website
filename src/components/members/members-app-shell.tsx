"use client";

import * as React from "react";
import { usePathname } from "next/navigation";

import {
  Sidebar,
  SidebarInset,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { MembersNav, type AssignmentFocus } from "@/components/members-nav";
import { cn } from "@/lib/utils";

interface MembersAppShellProps {
  children: React.ReactNode;
  permissions: readonly string[];
  activeProduction?: { id: string; title: string | null; year: number };
  assignmentFocus: AssignmentFocus;
  hasDepartmentMemberships: boolean;
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

interface MembersAppShellContextValue {
  setTopbarContent: (content: MembersTopbarSlots | null) => void;
  setContentHeader: (content: React.ReactNode | null) => void;
  setContentFooter: (content: React.ReactNode | null) => void;
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
}: {
  content: MembersTopbarSlots;
}) {
  const { isMobile } = useSidebar();
  const hasQuickActions = Boolean(content.quickActions);
  const hasStatus = Boolean(content.status);
  const hasBreadcrumbs = Boolean(content.breadcrumbs);

  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/75">
      <div className="mx-auto w-full max-w-screen-2xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3 py-3 sm:py-4">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            {isMobile ? (
              <SidebarTrigger
                className="-ml-1 inline-flex h-9 w-9 items-center justify-center rounded-full border border-border/60 text-muted-foreground transition hover:border-primary/60 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                aria-label="Navigationsmenü öffnen"
              />
            ) : null}
            <div className="min-w-0 flex flex-col gap-1">
              {hasBreadcrumbs ? (
                <div className="truncate text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {content.breadcrumbs}
                </div>
              ) : null}
              <div className="min-w-0 truncate text-sm font-semibold text-foreground">
                {content.title ?? (
                  <span className="truncate text-sm font-semibold text-foreground">
                    Mitgliederbereich
                  </span>
                )}
              </div>
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
          <div className="flex flex-wrap items-center gap-2 pb-3">
            {content.status}
          </div>
        ) : null}
      </div>
    </header>
  );
}

export function MembersAppShell({
  children,
  permissions,
  activeProduction,
  assignmentFocus,
  hasDepartmentMemberships,
}: MembersAppShellProps) {
  const [topbarContent, setTopbarContentState] =
    React.useState<MembersTopbarSlots>(INITIAL_TOPBAR);
  const [contentHeader, setContentHeaderState] =
    React.useState<React.ReactNode>(null);
  const [contentFooter, setContentFooterState] =
    React.useState<React.ReactNode>(null);

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
    }),
    [setTopbarContent, setContentHeader, setContentFooter],
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
        <SidebarInset id="main">
          <div className="flex min-h-svh flex-col">
            <MembersTopbarContent content={topbarContent} />
            <main className="flex-1 pb-12">
              {contentHeader ? (
                <header className="border-b border-border/60 bg-background/60">
                  <div className="mx-auto w-full max-w-screen-2xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
                    {contentHeader}
                  </div>
                </header>
              ) : null}
              <section className="py-6 sm:py-8">
                <div className="mx-auto w-full max-w-screen-2xl space-y-8 px-4 sm:px-6 lg:px-8">
                  {children}
                </div>
              </section>
              {contentFooter ? (
                <footer className="border-t border-border/60 bg-background/60">
                  <div className="mx-auto w-full max-w-screen-2xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
                    {contentFooter}
                  </div>
                </footer>
              ) : null}
            </main>
          </div>
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
