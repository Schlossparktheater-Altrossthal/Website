/**
 * Basis UI-Komponenten für Sperrlistenübersicht
 * Nutzt das Theater-Website Design System
 */

import React from "react";

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
    info: "border-sky-200 bg-sky-100/80 text-sky-700",
    danger: "border-red-200 bg-red-100/80 text-red-700",
    ok: "border-green-200 bg-green-100/80 text-green-700",
    default: "border-slate-200 bg-white/80 text-slate-600",
  };

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${palettes[tone]} ${className}`}
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
      className={`inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-500 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 ${className}`}
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
    ok: "bg-green-100 text-green-700 border-green-300",
    warn: "bg-orange-100 text-orange-700 border-orange-300",
    danger: "bg-red-100 text-red-700 border-red-300",
  };

  if (compact) {
    return (
      <div className={`flex items-center justify-center rounded-md border px-1 py-0.5 text-[10px] font-bold ${colors[tone]}`}>
        <span>{count}</span>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-1 rounded-lg border px-1.5 py-0.5 text-[10px] font-bold shadow-sm ${colors[tone]}`}>
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
    ok: "bg-green-100/80 text-green-700 border-green-200",
    warn: "bg-orange-100/80 text-orange-700 border-orange-200",
    danger: "bg-red-100/80 text-red-700 border-red-200",
  };

  return (
    <span className={`inline-flex min-w-5 items-center justify-center rounded-md border px-1 text-[10px] ${colorMap[tone]}`}>
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
    <article className={`rounded-2xl border border-slate-200/70 bg-white/80 p-4 shadow-sm ${className}`}>
      <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{title}</h3>
      <p className="mt-1 text-sm leading-6 text-slate-700">{children}</p>
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
    danger: "bg-red-100/80 text-red-700",
    info: "bg-sky-100/80 text-sky-700",
    default: "bg-blue-100/80 text-blue-700",
  };

  return (
    <article className="flex items-start gap-3 rounded-2xl border border-slate-200/70 bg-white/80 p-4 shadow-sm">
      <span className={`flex h-11 w-11 items-center justify-center rounded-full ${bgMap[tone]}`}>{icon}</span>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{title}</p>
        <p className="truncate text-lg font-semibold sm:text-xl">{value}</p>
        {hint && <p className="text-xs leading-5 text-slate-600">{hint}</p>}
      </div>
    </article>
  );
}
