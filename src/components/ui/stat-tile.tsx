import * as React from "react";
import Link from "next/link";

import { cn } from "@/lib/utils";

export type StatTileTone = "neutral" | "primary" | "success" | "warning" | "destructive";

const VALUE_TONE: Record<StatTileTone, string> = {
  neutral: "text-foreground",
  primary: "text-primary",
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
    "flex min-w-0 flex-col gap-1 rounded-lg border border-border/60 bg-card p-3 shadow-sm",
    href &&
      "transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
    className,
  );
  const content = (
    <>
      <span className="flex items-center justify-between gap-2 text-xs font-medium text-muted-foreground">
        <span className="truncate">{label}</span>
        {icon ? (
          <span className="shrink-0 [&>svg]:h-4 [&>svg]:w-4" aria-hidden>
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
