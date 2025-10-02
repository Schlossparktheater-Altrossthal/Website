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
import {
  motion,
  useMotionValueEvent,
  useScroll,
  useSpring,
  useTransform,
} from "framer-motion";
import { Menu, Search } from "lucide-react";
import { FocusScope } from "@radix-ui/react-focus-scope";

import { NotificationBell } from "@/components/notification-bell";
import { UserNav } from "@/components/user-nav";
import {
  type NavigationBadgeVariant,
  type NavigationItem,
  type NavigationItemTone,
  ctaNavigation,
  primaryNavigation,
  secondaryNavigation,
} from "@/config/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { UserAvatar } from "@/components/user-avatar";
import { getUserDisplayName } from "@/lib/names";

const COLLAPSE_DISTANCE = 160;
const ELEVATION_THRESHOLD = 0.25;

const drawerContentStyles = {
  width: "min(calc(100vw - 1.5rem), 24rem)",
} satisfies CSSProperties;

const desktopNavLinkClasses =
  "group relative inline-flex items-center gap-2 rounded-full border border-transparent px-4 py-2 text-sm font-semibold text-[color:var(--nav-tonal-label)] transition-colors duration-200 hover:bg-[color:color-mix(in_srgb,var(--nav-tonal-color)_16%,transparent)] hover:text-[var(--nav-tonal-color)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--nav-tonal-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-background data-[active=true]:border-[color:var(--nav-tonal-ring)] data-[active=true]:bg-[color:color-mix(in_srgb,var(--nav-tonal-color)_16%,transparent)] data-[active=true]:text-[var(--nav-tonal-color)]";

const mobileNavLinkClasses =
  "group relative flex items-start gap-3 rounded-2xl border border-transparent px-4 py-3 text-base font-semibold text-[color:var(--nav-tonal-label)] transition-colors duration-200 hover:bg-[color:color-mix(in_srgb,var(--nav-tonal-color)_16%,transparent)] hover:text-[var(--nav-tonal-color)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--nav-tonal-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-background data-[active=true]:border-[color:var(--nav-tonal-ring)] data-[active=true]:bg-[color:color-mix(in_srgb,var(--nav-tonal-color)_16%,transparent)] data-[active=true]:text-[var(--nav-tonal-color)]";

const mobileSectionLabelClasses =
  "text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground";

