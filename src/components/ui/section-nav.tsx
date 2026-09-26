import Link from "next/link";

import { SectionNavSelect } from "@/components/ui/section-nav-select";
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
  // Mehr als drei Einträge passen mobil nicht in eine Zeile – dort übernimmt der Select.
  const withSelect = items.length > 3;

  return (
    <div className={cn("w-full", className)}>
      {withSelect ? (
        <SectionNavSelect
          className="sm:hidden"
          items={items}
          activeId={activeId}
          ariaLabel={ariaLabel}
        />
      ) : null}
      <nav
        aria-label={ariaLabel}
        className={cn(
          "gap-0.5 rounded-lg bg-muted/70 p-0.5",
          withSelect ? "hidden sm:flex sm:w-auto" : "flex w-full sm:inline-flex sm:w-auto",
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
    </div>
  );
}
