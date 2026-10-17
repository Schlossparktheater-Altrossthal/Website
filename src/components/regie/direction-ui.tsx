import Link from "next/link";
import type * as React from "react";

import { PageHeader } from "@/components/members/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { directionHref, directionPdfHref } from "@/lib/regie/page";

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
}: {
  title: string;
  description?: string;
  showId: string;
  pdfKind?: string;
}) {
  return (
    <div className="space-y-3">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href={directionHref(null, showId)}>← Regie-Übersicht</Link>
      </Button>
      <PageHeader
        title={title}
        description={description}
        actions={
          pdfKind ? (
            <Button asChild variant="outline">
              <a href={directionPdfHref(pdfKind, showId)} target="_blank" rel="noopener">
                PDF
              </a>
            </Button>
          ) : undefined
        }
      />
    </div>
  );
}

export function DirectionEmpty({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed border-border/70 p-6 text-center text-sm text-muted-foreground">
      {children}
    </p>
  );
}
