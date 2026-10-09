"use client";

import { useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { LinkPendingIndicator } from "@/components/link-pending-indicator";
import { MenuIcon } from "@/components/ui/action-icons";
import { useSidebar } from "@/components/ui/sidebar";
import {
  isMembersNavItemActive,
  useMembersNavGroups,
  type MembersNavData,
} from "@/components/members-nav";
import { defaultMembersNavIcon } from "@/config/members-navigation";
import { cn } from "@/lib/utils";

/** Hauptziele der mobilen Leiste – kurze Beschriftung, Reihenfolge wie hier. */
const BOTTOM_NAV_TARGETS: ReadonlyArray<{ href: string; label: string }> = [
  { href: "/mitglieder", label: "Start" },
  { href: "/mitglieder/sperrliste", label: "Sperrliste" },
  { href: "/mitglieder/meine-proben", label: "Termine" },
  { href: "/mitglieder/produktionen", label: "Produktion" },
];

const itemClassName =
  "relative flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-md px-1 text-[11px] font-medium leading-tight transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/**
 * Feste Leiste unten auf Handy und Tablet (unter `lg`): die wichtigsten Seiten plus „Menü“,
 * das die vollständige Navigation öffnet. Sichtbarkeit per CSS, damit nichts nachträglich springt.
 */
export function MembersBottomNav(data: MembersNavData) {
  const pathname = usePathname() ?? "";
  const { setOpenMobile, openMobile } = useSidebar();
  const groups = useMembersNavGroups(data);

  const items = useMemo(() => {
    const available = new Map(
      groups
        .flatMap((group) => [
          ...group.items,
          ...(group.subgroups?.flatMap((sub) => sub.items) ?? []),
        ])
        .map((item) => [item.href, item]),
    );
    return BOTTOM_NAV_TARGETS.flatMap((target) => {
      const item = available.get(target.href);
      return item ? [{ ...item, label: target.label }] : [];
    });
  }, [groups]);

  // Ein Eintrag zählt nur als aktiv, wenn kein spezifischerer Eintrag der Leiste passt.
  const activeHref = useMemo(
    () =>
      items
        .filter((item) => isMembersNavItemActive(pathname, item.href))
        .sort((a, b) => b.href.length - a.href.length)[0]?.href,
    [items, pathname],
  );

  return (
    <nav
      aria-label="Schnellnavigation"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur supports-[backdrop-filter]:bg-background/80 lg:hidden"
    >
      <div className="mx-auto flex h-14 max-w-xl items-stretch gap-1 px-2 py-1">
        {items.map((item) => {
          const Icon = item.icon ?? defaultMembersNavIcon;
          const active = item.href === activeHref && !openMobile;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                itemClassName,
                active ? "text-primary" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="size-5 shrink-0" />
              <span className="max-w-full truncate">{item.label}</span>
              <LinkPendingIndicator className="absolute top-1 right-1/4" />
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setOpenMobile(!openMobile)}
          aria-expanded={openMobile}
          className={cn(
            itemClassName,
            openMobile ? "text-primary" : "text-muted-foreground hover:text-foreground",
          )}
        >
          <MenuIcon className="size-5 shrink-0" />
          <span>Menü</span>
        </button>
      </div>
    </nav>
  );
}
