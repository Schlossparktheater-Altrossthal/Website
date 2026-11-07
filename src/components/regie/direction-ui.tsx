import Link from "next/link";
import type * as React from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { directionHref, directionPdfHref } from "@/lib/regie/page";
import { cn } from "@/lib/utils";

/** Karte im Regie-Dashboard: Zusammenfassung + „Ansehen“ und „PDF“. */
export function DirectionCard({
  title,
  summary,
  isNew,
  viewHref,
  pdfHref,
  children,
  className,
  actions,
}: {
  title: string;
  summary: React.ReactNode;
  isNew?: boolean;
  viewHref?: string | null;
  pdfHref?: string | null;
  children?: React.ReactNode;
  className?: string;
  actions?: React.ReactNode;
}) {
  return (
    <Card variant="plain" size="flush" className={className}>
      <section className="flex h-full flex-col gap-3 p-4">
        <header className="flex items-start justify-between gap-2">
          <h2 className="text-base font-semibold leading-tight">{title}</h2>
          {isNew ? (
            <span className="shrink-0 rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary">
              neu
            </span>
          ) : null}
        </header>
        <div className="text-sm text-muted-foreground">{summary}</div>
        {children ? <div className="min-w-0">{children}</div> : null}
        <div className="mt-auto flex gap-2 pt-1">
          {actions}
          {viewHref ? (
            <Button asChild size="lg" variant="outline" className="flex-1">
              <Link href={viewHref}>Ansehen</Link>
            </Button>
          ) : null}
          {pdfHref ? (
            <Button asChild size="lg" variant="outline" className="flex-1">
              <a href={pdfHref} target="_blank" rel="noopener">
                PDF
              </a>
            </Button>
          ) : null}
        </div>
      </section>
    </Card>
  );
}

/** Kopf einer Lese-Ansicht: zurück zum Dashboard, Titel, PDF. */
export function DirectionViewHeader({
  title,
  description,
  showId,
  pdfKind,
  pdfAction,
}: {
  title: string;
  description?: string;
  showId: string;
  pdfKind?: string;
  /** Eigener PDF-Knopf (z. B. mit Auswahlfenster) statt des direkten Links. */
  pdfAction?: React.ReactNode;
}) {
  const action =
    pdfAction ??
    (pdfKind ? (
      <Button asChild variant="outline">
        <a href={directionPdfHref(pdfKind, showId)} target="_blank" rel="noopener">
          PDF
        </a>
      </Button>
    ) : null);
  return (
    <header className="space-y-2">
      <Link
        href={directionHref(null, showId)}
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        ← Regie-Übersicht
      </Link>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold leading-tight">{title}</h1>
          {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </header>
  );
}

/** Filter als Link-Chips (Server-Komponenten, Zustand in der URL). */
export function DirectionChips({
  items,
}: {
  items: { href: string; label: string; active: boolean; count?: number }[];
}) {
  return (
    <nav className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          scroll={false}
          aria-current={item.active ? "true" : undefined}
          className={cn(
            "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm whitespace-nowrap transition-colors",
            item.active
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-card hover:bg-muted",
          )}
        >
          {item.label}
          {item.count !== undefined ? (
            <span
              className={cn("tabular-nums", item.active ? "opacity-80" : "text-muted-foreground")}
            >
              {item.count}
            </span>
          ) : null}
        </Link>
      ))}
    </nav>
  );
}

/** Kleine Zwischenüberschrift (Woche, Akt …). */
export function DirectionGroupHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="pt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
    </h2>
  );
}

export function DirectionEmpty({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed border-border/70 p-6 text-center text-sm text-muted-foreground">
      {children}
    </p>
  );
}
