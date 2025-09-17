"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Role } from "@/lib/roles";

type Item = { href: string; label: string; roles?: Role[] };

const baseItems: Item[] = [
  { href: "/mitglieder", label: "Übersicht" },
  { href: "/mitglieder/dashboard", label: "Dashboard" },
  { href: "/mitglieder/sperrliste", label: "Sperrliste" },
  { href: "/mitglieder/probenplanung", label: "Probenplanung", roles: ["board", "admin", "tech"] },
  { href: "/mitglieder/rollenverwaltung", label: "Rollenverwaltung", roles: ["admin"] },
];

export function MembersNav({ roles }: { roles?: Role[] }) {
  const pathname = usePathname();
  const roleSet = new Set(roles ?? []);
  const items = baseItems.filter((i) => (i.roles ? i.roles.some((r) => roleSet.has(r)) : true));

  return (
    <>
      {/* Desktop sidebar */}
      <nav className="hidden md:block space-y-1" aria-label="Mitglieder Navigation">
        {items.map((i) => {
          // Exakte Übereinstimmung oder exakter Pfad-Start (verhindert /verfuegbarkeit-proben triggert /verfuegbarkeit)
          const active = pathname === i.href || 
            (i.href !== "/mitglieder" && pathname.startsWith(i.href + "/"));
          return (
            <Link
              key={i.href}
              href={i.href}
              className={`block rounded-md px-3 py-2 text-sm transition-colors border ${
                active
                  ? "bg-accent/30 border-border/60 text-foreground"
                  : "border-transparent hover:bg-accent/20 text-foreground/90"
              }`}
            >
              {i.label}
            </Link>
          );
        })}
      </nav>

      {/* Mobile pills */}
      <nav className="md:hidden -mx-1 mb-3 flex items-center gap-2 overflow-x-auto" aria-label="Mitglieder Navigation mobil">
        {items.map((i) => {
          // Exakte Übereinstimmung oder exakter Pfad-Start (verhindert /verfuegbarkeit-proben triggert /verfuegbarkeit)
          const active = pathname === i.href || 
            (i.href !== "/mitglieder" && pathname.startsWith(i.href + "/"));
          return (
            <Link
              key={i.href}
              href={i.href}
              className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-sm ${
                active ? "bg-accent/30 border-border/60" : "border-border/50 hover:bg-accent/20"
              }`}
            >
              {i.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