const iconButtonClasses =
  "inline-flex h-10 w-10 items-center justify-center rounded-full border border-outline/20 bg-surface/80 text-foreground/80 transition-colors duration-200 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background";

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
        "h-5 w-5 shrink-0 transition-colors duration-200",
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
  const user = session?.user ?? null;
  const isAuthenticated = Boolean(user);
  const userDisplayName = useMemo(() => {
    if (!user) {
      return null;
    }

    return getUserDisplayName(
      {
        firstName: user.firstName,
        lastName: user.lastName,
        name: user.name,
        email: user.email,
      },
      user.email ?? "",
    );
  }, [user]);
  const userEmail = user?.email?.trim() || null;

  const navigationItems = useMemo(() => primaryNavigation, []);
  const secondaryNavItems = useMemo(() => secondaryNavigation, []);

  const { scrollY } = useScroll();
  const collapseProgress = useTransform(
    scrollY,
    [0, COLLAPSE_DISTANCE],
    [0, 1],
    { clamp: true },
  );
  const collapseSpring = useSpring(collapseProgress, {
    stiffness: 260,
    damping: 32,
    mass: 0.6,
  });
  const headerSurface = useTransform(collapseSpring, [0, 1], [
    "var(--surface-variant)",
    "var(--surface)",
  ]);
  const headerBackdrop = useTransform(collapseSpring, [0, 1], [
    "blur(12px)",
    "blur(18px)",
  ]);
  const titleScale = useTransform(collapseSpring, [0, 1], [1, 0.92]);
  const titleOpacity = useTransform(collapseSpring, [0, 1], [1, 0.78]);
  const titleOffset = useTransform(collapseSpring, [0, 1], [0, -6]);

  useMotionValueEvent(collapseSpring, "change", (value) => {
    setScrolled((previous) => {
      const next = value > ELEVATION_THRESHOLD;

      if (next === previous) {
        return previous;
      }

      return next;
    });
  });

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    setScrolled(scrollY.get() > COLLAPSE_DISTANCE * ELEVATION_THRESHOLD);
  }, [scrollY]);

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

  const isElevated = scrolled || !isHomePage;

  const handleSearchToggle = () => {
    if (typeof window === "undefined") {
      return;
    }

    window.dispatchEvent(new CustomEvent("global-search:toggle", { bubbles: true }));
  };

  const closeDrawer = () => setOpen(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <motion.header
        ref={headerRef}
        data-testid="site-header"
        data-elevated={isElevated ? "true" : "false"}
        style={{
          backgroundColor: headerSurface,
          backdropFilter: headerBackdrop,
          WebkitBackdropFilter: headerBackdrop,
        }}
        className={cn(
          "fixed top-0 z-50 w-full border-b transition-[background-color,box-shadow,border-color] duration-300",
          "supports-[backdrop-filter]:bg-transparent",
          isElevated
            ? "bg-surface border-outline/30 shadow-lg"
            : "bg-surface-variant/95 border-outline/15 shadow-sm",
        )}
      >
        <div className="layout-container">
          <div className="flex h-16 items-center justify-between gap-3 sm:h-20 sm:gap-4">
            <div className="flex flex-1 items-center gap-3 sm:gap-4">
              <Link
                className="min-w-0 font-serif text-lg leading-none transition-colors duration-200 sm:text-2xl"
                href="/"
                title={siteTitle}
              >
                <motion.span
                  data-testid="site-header-title"
                  className="inline-block truncate"
                  style={{ scale: titleScale, opacity: titleOpacity, y: titleOffset }}
                >
                  {siteTitle}
                </motion.span>
              </Link>

              <nav aria-label="Hauptnavigation" className="hidden lg:block">
                <ul className="flex items-center gap-2">
                  {navigationItems.map((item) => {
                    const isActive =
                      pathname === item.href ||
                      Boolean(pathname?.startsWith(`${item.href}/`));
                    const tone = item.tone ?? "default";
                    const iconElement = getNavigationIcon(item, {
                      isActive,
                    });
                    const badgeElement = getNavigationBadge(item, {
                      className: "text-xs",
                    });

                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          aria-current={isActive ? "page" : undefined}
                          data-active={isActive ? "true" : undefined}
                          style={navigationToneVariables[tone]}
                          className={desktopNavLinkClasses}
                        >
                          {iconElement}
                          <span className="flex items-center gap-2">
                            <span>{item.label}</span>
                            {badgeElement}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </nav>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              <button
                type="button"
                aria-label="Suche öffnen"
                title="Suche"
                className={cn(iconButtonClasses, "hidden md:inline-flex")}
                onClick={handleSearchToggle}
              >
                <Search aria-hidden className="h-5 w-5" />
              </button>

              {isAuthenticated ? (
                <NotificationBell className="hidden lg:flex" />
              ) : null}

              {isAuthenticated ? (
                <UserNav className="hidden md:flex" />
              ) : sessionStatus !== "loading" ? (
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="hidden md:inline-flex"
                >
                  <Link href="/login">Login</Link>
                </Button>
              ) : null}

              <Button
                asChild
                variant="secondary"
                size="sm"
                className="hidden lg:inline-flex"
              >
                <Link href={ctaNavigation.href}>{ctaNavigation.label}</Link>
              </Button>

              <SheetTrigger asChild>
                <button
                  type="button"
                  aria-label="Navigationsmenü öffnen"
                  className={cn(iconButtonClasses, "md:hidden")}
                >
                  <Menu aria-hidden className="h-5 w-5" />
                </button>
              </SheetTrigger>
            </div>
          </div>
        </div>
      </motion.header>

      <SheetContent
        side="left"
        style={drawerContentStyles}
        className="gap-8 overflow-y-auto border-outline/15 bg-surface px-6 py-8 text-foreground shadow-xl sm:px-8"
      >
        <FocusScope loop>
          <div className="flex flex-1 flex-col gap-8">
            {isAuthenticated ? (
              <div className="flex items-center gap-4 rounded-2xl bg-surface-container p-4 shadow-sm ring-1 ring-outline/10">
                <UserAvatar
                  user={user}
                  className="h-12 w-12 border border-outline/20"
                />
                <div className="min-w-0 space-y-1">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {userDisplayName ?? "Angemeldeter Nutzer"}
                  </p>
                  {userEmail ? (
                    <p className="truncate text-sm text-muted-foreground">
                      {userEmail}
                    </p>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="space-y-3 rounded-2xl bg-surface-container p-4 shadow-sm ring-1 ring-outline/10">
                <p className="text-sm text-muted-foreground">
                  Melde dich an, um exklusive Inhalte und interne Bereiche zu nutzen.
                </p>
                <Button asChild className="w-full" onClick={closeDrawer}>
                  <Link href="/login">Login</Link>
                </Button>
              </div>
            )}

            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start gap-2"
              onClick={() => {
                handleSearchToggle();
                closeDrawer();
              }}
            >
              <Search aria-hidden className="h-4 w-4" />
              Suche öffnen
            </Button>

            <nav aria-label="Hauptnavigation" className="space-y-3">
              <p className={mobileSectionLabelClasses}>Hauptbereiche</p>
              <ul className="flex flex-col gap-2">
                {navigationItems.map((item) => {
                  const isActive =
                    pathname === item.href ||
                    Boolean(pathname?.startsWith(`${item.href}/`));
                  const tone = item.tone ?? "default";
                  const iconElement = getNavigationIcon(item, {
                    isActive,
                    className: "h-5 w-5",
                  });
                  const badgeElement = getNavigationBadge(item, {
                    className: "ml-auto shrink-0 text-xs",
                  });

                  return (
                    <li key={`${item.href}-mobile`}>
                      <Link
                        href={item.href}
                        onClick={closeDrawer}
                        aria-current={isActive ? "page" : undefined}
                        data-active={isActive ? "true" : undefined}
                        style={navigationToneVariables[tone]}
                        className={mobileNavLinkClasses}
                      >
                        {iconElement ? (
                          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[color:color-mix(in_srgb,var(--nav-tonal-color)_12%,transparent)] text-[color:var(--nav-tonal-color)] ring-1 ring-inset ring-[color:color-mix(in_srgb,var(--nav-tonal-color)_35%,transparent)] transition group-data-[active=true]:bg-[color:var(--nav-tonal-color)] group-data-[active=true]:text-[color:var(--background)]">
                            {iconElement}
                          </span>
                        ) : null}
                        <span className="flex-1 space-y-1">
                          <span className="flex items-center gap-2">
                            <span className="truncate text-base font-semibold">
                              {item.label}
                            </span>
                            {badgeElement}
                          </span>
                          {item.description ? (
                            <span className="block text-sm text-muted-foreground">
                              {item.description}
                            </span>
                          ) : null}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>

            <nav aria-label="Weitere Links" className="space-y-3">
              <p className={mobileSectionLabelClasses}>Mehr entdecken</p>
              <ul className="flex flex-col gap-2">
                {secondaryNavItems.map((item) => {
                  const isActive = pathname === item.href;
                  const tone = item.tone ?? "default";
                  const iconElement = getNavigationIcon(item, {
                    isActive,
                    className: "h-5 w-5",
                  });
                  const badgeElement = getNavigationBadge(item, {
                    className: "ml-auto shrink-0 text-xs",
                  });

                  return (
                    <li key={`${item.href}-secondary`}>
                      <Link
                        href={item.href}
                        onClick={closeDrawer}
                        aria-current={isActive ? "page" : undefined}
                        data-active={isActive ? "true" : undefined}
                        style={navigationToneVariables[tone]}
                        className={mobileNavLinkClasses}
                      >
                        {iconElement ? (
                          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[color:color-mix(in_srgb,var(--nav-tonal-color)_12%,transparent)] text-[color:var(--nav-tonal-color)] ring-1 ring-inset ring-[color:color-mix(in_srgb,var(--nav-tonal-color)_35%,transparent)] transition group-data-[active=true]:bg-[color:var(--nav-tonal-color)] group-data-[active=true]:text-[color:var(--background)]">
                            {iconElement}
                          </span>
                        ) : null}
                        <span className="flex-1 space-y-1">
                          <span className="flex items-center gap-2">
                            <span className="truncate text-base font-semibold">
                              {item.label}
                            </span>
                            {badgeElement}
                          </span>
                          {item.description ? (
                            <span className="block text-sm text-muted-foreground">
                              {item.description}
                            </span>
                          ) : null}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>

            <div className="mt-auto space-y-4">
              <Button
                asChild
                variant="secondary"
                size="md"
                className="w-full justify-center"
                onClick={closeDrawer}
              >
                <Link href={ctaNavigation.href}>{ctaNavigation.label}</Link>
              </Button>
            </div>
          </div>
        </FocusScope>
      </SheetContent>
    </Sheet>
  );
}

const navigationToneVariables: Record<NavigationItemTone, CSSProperties> = {
  default: {
    "--nav-tonal-color": "var(--foreground)",
    "--nav-tonal-label": "color-mix(in srgb, var(--foreground) 70%, transparent)",
    "--nav-tonal-hover": "color-mix(in srgb, var(--foreground) 12%, transparent)",
    "--nav-tonal-container": "color-mix(in srgb, var(--foreground) 18%, transparent)",
    "--nav-tonal-ring": "color-mix(in srgb, var(--foreground) 38%, transparent)",
  },
  muted: {
    "--nav-tonal-color": "var(--muted-foreground)",
    "--nav-tonal-label": "color-mix(in srgb, var(--muted-foreground) 70%, transparent)",
    "--nav-tonal-hover": "color-mix(in srgb, var(--muted-foreground) 12%, transparent)",
    "--nav-tonal-container": "color-mix(in srgb, var(--muted-foreground) 18%, transparent)",
    "--nav-tonal-ring": "color-mix(in srgb, var(--muted-foreground) 38%, transparent)",
  },
  primary: {
    "--nav-tonal-color": "var(--primary)",
    "--nav-tonal-label": "color-mix(in srgb, var(--primary) 70%, transparent)",
    "--nav-tonal-hover": "color-mix(in srgb, var(--primary) 12%, transparent)",
    "--nav-tonal-container": "color-mix(in srgb, var(--primary) 18%, transparent)",
    "--nav-tonal-ring": "color-mix(in srgb, var(--primary) 38%, transparent)",
  },
  success: {
    "--nav-tonal-color": "var(--success)",
    "--nav-tonal-label": "color-mix(in srgb, var(--success) 70%, transparent)",
    "--nav-tonal-hover": "color-mix(in srgb, var(--success) 12%, transparent)",
    "--nav-tonal-container": "color-mix(in srgb, var(--success) 18%, transparent)",
    "--nav-tonal-ring": "color-mix(in srgb, var(--success) 38%, transparent)",
  },
  info: {
    "--nav-tonal-color": "var(--info)",
    "--nav-tonal-label": "color-mix(in srgb, var(--info) 70%, transparent)",
    "--nav-tonal-hover": "color-mix(in srgb, var(--info) 12%, transparent)",
    "--nav-tonal-container": "color-mix(in srgb, var(--info) 18%, transparent)",
    "--nav-tonal-ring": "color-mix(in srgb, var(--info) 38%, transparent)",
  },
  warning: {
    "--nav-tonal-color": "var(--warning)",
    "--nav-tonal-label": "color-mix(in srgb, var(--warning) 70%, transparent)",
    "--nav-tonal-hover": "color-mix(in srgb, var(--warning) 12%, transparent)",
    "--nav-tonal-container": "color-mix(in srgb, var(--warning) 18%, transparent)",
    "--nav-tonal-ring": "color-mix(in srgb, var(--warning) 38%, transparent)",
  },
  destructive: {
    "--nav-tonal-color": "var(--destructive)",
    "--nav-tonal-label": "color-mix(in srgb, var(--destructive) 70%, transparent)",
    "--nav-tonal-hover": "color-mix(in srgb, var(--destructive) 12%, transparent)",
    "--nav-tonal-container": "color-mix(in srgb, var(--destructive) 18%, transparent)",
    "--nav-tonal-ring": "color-mix(in srgb, var(--destructive) 38%, transparent)",
  },
};
