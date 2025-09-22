"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";

import { NotificationBell } from "@/components/notification-bell";
import { UserNav } from "@/components/user-nav";
import { ctaNavigation, primaryNavigation } from "@/config/navigation";

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
        className={`${
          !scrolled && isHomePage
            ? "absolute inset-x-0 top-full h-32 bg-gradient-to-b from-transparent via-transparent to-transparent"
            : ""
        }`}
      />
      <nav
        aria-label="Hauptnavigation"
        className="layout-container flex flex-wrap items-center gap-3 px-3 py-3 sm:gap-4 md:gap-6 md:py-4"
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

        <div className="hidden items-center gap-6 md:flex">
          {navigationItems.map((item) => {
            const isActive =
              pathname === item.href || pathname?.startsWith(`${item.href}/`);

            return (
              <Link
                key={item.href}
                className={`transition-all duration-300 ${
                  scrolled || !isHomePage
                    ? "text-foreground/90 hover:text-primary"
                    : "text-foreground/90 drop-shadow-lg hover:text-foreground"
                } ${isActive ? "font-semibold" : ""}`}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
              >
                {item.label}
              </Link>
            );
          })}
        </div>

        <div className="ml-auto flex items-center gap-2 sm:gap-3">
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
            className={`inline-flex h-9 w-9 items-center justify-center rounded-md transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-ring md:hidden ${
              scrolled || !isHomePage
                ? "border border-border/60 text-foreground hover:bg-accent/30"
                : "border border-border/60 text-foreground drop-shadow-lg hover:bg-accent/20"
            }`}
          >
            <span className="sr-only">Menü</span>
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
            className="absolute right-0 top-0 flex h-screen w-64 max-w-[80vw] flex-col gap-4 border-l border-border/60 bg-card/95 p-6 pt-20 shadow-2xl backdrop-blur-md"
          >
            <div className="flex flex-col gap-2">
              {navigationItems.map((item) => {
                const isActive =
                  pathname === item.href || pathname?.startsWith(`${item.href}/`);

                return (
                  <Link
                    key={item.href}
                    onClick={() => setOpen(false)}
                    className={`block rounded-lg px-4 py-3 text-foreground/90 transition-colors duration-200 hover:bg-accent/30 hover:text-foreground ${
                      isActive ? "bg-accent/20 font-semibold" : ""
                    }`}
                    href={item.href}
                    aria-current={isActive ? "page" : undefined}
                  >
                    <span className="block font-medium">{item.label}</span>
                    {item.description ? (
                      <span className="mt-1 block text-sm text-muted-foreground">
                        {item.description}
                      </span>
                    ) : null}
                  </Link>
                );
              })}
            </div>

            <div className="mt-auto space-y-3 border-t border-border/60 pt-4 text-sm text-muted-foreground">
              <span className="block text-xs uppercase tracking-[0.12em] text-foreground/70">
                Bleib verbunden
              </span>
              <Link
                href={ctaNavigation.href}
                className="block rounded-lg border border-dashed border-primary/50 bg-primary/10 px-4 py-3 text-foreground transition-colors hover:border-primary hover:bg-primary/20"
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

