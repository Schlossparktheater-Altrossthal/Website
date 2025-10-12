/**
 * Cell-Komponente für Tabellen-Ansicht
 * Zeigt Status einer Person für einen Tag
 */

import React, { memo } from "react";

import type { OverviewPersonDay } from "./types";

type CellProps = {
  cell: OverviewPersonDay;
  compact?: boolean;
};

/**
 * Cell-Komponente für die Tabellen-Ansicht (memoized für Performance)
 */
const CellComponent = ({ cell, compact = false }: CellProps) => {
  const baseClasses = `flex flex-col justify-center h-16 w-full rounded-lg px-2.5 text-left text-[12px] font-medium overflow-hidden ${
    compact ? "leading-4" : ""
  }`;

  // Frei
  if (cell.type === "free") {
    return (
      <div className="flex h-16 items-center justify-center rounded-lg border border-border/60 bg-muted/30 text-[11px] font-medium text-muted-foreground">
        frei
      </div>
    );
  }

  // Gesperrt/Blockiert
  if (cell.type === "block") {
    return (
      <button
        type="button"
        className={`${baseClasses} bg-destructive/15 text-destructive border border-destructive/50 hover:bg-destructive/20 transition-colors`}
        title={cell.label ?? "Sperrtermin"}
      >
        <span className="block truncate text-[10px] font-semibold uppercase tracking-[0.14em]">Sperrtermin</span>
        {cell.label && (
          <span className="block mt-0.5 text-[11px] opacity-90 truncate" title={cell.label}>
            {cell.label}
          </span>
        )}
      </button>
    );
  }

  // Eingeschränkt
  if (cell.type === "limited") {
    return (
      <button
        type="button"
        className={`${baseClasses} border border-warning/50 bg-warning/15 text-warning hover:bg-warning/20 transition-colors`}
        title={cell.label ?? "Eingeschränkt verfügbar"}
      >
        <span className="block truncate text-[10px] font-semibold uppercase tracking-[0.14em]">Eingeschränkt</span>
        {cell.label && (
          <span className="block mt-0.5 text-[11px] opacity-90 truncate" title={cell.label}>
            {cell.label}
          </span>
        )}
      </button>
    );
  }

  // Bevorzugt
  if (cell.type === "preferred") {
    return (
      <button
        type="button"
        className={`${baseClasses} border border-success/50 bg-success/15 text-success hover:bg-success/20 transition-colors`}
        title={cell.label ?? "Bevorzugter Termin"}
      >
        <span className="block truncate text-[10px] font-semibold uppercase tracking-[0.14em]">Bevorzugt</span>
        {cell.label && (
          <span className="block mt-0.5 text-[11px] opacity-90 truncate" title={cell.label}>
            {cell.label}
          </span>
        )}
      </button>
    );
  }

  return null;
};

// Memoize für Performance-Optimierung
export const Cell = memo(CellComponent);
