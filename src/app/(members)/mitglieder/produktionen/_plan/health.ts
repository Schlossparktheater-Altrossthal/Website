import type { MilestoneHealth } from "@/lib/planning/schedule";

/**
 * Eine Farbsprache für Fristen (docs/Plan/projektplanung-plan.md, Grundregel 2):
 * grün im Plan · gelb wenig Puffer · rot überfällig/kritisch · grau erledigt.
 */
export const HEALTH_DOT: Record<MilestoneHealth, string> = {
  ok: "bg-success",
  warning: "bg-warning",
  critical: "bg-destructive",
  overdue: "bg-destructive",
  done: "bg-muted-foreground/50",
  unscheduled: "bg-muted-foreground/30",
};

export const HEALTH_FILL: Record<MilestoneHealth, string> = {
  ok: "fill-success",
  warning: "fill-warning",
  critical: "fill-destructive",
  overdue: "fill-destructive",
  done: "fill-muted-foreground/50",
  unscheduled: "fill-muted-foreground/30",
};

export const HEALTH_BADGE: Record<MilestoneHealth, string> = {
  ok: "border-success/30 bg-success/12 text-success",
  warning: "border-warning/40 bg-warning/15 text-warning",
  critical: "border-destructive/30 bg-destructive/12 text-destructive",
  overdue: "border-destructive/30 bg-destructive/12 text-destructive",
  done: "border-border bg-muted/60 text-muted-foreground",
  unscheduled: "border-border bg-muted/40 text-muted-foreground",
};

export const HEALTH_LABELS: Record<MilestoneHealth, string> = {
  ok: "im Plan",
  warning: "wenig Puffer",
  critical: "kritisch",
  overdue: "überfällig",
  done: "erledigt",
  unscheduled: "ohne Datum",
};

/** Ampel nur aus dem Datum – für Stellen ohne volle Planrechnung (Gewerke, Dashboard). */
export function healthFromDays(days: number | null, done = false): MilestoneHealth {
  if (done) return "done";
  if (days === null) return "unscheduled";
  if (days < 0) return "overdue";
  if (days < 7) return "warning";
  return "ok";
}
