/**
 * TimelineCell-Komponente für Timeline-Ansicht
 * Zeigt Status mit Icons und Tooltips
 */

import React, { useState } from "react";

import { CheckIcon, ClockAlertIcon, StarIcon, XCircleIcon } from "./icons";
import type { OverviewPersonDay } from "./types";

type TimelineCellProps = {
  cell: OverviewPersonDay;
};

/**
 * TimelineCell für die Timeline-Ansicht
 */
export function TimelineCell({ cell }: TimelineCellProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  // Frei
  if (cell.type === "free") {
    return (
      <div className="group relative flex h-10 items-center justify-center">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-border/60 bg-muted/30 text-muted-foreground transition-all group-hover:border-border group-hover:bg-muted/50">
          <CheckIcon />
        </div>
        <span className="pointer-events-none absolute -top-8 left-1/2 z-30 -translate-x-1/2 whitespace-nowrap rounded-lg bg-popover px-2 py-1 text-xs text-popover-foreground opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
          Frei verfügbar
        </span>
      </div>
    );
  }

  // Gesperrt/Blockiert
  if (cell.type === "block") {
    return (
      <div
        className="group relative flex h-10 items-center justify-center"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-destructive/40 bg-gradient-to-br from-destructive/15 to-destructive/25 shadow-sm transition-all group-hover:shadow-md">
          <XCircleIcon className="h-5 w-5 text-destructive-foreground" />
        </div>
        {cell.label && showTooltip && (
          <div className="absolute -top-2 left-1/2 z-30 w-48 -translate-x-1/2 -translate-y-full rounded-lg border border-destructive/40 bg-card p-2 shadow-xl">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-destructive-foreground">Sperrtermin</p>
            <p className="mt-0.5 text-xs leading-snug text-card-foreground">{cell.label}</p>
          </div>
        )}
      </div>
    );
  }

  // Eingeschränkt
  if (cell.type === "limited") {
    return (
      <div
        className="group relative flex h-10 items-center justify-center"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-warning/40 bg-gradient-to-br from-warning/15 to-warning/25 shadow-sm transition-all group-hover:shadow-md">
          <ClockAlertIcon className="h-5 w-5 text-warning-foreground" />
        </div>
        {cell.label && showTooltip && (
          <div className="absolute -top-2 left-1/2 z-30 w-48 -translate-x-1/2 -translate-y-full rounded-lg border border-warning/40 bg-card p-2 shadow-xl">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-warning-foreground">Eingeschränkt</p>
            <p className="mt-0.5 text-xs leading-snug text-card-foreground">{cell.label}</p>
          </div>
        )}
      </div>
    );
  }

  // Bevorzugt
  if (cell.type === "preferred") {
    return (
      <div
        className="group relative flex h-10 items-center justify-center"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-success/40 bg-gradient-to-br from-success/15 to-success/25 shadow-sm transition-all group-hover:shadow-md">
          <StarIcon className="h-5 w-5 text-success-foreground" />
        </div>
        {cell.label && showTooltip && (
          <div className="absolute -top-2 left-1/2 z-30 w-48 -translate-x-1/2 -translate-y-full rounded-lg border border-success/40 bg-card p-2 shadow-xl">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-success-foreground">Bevorzugt</p>
            <p className="mt-0.5 text-xs leading-snug text-card-foreground">{cell.label}</p>
          </div>
        )}
      </div>
    );
  }

  return null;
}
