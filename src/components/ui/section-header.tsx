import * as React from "react";

import { cn } from "@/lib/utils";

type SectionHeaderProps = {
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Link oder Button rechts neben dem Titel, z. B. „Alle anzeigen“. */
  action?: React.ReactNode;
  /** Überschriftenebene; Standard `h2`. */
  as?: "h2" | "h3" | "h4";
  size?: "sm" | "md";
  className?: string;
};

/** Titelzeile für Bereiche und Karten: Titel links, Aktion rechts, ohne Trennlinie. */
export function SectionHeader({
  title,
  description,
  action,
  as: Heading = "h2",
  size = "md",
  className,
}: SectionHeaderProps) {
  return (
    <div className={cn("flex items-start justify-between gap-3", className)}>
      <div className="min-w-0 space-y-0.5">
        <Heading
          className={cn(
            "font-semibold leading-tight tracking-tight text-foreground",
            size === "sm" ? "text-sm" : "text-base",
          )}
        >
          {title}
        </Heading>
        {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
      </div>
      {action ? <div className="flex shrink-0 items-center gap-1">{action}</div> : null}
    </div>
  );
}
