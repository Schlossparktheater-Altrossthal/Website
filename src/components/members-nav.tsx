"use client";

import { useMemo } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { Role } from "@/lib/roles";
import { cn } from "@/lib/utils";

type Item = { href: string; label: string; roles?: Role[] };
type Group = { label: string; items: Item[] };

const groupedConfig: Group[] = [
  {
    label: "Allgemein",
    items: [
      { href: "/mitglieder", label: "Dashboard" },
      { href: "/mitglieder/profil", label: "Profil" },
    ],
  },
  {
    label: "Proben",
    items: [
      { href: "/mitglieder/probenplanung", label: "Probenplanung", roles: ["board", "admin", "tech", "owner"] },
      { href: "/mitglieder/sperrliste", label: "Sperrliste" },
    ],
  },
  {
    label: "Verwaltung",
    items: [
      { href: "/mitglieder/rollenverwaltung", label: "Rollenverwaltung", roles: ["admin", "owner"] },
      { href: "/mitglieder/rechte", label: "Rechteverwaltung", roles: ["admin", "owner"] },
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
    case "/mitglieder": // Home
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m3 10 9-7 9 7" />
          <path d="M5 10v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V10" />
        </svg>
      );
    case "/mitglieder/profil": // User
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="8" r="4" />
          <path d="M6 20c0-3.314 2.686-6 6-6s6 2.686 6 6" />
        </svg>
      );
    case "/mitglieder": // Dashboard icon for entry page
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 13h8V3H3zM13 21h8v-8h-8zM13 3v8h8V3zM3 21h8v-4H3z" />
        </svg>
      );
    case "/mitglieder/sperrliste": // Ban
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9" />
          <path d="m5 5 14 14" />
        </svg>
      );
    case "/mitglieder/probenplanung": // Calendar
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M16 2v4M8 2v4M3 10h18" />
        </svg>
      );
    case "/mitglieder/rollenverwaltung": // Users/settings
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="m20 8 1 1 2-2" />
        </svg>
      );
    case "/mitglieder/rechte": // Shield
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-3 8-10V5l-8-3-8 3v7c0 7 8 10 8 10Z" />
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

export function MembersNav({ roles }: { roles?: Role[] }) {
  const pathname = usePathname();
  const router = useRouter();

  const { groups, flat } = useMemo(() => {
    const roleSet = new Set(roles ?? []);
    const groups = groupedConfig
      .map((g) => ({
        label: g.label,
        items: g.items.filter((i) => !i.roles || i.roles.some((r) => roleSet.has(r))),
      }))
      .filter((g) => g.items.length > 0);
    const flat = groups.flatMap((g) => g.items);
    return { groups, flat } as { groups: Group[]; flat: Item[] };
  }, [roles]);

  const activeItem = useMemo(() => flat.find((item) => isActive(pathname, item.href)), [flat, pathname]);
  const activeHref = activeItem?.href ?? flat[0]?.href ?? "";

  return (
    <div className="flex flex-col gap-4">
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
