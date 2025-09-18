"use client";

import { useMemo } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

type Item = { href: string; label: string; permissionKey?: string };
type Group = { label: string; items: Item[] };

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
    label: "Verwaltung",
    items: [
      { href: "/mitglieder/mitgliederverwaltung", label: "Mitgliederverwaltung", permissionKey: "mitglieder.rollenverwaltung" },
      { href: "/mitglieder/rechte", label: "Rechteverwaltung", permissionKey: "mitglieder.rechte" },
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
    default:
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="2" />
        </svg>
      );
  }
}

export function MembersNav({ permissions }: { permissions?: string[] }) {
  const pathname = usePathname();
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
