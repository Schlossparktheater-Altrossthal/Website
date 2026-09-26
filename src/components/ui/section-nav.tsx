import Link from "next/link";

import type { SectionNavProps } from "@/lib/ui-standards";
import { cn } from "@/lib/utils";

/**
 * Bereichs-Navigation im Referenzmuster der Stück-Seite (docs/design-system.md,
 * Abschnitt "Seiten-Muster"): Pill-Leiste direkt unter dem Seitenkopf, mobil über die
 * volle Breite, aktiver Eintrag hell mit Ring statt gefüllt.
 *
 * Der Zustand steht in der URL, die Einträge sind Links – Deep-Links und der
 * Zurück-Button funktionieren dadurch ohne zusätzlichen State.
 */
export function SectionNav({
  items,
  activeId,
  ariaLabel = "Bereiche",
  className,
}: SectionNavProps) {
  return (
    <nav
      aria-label={ariaLabel}
      className={cn(
        "flex w-full gap-0.5 rounded-lg bg-muted/70 p-0.5 sm:inline-flex sm:w-auto",
        className,
      )}
    >
      {items.map((item) => {
        const isActive = item.id === activeId;
        return (
          <Link
            key={item.id}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            scroll={false}
            className={cn(
              "inline-flex h-10 flex-1 items-center justify-center rounded-md px-4 text-sm font-medium sm:flex-none",
              isActive
                ? "bg-background text-foreground shadow-sm ring-1 ring-border"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
