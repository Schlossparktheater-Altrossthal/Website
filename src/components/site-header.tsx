"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { UserNav } from "@/components/user-nav";
import { NotificationBell } from "@/components/notification-bell";

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();
  const isHomePage = pathname === '/';
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

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
    <header className={`fixed top-0 w-full z-50 transition-all duration-300 ${
      scrolled || !isHomePage
        ? 'bg-background/95 backdrop-blur-md border-b border-border/50 shadow-lg' 
        : 'bg-gradient-to-b from-black/40 via-black/25 via-black/12 to-transparent backdrop-blur-[1px]'
    }`}>
      <div className={`${!scrolled && isHomePage ? 'h-32 bg-gradient-to-b from-transparent via-transparent to-transparent absolute inset-x-0 top-full' : ''}`} />
      <nav
        aria-label="Hauptnavigation"
        className="container mx-auto flex flex-wrap items-center gap-3 sm:gap-4 md:gap-6 px-4 py-3 sm:px-6 sm:py-4"
      >
        <Link className={`font-serif text-lg sm:text-xl transition-all duration-300 ${
          scrolled || !isHomePage
            ? 'text-primary hover:opacity-90'
            : 'text-white hover:text-primary/90 drop-shadow-lg'
        }`} href="/">
          Sommertheater
        </Link>

        <div className="hidden md:flex items-center gap-6">
          <Link
            className={`transition-all duration-300 ${
              scrolled || !isHomePage
                ? 'text-foreground/90 hover:text-primary'
                : 'text-white/90 hover:text-white drop-shadow-lg'
            }`}
            href="/ueber-uns"
          >
            Über uns
          </Link>
          <Link
            className={`transition-all duration-300 ${
              scrolled || !isHomePage
                ? 'text-foreground/90 hover:text-primary'
                : 'text-white/90 hover:text-white drop-shadow-lg'
            }`}
            href="/mystery"
          >
            Das Geheimnis
          </Link>
          <Link
            className={`transition-all duration-300 ${
              scrolled || !isHomePage
                ? 'text-foreground/90 hover:text-primary'
                : 'text-white/90 hover:text-white drop-shadow-lg'
            }`}
            href="/chronik"
          >
            Chronik
          </Link>
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
            className={`md:hidden inline-flex h-9 w-9 items-center justify-center rounded-md transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-ring ${
              scrolled || !isHomePage
                ? 'border border-border/60 hover:bg-accent/30 text-foreground'
                : 'border border-white/30 hover:bg-white/20 text-white drop-shadow-lg'
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
        <div className="md:hidden fixed inset-0 z-[60]" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div
            ref={panelRef}
            id="mobile-menu"
            className="absolute right-0 top-0 h-screen w-64 max-w-[80vw] border-l border-border/60 bg-card/95 backdrop-blur-md p-6 pt-20 shadow-2xl flex flex-col gap-4"
          >
            <Link
              onClick={() => setOpen(false)}
              className="block px-4 py-3 rounded-lg hover:bg-accent/30 transition-colors duration-200 text-foreground/90 hover:text-foreground font-medium"
              href="/ueber-uns"
            >
              Über uns
            </Link>
            <Link
              onClick={() => setOpen(false)}
              className="block px-4 py-3 rounded-lg hover:bg-accent/30 transition-colors duration-200 text-foreground/90 hover:text-foreground font-medium"
              href="/mystery"
            >
              Das Geheimnis
            </Link>
            <Link 
              onClick={() => setOpen(false)} 
              className="block px-4 py-3 rounded-lg hover:bg-accent/30 transition-colors duration-200 text-foreground/90 hover:text-foreground font-medium" 
              href="/chronik"
            >
              Chronik
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}

