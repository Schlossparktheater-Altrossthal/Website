"use client";

import { useMemo } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

type Item = { href: string; label: string; permissionKey?: string };
type Group = { label: string; items: Item[] };
type ActiveProductionNavInfo = { id: string; title: string | null; year: number };

const groupedConfig: Group[] = [
  {
    label: "Allgemein",
    items: [
      { href: "/mitglieder", label: "Dashboard", permissionKey: "mitglieder.dashboard" },
      { href: "/mitglieder/profil", label: "Profil", permissionKey: "mitglieder.profil" },
    ],
  },
  {
    label: "Proben",
    items: [
      { href: "/mitglieder/meine-proben", label: "Meine Proben", permissionKey: "mitglieder.meine-proben" },
      { href: "/mitglieder/probenplanung", label: "Probenplanung", permissionKey: "mitglieder.probenplanung" },
      { href: "/mitglieder/sperrliste", label: "Sperrliste", permissionKey: "mitglieder.sperrliste" },
    ],
  },
  {
    label: "Produktion",
    items: [
      { href: "/mitglieder/produktionen", label: "Übersicht", permissionKey: "mitglieder.produktionen" },
      { href: "/mitglieder/produktionen/gewerke", label: "Gewerke & Teams", permissionKey: "mitglieder.produktionen" },
      {
        href: "/mitglieder/produktionen/besetzung",
        label: "Rollen & Besetzung",
        permissionKey: "mitglieder.produktionen",
      },
      {
        href: "/mitglieder/produktionen/szenen",
        label: "Szenen & Breakdowns",
        permissionKey: "mitglieder.produktionen",
      },
    ],
  },
  {
    label: "Verwaltung",
    items: [
      { href: "/mitglieder/mitgliederverwaltung", label: "Mitgliederverwaltung", permissionKey: "mitglieder.rollenverwaltung" },
      { href: "/mitglieder/onboarding-analytics", label: "Onboarding Analytics", permissionKey: "mitglieder.onboarding.analytics" },
      { href: "/mitglieder/rechte", label: "Rechteverwaltung", permissionKey: "mitglieder.rechte" },
      { href: "/mitglieder/fotoerlaubnisse", label: "Fotoerlaubnisse", permissionKey: "mitglieder.fotoerlaubnisse" },
    ],
  },
];

function isActive(pathname: string, href: string) {
  if (pathname === href) return true;
  if (href === "/mitglieder") return false;
  return pathname.startsWith(`${href}/`);
}

function NavIcon({ name, className }: { name: string; className?: string }) {
  const cls = cn("h-4 w-4", className);
  switch (name) {
    case "/mitglieder":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 13h8V3H3zM13 21h8v-8h-8zM13 3v8h8V3zM3 21h8v-4H3z" />
        </svg>
      );
    case "/mitglieder/profil":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="8" r="4" />
          <path d="M6 20c0-3.314 2.686-6 6-6s6 2.686 6 6" />
        </svg>
      );
    case "/mitglieder/meine-proben":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 6a2 2 0 0 1 2-2h6" />
          <path d="M20 10v8a2 2 0 0 1-2 2h-6" />
          <circle cx="9" cy="10" r="3" />
          <path d="M4 20c0-2.761 2.239-5 5-5" />
          <path d="m15 5 2 2 4-4" />
          <path d="M14 9h6" />
        </svg>
      );
    case "/mitglieder/sperrliste":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9" />
          <path d="m5 5 14 14" />
        </svg>
      );
    case "/mitglieder/probenplanung":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M16 2v4M8 2v4M3 10h18" />
        </svg>
      );
    case "/mitglieder/produktionen":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 4h18v4H3z" />
          <path d="M5 8v12h14V8" />
          <path d="M9 12h6" />
          <path d="M9 16h6" />
        </svg>
      );
    case "/mitglieder/produktionen/gewerke":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="7" cy="7" r="2.5" />
          <circle cx="17" cy="7" r="2.5" />
          <circle cx="12" cy="17" r="2.5" />
          <path d="M9.5 7h5" />
          <path d="M9.4 8.6L12 12" />
          <path d="M14.6 8.6 12 12" />
          <path d="M12 14.5V12" />
        </svg>
      );
    case "/mitglieder/produktionen/besetzung":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="9" cy="8" r="3" />
          <path d="M4 20c0-3 2.239-5.5 5-5.5S14 17 14 20" />
          <path d="M17 11a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" />
          <path d="M20.5 20c0-2.485-2.015-4.5-4.5-4.5" />
        </svg>
      );
    case "/mitglieder/produktionen/szenen":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 9h18v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <path d="M3 9l2.5-5h5L8 9" />
          <path d="M8 9l2.5-5h5L13 9" />
          <path d="M3 13h18" />
        </svg>
      );
    case "/mitglieder/mitgliederverwaltung":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="m20 8 1 1 2-2" />
        </svg>
      );
    case "/mitglieder/rechte":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-3 8-10V5l-8-3-8 3v7c0 7 8 10 8 10Z" />
        </svg>
      );
    case "/mitglieder/fotoerlaubnisse":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h3l2-3h4l2 3h3a2 2 0 0 1 2 2Z" />
          <circle cx="12" cy="14" r="3" />
        </svg>
      );
    default:
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="2" />
        </svg>
      );
  }
}

