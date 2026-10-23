"use client";

import * as React from "react";

import { Badge } from "@/components/ui/badge";
import type { ThemeColorScheme, TweakcnTheme } from "@/lib/theme/tweakcn";
import { cn } from "@/lib/utils";

/**
 * Setzt die Theme-Variablen nur für diesen Teilbaum. Tailwind bindet die Farben über
 * `@theme inline` direkt an `var(--…)`, deshalb greifen die normalen Utility-Klassen.
 */
function toScopedStyle(theme: TweakcnTheme, scheme: ThemeColorScheme): React.CSSProperties {
  const style: Record<string, string> = { colorScheme: scheme };
  for (const [name, value] of Object.entries({ ...theme.theme, ...theme[scheme] })) {
    style[`--${name}`] = value;
  }
  return style as React.CSSProperties;
}

const CHART_BARS = [
  "h-10 bg-chart-1",
  "h-14 bg-chart-2",
  "h-8 bg-chart-3",
  "h-12 bg-chart-4",
  "h-6 bg-chart-5",
];

/** Kleine Musterseite mit den wichtigsten Bausteinen in den Farben des Entwurfs. */
export function ThemeLivePreview({
  theme,
  scheme,
  className,
}: {
  theme: TweakcnTheme;
  scheme: ThemeColorScheme;
  className?: string;
}) {
  return (
    <div
      style={toScopedStyle(theme, scheme)}
      className={cn(
        "overflow-hidden rounded-lg border border-border bg-background font-sans text-foreground",
        className,
      )}
      aria-label={`Vorschau ${scheme === "dark" ? "dunkel" : "hell"}`}
      role="img"
    >
      <div className="flex">
        <div className="hidden w-24 shrink-0 space-y-1 border-r border-sidebar-border bg-sidebar p-2 text-[11px] text-sidebar-foreground sm:block">
          <div className="rounded-sm bg-sidebar-primary px-2 py-1 font-medium text-sidebar-primary-foreground">
            Dashboard
          </div>
          <div className="rounded-sm bg-sidebar-accent px-2 py-1 text-sidebar-accent-foreground">
            Termine
          </div>
          <div className="px-2 py-1">Profil</div>
        </div>
        <div className="min-w-0 flex-1 space-y-2 p-3">
          <div className="space-y-2 rounded-lg border border-border bg-card p-3 text-card-foreground shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">Probe Akt 2</p>
                <p className="truncate text-xs text-muted-foreground">Sa, 19:00 · Schlosspark</p>
              </div>
              <Badge variant="success" size="sm">
                Zugesagt
              </Badge>
            </div>
            <div className="h-8 rounded-md border border-input bg-background px-2 text-xs leading-8 text-muted-foreground">
              Notiz eingeben…
            </div>
            <div className="flex flex-wrap gap-1.5">
              <span className="rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground">
                Speichern
              </span>
              <span className="rounded-md bg-secondary px-2.5 py-1 text-xs text-secondary-foreground">
                Später
              </span>
              <span className="rounded-md border border-border px-2.5 py-1 text-xs">Abbrechen</span>
              <span className="rounded-md bg-destructive px-2.5 py-1 text-xs text-destructive-foreground">
                Löschen
              </span>
            </div>
          </div>
          <div className="flex items-end gap-2 rounded-lg bg-muted p-2">
            <div className="flex flex-1 items-end gap-1">
              {CHART_BARS.map((bar) => (
                <span key={bar} className={cn("flex-1 rounded-sm", bar)} />
              ))}
            </div>
            <div className="flex flex-col gap-1">
              <Badge variant="warning" size="sm">
                Offen
              </Badge>
              <Badge variant="info" size="sm">
                Info
              </Badge>
            </div>
          </div>
          <p className="rounded-md bg-accent px-2 py-1 text-xs text-accent-foreground">
            Akzent: Hinweis für alle
          </p>
        </div>
      </div>
    </div>
  );
}
