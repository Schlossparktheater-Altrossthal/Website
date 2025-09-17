"use client";

import { useMemo } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { Role } from "@/lib/roles";
import { cn } from "@/lib/utils";

type Item = { href: string; label: string; roles?: Role[] };

const baseItems: Item[] = [
  { href: "/mitglieder", label: "Übersicht" },
  { href: "/mitglieder/profil", label: "Profil" },
  { href: "/mitglieder/dashboard", label: "Dashboard" },
  { href: "/mitglieder/sperrliste", label: "Sperrliste" },
  { href: "/mitglieder/probenplanung", label: "Probenplanung", roles: ["board", "admin", "tech", "owner"] },
  { href: "/mitglieder/rollenverwaltung", label: "Rollenverwaltung", roles: ["admin", "owner"] },
  { href: "/mitglieder/rechte", label: "Rechteverwaltung", roles: ["admin", "owner"] },
];

function isActive(pathname: string, href: string) {
  if (pathname === href) return true;
  if (href === "/mitglieder") return false;
  return pathname.startsWith(`${href}/`);
}

export function MembersNav({ roles }: { roles?: Role[] }) {
  const pathname = usePathname();
  const router = useRouter();

  const items = useMemo(() => {
    if (!roles || roles.length === 0) {
      return baseItems;
    }
    const roleSet = new Set(roles);
    return baseItems.filter((item) => !item.roles || item.roles.some((role) => roleSet.has(role)));
  }, [roles]);

  const activeItem = useMemo(() => items.find((item) => isActive(pathname, item.href)), [items, pathname]);
  const activeHref = activeItem?.href ?? items[0]?.href ?? "";

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
          disabled={items.length === 0}
        >
          {items.map((item) => (
            <option key={item.href} value={item.href}>
              {item.label}
            </option>
          ))}
        </select>
      </div>

      <nav className="hidden lg:flex flex-col gap-1" aria-label="Mitglieder Navigation">
        {items.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center rounded-md border px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "border-border bg-accent/40 text-foreground shadow-sm"
                  : "border-transparent text-muted-foreground hover:border-border/60 hover:bg-accent/20 hover:text-foreground"
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
