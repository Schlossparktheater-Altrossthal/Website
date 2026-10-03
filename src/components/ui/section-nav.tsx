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
  variant = "pills",
}: SectionNavProps) {
  const underline = variant === "underline";
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
          // Unterstrich-Reiter für Hauptbereiche, damit darunter liegende Pill-Leisten
          // (Unterbereiche) sich klar davon abheben.
          underline
            ? "min-w-0 gap-1 border-b border-border sm:!flex sm:w-full"
            : "min-w-0 gap-0.5 rounded-lg bg-muted/70 p-0.5",
          // inline-flex statt flex: sonst zieht sich die Leiste über die volle Breite
          // und die Pills wirken gestreckt (Stück-Muster ist kompakt).
          // `flex-wrap`: Ein langer Eintrag darf die Leiste umbrechen, nicht die Seite aufreißen.
          withSelect
            ? "hidden sm:inline-flex sm:w-auto"
            : "flex w-full flex-wrap sm:inline-flex sm:w-auto",
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
                "inline-flex h-10 min-w-0 flex-1 items-center justify-center px-4 text-sm font-medium sm:flex-none",
                underline
                  ? cn(
                      "-mb-px border-b-2",
                      isActive
                        ? "border-primary text-foreground"
                        : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
                    )
                  : cn(
                      "rounded-md",
                      isActive
                        ? "bg-background text-foreground shadow-sm ring-1 ring-border"
                        : "text-muted-foreground hover:text-foreground",
                    ),
              )}
            >
              {/* `truncate` statt Umbruch: Ein gekürzter Eintrag bleibt lesbar, ein
                  umgebrochener sprengt die 40 px hohe Pill. */}
              <span className="min-w-0 truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
