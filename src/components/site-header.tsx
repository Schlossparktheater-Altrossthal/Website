"use client";

import Link from "next/link";
import {
  type CSSProperties,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { usePathname } from "next/navigation";

import { NotificationBell } from "@/components/notification-bell";
import { UserNav } from "@/components/user-nav";
import { ctaNavigation, primaryNavigation } from "@/config/navigation";
import { cn } from "@/lib/utils";

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

export function SiteHeader({ siteTitle }: { siteTitle: string }) {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();
  const isHomePage = pathname === "/";
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const navigationItems = useMemo(() => primaryNavigation, []);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 100);
    };
    
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!open) return;
      if (e.key === "Escape") {
        setOpen(false);
        btnRef.current?.focus();
      }
    }
    function onClick(e: MouseEvent) {
      if (!open) return;
      const t = e.target as Node;
      if (panelRef.current?.contains(t) || btnRef.current?.contains(t)) return;
      setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  return (
    <header
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
      <nav
        aria-label="Hauptnavigation"
        style={navSpacingStyles}
        className="layout-container flex flex-wrap items-center gap-[var(--nav-gap)] py-[var(--nav-padding-y)] sm:[--nav-gap:var(--space-sm)] md:[--nav-gap:var(--space-md)] md:[--nav-padding-y:var(--space-sm)]"
      >
        <Link
          className={`font-serif text-lg transition-all duration-300 sm:text-xl ${
            scrolled || !isHomePage
              ? "text-primary hover:opacity-90"
              : "text-foreground drop-shadow-lg hover:text-primary/90"
          }`}
          href="/"
        >
          {siteTitle}
        </Link>

        <div className="hidden items-center gap-[var(--space-md)] md:flex">
          {navigationItems.map((item) => {
            const isActive =
              pathname === item.href || pathname?.startsWith(`${item.href}/`);

            return (
              <Link
                key={item.href}
                className={cn(
                  "relative inline-flex items-center font-medium transition-all duration-300",
                  "after:absolute after:-bottom-[var(--space-3xs)] after:left-0 after:h-[2px] after:w-full after:origin-left after:scale-x-0 after:rounded-full after:bg-[var(--primary)] after:opacity-95 after:transition-transform after:duration-300 after:content-[''] after:transform",
                  "hover:text-[var(--primary)] hover:after:scale-x-100 focus-visible:outline-none focus-visible:text-[var(--primary)] focus-visible:after:scale-x-100",
                  "data-[active=true]:font-semibold data-[active=true]:text-[var(--primary)] data-[active=true]:after:scale-x-100",
                  scrolled || !isHomePage
                    ? "text-foreground/90"
                    : "text-foreground/90 drop-shadow-lg"
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
          className="ml-auto flex items-center gap-[var(--header-actions-gap)] sm:[--header-actions-gap:var(--space-xs)]"
        >
          <NotificationBell />
          <UserNav className="relative" />

          {/* Mobile menu button */}
          <button
            ref={btnRef}
            type="button"
            aria-label="Menü öffnen"
            aria-controls="mobile-menu"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className={`inline-flex h-[var(--header-mobile-trigger-size)] w-[var(--header-mobile-trigger-size)] items-center justify-center rounded-md transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-ring md:hidden ${
              scrolled || !isHomePage
                ? "border border-border/60 text-foreground hover:bg-accent/30"
                : "border border-border/60 text-foreground drop-shadow-lg hover:bg-accent/20"
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
        </div>
      </nav>

      {/* Mobile overlay panel */}
      {open && (
        <div className="fixed inset-0 z-[60] md:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div
            ref={panelRef}
            id="mobile-menu"
            style={drawerPanelStyles}
            className="absolute right-0 top-0 flex h-screen flex-col gap-[var(--drawer-gap)] border-l border-border/60 bg-card/95 p-[var(--drawer-padding)] pt-[var(--drawer-padding-top)] shadow-2xl backdrop-blur-md"
          >
            <div
              style={drawerLinkGroupStyles}
              className="flex flex-col gap-[var(--drawer-link-gap)]"
            >
              {navigationItems.map((item) => {
                const isActive =
                  pathname === item.href || pathname?.startsWith(`${item.href}/`);

                return (
                  <Link
                    key={item.href}
                    onClick={() => setOpen(false)}
                    style={drawerLinkPaddingStyles}
                    className={cn(
                      "block rounded-lg text-foreground/90 transition-colors duration-200 hover:bg-accent/30 hover:text-[var(--primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                      "data-[active=true]:bg-accent/20 data-[active=true]:font-semibold data-[active=true]:text-[var(--primary)] data-[active=true]:ring-1 data-[active=true]:ring-inset data-[active=true]:ring-[var(--primary)]"
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
          </div>
        </div>
      )}
    </header>
  );
}

