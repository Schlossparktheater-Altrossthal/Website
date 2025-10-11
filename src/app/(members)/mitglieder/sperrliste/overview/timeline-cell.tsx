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
        <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-slate-50/50 text-slate-400 transition-all group-hover:border-slate-300 group-hover:bg-slate-100">
          <CheckIcon />
        </div>
        <span className="pointer-events-none absolute -top-8 left-1/2 z-30 -translate-x-1/2 whitespace-nowrap rounded-lg bg-slate-900 px-2 py-1 text-xs text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
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
        <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-red-200 bg-gradient-to-br from-red-50 to-red-100/50 shadow-sm transition-all group-hover:shadow-md">
          <XCircleIcon className="h-5 w-5 text-red-600" />
        </div>
        {cell.label && showTooltip && (
          <div className="absolute -top-2 left-1/2 z-30 w-48 -translate-x-1/2 -translate-y-full rounded-lg border border-red-200 bg-white p-2 shadow-xl">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-red-700">Sperrtermin</p>
            <p className="mt-0.5 text-xs leading-snug text-slate-700">{cell.label}</p>
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
        <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-orange-200 bg-gradient-to-br from-orange-50 to-orange-100/50 shadow-sm transition-all group-hover:shadow-md">
          <ClockAlertIcon className="h-5 w-5 text-orange-600" />
        </div>
        {cell.label && showTooltip && (
          <div className="absolute -top-2 left-1/2 z-30 w-48 -translate-x-1/2 -translate-y-full rounded-lg border border-orange-200 bg-white p-2 shadow-xl">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-orange-700">Eingeschränkt</p>
            <p className="mt-0.5 text-xs leading-snug text-slate-700">{cell.label}</p>
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
        <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-green-200 bg-gradient-to-br from-green-50 to-green-100/50 shadow-sm transition-all group-hover:shadow-md">
          <StarIcon className="h-5 w-5 text-green-600" />
        </div>
        {cell.label && showTooltip && (
          <div className="absolute -top-2 left-1/2 z-30 w-48 -translate-x-1/2 -translate-y-full rounded-lg border border-green-200 bg-white p-2 shadow-xl">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-green-700">Bevorzugt</p>
            <p className="mt-0.5 text-xs leading-snug text-slate-700">{cell.label}</p>
          </div>
        )}
      </div>
    );
  }

  return null;
}
