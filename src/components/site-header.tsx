"use client";

import Link from "next/link";
import Image from "next/image";
import { type CSSProperties, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";

import { NotificationBell } from "@/components/notification-bell";
import { UserNav } from "@/components/user-nav";
import { primaryNavigation, type NavigationItem } from "@/config/navigation";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

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
      base: "var(--space-2xs)",
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

const navSpacingStyles = {
  "--nav-gap": HEADER_SPACING.nav.gap.base,
  "--nav-padding-y": HEADER_SPACING.nav.paddingY.base,
} as CSSProperties;

const actionsSpacingStyles = {
  "--header-actions-gap": HEADER_SPACING.actions.gap.base,
} as CSSProperties;

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

const drawerLinkPaddingStyles = {
  paddingInline: HEADER_SPACING.mobile.linkPaddingInline,
  paddingBlock: HEADER_SPACING.mobile.linkPaddingBlock,
} satisfies CSSProperties;

const drawerLinkDescriptionStyles = {
  marginTop: HEADER_SPACING.mobile.linkDescriptionMarginTop,
} satisfies CSSProperties;

const heroGradientStyles = {
  height: HEADER_SPACING.gradientHeight,
} satisfies CSSProperties;

export function SiteHeader({
  siteTitle,
  navigationItems = primaryNavigation,
}: {
  siteTitle: string;
  navigationItems?: NavigationItem[];
}) {
  const headerRef = useRef<HTMLElement | null>(null);
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();
  const { status } = useSession();
  const isAuthenticated = status === "authenticated";
  const isHomePage = pathname === "/";
  const isTransparentHomeHeader = isHomePage && !scrolled;

  const visibleNavigationItems = useMemo(() => navigationItems, [navigationItems]);

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
          !isTransparentHomeHeader
            ? "border-b border-border/50 bg-background/95 backdrop-blur-md shadow-lg"
            : "bg-gradient-to-b from-black/40 via-black/25 via-black/12 to-transparent backdrop-blur-[1px]"
        }`}
      >
        <div
          style={isTransparentHomeHeader ? heroGradientStyles : undefined}
          className={`${
            isTransparentHomeHeader
              ? "absolute inset-x-0 top-full bg-gradient-to-b from-transparent via-transparent to-transparent"
              : ""
          }`}
        />
        <nav
          aria-label="Hauptnavigation"
          style={navSpacingStyles}
          className="layout-container flex flex-nowrap items-center gap-[var(--nav-gap)] py-[var(--nav-padding-y)] sm:[--nav-gap:var(--space-sm)] md:[--nav-gap:var(--space-md)] md:[--nav-padding-y:var(--space-sm)]"
        >
          <Link
            className={`flex-1 min-w-0 truncate font-serif text-lg transition-all duration-300 sm:text-xl ${
              !isTransparentHomeHeader
                ? "text-primary hover:opacity-90"
                : "text-white drop-shadow-lg hover:text-white/90"
            }`}
            href="/"
            title={siteTitle}
          >
            <span className="hidden md:inline">{siteTitle}</span>
            <span className="md:hidden">
              <Image
                src="/Logo-Sommertheater.png"
                alt={siteTitle}
                width={140}
                height={40}
                sizes="40px"
                className="h-10 w-auto"
                priority
              />
            </span>
          </Link>

          <div className="hidden items-center gap-[var(--space-md)] md:flex">
            {visibleNavigationItems.map((item) => {
              const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`);

              return (
                <Link
                  key={item.href}
                  className={cn(
                    "relative inline-flex items-center font-medium transition-all duration-300",
                    "after:absolute after:-bottom-[var(--space-3xs)] after:left-0 after:h-[2px] after:w-full after:origin-left after:scale-x-0 after:rounded-full after:bg-[var(--primary)] after:opacity-95 after:transition-transform after:duration-300 after:content-[''] after:transform",
                    !isTransparentHomeHeader
                      ? "text-foreground/90 hover:text-[var(--primary)] hover:after:scale-x-100 focus-visible:outline-none focus-visible:text-[var(--primary)] focus-visible:after:scale-x-100 data-[active=true]:font-semibold data-[active=true]:text-[var(--primary)] data-[active=true]:after:scale-x-100"
                      : "text-white drop-shadow-lg hover:text-white/90 hover:after:scale-x-100 focus-visible:outline-none focus-visible:text-white focus-visible:after:scale-x-100 data-[active=true]:font-semibold data-[active=true]:text-white data-[active=true]:after:scale-x-100",
                  )}
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  data-active={isActive ? "true" : undefined}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>

          <div
            style={actionsSpacingStyles}
            className="ml-auto flex flex-shrink-0 items-center gap-[var(--header-actions-gap)] sm:[--header-actions-gap:var(--space-xs)]"
          >
            <NotificationBell className="flex-shrink-0" />
            <UserNav className="flex-shrink-0" />

            {/* Mobile menu button */}
            <SheetTrigger asChild>
              <button
                type="button"
                aria-label="Menü öffnen"
                className={`inline-flex h-[var(--header-mobile-trigger-size)] w-[var(--header-mobile-trigger-size)] flex-shrink-0 items-center justify-center rounded-md transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-ring md:hidden ${
                  !isTransparentHomeHeader
                    ? "border border-border/60 text-foreground hover:bg-accent/30"
                    : "border border-border/60 text-white drop-shadow-lg hover:bg-accent/20"
                }`}
              >
                <span className="sr-only">Menü</span>
                <svg
                  className="h-[var(--header-mobile-icon-size)] w-[var(--header-mobile-icon-size)]"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </svg>
              </button>
            </SheetTrigger>
          </div>
        </nav>
      </header>

      <SheetContent
        id="mobile-menu"
        side="right"
        style={drawerPanelStyles}
        className="flex h-screen flex-col gap-[var(--drawer-gap)] border-l border-border/60 bg-card/95 p-[var(--drawer-padding)] pt-[var(--drawer-padding-top)] shadow-2xl backdrop-blur-md md:hidden"
      >
        <div style={drawerLinkGroupStyles} className="flex flex-col gap-[var(--drawer-link-gap)]">
          {visibleNavigationItems.map((item) => {
            const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`);

            return (
              <Link
                key={item.href}
                onClick={() => setOpen(false)}
                style={drawerLinkPaddingStyles}
                className={cn(
                  "block rounded-lg text-foreground/90 transition-colors duration-200 hover:bg-accent/30 hover:text-[var(--primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                  "data-[active=true]:bg-accent/20 data-[active=true]:font-semibold data-[active=true]:text-[var(--primary)] data-[active=true]:ring-1 data-[active=true]:ring-inset data-[active=true]:ring-[var(--primary)]",
                )}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                data-active={isActive ? "true" : undefined}
              >
                <span className="block font-medium">{item.label}</span>
                {item.description ? (
                  <span
                    style={drawerLinkDescriptionStyles}
                    className="block text-sm text-muted-foreground"
                  >
                    {item.description}
                  </span>
                ) : null}
              </Link>
            );
          })}
          {!isAuthenticated ? (
            <Link
              onClick={() => setOpen(false)}
              style={drawerLinkPaddingStyles}
              className="mt-2 block border-t border-border/60 pt-3 font-medium text-foreground/90 transition-colors duration-200 hover:text-[var(--primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              href="/login"
            >
              Login
            </Link>
          ) : null}
        </div>

        <div className="mt-auto text-xs text-muted-foreground">
          <span className="block uppercase tracking-[0.12em] text-foreground/70">
            Gute Unterhaltung!
          </span>
        </div>
      </SheetContent>
    </Sheet>
  );
}
