import * as React from "react";

import { cn } from "@/lib/utils";

/** Verfügbarkeit eines Mitglieds an einem Tag (Sperrliste, Probenplanung). */
export type AvailabilityStatus = "free" | "preferred" | "limited" | "blocked";

type StatusStyle = {
  label: string;
  /** Kurzform für enge Stellen (Tabellenköpfe, Chips). */
  short: string;
  dot: string;
  /** Getönte Fläche für Zellen und Chips. */
  surface: string;
  text: string;
};

/** Zentrale Farbzuordnung – überall gleich: frei neutral, bevorzugt grün, eingeschränkt gelb, gesperrt rot. */
export const AVAILABILITY_STATUS: Record<AvailabilityStatus, StatusStyle> = {
  free: {
    label: "Frei",
    short: "frei",
    dot: "bg-muted-foreground/35",
    surface: "bg-transparent",
    text: "text-muted-foreground",
  },
  preferred: {
    label: "Bevorzugt",
    short: "bevorzugt",
    dot: "bg-success",
    surface: "bg-success/15",
    text: "text-success",
  },
  limited: {
    label: "Eingeschränkt",
    short: "eingeschränkt",
    dot: "bg-warning",
    surface: "bg-warning/20",
    text: "text-warning",
  },
  blocked: {
    label: "Gesperrt",
    short: "gesperrt",
    dot: "bg-destructive",
    surface: "bg-destructive/15",
    text: "text-destructive",
  },
};

export const AVAILABILITY_STATUS_ORDER: AvailabilityStatus[] = [
  "free",
  "preferred",
  "limited",
  "blocked",
];

export function StatusDot({
  status,
  className,
}: {
  status: AvailabilityStatus;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-block h-2 w-2 shrink-0 rounded-full",
        AVAILABILITY_STATUS[status].dot,
        className,
      )}
    />
  );
}

export function StatusBadge({
  status,
  className,
  children,
}: {
  status: AvailabilityStatus;
  className?: string;
  children?: React.ReactNode;
}) {
  const style = AVAILABILITY_STATUS[status];
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
        status === "free" ? "bg-muted/70 text-muted-foreground" : [style.surface, style.text],
        className,
      )}
    >
      <StatusDot status={status} />
      <span className="truncate">{children ?? style.label}</span>
    </span>
  );
}

/** Kompakte Legende, z. B. unter Kalendern. */
export function StatusLegend({
  statuses = AVAILABILITY_STATUS_ORDER,
  extra,
  className,
}: {
  statuses?: AvailabilityStatus[];
  extra?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground",
        className,
      )}
    >
      {statuses.map((status) => (
        <span key={status} className="inline-flex items-center gap-1.5">
          <StatusDot status={status} />
          {AVAILABILITY_STATUS[status].label}
        </span>
      ))}
      {extra}
    </div>
  );
}