export function MembersNav({
  permissions,
  activeProduction,
}: {
  permissions?: string[];
  activeProduction?: ActiveProductionNavInfo;
}) {
  const pathname = usePathname() ?? "";
  const router = useRouter();

  const { groups, flat } = useMemo(() => {
    const permissionSet = new Set(permissions ?? []);
    const groups = groupedConfig
      .map((g) => ({
        label: g.label,
        items: g.items.filter((i) => !i.permissionKey || permissionSet.has(i.permissionKey!)),
      }))
      .filter((g) => g.items.length > 0);
    const flat = groups.flatMap((g) => g.items);
    return { groups, flat } as { groups: Group[]; flat: Item[] };
  }, [permissions]);

  const activeItem = useMemo(() => flat.find((item) => isActive(pathname, item.href)), [flat, pathname]);
  const activeHref = activeItem?.href ?? flat[0]?.href ?? "";

  const activeProductionTitle = activeProduction
    ? activeProduction.title && activeProduction.title.trim()
      ? activeProduction.title
      : `Produktion ${activeProduction.year}`
    : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border border-border/50 bg-background/60 p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wide text-foreground/50">
              Aktive Produktion
            </div>
            {activeProduction && activeProductionTitle ? (
              <>
                <div className="mt-1 text-sm font-semibold text-foreground">{activeProductionTitle}</div>
                <div className="text-xs text-muted-foreground">Jahrgang {activeProduction.year}</div>
              </>
            ) : (
              <p className="mt-1 text-xs text-muted-foreground">
                Noch keine Produktion ausgewählt. Wähle in der Übersicht eine aktive Produktion aus.
              </p>
            )}
          </div>
          <Link
            href="/mitglieder/produktionen"
            className="text-xs font-medium text-primary transition hover:text-primary/80"
          >
            Übersicht öffnen
          </Link>
        </div>
      </div>

      <div className="lg:hidden">
        <label htmlFor="members-navigation" className="sr-only">
          Bereich im Mitgliederbereich wählen
        </label>
        <select
          id="members-navigation"
          value={activeHref}
          onChange={(event) => {
            const next = event.target.value;
            if (next && next !== pathname) {
              router.push(next);
            }
          }}
          className="block w-full rounded-md border border-border bg-background px-3 py-2 text-sm shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Mitgliederbereich"
          disabled={flat.length === 0}
        >
          {groups.map((g) => (
            <optgroup key={g.label} label={g.label}>
              {g.items.map((item) => (
                <option key={item.href} value={item.href}>
                  {item.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      <nav className="hidden lg:flex flex-col gap-4" aria-label="Mitglieder Navigation">
        {groups.map((g) => (
          <div key={g.label} className="flex flex-col gap-2 rounded-lg border border-border/60 bg-background/50 p-2">
            <div className="px-1 text-[11px] uppercase tracking-wide text-foreground/60">{g.label}</div>
            {g.items.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "group flex items-center rounded-md border px-3 py-2 text-sm font-medium transition-colors",
                    active
                      ? "border-border bg-accent/40 text-foreground shadow-sm"
                      : "border-transparent text-muted-foreground hover:border-border/60 hover:bg-accent/20 hover:text-foreground"
                  )}
                >
                  <span className={cn("mr-2 opacity-75", active && "opacity-100")}>
                    <NavIcon name={item.href} />
                  </span>
                  <span>{item.label}</span>
                  <span
                    className={cn(
                      "ml-auto hidden h-4 w-1 rounded bg-primary/70 transition-opacity group-hover:opacity-100",
                      active ? "opacity-100" : "opacity-0"
                    )}
                    aria-hidden
                  />
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
    </div>
  );
}
