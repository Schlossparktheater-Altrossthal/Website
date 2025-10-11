/**
 * Basis UI-Komponenten für Sperrlistenübersicht
 * Nutzt das Theater-Website Design System
 */

import React from "react";

import { cn } from "@/lib/utils";

// ============================================================================
// Badge
// ============================================================================

type BadgeTone = "info" | "danger" | "ok" | "default";

type BadgeProps = {
  children: React.ReactNode;
  tone?: BadgeTone;
  className?: string;
};

/**
 * Badge-Komponente mit verschiedenen Tones
 */
export function Badge({ children, tone = "default", className = "" }: BadgeProps) {
  const palettes: Record<BadgeTone, string> = {
    info: "border-info/40 bg-info/15 text-info",
    danger: "border-destructive/40 bg-destructive/20 text-destructive",
    ok: "border-success/40 bg-success/15 text-success",
    default: "border-border/60 bg-card/75 text-muted-foreground",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]",
        palettes[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

// ============================================================================
// IconButton
// ============================================================================

type IconButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement>;

/**
 * Runder Icon-Button für Navigation/Actions
 */
export function IconButton({ children, className = "", ...props }: IconButtonProps) {
  return (
    <button
      {...props}
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-full border border-border/60 bg-card/70 text-muted-foreground transition hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        className,
      )}
    >
      {children}
    </button>
  );
}

// ============================================================================
// StatusBadge
// ============================================================================

type StatusBadgeTone = "ok" | "warn" | "danger";

type StatusBadgeProps = {
  icon: React.ReactNode;
  count: number;
  tone: StatusBadgeTone;
  compact?: boolean;
};

/**
 * Status-Badge mit Icon und Count
 */
export function StatusBadge({ icon, count, tone, compact = false }: StatusBadgeProps) {
  const colors: Record<StatusBadgeTone, string> = {
    ok: "border-success/40 bg-success/15 text-success",
    warn: "border-warning/40 bg-warning/15 text-warning",
    danger: "border-destructive/40 bg-destructive/15 text-destructive",
  };

  if (compact) {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-md border px-1 py-0.5 text-[10px] font-semibold",
          colors[tone],
        )}
      >
        <span>{count}</span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex items-center gap-1 rounded-lg border px-1.5 py-0.5 text-[10px] font-semibold shadow-sm",
        colors[tone],
      )}
    >
      {icon}
      <span>{count}</span>
    </div>
  );
}

// ============================================================================
// MiniChip
// ============================================================================

type MiniChipProps = {
  count: number;
  tone: StatusBadgeTone;
};

/**
 * Kompakter Chip für Listen
 */
export function MiniChip({ count, tone }: MiniChipProps) {
  const colorMap: Record<StatusBadgeTone, string> = {
    ok: "border-success/35 bg-success/15 text-success",
    warn: "border-warning/35 bg-warning/15 text-warning",
    danger: "border-destructive/35 bg-destructive/15 text-destructive",
  };

  return (
    <span
      className={cn(
        "inline-flex min-w-5 items-center justify-center rounded-md border px-1 text-[10px] font-medium",
        colorMap[tone],
      )}
    >
      {count}
    </span>
  );
}

// ============================================================================
// Dot (noch kompakter als MiniChip)
// ============================================================================

export function Dot({ count, tone }: MiniChipProps) {
  return <MiniChip count={count} tone={tone} />;
}

// ============================================================================
// Note - Info-Karte
// ============================================================================

type NoteProps = {
  title: string;
  children: React.ReactNode;
  className?: string;
};

/**
 * Note/Info-Karte für wichtige Hinweise
 */
export function Note({ title, children, className = "" }: NoteProps) {
  return (
    <article
      className={cn(
        "rounded-2xl border border-border/60 bg-card/80 p-4 text-sm leading-6 text-card-foreground shadow-sm backdrop-blur",
        className,
      )}
    >
      <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{title}</h3>
      <p className="mt-1 text-sm leading-6 text-foreground/85">{children}</p>
    </article>
  );
}

// ============================================================================
// Kpi - Key Performance Indicator Card
// ============================================================================

type KpiTone = "info" | "danger" | "default";

type KpiProps = {
  icon: React.ReactNode;
  title: string;
  value: string;
  hint?: string;
  tone?: KpiTone;
};

/**
 * KPI-Karte für Metriken
 */
export function Kpi({ icon, title, value, hint, tone = "default" }: KpiProps) {
  const bgMap: Record<KpiTone, string> = {
    danger: "bg-destructive/15 text-destructive",
    info: "bg-info/18 text-info",
    default: "bg-primary/15 text-primary",
  };

  return (
    <article className="flex items-start gap-3 rounded-2xl border border-border/60 bg-card/80 p-4 text-card-foreground shadow-sm backdrop-blur">
      <span className={cn("flex h-11 w-11 items-center justify-center rounded-full", bgMap[tone])}>{icon}</span>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{title}</p>
        <p className="truncate text-lg font-semibold text-foreground sm:text-xl">{value}</p>
        {hint && <p className="text-xs leading-5 text-foreground/80">{hint}</p>}
      </div>
    </article>
  );
}
