/**
 * PersonCard-Komponente für DesktopCalendar
 * Zeigt eine Person mit Status in einer Karte
 */

import React, { memo } from "react";

import type { OverviewPerson, OverviewPersonDay } from "./types";

type PersonCardTone = "ok" | "warn" | "danger";

type PersonCardProps = {
  person: OverviewPerson;
  cell: OverviewPersonDay;
  tone: PersonCardTone;
  compact?: boolean;
};

/**
 * PersonCard für die Kalender-Ansicht (memoized für Performance)
 */
const PersonCardComponent = ({ person, cell, tone, compact = false }: PersonCardProps) => {
  const colors = {
    ok: {
      border: "border-success/40",
      bg: "from-success/10 to-card",
      avatar: "from-success to-success",
      text: "text-success-foreground/90",
      badge: "bg-success",
    },
    warn: {
      border: "border-warning/40",
      bg: "from-warning/10 to-card",
      avatar: "from-warning to-warning",
      text: "text-warning-foreground/90",
      badge: "bg-warning",
    },
    danger: {
      border: "border-destructive/40",
      bg: "from-destructive/10 to-card",
      avatar: "from-destructive to-destructive",
      text: "text-destructive-foreground/90",
      badge: "bg-destructive",
    },
  };

  const style = colors[tone];

  return (
    <li
      className={`group/item flex items-start gap-1.5 rounded-xl border ${style.border} bg-gradient-to-br ${style.bg} px-2 py-1.5 text-[11px] shadow-sm transition-all hover:scale-[1.02] hover:shadow-md`}
    >
      <span
        className={`mt-0.5 inline-flex ${compact ? "h-5 w-5" : "h-6 w-6"} shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${style.avatar} text-[9px] font-bold text-white shadow-sm`}
      >
        {person.initials}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1">
          <p className="truncate font-semibold text-foreground text-[11px]">{person.name}</p>
          {cell.type === "preferred" && !compact && (
            <span
              className={`rounded-full ${style.badge} px-1 py-0.5 text-[8px] font-bold uppercase tracking-wide text-white`}
            >
              Top
            </span>
          )}
        </div>
        {cell.label && !compact && (
          <p className={`mt-0.5 text-[10px] leading-tight ${style.text} line-clamp-2`}>{cell.label}</p>
        )}
        {cell.label && compact && (
          <p className={`text-[9px] ${style.text} truncate`} title={cell.label}>
            {cell.label}
          </p>
        )}
      </div>
    </li>
  );
};

// Memoize für Performance-Optimierung
export const PersonCard = memo(PersonCardComponent);
