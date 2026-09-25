"use client";

import Link from "next/link";
import Image from "next/image";
import { type CSSProperties, useLayoutEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";

import { NotificationBell } from "@/components/notification-bell";
import { UserNav } from "@/components/user-nav";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { PUBLIC_SITE_URL } from "@/config/public-site";

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

export function SiteHeader({ siteTitle }: { siteTitle: string }) {
  const headerRef = useRef<HTMLElement | null>(null);
  const [open, setOpen] = useState(false);
  const { status } = useSession();
  const isAuthenticated = status === "authenticated";

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

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <header
        ref={headerRef}
        className="fixed top-0 z-50 w-full border-b border-border/50 bg-background/95 backdrop-blur-md shadow-lg transition-all duration-300"
      >
        <nav
          aria-label="Hauptnavigation"
          style={navSpacingStyles}
          className="layout-container flex flex-nowrap items-center gap-[var(--nav-gap)] py-[var(--nav-padding-y)] sm:[--nav-gap:var(--space-sm)] md:[--nav-gap:var(--space-md)] md:[--nav-padding-y:var(--space-sm)]"
        >
          <Link
            className="flex-1 min-w-0 truncate font-serif text-lg text-primary transition-all duration-300 hover:opacity-90 sm:text-xl"
            href={PUBLIC_SITE_URL}
            title={siteTitle}
          >
            <span className="hidden md:inline">{siteTitle}</span>
            <span className="md:hidden">
              <Image
                src="/Logo-Sommertheater.png"
                alt={siteTitle}
                width={40}
                height={40}
                sizes="40px"
                className="h-10 w-10"
                priority
              />
            </span>
          </Link>

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
                className="inline-flex h-[var(--header-mobile-trigger-size)] w-[var(--header-mobile-trigger-size)] flex-shrink-0 items-center justify-center rounded-md border border-border/60 text-foreground transition-all duration-300 hover:bg-accent/30 focus:outline-none focus:ring-2 focus:ring-ring md:hidden"
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
