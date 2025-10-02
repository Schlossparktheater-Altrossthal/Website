"use client";

import Link from "next/link";
import {
  type CSSProperties,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { usePathname } from "next/navigation";

import { useSession } from "next-auth/react";
import { Menu, Search } from "lucide-react";

import { NotificationBell } from "@/components/notification-bell";
import { UserNav } from "@/components/user-nav";
import {
  type NavigationBadgeVariant,
  type NavigationItem,
  type NavigationItemTone,
  ctaNavigation,
  primaryNavigation,
} from "@/config/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";

const HEADER_SPACING = {
  gradientHeight: "var(--header-gradient-height)",
  nav: {
    gap: {
      base: "var(--space-xs)",
      sm: "var(--space-sm)",
      md: "var(--space-md)",
    },
    paddingY: {
      base: "var(--space-xs)",
      md: "var(--space-sm)",
    },
  },
  desktopLinksGap: "var(--space-md)",
  actions: {
    gap: {
      base: "var(--space-3xs)",
      sm: "var(--space-xs)",
    },
  },
  mobile: {
    triggerSize: "var(--header-mobile-trigger-size)",
    iconSize: "var(--header-mobile-icon-size)",
    panelWidth: "var(--header-drawer-width)",
    panelMaxWidth: "calc(100vw - 2 * var(--layout-gutter))",
    panelGap: "var(--space-sm)",
    panelPadding: "var(--space-md)",
    panelPaddingTop: "var(--header-drawer-padding-top)",
    linkGroupGap: "var(--space-2xs)",
    linkPaddingInline: "var(--space-sm)",
    linkPaddingBlock: "var(--space-xs)",
    linkDescriptionMarginTop: "var(--space-3xs)",
    footerSpace: "var(--space-xs)",
    footerPaddingTop: "var(--space-sm)",
    ctaPaddingInline: "var(--space-sm)",
    ctaPaddingBlock: "var(--space-xs)",
  },
} as const;

const drawerPanelStyles = {
  "--drawer-gap": HEADER_SPACING.mobile.panelGap,
  "--drawer-padding": HEADER_SPACING.mobile.panelPadding,
  "--drawer-padding-top": HEADER_SPACING.mobile.panelPaddingTop,
  width: HEADER_SPACING.mobile.panelWidth,
  maxWidth: HEADER_SPACING.mobile.panelMaxWidth,
} as CSSProperties;

const drawerLinkGroupStyles = {
  "--drawer-link-gap": HEADER_SPACING.mobile.linkGroupGap,
} as CSSProperties;

const drawerFooterStyles = {
  "--drawer-footer-space": HEADER_SPACING.mobile.footerSpace,
  "--drawer-footer-padding-top": HEADER_SPACING.mobile.footerPaddingTop,
} as CSSProperties;

const drawerLinkPaddingStyles = {
  paddingInline: HEADER_SPACING.mobile.linkPaddingInline,
  paddingBlock: HEADER_SPACING.mobile.linkPaddingBlock,
} satisfies CSSProperties;

const drawerLinkDescriptionStyles = {
  marginTop: HEADER_SPACING.mobile.linkDescriptionMarginTop,
} satisfies CSSProperties;

const drawerCtaPaddingStyles = {
  paddingInline: HEADER_SPACING.mobile.ctaPaddingInline,
  paddingBlock: HEADER_SPACING.mobile.ctaPaddingBlock,
} satisfies CSSProperties;

const heroGradientStyles = {
  height: HEADER_SPACING.gradientHeight,
} satisfies CSSProperties;

function createToneVars(color: string): CSSProperties {
  return {
    "--nav-tonal-color": color,
    "--nav-tonal-label": `color-mix(in srgb, ${color} 65%, transparent)`,
    "--nav-tonal-hover": `color-mix(in srgb, ${color} 12%, transparent)`,
    "--nav-tonal-container": `color-mix(in srgb, ${color} 20%, transparent)`,
    "--nav-tonal-ripple": `color-mix(in srgb, ${color} 18%, transparent)`,
    "--nav-tonal-ring": `color-mix(in srgb, ${color} 45%, transparent)`,
    "--nav-tonal-indicator": `color-mix(in srgb, ${color} 80%, transparent)`,
  } as CSSProperties;
}

const navigationToneVariables: Record<NavigationItemTone, CSSProperties> = {
  default: createToneVars("var(--foreground)"),
  muted: createToneVars("var(--muted-foreground)"),
  primary: createToneVars("var(--primary)"),
  success: createToneVars("var(--success)"),
  info: createToneVars("var(--info)"),
  warning: createToneVars("var(--warning)"),
  destructive: createToneVars("var(--destructive)"),
};

const navigationBarBaseClasses =
  "group relative flex flex-1 min-w-[5.5rem] flex-col items-center justify-center gap-1 overflow-hidden rounded-[1.75rem] px-3 py-2 text-[0.7rem] font-semibold tracking-[0.04em] text-[color:var(--nav-tonal-label)] transition-all duration-300 ease-out ring-1 ring-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--nav-tonal-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-background hover:text-[var(--nav-tonal-color)] hover:bg-[color:var(--nav-tonal-hover)] focus-visible:bg-[color:var(--nav-tonal-hover)] data-[active=true]:text-[var(--nav-tonal-color)] data-[active=true]:bg-[color:var(--nav-tonal-container)] data-[active=true]:ring-[color:var(--nav-tonal-ring)] data-[active=true]:shadow-[0_14px_30px_-16px_color-mix(in_srgb,var(--nav-tonal-color)_75%,transparent)] before:pointer-events-none before:absolute before:inset-0 before:scale-75 before:rounded-[1.75rem] before:bg-[color:var(--nav-tonal-ripple)] before:opacity-0 before:transition before:duration-300 before:ease-out hover:before:scale-100 hover:before:opacity-100 focus-visible:before:scale-105 focus-visible:before:opacity-100 after:pointer-events-none after:absolute after:bottom-1 after:h-0.5 after:w-2/3 after:origin-center after:scale-x-0 after:rounded-full after:bg-[var(--nav-tonal-indicator)] after:opacity-0 after:transition after:duration-300 after:ease-out data-[active=true]:after:scale-x-100 data-[active=true]:after:opacity-100";

const navigationRailBaseClasses =
  "group relative flex h-16 w-16 flex-col items-center justify-center gap-1 overflow-hidden rounded-[1.5rem] text-[0.7rem] font-semibold text-[color:var(--nav-tonal-label)] transition-all duration-300 ease-out ring-1 ring-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--nav-tonal-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-background hover:text-[var(--nav-tonal-color)] hover:bg-[color:var(--nav-tonal-hover)] focus-visible:bg-[color:var(--nav-tonal-hover)] data-[active=true]:text-[var(--nav-tonal-color)] data-[active=true]:bg-[color:var(--nav-tonal-container)] data-[active=true]:ring-[color:var(--nav-tonal-ring)] data-[active=true]:shadow-[0_16px_35px_-18px_color-mix(in_srgb,var(--nav-tonal-color)_80%,transparent)] before:pointer-events-none before:absolute before:inset-0 before:scale-75 before:rounded-[1.5rem] before:bg-[color:var(--nav-tonal-ripple)] before:opacity-0 before:transition before:duration-300 before:ease-out hover:before:scale-100 hover:before:opacity-100 focus-visible:before:scale-105 focus-visible:before:opacity-100 after:pointer-events-none after:absolute after:left-1.5 after:top-1/2 after:h-2/3 after:w-[3px] after:-translate-y-1/2 after:scale-y-0 after:rounded-full after:bg-[var(--nav-tonal-indicator)] after:opacity-0 after:transition after:duration-300 after:ease-out data-[active=true]:after:scale-y-100 data-[active=true]:after:opacity-100";

const iconButtonClasses =
  "relative inline-flex h-10 w-10 items-center justify-center overflow-hidden rounded-full text-foreground/70 transition-colors duration-200 ease-out hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-background before:pointer-events-none before:absolute before:inset-0 before:scale-75 before:rounded-full before:bg-[color:color-mix(in_srgb,var(--primary)_18%,transparent)] before:opacity-0 before:transition before:duration-300 hover:before:scale-100 hover:before:opacity-100 focus-visible:before:scale-105 focus-visible:before:opacity-100";

const badgeToneFallback: Partial<
  Record<NavigationItemTone, NavigationBadgeVariant>
> = {
  muted: "muted",
  primary: "default",
  success: "success",
  info: "info",
  warning: "warning",
  destructive: "destructive",
};

const iconToneFallbackClasses: Record<
  NavigationItemTone,
  { idle: string; active: string }
> = {
  default: { idle: "text-foreground opacity-70", active: "text-foreground" },
  muted: { idle: "text-muted-foreground", active: "text-foreground" },
  primary: { idle: "text-primary opacity-80", active: "text-primary" },
  success: { idle: "text-success opacity-80", active: "text-success" },
  info: { idle: "text-info opacity-80", active: "text-info" },
  warning: { idle: "text-warning opacity-80", active: "text-warning" },
  destructive: { idle: "text-destructive opacity-80", active: "text-destructive" },
};

function getNavigationIcon(
  item: NavigationItem,
  { isActive, className }: { isActive: boolean; className?: string },
) {
  const IconComponent =
    (isActive ? item.activeIcon ?? item.icon : item.icon) ?? item.activeIcon;

  if (!IconComponent) {
    return null;
  }

  const tone = item.tone ?? "default";
  const fallback = iconToneFallbackClasses[tone];

  return (
    <IconComponent
      aria-hidden
      className={cn(
        "h-5 w-5 shrink-0 transition-all duration-300",
        isActive
          ? "text-[var(--nav-tonal-color)] drop-shadow-[0_0_6px_color-mix(in_srgb,var(--nav-tonal-color)_45%,transparent)]"
          : "text-[color:var(--nav-tonal-label)]",
        isActive ? fallback.active : fallback.idle,
        className,
      )}
    />
  );
}

function getNavigationBadge(
  item: NavigationItem,
  options?: { className?: string },
) {
  if (!item.badge) {
    return null;
  }

  const tone = item.tone ?? "default";
  const variant = item.badge.variant ?? badgeToneFallback[tone] ?? "accent";

  return (
    <Badge
      variant={variant}
      size={item.badge.size ?? "sm"}
      className={cn("whitespace-nowrap", options?.className)}
    >
      {item.badge.label}
    </Badge>
  );
}

export function SiteHeader({ siteTitle }: { siteTitle: string }) {
  const headerRef = useRef<HTMLElement | null>(null);
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();
  const isHomePage = pathname === "/";
  const { data: session, status: sessionStatus } = useSession();
  const isAuthenticated = Boolean(session?.user);

  const navigationItems = useMemo(() => primaryNavigation, []);

  useLayoutEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    const headerElement = headerRef.current;
    if (!headerElement) {
      return;
    }

    const root = document.documentElement;

    const updateHeight = () => {
      const { height } = headerElement.getBoundingClientRect();
      root.style.setProperty("--header-height", `${height}px`);
    };

    updateHeight();

    let resizeObserver: ResizeObserver | null = null;
    let cleanupResizeListener: (() => void) | null = null;

    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver((entries) => {
        const entry = entries[0];
        if (!entry) return;

        const borderBoxSize = Array.isArray(entry.borderBoxSize)
          ? entry.borderBoxSize[0]
          : entry.borderBoxSize;
        const height =
          borderBoxSize?.blockSize ??
          entry.contentRect?.height ??
          headerElement.getBoundingClientRect().height;

        root.style.setProperty("--header-height", `${height}px`);
      });
      resizeObserver.observe(headerElement);
    } else {
      const target = globalThis as typeof globalThis & {
        addEventListener?: Window["addEventListener"];
        removeEventListener?: Window["removeEventListener"];
      };

      if (
        typeof target.addEventListener === "function" &&
        typeof target.removeEventListener === "function"
      ) {
        const add = target.addEventListener.bind(target);
        const remove = target.removeEventListener.bind(target);
        add("resize", updateHeight);
        cleanupResizeListener = () => {
          remove("resize", updateHeight);
        };
      }
    }

    return () => {
      resizeObserver?.disconnect();
      cleanupResizeListener?.();
      root.style.removeProperty("--header-height");
    };
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 100);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <header
        ref={headerRef}
        className={`fixed top-0 z-50 w-full transition-all duration-300 ${
          scrolled || !isHomePage
            ? "border-b border-border/50 bg-background/95 backdrop-blur-md shadow-lg"
            : "bg-gradient-to-b from-black/40 via-black/25 via-black/12 to-transparent backdrop-blur-[1px]"
        }`}
      >
        <div
          style={!scrolled && isHomePage ? heroGradientStyles : undefined}
          className={`${
            !scrolled && isHomePage
              ? "absolute inset-x-0 top-full bg-gradient-to-b from-transparent via-transparent to-transparent"
              : ""
          }`}
        />
        <nav aria-label="Hauptnavigation" className="layout-container py-3 sm:py-4">
          <div className="relative flex w-full flex-col gap-3 lg:grid lg:grid-cols-[auto,1fr] lg:items-start lg:gap-6">
            <aside className="hidden lg:flex" aria-label="NavigationRail">
              <div className="flex flex-col items-center gap-3 rounded-[2rem] bg-background/95 p-3 shadow-md ring-1 ring-border/60 backdrop-blur supports-[backdrop-filter]:bg-background/80">
                {navigationItems.map((item) => {
                  const isActive =
                    pathname === item.href ||
                    Boolean(pathname?.startsWith(`${item.href}/`));
                  const tone = item.tone ?? "default";
                  const iconElement = getNavigationIcon(item, {
                    isActive,
                    className:
                      "transition-transform duration-300 group-data-[active=true]:scale-110",
                  });
                  const badgeElement = getNavigationBadge(item, {
                    className:
                      "pointer-events-none absolute right-2 top-2 scale-90 text-[0.6rem]",
                  });

                  return (
                    <Link
                      key={`${item.href}-rail`}
                      href={item.href}
                      aria-current={isActive ? "page" : undefined}
                      data-active={isActive ? "true" : undefined}
                      style={navigationToneVariables[tone]}
                      className={cn(
                        navigationRailBaseClasses,
                        "px-2 py-2",
                        "transition-transform will-change-transform hover:-translate-y-0.5 data-[active=true]:-translate-y-1",
                      )}
                    >
                      {badgeElement}
                      <span className="relative flex h-10 w-10 items-center justify-center">
                        {iconElement}
                      </span>
                      <span className="text-[0.68rem] font-medium leading-tight text-center">
                        {item.label}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </aside>

            <div className="flex flex-col gap-3">
              <div
                className={cn(
                  "flex items-center gap-3 rounded-full bg-background/95 px-3 py-2 shadow-md ring-1 ring-border/60 backdrop-blur supports-[backdrop-filter]:bg-background/80 transition-colors duration-300",
                  scrolled || !isHomePage
                    ? "text-foreground"
                    : "text-foreground drop-shadow-lg",
                )}
              >
                <Link
                  className="flex-1 min-w-0 truncate font-serif text-lg leading-tight transition-colors duration-300 sm:text-xl"
                  href="/"
                  title={siteTitle}
                >
                  {siteTitle}
                </Link>

                <div className="flex items-center gap-1 sm:gap-2">
                  <button
                    type="button"
                    aria-label="Suche öffnen"
                    title="Suche"
                    className={cn(iconButtonClasses, "hidden sm:inline-flex")}
                    onClick={() => {
                      if (typeof window === "undefined") {
                        return;
                      }

                      window.dispatchEvent(
                        new CustomEvent("global-search:toggle", { bubbles: true }),
                      );
                    }}
                  >
                    <Search aria-hidden className="h-5 w-5" />
                  </button>
                  <NotificationBell className="hidden sm:flex" />
                  <UserNav className="hidden sm:flex" />

                  <SheetTrigger asChild>
                    <button
                      type="button"
                      aria-label="Navigationsmenü öffnen"
                      className={cn(
                        iconButtonClasses,
                        "md:hidden border border-border/60 bg-background/80 text-foreground/80 shadow-sm",
                      )}
                    >
                      <Menu aria-hidden className="h-5 w-5" />
                    </button>
                  </SheetTrigger>
                </div>
              </div>

              <div
                className="flex items-stretch gap-2 overflow-x-auto rounded-[2rem] bg-background/90 px-2 py-2 shadow-md ring-1 ring-border/60 backdrop-blur supports-[backdrop-filter]:bg-background/75 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              >
                {navigationItems.map((item) => {
                  const isActive =
                    pathname === item.href ||
                    Boolean(pathname?.startsWith(`${item.href}/`));
                  const tone = item.tone ?? "default";
                  const iconElement = getNavigationIcon(item, {
                    isActive,
                    className:
                      "transition-transform duration-300 group-data-[active=true]:scale-110",
                  });
                  const badgeElement = getNavigationBadge(item, {
                    className:
                      "pointer-events-none absolute right-2 top-2 translate-y-0 text-[0.6rem]",
                  });

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-current={isActive ? "page" : undefined}
                      data-active={isActive ? "true" : undefined}
                      style={navigationToneVariables[tone]}
                      className={cn(
                        navigationBarBaseClasses,
                        "snap-center",
                        "transition-transform will-change-transform hover:-translate-y-0.5 data-[active=true]:-translate-y-1",
                      )}
                    >
                      {badgeElement}
                      <span className="relative flex h-10 w-10 items-center justify-center">
                        {iconElement}
                      </span>
                      <span className="text-[0.72rem] font-semibold leading-tight text-center">
                        {item.label}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        </nav>
      </header>

      <SheetContent
        id="mobile-menu"
        side="right"
        style={drawerPanelStyles}
        className="flex h-screen flex-col gap-[var(--drawer-gap)] border-l border-border/60 bg-card/95 p-[var(--drawer-padding)] pt-[var(--drawer-padding-top)] shadow-2xl backdrop-blur-md md:hidden"
      >
        {sessionStatus === "loading" ? (
          <div className="h-11 rounded-md bg-foreground/10" aria-hidden />
        ) : isAuthenticated ? (
          <div className="space-y-2 rounded-lg border border-border/60 bg-card/80 p-3 text-sm text-foreground/90">
            <span className="text-xs uppercase tracking-[0.12em] text-foreground/70">
              Angemeldet als
            </span>
            <span className="block truncate font-medium">
              {session?.user?.firstName ?? session?.user?.name ?? session?.user?.email}
            </span>
            <Link
              href="/mitglieder"
              className="mt-3 inline-flex w-full items-center justify-center rounded-md border border-border/60 bg-background/70 px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              onClick={() => setOpen(false)}
            >
              Mitgliederbereich öffnen
            </Link>
          </div>
        ) : (
          <Button asChild size="sm" className="w-full justify-center">
            <Link href="/login" onClick={() => setOpen(false)}>
              Login
            </Link>
          </Button>
        )}

        <div
          style={drawerLinkGroupStyles}
          className="flex flex-col gap-[var(--drawer-link-gap)]"
        >
          {navigationItems.map((item) => {
            const isActive =
              pathname === item.href ||
              Boolean(pathname?.startsWith(`${item.href}/`));

            const tone = item.tone ?? "default";
            const iconElement = getNavigationIcon(item, {
              isActive,
              className:
                "transition-transform duration-300 group-data-[active=true]:scale-105",
            });
            const badgeElement = getNavigationBadge(item, {
              className: "text-[0.65rem]",
            });

            return (
              <Link
                key={item.href}
                onClick={() => setOpen(false)}
                style={{
                  ...drawerLinkPaddingStyles,
                  ...navigationToneVariables[tone],
                }}
                className={cn(
                  "group relative flex items-start gap-3 rounded-2xl border border-transparent text-[color:var(--nav-tonal-label)] transition-colors duration-200 hover:bg-[color:var(--nav-tonal-hover)] hover:text-[var(--nav-tonal-color)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--nav-tonal-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                  "data-[active=true]:border-[color:var(--nav-tonal-ring)] data-[active=true]:bg-[color:var(--nav-tonal-container)] data-[active=true]:text-[var(--nav-tonal-color)] data-[active=true]:shadow-[0_10px_24px_-14px_color-mix(in_srgb,var(--nav-tonal-color)_70%,transparent)]",
                )}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                data-active={isActive ? "true" : undefined}
              >
                {iconElement ? (
                  <span className="mt-0.5 flex h-5 w-5 items-center justify-center">
                    {iconElement}
                  </span>
                ) : null}
                <span className="flex flex-1 flex-col">
                  <span className="flex items-center gap-2 font-medium">
                    <span>{item.label}</span>
                    {badgeElement}
                  </span>
                  {item.description ? (
                    <span
                      style={drawerLinkDescriptionStyles}
                      className="mt-1 text-sm text-muted-foreground"
                    >
                      {item.description}
                    </span>
                  ) : null}
                </span>
              </Link>
            );
          })}
        </div>

        <div
          style={drawerFooterStyles}
          className="mt-auto space-y-[var(--drawer-footer-space)] border-t border-border/60 pt-[var(--drawer-footer-padding-top)] text-sm text-muted-foreground"
        >
          <span className="block text-xs uppercase tracking-[0.12em] text-foreground/70">
            Bleib verbunden
          </span>
          <Link
            href={ctaNavigation.href}
            style={drawerCtaPaddingStyles}
            className="block rounded-lg border border-dashed border-primary/50 bg-primary/10 text-foreground transition-colors hover:border-primary hover:bg-primary/20"
            onClick={() => setOpen(false)}
          >
            {ctaNavigation.label}
          </Link>
        </div>
      </SheetContent>
    </Sheet>
  );
}

