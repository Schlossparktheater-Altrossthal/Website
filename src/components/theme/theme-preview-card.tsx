import * as React from "react";

import type { ThemeSwatch, ThemeSwatches } from "@/lib/theme/swatches";
import { cn } from "@/lib/utils";

/**
 * Miniatur einer Seite in den Farben eines Themes. Die Farben stammen aus dem Theme selbst,
 * deshalb hier als Inline-Styles statt semantischer Tokens.
 */
function MiniPage({ swatch, radius }: { swatch: ThemeSwatch; radius: string }) {
  const round = `min(${radius}, 6px)`;
  return (
    <div
      aria-hidden
      className="flex h-full min-w-0 flex-1 gap-1.5 p-2"
      style={{ background: swatch.background }}
    >
      <div className="w-3 shrink-0 space-y-1 rounded-sm p-0.5" style={{ background: swatch.muted }}>
        <div className="h-1 rounded-full" style={{ background: swatch.primary }} />
        <div className="h-1 rounded-full opacity-50" style={{ background: swatch.foreground }} />
      </div>
      <div
        className="flex min-w-0 flex-1 flex-col gap-1 border p-1.5"
        style={{ background: swatch.card, borderColor: swatch.border, borderRadius: round }}
      >
        <div className="h-1.5 w-3/4 rounded-full" style={{ background: swatch.foreground }} />
        <div
          className="h-1 w-1/2 rounded-full opacity-50"
          style={{ background: swatch.foreground }}
        />
        <div className="mt-auto flex gap-1">
          <div className="h-2.5 w-6" style={{ background: swatch.primary, borderRadius: round }} />
          <div
            className="h-2.5 w-4"
            style={{ background: swatch.secondary, borderRadius: round }}
          />
          <div className="h-2.5 w-2.5 rounded-full" style={{ background: swatch.accent }} />
        </div>
      </div>
    </div>
  );
}

/** Hell und dunkel nebeneinander. */
export function ThemeMiniPreview({
  swatches,
  radius,
  className,
}: {
  swatches: ThemeSwatches;
  radius: string;
  className?: string;
}) {
  return (
    <div className={cn("flex h-20 overflow-hidden rounded-md border border-border/60", className)}>
      <MiniPage swatch={swatches.light} radius={radius} />
      <MiniPage swatch={swatches.dark} radius={radius} />
    </div>
  );
}

/** Farbstreifen aus den wichtigsten Farben eines Modus. */
export function ThemeSwatchStrip({
  swatch,
  className,
}: {
  swatch: ThemeSwatch;
  className?: string;
}) {
  const colors = [swatch.primary, swatch.secondary, swatch.accent, swatch.muted, swatch.background];
  return (
    <div aria-hidden className={cn("flex h-2 overflow-hidden rounded-full", className)}>
      {colors.map((color, index) => (
        <span key={index} className="flex-1" style={{ background: color }} />
      ))}
    </div>
  );
}

type ThemePreviewCardProps = {
  name: string;
  description?: string | null;
  swatches: ThemeSwatches;
  radius: string;
  selected?: boolean;
  onSelect?: () => void;
  /** Abzeichen unter dem Namen. */
  badges?: React.ReactNode;
  /** Zusätzliche Bedienelemente (z. B. „⋯“-Menü) rechts neben dem Namen. */
  actions?: React.ReactNode;
  selectLabel?: string;
};

/**
 * Auswählbare Theme-Karte. Die ganze Vorschau ist der Auswahl-Knopf; `actions` liegen
 * außerhalb davon, damit keine Knöpfe ineinander stecken.
 */
export function ThemePreviewCard({
  name,
  description,
  swatches,
  radius,
  selected = false,
  onSelect,
  badges,
  actions,
  selectLabel,
}: ThemePreviewCardProps) {
  return (
    <div
      className={cn(
        "relative flex min-w-0 flex-col gap-2 rounded-lg border bg-card p-2 transition-colors",
        selected
          ? "border-primary ring-2 ring-primary/30"
          : "border-border hover:border-primary/50",
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={onSelect ? selected : undefined}
        aria-label={selectLabel ?? name}
        className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ThemeMiniPreview swatches={swatches} radius={radius} />
      </button>
      <div className="flex min-w-0 items-start gap-1">
        <div className="min-w-0 flex-1 px-1">
          <p className="truncate text-sm font-medium text-foreground">{name}</p>
          {description ? (
            <p className="line-clamp-1 text-xs text-muted-foreground">{description}</p>
          ) : null}
          {badges ? <div className="mt-1 flex flex-wrap gap-1">{badges}</div> : null}
        </div>
        {actions}
      </div>
    </div>
  );
}
