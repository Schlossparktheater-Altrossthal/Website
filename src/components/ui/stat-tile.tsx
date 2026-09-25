import * as React from "react";
import Link from "next/link";

import { cn } from "@/lib/utils";

export type StatTileTone = "neutral" | "primary" | "info" | "success" | "warning" | "destructive";

const VALUE_TONE: Record<StatTileTone, string> = {
  neutral: "text-foreground",
  primary: "text-primary",
  info: "text-info",
  success: "text-success",
  warning: "text-warning",
  destructive: "text-destructive",
};

type StatTileProps = {
  label: string;
  value: React.ReactNode;
  /** Kurze Zusatzinfo unter dem Wert (eine Zeile). */
  hint?: React.ReactNode;
  icon?: React.ReactNode;
  tone?: StatTileTone;
  href?: string;
  className?: string;
};

// Getönte Icon-Kachel und Rand je Ton, damit Kennzahlen auf einen Blick unterscheidbar sind.
const ICON_TONE: Record<StatTileTone, string> = {
  neutral: "border-border/60 bg-muted/60 text-muted-foreground",
  primary: "border-primary/30 bg-primary/12 text-primary",
  info: "border-info/30 bg-info/12 text-info",
  success: "border-success/30 bg-success/15 text-success",
  warning: "border-warning/30 bg-warning/20 text-warning",
  destructive: "border-destructive/30 bg-destructive/12 text-destructive",
};

const SURFACE_TONE: Record<StatTileTone, string> = {
  neutral: "border-border/60 bg-card",
  primary: "border-primary/20 bg-gradient-to-br from-primary/10 via-card to-card",
  info: "border-info/20 bg-gradient-to-br from-info/10 via-card to-card",
  success: "border-success/20 bg-gradient-to-br from-success/10 via-card to-card",
  warning: "border-warning/30 bg-gradient-to-br from-warning/15 via-card to-card",
  destructive: "border-destructive/30 bg-gradient-to-br from-destructive/12 via-card to-card",
};

/** Kompakte Kennzahl: Label oben, großer Wert, optional eine Hinweiszeile. */
export function StatTile({
  label,
  value,
  hint,
  icon,
  tone = "neutral",
  href,
  className,
}: StatTileProps) {
  const classes = cn(
    "flex min-w-0 flex-col gap-1.5 rounded-lg border p-3 shadow-sm",
    SURFACE_TONE[tone],
    href &&
      "transition-colors hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
    className,
  );
  const content = (
    <>
      <span className="flex items-center justify-between gap-2 text-xs font-medium text-muted-foreground">
        <span className="truncate">{label}</span>
        {icon ? (
          <span
            className={cn(
              "flex h-7 w-7 shrink-0 items-center justify-center rounded-md border [&>svg]:h-4 [&>svg]:w-4",
              ICON_TONE[tone],
            )}
            aria-hidden
          >
            {icon}
          </span>
        ) : null}
      </span>
      <span
        className={cn(
          "text-2xl font-semibold leading-none tracking-tight tabular-nums",
          VALUE_TONE[tone],
        )}
      >
        {value}
      </span>
      {hint ? <span className="truncate text-xs text-muted-foreground">{hint}</span> : null}
    </>
  );
  return href ? (
    <Link href={href} className={classes}>
      {content}
    </Link>
  ) : (
    <div className={classes}>{content}</div>
  );
}
