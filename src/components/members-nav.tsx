"use client";

import { useId, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Item = { href: string; label: string; permissionKey?: string };
type Group = { label: string; items: Item[] };
type ActiveProductionNavInfo = { id: string; title: string | null; year: number };
export type AssignmentFocus = "none" | "rehearsals" | "departments" | "both";

const GENERAL_ITEMS: Item[] = [
  { href: "/mitglieder", label: "Dashboard", permissionKey: "mitglieder.dashboard" },
  { href: "/mitglieder/profil", label: "Profil", permissionKey: "mitglieder.profil" },
  { href: "/mitglieder/galerie", label: "Galerie", permissionKey: "mitglieder.galerie" },
  { href: "/mitglieder/sperrliste", label: "Sperrliste", permissionKey: "mitglieder.sperrliste" },
  { href: "/mitglieder/issues", label: "Feedback & Support", permissionKey: "mitglieder.issues" },
];

const ASSIGNMENT_ITEMS: Item[] = [
  { href: "/mitglieder/meine-proben", label: "Meine Proben", permissionKey: "mitglieder.meine-proben" },
  { href: "/mitglieder/meine-gewerke", label: "Meine Gewerke", permissionKey: "mitglieder.meine-gewerke" },
  { href: "/mitglieder/koerpermasse", label: "Körpermaße", permissionKey: "mitglieder.koerpermasse" },
  { href: "/mitglieder/probenplanung", label: "Probenplanung", permissionKey: "mitglieder.probenplanung" },
  { href: "/mitglieder/essenplanung", label: "Essensplanung", permissionKey: "mitglieder.essenplanung" },
];

const PRODUCTION_ITEMS: Item[] = [
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
];

const FINANCE_ITEMS: Item[] = [
  { href: "/mitglieder/finanzen", label: "Finanz-Dashboard", permissionKey: "mitglieder.finanzen" },
  { href: "/mitglieder/finanzen/buchungen", label: "Buchungen", permissionKey: "mitglieder.finanzen" },
  { href: "/mitglieder/finanzen/budgets", label: "Budgets", permissionKey: "mitglieder.finanzen" },
  { href: "/mitglieder/finanzen/export", label: "Exporte", permissionKey: "mitglieder.finanzen.export" },
];

const ADMIN_ITEMS: Item[] = [
  { href: "/mitglieder/mitgliederverwaltung", label: "Mitgliederverwaltung", permissionKey: "mitglieder.rollenverwaltung" },
  { href: "/mitglieder/onboarding-analytics", label: "Onboarding Analytics", permissionKey: "mitglieder.onboarding.analytics" },
  { href: "/mitglieder/server-analytics", label: "Server-Statistiken", permissionKey: "mitglieder.server.analytics" },
  { href: "/mitglieder/rechte", label: "Rechteverwaltung", permissionKey: "mitglieder.rechte" },
  { href: "/mitglieder/fotoerlaubnisse", label: "Fotoerlaubnisse", permissionKey: "mitglieder.fotoerlaubnisse" },
];

function resolveAssignmentLabel(focus: AssignmentFocus, permissions: readonly string[] | Set<string>) {
  if (focus === "both") return "Proben & Gewerke";
  if (focus === "departments") return "Gewerke";
  if (focus === "rehearsals") return "Proben";
  const permissionSet = permissions instanceof Set ? permissions : new Set(permissions);
  const canSeeRehearsals = permissionSet.has("mitglieder.meine-proben");
  const canSeeDepartments = permissionSet.has("mitglieder.meine-gewerke");
  if (canSeeRehearsals && canSeeDepartments) return "Proben & Gewerke";
  if (canSeeDepartments) return "Gewerke";
  return "Proben";
}

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
    case "/mitglieder/galerie":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 8a2 2 0 0 1 2-2h2l1.2-2h5.6L15 6h2a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
          <circle cx="12" cy="12" r="3" />
          <path d="M7 8h2" />
        </svg>
      );
    case "/mitglieder/issues":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H9l-4 4v-4H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z" />
          <path d="M9 7h6" />
          <path d="M9 11h6" />
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
    case "/mitglieder/meine-gewerke":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="5" y="4" width="14" height="16" rx="2" />
          <path d="M9 2h6" />
          <path d="M12 2v2" />
          <path d="M8 10h8" />
          <path d="M8 14h8" />
          <path d="M8 18h5" />
          <path d="m6 15 1.8 1.8L10 14" />
        </svg>
      );
    case "/mitglieder/koerpermasse":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="6" width="18" height="12" rx="2" />
          <path d="M6 10h.01" />
          <path d="M9 10h.01" />
          <path d="M12 10h.01" />
          <path d="M15 10h.01" />
          <path d="M18 10h.01" />
          <path d="M6 14h6" />
          <path d="M6 18v2" />
          <path d="M18 18v2" />
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
    case "/mitglieder/essenplanung":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m16 2-2.3 2.3a3 3 0 0 0 0 4.2l1.8 1.8a3 3 0 0 0 4.2 0L22 8" />
          <path d="M15 15 3.3 3.3a4.2 4.2 0 0 0 0 6l7.3 7.3c.7.7 2 .7 2.8 0L15 15Zm0 0 7 7" />
          <path d="m2.1 21.8 6.4-6.3" />
          <path d="m19 5-7 7" />
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
    case "/mitglieder/server-analytics":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 20h16" />
          <path d="M6 16l4-6 3 4 4-7 3 5" />
        </svg>
      );
    case "/mitglieder/finanzen":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="6" width="18" height="12" rx="2" />
          <path d="M7 10h10" />
          <path d="M7 14h6" />
          <circle cx="9" cy="10" r="0.5" fill="currentColor" />
          <circle cx="15" cy="14" r="0.5" fill="currentColor" />
        </svg>
      );
    case "/mitglieder/finanzen/buchungen":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 6h16v4H4z" />
          <path d="M7 10v8a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-8" />
          <path d="M9 14h6" />
          <path d="M9 18h4" />
        </svg>
      );
    case "/mitglieder/finanzen/budgets":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 19h16" />
          <path d="M7 19v-7" />
          <path d="M12 19v-11" />
          <path d="M17 19v-5" />
          <path d="M5 8h14l-2-3H7z" />
        </svg>
      );
    case "/mitglieder/finanzen/export":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3v12" />
          <path d="m8 11 4 4 4-4" />
          <path d="M4 19h16" />
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
  assignmentFocus = "none",
}: {
  permissions?: string[];
  activeProduction?: ActiveProductionNavInfo;
  assignmentFocus?: AssignmentFocus;
}) {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();
  const isFiltering = normalizedQuery.length > 0;
  const searchInputId = useId();

  const assignmentLabel = useMemo(
    () => resolveAssignmentLabel(assignmentFocus, permissions ?? []),
    [assignmentFocus, permissions],
  );

  const groupedConfig = useMemo<Group[]>(
    () => [
      { label: "Allgemein", items: GENERAL_ITEMS },
      { label: assignmentLabel, items: ASSIGNMENT_ITEMS },
      { label: "Produktion", items: PRODUCTION_ITEMS },
      { label: "Finanzen", items: FINANCE_ITEMS },
      { label: "Verwaltung", items: ADMIN_ITEMS },
    ],
    [assignmentLabel],
  );

  const { groups: availableGroups, flat: availableFlat } = useMemo(() => {
    const permissionSet = new Set(permissions ?? []);
    const groups = groupedConfig
      .map((g) => ({
        label: g.label,
        items: g.items.filter((i) => !i.permissionKey || permissionSet.has(i.permissionKey!)),
      }))
      .filter((g) => g.items.length > 0);
    const flat = groups.flatMap((g) => g.items);
    return { groups, flat } as { groups: Group[]; flat: Item[] };
  }, [groupedConfig, permissions]);

  const activeItem = useMemo(
    () => availableFlat.find((item) => isActive(pathname, item.href)),
    [availableFlat, pathname],
  );
  const activeHref = activeItem?.href ?? availableFlat[0]?.href ?? "";

  const { groups, flat } = useMemo(() => {
    if (!isFiltering) {
      return { groups: availableGroups, flat: availableFlat };
    }

    const filteredGroups = availableGroups
      .map((group) => ({
        label: group.label,
        items: group.items.filter((item) => item.label.toLowerCase().includes(normalizedQuery)),
      }))
      .filter((group) => group.items.length > 0);

    const filteredFlat = filteredGroups.flatMap((group) => group.items);

    return { groups: filteredGroups, flat: filteredFlat };
  }, [availableFlat, availableGroups, isFiltering, normalizedQuery]);

  const hasResults = flat.length > 0;
  const selectValue = hasResults && flat.some((item) => item.href === activeHref) ? activeHref : "";
  const emptyStateMessage = isFiltering
    ? "Keine Bereiche gefunden. Passe die Suche an."
    : "Keine Bereiche verfügbar.";
  const firstMatch = flat[0];

  const activeProductionTitle = activeProduction
    ? activeProduction.title && activeProduction.title.trim()
      ? activeProduction.title
      : `Produktion ${activeProduction.year}`
    : null;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <label htmlFor={searchInputId} className="sr-only">
          Mitgliederbereiche durchsuchen
        </label>
        <Input
          id={searchInputId}
          type="search"
          inputMode="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape" && query) {
              event.preventDefault();
              setQuery("");
              return;
            }

            if (event.key === "Enter" && firstMatch) {
              event.preventDefault();
              if (firstMatch.href && firstMatch.href !== pathname) {
                router.push(firstMatch.href);
              }
            }
          }}
          placeholder="Bereiche suchen"
          className="h-9 text-sm"
          aria-label="Mitgliederbereiche durchsuchen"
        />
      </div>

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
          value={selectValue}
          onChange={(event) => {
            const next = event.target.value;
            if (next && next !== pathname) {
              router.push(next);
            }
          }}
          className="block w-full rounded-md border border-border bg-background px-3 py-2 text-sm shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Mitgliederbereich"
          disabled={!hasResults}
        >
          <option value="" disabled>
            {hasResults
              ? isFiltering
                ? "Treffer auswählen"
                : "Bereich wählen"
              : emptyStateMessage}
          </option>
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
        {groups.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border/60 bg-background/40 p-4 text-sm text-muted-foreground">
            {emptyStateMessage}
          </div>
        ) : (
          groups.map((g) => (
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
          ))
        )}
      </nav>
    </div>
  );
}
